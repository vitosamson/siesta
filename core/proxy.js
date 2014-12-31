/**
 * Base functionality for relationships.
 * @module relationships
 */

var InternalSiestaError = require('./error').InternalSiestaError,
    Store = require('./store'),
    Operation = require('./operation/operation').Operation,
    util = require('./util'),
    _ = util._,
    Fault = require('./Fault'),
    Query = require('./query'),
    log = require('./operation/log'),
    notifications = require('./notifications'),
    wrapArrayForAttributes = notifications.wrapArray,
    ArrayObserver = require('../vendor/observe-js/src/observe').ArrayObserver,
    coreChanges = require('./changes'),
    ChangeType = coreChanges.ChangeType;

/**
 * @class  [RelationshipProxy description]
 * @param {Object} opts
 * @constructor
 */
function RelationshipProxy(opts) {
    var self = this;
    opts = opts || {};

    _.extend(this, {
        fault: new Fault(this),
        object: null,
        _id: undefined,
        related: null
    });

    Object.defineProperties(this, {
        isFault: {
            get: function () {
                if (self._id) {
                    return !self.related;
                } else if (self._id === null) {
                    return false;
                }
                return true;
            },
            set: function (v) {
                if (v) {
                    self._id = undefined;
                    self.related = null;
                } else {
                    if (!self._id) {
                        self._id = null;
                    }
                }
            },
            enumerable: true,
            configurable: true
        },
        isForward: {
            get: function () {
                return !self.isReverse;
            },
            set: function (v) {
                self.isReverse = !v;
            },
            enumerable: true
        }
    });

    util.extendFromOpts(this, opts, {
        reverseModel: null,
        forwardModel: null,
        forwardName: null,
        reverseName: null,
        isReverse: null
    });

}

_.extend(RelationshipProxy.prototype, {
    /**
     * Install this proxy on the given instance
     * @param {ModelInstance} modelInstance
     */
    install: function (modelInstance) {
        if (modelInstance) {
            if (!this.object) {
                this.object = modelInstance;
                var self = this;
                var name = getForwardName.call(this);
                Object.defineProperty(modelInstance, name, {
                    get: function () {
                        if (self.isFault) {
                            return self.fault;
                        } else {
                            return self.related;
                        }
                    },
                    set: function (v) {
                        self.set(v);
                    },
                    configurable: true,
                    enumerable: true
                });
                if (!modelInstance.__proxies) modelInstance.__proxies = {};
                modelInstance.__proxies[name] = this;
                if (!modelInstance._proxies) {
                    modelInstance._proxies = [];
                }
                modelInstance._proxies.push(this);
            } else {
                throw new InternalSiestaError('Already installed.');
            }
        } else {
            throw new InternalSiestaError('No object passed to relationship install');
        }
    }

});

//noinspection JSUnusedLocalSymbols
_.extend(RelationshipProxy.prototype, {
    set: function (obj, opts) {
        throw new InternalSiestaError('Must subclass RelationshipProxy');
    },
    get: function (callback) {
        throw new InternalSiestaError('Must subclass RelationshipProxy');
    }
});


function proxyForInstance(modelInstance, reverse) {
    var name = reverse ? getReverseName.call(this) : getForwardName.call(this),
        model = reverse ? this.reverseModel : this.forwardModel;
    var ret;
    // This should never happen. Should g   et caught in the mapping operation?
    if (util.isArray(modelInstance)) {
        ret = _.map(modelInstance, function (o) {
            return o.__proxies[name];
        });
    } else {
        var proxy = modelInstance.__proxies[name];
        if (!proxy) {
            var err = 'No proxy with name "' + name + '" on mapping ' + model.name;
            throw new InternalSiestaError(err);
        }
        ret = proxy;
    }
    return ret;
}
function reverseProxyForInstance(modelInstance) {
    return proxyForInstance.call(this, modelInstance, true);
}

function forwardProxyForInstance(modelInstance) {
    return proxyForInstance.call(this, modelInstance, false);
}

function getReverseName() {
    return this.isForward ? this.reverseName : this.forwardName;
}

function getForwardName() {
    return this.isForward ? this.forwardName : this.reverseName;
}

function getReverseModel() {
    return this.isForward ? this.reverseModel : this.forwardModel;
}

function getForwardModel() {
    return this.isForward ? this.forwardModel : this.reverseModel;
}

function checkInstalled() {
    if (!this.object) {
        throw new InternalSiestaError('Proxy must be installed on an object before can use it.');
    }
}

/**
 * Configure _id and related with the new related object.
 * @param obj
 * @param {object} [opts]
 * @param {boolean} [opts.disableNotifications]
 * @returns {String|undefined} - Error message or undefined
 */
function set(obj, opts) {
    opts = opts || {};
    if (!opts.disableNotifications) {
        registerSetChange.call(this, obj);
    }
    if (obj) {
        if (util.isArray(obj)) {
            this._id = _.pluck(obj, '_id');
            this.related = obj;
        } else {
            this._id = obj._id;
            this.related = obj;
        }
    } else {
        this._id = null;
        this.related = null;
    }
}

function spliceFactory(opts) {
    opts = opts || {};
    return function (idx, numRemove) {
        opts = opts || {};
        if (!opts.disableNotifications) {
            registerSpliceChange.apply(this, arguments);
        }
        var add = Array.prototype.slice.call(arguments, 2);
        var returnValue = _.partial(this._id.splice, idx, numRemove).apply(this._id, _.pluck(add, '_id'));
        if (this.related) {
            _.partial(this.related.splice, idx, numRemove).apply(this.related, add);
        }
        return returnValue;
    }
}

var splice = spliceFactory({});

function objAsString(obj) {
    function _objAsString(obj) {
        if (obj) {
            var model = obj.model;
            var modelName = model.name;
            var ident = obj._id;
            if (typeof ident == 'string') {
                ident = '"' + ident + '"';
            }
            return modelName + '[_id=' + ident + ']';
        } else if (obj === undefined) {
            return 'undefined';
        } else if (obj === null) {
            return 'null';
        }
    }

    if (util.isArray(obj)) return _.map(_objAsString, obj).join(', ');
    return _objAsString(obj);
}

function clearReverseRelated(opts) {
    opts = opts || {};
    var self = this;
    if (!self.isFault) {
        if (this.related) {
            var reverseProxy = reverseProxyForInstance.call(this, this.related);
            var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
            _.each(reverseProxies, function (p) {
                if (util.isArray(p._id)) {
                    var idx = p._id.indexOf(self.object._id);
                    makeChangesToRelatedWithoutObservations.call(p, function () {
                        spliceFactory(opts).call(p, idx, 1);
                    });
                } else {
                    set.call(p, null, opts);
                }
            });
        }
    } else {
        if (self._id) {
            var reverseName = getReverseName.call(this);
            var reverseModel = getReverseModel.call(this);
            var identifiers = util.isArray(self._id) ? self._id : [self._id];
            if (this._reverseIsArray) {
                if (!opts.disableNotifications) {
                    _.each(identifiers, function (_id) {
                        coreChanges.registerChange({
                            collection: reverseModel.collectionName,
                            model: reverseModel.name,
                            _id: _id,
                            field: reverseName,
                            removedId: [self.object._id],
                            removed: [self.object],
                            type: ChangeType.Delete,
                            obj: self.object
                        });
                    });
                }
            } else {
                if (!opts.disableNotifications) {
                    _.each(identifiers, function (_id) {
                        coreChanges.registerChange({
                            collection: reverseModel.collectionName,
                            model: reverseModel.name,
                            _id: _id,
                            field: reverseName,
                            new: null,
                            newId: null,
                            oldId: self.object._id,
                            old: self.object,
                            type: ChangeType.Set,
                            obj: self.object
                        });
                    });
                }
            }

        } else {
            throw new Error(getForwardName.call(this) + ' has no _id');
        }
    }
}

function makeChangesToRelatedWithoutObservations(f) {
    if (this.related) {
        this.related.oneToManyObserver.close();
        this.related.oneToManyObserver = null;
        f();
        wrapArray.call(this, this.related);
    } else {
        // If there's a fault we can make changes anyway.
        f();
    }
}

function setReverse(obj, opts) {
    var self = this;
    var reverseProxy = reverseProxyForInstance.call(this, obj);
    var reverseProxies = util.isArray(reverseProxy) ? reverseProxy : [reverseProxy];
    _.each(reverseProxies, function (p) {
        if (util.isArray(p._id)) {
            makeChangesToRelatedWithoutObservations.call(p, function () {
                spliceFactory(opts).call(p, p._id.length, 0, self.object);
            });
        } else {
            clearReverseRelated.call(p, opts);
            set.call(p, self.object, opts);
        }
    });
}

function registerSetChange(obj) {
    var proxyObject = this.object;
    if (!proxyObject) throw new InternalSiestaError('Proxy must have an object associated');
    var model = proxyObject.model.name;
    var collectionName = proxyObject.collectionName;
    var newId;
    if (util.isArray(obj)) {
        newId = _.pluck(obj, '_id');
    } else {
        newId = obj ? obj._id : obj;
    }
    // We take [] == null == undefined in the case of relationships.
    var oldId = this._id;
    if (util.isArray(oldId) && !oldId.length) {
        oldId = null;
    }
    var old = this.related;
    if (util.isArray(old) && !old.length) {
        old = null;
    }
    coreChanges.registerChange({
        collection: collectionName,
        model: model,
        _id: proxyObject._id,
        field: getForwardName.call(this),
        newId: newId,
        oldId: oldId,
        old: old,
        new: obj,
        type: ChangeType.Set,
        obj: proxyObject
    });
}

function registerSpliceChange(idx, numRemove) {
    var add = Array.prototype.slice.call(arguments, 2);
    var model = this.object.model.name;
    var coll = this.object.collectionName;
    coreChanges.registerChange({
        collection: coll,
        model: model,
        _id: this.object._id,
        field: getForwardName.call(this),
        index: idx,
        removedId: this._id.slice(idx, idx + numRemove),
        removed: this.related ? this.related.slice(idx, idx + numRemove) : null,
        addedId: add.length ? _.pluck(add, '_id') : [],
        added: add.length ? add : [],
        type: ChangeType.Splice,
        obj: this.object
    });
}


function wrapArray(arr) {
    var self = this;
    wrapArrayForAttributes(arr, this.reverseName, this.object);
    if (!arr.oneToManyObserver) {
        arr.oneToManyObserver = new ArrayObserver(arr);
        var observerFunction = function (splices) {
            splices.forEach(function (splice) {
                var added = splice.addedCount ? arr.slice(splice.index, splice.index + splice.addedCount) : [];
                var model = getForwardModel.call(self);
                coreChanges.registerChange({
                    collection: model.collectionName,
                    model: model.name,
                    _id: self.object._id,
                    field: getForwardName.call(self),
                    removed: splice.removed,
                    added: added,
                    removedId: _.pluck(splice.removed, '_id'),
                    addedId: _.pluck(splice.added, '_id'),
                    type: ChangeType.Splice,
                    obj: self.object
                });
            });
        };
        arr.oneToManyObserver.open(observerFunction);
    }
}

module.exports = {
    RelationshipProxy: RelationshipProxy,
    Fault: Fault,
    reverseProxyForInstance: reverseProxyForInstance,
    forwardProxyForInstance: forwardProxyForInstance,
    getReverseName: getReverseName,
    getForwardName: getForwardName,
    getReverseModel: getReverseModel,
    getForwardModel: getForwardModel,
    checkInstalled: checkInstalled,
    set: set,
    registerSetChange: registerSetChange,
    splice: splice,
    spliceFactory: spliceFactory,
    clearReverseRelated: clearReverseRelated,
    setReverse: setReverse,
    objAsString: objAsString,
    wrapArray: wrapArray,
    registerSpliceChange: registerSpliceChange,
    makeChangesToRelatedWithoutObservations: makeChangesToRelatedWithoutObservations
};


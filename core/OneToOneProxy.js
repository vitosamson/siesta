/**
 * @module relationships
 */

var RelationshipProxy = require('./RelationshipProxy'),
    Store = require('./store'),
    util = require('./util'),
    InternalSiestaError = require('./error').InternalSiestaError,
    ModelEventType = require('./modelEvents').ModelEventType,
    SiestaModel = require('./modelInstance');

/**
 * [OneToOneProxy description]
 * @param {Object} opts
 */
function OneToOneProxy(opts) {
    RelationshipProxy.call(this, opts);
}


OneToOneProxy.prototype = Object.create(RelationshipProxy.prototype);

_.extend(OneToOneProxy.prototype, {
    /**
     * Validate the object that we're setting
     * @param obj
     * @returns {string|null} An error message or null
     */
    validate: function (obj) {
        if (Object.prototype.toString.call(obj) == '[object Array]') {
            return 'Cannot assign array to one to one relationship';
        }
        else if ((!obj instanceof SiestaModel)) {

        }
        return null;
    },
    clearRemovalListener: function () {
        if (this.cancelRemovalListen) {
            this.cancelRemovalListen();
            this.cancelRemovalListen = null;
        }
    },

    /**
     * If the related object is removed from the object graph, we need to ensure that the relationship is cleared.
     * @param obj
     */
    listenForRemoval: function (obj) {
        this.cancelRemovalListen = obj.listen(function (e) {
            if (e.type == ModelEventType.Remove) {
                this.clearReverseRelated();
                this.setIdAndRelated(null);
                this.cancelRemovalListen();
                this.cancelRemovalListen = null;
            }
        }.bind(this));
    },
    set: function (obj, opts) {
        this.checkInstalled();
        if (obj) {
            var errorMessage;
            if (errorMessage = this.validate(obj)) {
                return errorMessage;
            }
            else {
                this.clearRemovalListener();
                this.listenForRemoval(obj);
                this.clearReverseRelated(opts);
                this.setIdAndRelated(obj, opts);
                this.setIdAndRelatedReverse(obj, opts);
            }
        }
        else {
            this.clearRemovalListener();
            this.clearReverseRelated(opts);
            this.setIdAndRelated(obj, opts);
        }
    },
    get: function (callback) {
        var deferred = util.defer(callback);
        callback = deferred.finish.bind(deferred);
        callback(null, this.related);
        return deferred.promise;
    }
});


module.exports = OneToOneProxy;
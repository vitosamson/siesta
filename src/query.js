/**
 * @module query
 */

var log = require('./operation/log')
    , cache = require('./cache')
    , Logger = log.loggerWithName('Query')
    , util = require('./util');
Logger.setLevel(log.Level.warn);

/**
 * @class  [Query description]
 * @param {Mapping} mapping
 * @param {Object} opts
 */
function Query(mapping, opts) {
    this.mapping = mapping;
    this.query = opts;
}

/**
 * If the storage extension is enabled, objects may be faulted and so we need to query via PouchDB. The storage
 * extension provides the RawQuery class to enable this.
 * @param callback
 * @private
 */
function _executeUsingStorageExtension(callback) {
    var deferred = window.q ? window.q.defer() : null;
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var storageExtension = siesta.ext.storage;
    var RawQuery = storageExtension.RawQuery;
    var Pouch = storageExtension.Pouch;
    var rawQuery = new RawQuery(this.mapping.collection, this.mapping.type, this.query);
    rawQuery.execute(function (err, results) {
        if (err) {
            callback(err);
        } else {
            if (Logger.debug.isEnabled)
                Logger.debug('got results', results);
            if (callback) callback(null, Pouch.toSiesta(results));
        }
    });
    return deferred ? deferred.promise : null;
}

/**
 * Returns true if the given object matches the query.
 * @param {SiestaModel} obj
 * @returns {boolean}
 */
function objectMatchesQuery(obj) {
    var fields = Object.keys(this.query);
    for (var i = 0; i < fields.length; i++) {
        var origField = fields[i];
        var splt = origField.split('__');
        var op = 'e';
        var field;
        if (splt.length == 2) {
            field = splt[0]
            op = splt[1];
        } else {
            field = origField;
        }
        var queryObj = this.query[origField];
        var val = obj[field];
        if (op == 'e') {
            if (val != queryObj) {
                return false;
            }
        } else if (op == 'lt') {
            if (val >= queryObj) {
                return false;
            }
        } else if (op == 'lte') {
            if (val > queryObj) {
                return false;
            }
        } else if (op == 'gt') {
            if (val <= queryObj) {
                return false;
            }
        } else if (op == 'gte') {
            if (val < queryObj) {
                return false;
            }
        } else {
            return 'Query operator "' + op + '"' + ' does not exist';
        }
    }
    return true;
}

/**
 * If the storage extension is not enabled, we simply cycle through all objects of the type requested in memory.
 * @param callback
 * @private
 */
function _executeInMemory(callback) {
    var deferred = window.q ? window.q.defer() : null;
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    var cacheByType = cache._localCacheByType;
    var mappingName = this.mapping.type;
    var collectionName = this.mapping.collection;
    var cacheByMapping = cacheByType[collectionName];
    var cacheByLocalId;
    if (cacheByMapping) {
        cacheByLocalId = cacheByMapping[mappingName];
    }
    if (cacheByLocalId) {
        var keys = Object.keys(cacheByLocalId);
        var self = this;
        var res = [];
        var err;
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var obj = cacheByLocalId[k];
            var matches = objectMatchesQuery.call(self, obj);
            if (typeof(matches) == 'string') {
                err = matches;
                break;
            } else {
                if (matches) res.push(obj);
            }
        }
        callback(err, err ? null : res);
    } else if (callback) {
        callback(null, []);
    }
    return deferred ? deferred.promise : null;
}

Query.prototype.execute = function (callback) {
    var deferred = window.q ? window.q.defer() : null;
    callback = util.constructCallbackAndPromiseHandler(callback, deferred);
    // if (siesta.ext.storageEnabled) {
    //     _executeUsingStorageExtension.call(this, callback);
    // }
    // else {
    _executeInMemory.call(this, callback);
    // }
    return deferred ? deferred.promise : null;
};

Query.prototype._dump = function (asJson) {
    // TODO
    return asJson ? '{}' : {};
};

exports.Query = Query;
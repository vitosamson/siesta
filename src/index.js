angular.module('restkit.indexing', ['restkit'])

    .factory('Indexes', function (Index, jlog) {

        var $log = jlog.loggerWithName('Indexes');

        /**
         * Adapted from:
         * http://stackoverflow.com/questions/5752002/find-all-possible-subset-combos-in-an-array
         * @param a
         * @param min
         * @returns {Array}
         */
        function combine(a, min) {
            var fn = function (n, src, got, all) {
                if (n == 0) {
                    if (got.length > 0) {
                        all[all.length] = got;
                    }
                    return;
                }
                for (var j = 0; j < src.length; j++) {
                    fn(n - 1, src.slice(j + 1), got.concat([src[j]]), all);
                }
            };
            var all = [];
            for (var i = min; i < a.length; i++) {
                fn(i, a, [], all);
            }
            all.push(a);
            return all;
        }

        function getFieldCombinations(fields) {
            var combinations = combine(fields, 1);
            combinations.push([]);
            return  combinations;
        }

        function constructIndexes(collection, modelName, fields) {
            var combinations = getFieldCombinations(fields);
            return _.map(combinations, function (fields) {
                return new Index(collection, modelName, fields);
            });
        }

        return {
            installIndexes: function (collection, modelName, fields, callback) {
                var indexes = constructIndexes(collection, modelName, fields);
                var numCompleted = 0;
                var errors = [];
                _.each(indexes, function (index) {
                    index.install(function (err) {
                        if (err) {
                            errors.push(err);
                        }
                        numCompleted++;
                        if (numCompleted == indexes.length) {
                            $log.info('Successfully installed all indexes');
                            callback(errors.length ? errors : null);
                        }
                    });
                });
            },
            _constructIndexes: constructIndexes,
            _getFieldCombinations: getFieldCombinations
        };
    })

    .factory('Index', function (Pouch, jlog, RestError, constructMapFunction) {
        var $log = jlog.loggerWithName('Index');

        function Index(collection, type, fields_or_field) {
            this.type = type;
            this.collection = collection;
            if (fields_or_field.length) {
                this.fields = _.sortBy(fields_or_field, function (x) {return x});

            }
            else {
                this.fields = [fields_or_field];
            }
        }

        Index.prototype._getDesignDocName = function () {
            var name = this._getName();
            return '_design/' + name;
        };

        /**
         * Return a PouchDB secondary index.
         * See http://pouchdb.com/2014/05/01/secondary-indexes-have-landed-in-pouchdb.html
         * @private
         */
        Index.prototype._constructPouchDbView = function () {
            var name = this._getName();
            var index = {
                _id: this._getDesignDocName(),
                views: {}
            };
            index.views[name] = {
                map: this._constructMapFunction()
            };
            return  index
        };

        Index.prototype._constructMapFunction = function () {
            this._validate();
            var fields = this.fields;
            var type = this.type;
            var collection = this.collection;
            return constructMapFunction(collection, type, fields);
        };

        Index.prototype._validate = function () {
            if (!this.type) {
                throw new RestError('Type must be specified in order to construct index map function.', {index: this});
            }
            if (!this.collection) {
                throw new RestError('API must be specified in order to construct index map function.', {index: this});
            }
        };

        Index.prototype._dump = function () {
            return this._getName();
        };

        Index.prototype._getName = function () {
            this._validate();
            var appendix = _.reduce(this.fields, function (memo, field) {return memo + '_' + field}, '');
            return this.collection + '_' + 'Index_' + this.type + appendix;
        };

        Index.prototype.install = function (callback) {
            this._validate();
            var self = this;
            var constructPouchDbView = this._constructPouchDbView();
            var indexName = this._getName();
            $log.debug('Installing Index: ' + indexName, constructPouchDbView);
            Pouch.getPouch().put(constructPouchDbView, function (err, resp) {
                if (err) {
                    if (err.status === 409) {
                        $log.debug(indexName + ' already installed');
                        err = null;
                    }
                }
                if (!err && Index.indexes.indexOf(self) < 0) {
                    Index.indexes.push(self);
                }
                callback(err, resp);
            });
        };

        Index.indexes = [];

        return Index;
    })

;
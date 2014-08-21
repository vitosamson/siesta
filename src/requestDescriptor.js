angular.module('restkit.requestDescriptor', ['restkit'])

    .factory('DescriptorRegistry', function () {
        function RequestDescriptorRegistry() {
            if (!this) {
                return new RequestDescriptorRegistry(opts);
            }
            this.requestDescriptors = [];
            this.responseDescriptors = [];
        }
        RequestDescriptorRegistry.prototype.registerRequestDescriptor = function (requestDescriptor) {
            this.requestDescriptors.push(requestDescriptor);
        };
        RequestDescriptorRegistry.prototype.registerResponseDescriptor = function (responseDescriptor) {
            this.requestDescriptors.push(responseDescriptor);
        };
        return new RequestDescriptorRegistry();
    })

    .factory('RequestDescriptor', function (defineSubProperty, RestAPIRegistry, RestError, DescriptorRegistry, assert) {
        // The XRegExp object has these properties that we want to ignore when matching.
        var ignore = ['index', 'input'];


        function RequestDescriptor(opts) {
            if (!this) {
                return new RequestDescriptor(opts);
            }

            this._opts = opts;

            // Convert path string into XRegExp if not already.
            if (this._opts.path) {
                if (!(this._opts.path instanceof XRegExp)) {
                    this._opts.path = XRegExp(this._opts.path);
                }
            }

            // Convert wildcards into methods and ensure is an array of uppercase methods.
            if (this._opts.method) {
                if (this._opts.method == '*' || this._opts.method.indexOf('*') > -1) {
                    this._opts.method = this.httpMethods;
                }
                else if (typeof(this._opts.method) == 'string') {
                    this._opts.method = [this._opts.method];
                }
                this._opts.method = _.map(this._opts.method, function (x) {return x.toUpperCase()});
            }

            // Mappings can be passed as the actual mapping object or as a string (with API specified too)
            if (this._opts.mapping) {
                if (typeof(this._opts.mapping) == 'string') {
                    if (this._opts.api) {
                        var api;
                        if (typeof(this._opts.api) == 'string') {
                            api = RestAPIRegistry[this._opts.api];
                        }
                        else {
                            api = this._opts.api;
                        }
                        if (api) {
                            var actualMapping = api[this._opts.mapping];
                            if (actualMapping) {
                                this._opts.mapping = actualMapping;
                            }
                            else {
                                throw new RestError('Mapping ' + this._opts.mapping + ' does not exist', {opts: opts});
                            }
                        }
                        else {
                            throw new RestError('API ' + this._opts.api + ' does not exist', {opts: opts});
                        }
                    }
                    else {
                        throw new RestError('Passed mapping as string, but did not specify the collection it belongs to', {opts: opts});
                    }
                }
            }

            // If key path, convert data key path into an object that we can then use to traverse the HTTP bodies.
            // otherwise leave as string or undefined.
            var data = this._opts.data;
            if (data) {
                if (data.length) {
                    var root;
                    var arr = data.split('.');
                    if (arr.length == 1) {
                        root = arr[0];
                    }
                    else {
                        var obj = {};
                        root = obj;
                        var previousKey = arr[0];
                        for (var i = 1; i < arr.length; i++) {
                            var key = arr[i];
                            if (i == (arr.length - 1)) {
                                obj[previousKey] = key;
                                deepest = obj;
                                deepestKey = previousKey;
                            }
                            else {
                                var newVar = {};
                                obj[previousKey] = newVar;
                                obj = newVar;
                                previousKey = key;
                            }
                        }
                    }
                    this._opts.data = root;
                }
            }

            DescriptorRegistry.registerRequestDescriptor(this);

            defineSubProperty.call(this, 'path', this._opts);
            defineSubProperty.call(this, 'method', this._opts);
            defineSubProperty.call(this, 'mapping', this._opts);
            defineSubProperty.call(this, 'data', this._opts);
        }

        RequestDescriptor.prototype.httpMethods = ['POST', 'PATCH', 'PUT', 'HEAD', 'GET', 'DELETE', 'OPTIONS', 'TRACE', 'CONNECT'];

        RequestDescriptor.prototype._matchPath = function (path) {
            var match = XRegExp.exec(path, this.path);
            var matched = null;
            if (match) {
                matched = {};
                for (var prop in match) {
                    if (match.hasOwnProperty(prop)) {
                        if (isNaN(parseInt(prop)) && ignore.indexOf(prop) < 0) {
                            matched[prop] = match[prop];
                        }
                    }
                }
            }
            return matched;
        };

        RequestDescriptor.prototype._matchMethod = function (method) {
            for (var i=0;i<this.method.length;i++) {
                if (method.toUpperCase() == this.method[i]) {
                    return true;
                }
            }
            return false;
        };

        /**
         * Bury obj as far down in data as poss.
         * @param obj
         * @param data keypath object
         * @returns {*}
         */
        function bury(obj, data) {
            var root = data;
            var keys = Object.keys(data);
            assert(keys.length == 1);
            var key = keys[0];
            var curr = data;
            while (!(typeof(curr[key]) == 'string')) {
                curr = curr[key];
                keys = Object.keys(curr);
                assert(keys.length == 1);
                key = keys[0];
            }
            var newParent = curr[key];
            var newObj = {};
            curr[key] = newObj;
            newObj[newParent] = obj;
            return root;
        }

        RequestDescriptor.prototype._embedData = function (data) {
            if (this.data) {
                var nested;
                if (typeof(this.data) == 'string') {
                    nested = {};
                    nested[this.data] = data;
                }
                else {
                    nested = bury(data, $.extend(true, {}, this.data));
                }
                return nested;
            }
            else {
                return data;
            }
        };

        RequestDescriptor.prototype._extractData = function (data) {
            if (this.data) {
                if (typeof(this.data) == 'string') {
                    return data[this.data];
                }
                else {
                    var keys = Object.keys(this.data);
                    assert(keys.length == 1);
                    var currKey = keys[0];
                    var currTheirs = data;
                    var currOurs = this.data;
                    while(typeof(currOurs) != 'string') {
                        console.log(currKey, currOurs, currTheirs);
                            keys = Object.keys(currOurs);
                            assert(keys.length == 1);
                            currKey = keys[0];
                            currTheirs = currTheirs[currKey];
                            currOurs = currOurs[currKey];
                    }
                    return currTheirs[currOurs];
                }
            }
            else {
                return data;
            }
        };

        return RequestDescriptor;
    })

;
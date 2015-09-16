/* jshint -W097 */// jshint strict:false
/*jslint node: true */
/*jshint -W061 */
"use strict";

// From settings used only secure, auth and crossDomain
function SimpleAPI(server, settings, adapter) {
    if (!(this instanceof SimpleAPI)) return new SimpleAPI(settings);

    this.server   = server;
    this.adapter  = adapter;
    this.settings = settings;
    this.restApiDelayed = {
        timer:        null,
        responseType: '',
        response:     null,
        waitId:       0
    };

    var that = this;
    // Cache
    this.users = {};

    var __construct = (function () {
        that.adapter.log.info((settings.secure ? 'Secure ' : '') + 'simpleAPI server listening on port ' + settings.port);
        that.adapter.config.defaultUser = that.adapter.config.defaultUser || 'system.user.admin';
        if (!that.adapter.config.defaultUser.match(/^system\.user\./)) {
            that.adapter.config.defaultUser = 'system.user.' + that.adapter.config.defaultUser;
        }

    })();

    this.isAuthenticated = function (values, callback) {
        if (!values.user || !values.pass) {
            that.adapter.log.warn('No password or username!');
            callback(false);
        } else {
            that.adapter.checkPassword(values.user, values.pass, function (res) {
                if (res) {
                    that.adapter.log.debug("Logged in: " + values.user);
                    callback(true);
                } else {
                    that.adapter.log.warn('Invalid password or user name: ' + values.user);
                    callback(false);
                }
            });
        }
    };

    this.stateChange = function (id, state) {
        if (that.restApiDelayed.id == id && state && state.ack) {
            adapter.unsubscribeForeignStates(id);
            that.restApiDelayed.response = state;
            setTimeout(restApiDelayedAnswer, 0);
        }
    };

    this.userReg  = new RegExp('^system\.user\.');
    this.groupReg = new RegExp('^system\.group\.');

    // if user politics changes, clear cache
    this.objectChange = function (id, state) {
        if (this.userReg.test(id) || this.groupReg.test(id)) {
            this.users = {};
        }
    };

    function restApiPost(req, res, command, oId, values) {
        var responseType = 'json';
        var status       = 500;
        var headers      = {'Access-Control-Allow-Origin': '*'};

        var body = '';
        req.on('data', function (data) {
            body += data;
        });
        req.on('end', function () {
            switch (command) {
                case 'setBulk':
                    var arr = body.split('&');

                    for (var i = 0; i < arr.length; i++) {
                        arr[i] = arr[i].split('=');
                        values[arr[i][0]] = (arr[i][1] === undefined) ? null : arr[i][1];
                    }

                    if (values.prettyPrint !== undefined) {
                        if (values.prettyPrint === 'false') values.prettyPrint = false;
                        if (values.prettyPrint === null)    values.prettyPrint = true;
                    }

                    var cnt = 0;
                    var response = [];
                    for (var _id in values) {
                        cnt++;
                        findState(_id, values.user, function (err, id, originId) {
                            if (err) {
                                doResponse(res, 'plain', 500, headers, 'error: ' + err, values.prettyPrint);
                                cnt = 0;
                            } else
                            if (!id) {
                                response.push({error:  'error: datapoint "' + originId + '" not found'});
                                if (!--cnt) doResponse(res, responseType, status, headers, response, values.prettyPrint);
                            } else {
                                adapter.setForeignState(id, values[originId], false, function (err, id) {
                                    if (err) {
                                        doResponse(res, 'plain', 500, headers, 'error: ' + err, values.prettyPrint);
                                        cnt = 0;
                                    } else {
                                        status = 200;
                                        response.push({id:  id, val: values[originId]});
                                        if (!--cnt) doResponse(res, responseType, status, headers, response, values.prettyPrint);
                                    }
                                });
                            }
                        });
                    }
                    break;

                default:
                    doResponse(res, responseType, status, headers, {error: 'command ' + command + ' unknown'}, values.prettyPrint);
                    break;
            }
        });
        return;
    }

    function restApiDelayedAnswer() {
        if (that.restApiDelayed.timer) {
            clearTimeout(that.restApiDelayed.timer);
            that.restApiDelayed.timer = null;

            doResponse(that.restApiDelayed.res, that.restApiDelayed.responseType, 200, {'Access-Control-Allow-Origin': '*'},  that.restApiDelayed.response, that.restApiDelayed.prettyPrint);
            that.restApiDelayed.id          = null;
            that.restApiDelayed.res         = null;
            that.restApiDelayed.response    = null;
            that.restApiDelayed.prettyPrint = false;
        }
    }

    function findState(idOrName, user, type, callback) {
        if (typeof type == 'function') {
            callback = type;
            type = null;
        }
        adapter.findForeignObject(idOrName, type, {user: user}, callback);
    }

    function getState(idOrName, user, type, callback) {
        if (typeof type == 'function') {
            callback = type;
            type = null;
        }

        findState(idOrName, user, type, function (err, id, originId) {
            if (err) {
                if (callback) callback(err, undefined, null, originId);
            } else
            if (id) {
                that.adapter.getForeignState(id, function (err, obj) {
                    if (err || !obj) {
                        obj = undefined;
                    }
                    if (callback) callback (null, obj, id, originId);
                });
            } else {
                if (callback) callback (null, undefined, null, originId);
            }
        });
    }

    function doResponse(res, type, status, headers, content, pretty) {
        if (!headers) headers = {};

        if (pretty && typeof content == 'object') {
            type = 'plain';
            content = JSON.stringify(content, null, 2);
        }

        switch (type) {
            case 'json':
                headers['Content-Type'] = 'application/json';
                res.writeHead(status, headers);
                res.end(JSON.stringify(content), 'utf8');
                break;

            case 'plain':
                headers['Content-Type'] = 'text/plain';
                res.writeHead(status, headers);

                if (typeof content == 'object') {
                    res.end(JSON.stringify(content), 'utf8');
                } else {
                    res.end(content, 'utf8');
                }
                break;
        }
    }

    // static information
    var commandsPermissions = {
        getPlainValue:  {type: 'state',    operation: 'read'},
        get:            {type: 'state',    operation: 'read'},
        getBulk:        {type: 'state',    operation: 'read'},
        set:            {type: 'state',    operation: 'write'},
        toggle:         {type: 'state',    operation: 'write'},
        setBulk:        {type: 'state',    operation: 'write'},
        getObjects:     {type: 'object',   operation: 'list'},
        objects:        {type: 'object',   operation: 'list'},
        states:         {type: 'state',    operation: 'list'},
        getStates:      {type: 'state',    operation: 'list'},
        help:           {type: '',         operation: ''}
    };

    this.commands = [];
    for (var c in commandsPermissions) {
        this.commands.push(c);
    }
    // Register api by express
    this.checkRequest = function (url) {
        var parts = url.split('/', 2);
        return (parts[1] && this.commands.indexOf(parts[1]) != -1);
    };

    this.checkPermissions = function (user, command, callback) {
        adapter.calculatePermissions(user, commandsPermissions, function (acl) {
            if (user != 'system.user.admin') {
                // type: file, object, state, other
                // operation: create, read, write, list, delete, sendto, execute, sendto
                if (commandsPermissions[command]) {
                    // If permission required
                    if (commandsPermissions[command].type) {
                        if (acl[commandsPermissions[command].type] &&
                            acl[commandsPermissions[command].type][commandsPermissions[command].operation]) {
                            return callback(null);
                        }
                    } else {
                        return callback(null);
                    }
                }

                that.adapter.log.warn('No permission for "' + user + '" to call ' + command);

                if (callback) callback('permissionError');
            } else {
                return callback(null);
            }
        });
    };

    this.restApi = function (req, res, isAuth, isChecked) {
        var values       = {};
        var oId          = [];
        var wait         = 0;
        var responseType = 'json';
        var status       = 500;
        var headers      = {'Access-Control-Allow-Origin': '*'};
        var response;

        var url = decodeURI(req.url);
        var pos = url.indexOf('?');
        if (pos != -1) {
            var arr = url.substring(pos + 1).split('&');
            url = url.substring(0, pos);

            for (var i = 0; i < arr.length; i++) {
                arr[i] = arr[i].split('=');
                values[arr[i][0].trim()] = (arr[i][1] === undefined) ? null : arr[i][1];
            }
            if (values.prettyPrint !== undefined) {
                if (values.prettyPrint === 'false') values.prettyPrint = false;
                if (values.prettyPrint === null)    values.prettyPrint = true;
            }
            // Default value for wait
            if (values.wait === null) values.wait = 2000;
        }

        var parts        = url.split('/');
        var command      = parts[1];

        // Analyse system.adapter.socketio.0.uptime,system.adapter.history.0.memRss?value=78&wait=300
        if (parts[2]) {
            oId = parts[2].split(',');
            for (var j = oId.length - 1; j >= 0; j--) {
                oId[j] = oId[j].trim();
                if (!oId[j]) oId.splice(j, 1);
            }
        }

        // If authentication check is required
        if (that.settings.auth) {
            if (!isAuth) {
                this.isAuthenticated(values, function (isAuth) {
                    if (isAuth) {
                        that.restApi(req, res, true);
                    } else {
                        doResponse(res, 'plain', 401, headers, 'error: authentication failed. Please write "http' + (settings.secure ? 's' : '') + '://' + req.headers.host + '?user=UserName&pass=Password"');
                    }
                });
                return;
            } else
            if (!isChecked) {
                if (!values.user.match(/^system\.user\./)) values.user = 'system.user.' + values.user;
                that.checkPermissions(values.user, command, function (err) {
                    if (!err) {
                        that.restApi(req, res, true, true);
                    } else {
                        doResponse(res, 'plain', 401, headers, 'error: ' + err, values.prettyPrint);
                    }
                });
                return;
            }
        } else {
            req.user = req.user || that.adapter.config.defaultUser;
            values.user = req.user;
            if (!values.user.match(/^system\.user\./)) values.user = 'system.user.' + values.user;
            if (!isChecked && command) {
                that.checkPermissions(req.user || that.adapter.config.defaultUser, command, function (err) {
                    if (!err) {
                        that.restApi(req, res, true, true);
                    } else {
                        doResponse(res, 'plain', 401, headers, 'error: ' + err, values.prettyPrint);
                    }
                });
                return;
            }
        }
        if (!values.user.match(/^system\.user\./)) values.user = 'system.user.' + values.user;

        if (req.method == 'POST') {
            restApiPost(req, res, command, oId, values);
            return;
        }

        switch (command) {
            case 'getPlainValue':
                responseType = 'plain';
                if (!oId.length || !oId[0]) {
                    doResponse(res, responseType, status, headers, 'error: no datapoint given', values.prettyPrint);
                    break;
                }

                var pcnt = oId.length;
                response = '';
                for (var g = 0; g < oId.length; g++) {
                    getState(oId[g], values.user, function (err, obj, id, originId) {
                        if (err) {
                            status = 500;
                            response = 'error: ' + err;
                            pcnt = 1;
                        } else if ((!id && originId) || obj === undefined) {
                            response += (response ? '\n' : '') + 'error: datapoint "' + originId + '" not found';
                        } else {
                            response += (response ? '\n' : '') + JSON.stringify(obj.val);
                            status = 200;
                        }
                        if (!--pcnt) doResponse(res, responseType, status, headers, response, values.prettyPrint);
                    });
                }
                break;

            case 'get':
                if (!oId.length || !oId[0]) {
                    doResponse(res, responseType, status, headers, {error: 'no object/datapoint given'}, values.prettyPrint);
                    break;
                }

                var gcnt = oId.length;
                for (var k = 0; k < oId.length; k++) {
                    getState(oId[k], values.user, function (err, state, id, originId) {
                        if (err) {
                            gcnt = 0;
                            doResponse(res, responseType, 500, headers, 'error: ' + err, values.prettyPrint);
                        } else
                        if ((!id && originId)) {
                            if (!response) {
                                response = 'error: datapoint "' + originId + '" not found';
                            } else {
                                if (typeof response != 'object' || response.constructor !== Array) {
                                    response = [response];
                                }
                                response.push('error: datapoint "' + originId + '" not found');
                            }
                            if (!--gcnt) doResponse(res, responseType, status, headers, response, values.prettyPrint);
                        } else {
                            var vObj = state || {};
                            status = 200;
                            that.adapter.getForeignObject(id, function (err, obj) {
                                if (obj) {
                                    for (var attr in obj) {
                                        vObj[attr] = obj[attr];
                                    }
                                }

                                if (!response) {
                                    response = vObj;
                                } else {
                                    if (typeof response != 'object' || response.constructor !== Array) response = [response];
                                    response.push(vObj);
                                }

                                if (!--gcnt) doResponse(res, responseType, status, headers, response, values.prettyPrint);
                            });
                        }
                    });
                }
                break;

            case 'getBulk':
                if (!oId.length || !oId[0]) {
                    doResponse(res, responseType, status, headers, {error: 'no datapoints given'}, values.prettyPrint);
                    break;
                }
                var bcnt = oId.length;
                response = [];
                for (var b = 0; b < oId.length; b++) {
                    getState(oId[b], values.user, function (err, state, id, originId) {
                        if (err) {
                            bcnt = 0;
                            doResponse(res, responseType, 500, headers, 'error: ' + err, values.prettyPrint);
                        } else{
                            if (id) status = 200;
                            state = state || {};
                            response.push({val: state.val, ts: state.ts});
                            if (!--bcnt) doResponse(res, responseType, status, headers, response, values.prettyPrint);
                        }
                    });
                }
                break;

            case 'set':
                if (!oId.length || !oId[0]) {
                    doResponse(res, responseType, status, headers, {error: "object/datapoint not given"}, values.prettyPrint);
                    break;
                }
                if (values.value === undefined) {
                    doResponse(res, responseType, status, headers, 'error: no value found for "' + oId[0] + '". Use /set/id?value=1 or /set/id?value=1&wait=1000', values.prettyPrint);
                } else {
                    findState(oId[0], values.user, function (err, id, originId) {
                        if (err) {
                            wait = 0;
                            doResponse(res, 'plain', 500, headers, 'error: ' + err);
                        } else
                        if (id) {
                            wait = values.wait || 0;
                            if (wait) wait = parseInt(wait, 10);

                            if (values.value === 'true') {
                                values.value = true;
                            } else if (values.value === 'false') {
                                values.value = false;
                            } else if (!isNaN(values.value)) {
                                values.value = parseFloat(values.value);
                            }

                            if (wait) adapter.subscribeForeignStates(id);

                            adapter.setForeignState(id, values.value, false, {user: values.user}, function (err) {
                                if (err) {
                                    doResponse(res, 'plain', 500, headers, 'error: ' + err, values.prettyPrint);
                                    wait = 0;
                                } else
                                if (!wait) {
                                    status = 200;
                                    response = {id: id, value: values.value};
                                    doResponse(res, responseType, status, headers, response, values.prettyPrint);
                                }
                            });

                            if (wait) {
                                that.restApiDelayed.responseType = responseType;
                                that.restApiDelayed.response     = null;
                                that.restApiDelayed.id           = id;
                                that.restApiDelayed.res          = res;
                                that.restApiDelayed.prettyPrint  = values.prettyPrint;
                                that.restApiDelayed.timer        = setTimeout(restApiDelayedAnswer, wait);
                            }
                        } else {
                            doResponse(res, responseType, status, headers, 'error: datapoint "' + originId + '" not found', values.prettyPrint);
                        }
                    });
                }
                break;

            case 'toggle':
                if (!oId.length || !oId[0]) {
                    doResponse(res, responseType, status, headers, {error: "state not given"}, values.prettyPrint);
                    break;
                }

                findState(oId[0], values.user, function (err, id, originId) {
                    if (err) {
                        doResponse(res, 'plain', 500, headers, 'error: ' + err, values.prettyPrint);
                        wait = 0;
                    } else if (id) {
                        wait = values.wait || 0;
                        if (wait) wait = parseInt(wait, 10);

                        // Read type of object
                        adapter.getForeignObject(id, {user: values.user}, function (err, obj) {
                            if (err) {
                                doResponse(res, 'plain', 500, headers, 'error: ' + err, values.prettyPrint);
                                wait = 0;
                            } else {
                                // Read actual value
                                adapter.getForeignState(id, {user: values.user}, function (err, state) {
                                    if (err) {
                                        doResponse(res, 'plain', 500, headers, 'error: ' + err, values.prettyPrint);
                                        wait = 0;
                                    } else
                                    if (state) {
                                        if (obj && obj.common && obj.common.type) {
                                            if (obj.common.type == 'bool' || obj.common.type == 'boolean') {
                                                if (state.val === 'true') {
                                                    state.val = true;
                                                } else if (state.val === 'false') {
                                                    state.val = false;
                                                }
                                                state.value = !state.value;
                                            } else
                                            if (obj.common.type == 'number') {
                                                state.value = parseFloat(state.val);
                                                if (obj.common.max !== undefined) {
                                                    if (obj.common.min === undefined) obj.common.min = 0;
                                                    if (state.val > obj.common.max) state.val = obj.common.max;
                                                    if (state.val < obj.common.min) state.val = obj.common.min;
                                                    // Invert
                                                    state.val = obj.common.max + obj.common.min - state.val;
                                                } else {
                                                    // default number is from 0 to 100
                                                    if (state.val > 100) state.val = 100;
                                                    if (state.val < 0) state.val = 0;
                                                    state.val = 100 - state.val;
                                                }
                                            } else {
                                                if (state.val === 'true' || state.val === true) {
                                                    state.val = false;
                                                } else if (state.val === 'false' || state.val === false) {
                                                    state.val = true;
                                                } else if (parseInt(state.val, 10) == state.val) {
                                                    state.val = parseInt(state.val, 10) ? 0 : 1;
                                                } else {
                                                    doResponse(res, responseType, status, headers, {error: 'state is neither number nor boolean'}, values.prettyPrint);
                                                    return;
                                                }
                                            }
                                        } else {
                                            if (state.val === 'true') {
                                                state.val = true;
                                            } else if (state.val === 'false') {
                                                state.val = false;
                                            } else if (!isNaN(state.val)) {
                                                state.val = parseFloat(state.val);
                                            }

                                            if (state.val === true)  state.val = 1;
                                            if (state.val === false) state.val = 0;
                                            state.val = 1 - parseInt(state.val, 10);
                                        }

                                        if (wait) adapter.subscribeForeignStates(id);

                                        adapter.setForeignState(id, state.val, false, {user: values.user}, function (err) {
                                            if (err) {
                                                doResponse(res, 'plain', 500, headers, 'error: ' + err, values.prettyPrint);
                                                wait = 0;
                                            } else
                                            if (!wait) {
                                                status = 200;
                                                doResponse(res, responseType, status, headers, {id: id, value: state.val}, values.prettyPrint);
                                            }
                                        });

                                        if (wait) {
                                            that.restApiDelayed.responseType = responseType;
                                            that.restApiDelayed.response     = null;
                                            that.restApiDelayed.id           = id;
                                            that.restApiDelayed.res          = res;
                                            that.restApiDelayed.prettyPrint  = values.prettyPrint;
                                            that.restApiDelayed.timer        = setTimeout(restApiDelayedAnswer, wait);
                                        }
                                    } else {
                                        doResponse(res, responseType, status, headers, {error: 'object has no state'}, values.prettyPrint);
                                    }
                                });                            }

                        });
                    } else {
                        doResponse(res, responseType, status, headers, {error: 'error: datapoint "' + originId + '" not found'}, values.prettyPrint);
                    }
                });

                break;

            // /setBulk?BidCos-RF.FEQ1234567:1.LEVEL=0.7&Licht-Küche/LEVEL=0.7&Anwesenheit=0&950=1
            case 'setBulk':
                var cnt = 0;
                response = [];
                for (var _id in values) {
                    if (_id == 'prettyPrint' || _id == 'user' || _id == 'pass') continue;
                    cnt++;
                    findState(_id, values.user, function (err, id, originId) {
                        if (err) {
                            doResponse(res, 'plain', 500, headers, 'error: ' + err, values.prettyPrint);
                            cnt = 0;
                        } else if (!id) {
                            response.push({error:  'error: datapoint "' + originId + '" not found'});
                            if (!--cnt) doResponse(res, responseType, status, headers, response, values.prettyPrint);
                        } else {
                            adapter.setForeignState(id, values[originId], false, {user: values.user}, function (err, id) {
                                if (err) {
                                    doResponse(res, 'plain', 500, headers, 'error: ' + err, values.prettyPrint);
                                    cnt = 0;
                                } else {
                                    response.push({id: id, val: values[originId]});
                                    if (!--cnt) doResponse(res, responseType, status, headers, response, values.prettyPrint);
                                }
                            });
                        }
                    });
                }
                break;

            case 'getObjects':
            case 'objects':
                adapter.getForeignObjects(values.pattern || parts[2] || '*', {user: values.user}, function (err, list) {
                    if (err) {
                        status = 500;
                        doResponse(res, responseType, status, headers, {error: JSON.stringify(err)}, values.prettyPrint);
                    } else {
                        status = 200;
                        doResponse(res, responseType, status, headers, list, values.prettyPrint);
                    }
                });
                break;

            case 'getStates':
            case 'states':
                adapter.getForeignStates(values.pattern || parts[2] || '*', {user: values.user}, function (err, list) {
                    if (err) {
                        status = 500;
                        doResponse(res, responseType, status, headers, {error: JSON.stringify(err)}, values.prettyPrint);
                    } else {
                        status = 200;
                        doResponse(res, responseType, status, headers, list, values.prettyPrint);
                    }
                });
                break;

            case 'help':
            default:
                var obj =  (command == 'help') ? {} : {error: 'command ' + command + ' unknown'};
                var request = 'http' + (settings.secure ? 's' : '') + '://' + req.headers.host;
                var auth = '';
                if (that.settings.auth) auth = 'user=UserName&pass=Password';
                obj.getPlainValue = request + '/getPlainValue/stateID' + (auth ? '?' + auth : '');
                obj.get           = request + '/get/stateID/?prettyPrint' + (auth ? '&' + auth : '');
                obj.getBulk       = request + '/getBulk/stateID1,stateID2/?prettyPrint' + (auth ? '&' + auth : '');
                obj.set           = request + '/set/stateID?value=1&prettyPrint' + (auth ? '&' + auth : '');
                obj.toggle        = request + '/toggle/stateID&prettyPrint' + (auth ? '&' + auth : '');
                obj.setBulk       = request + '/setBulk?stateID1=0.7&stateID2=0&prettyPrint' + (auth ? '&' + auth : '');
                obj.objects       = request + '/objects?pattern=system.adapter.admin.0*&prettyPrint' + (auth ? '&' + auth : '');
                obj.states        = request + '/states?pattern=system.adapter.admin.0*&prettyPrint' + (auth ? '&' + auth : '');

                doResponse(res, responseType, status, headers, obj, true);
                break;
        }
    };
}

module.exports = SimpleAPI;
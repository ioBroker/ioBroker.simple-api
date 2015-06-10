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

    this.objectChange = function (id, state) {
        this.users = {};
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
                        findState(_id, function (id, originId) {
                            if (!id) {
                                cnt--;
                                response.push({error:  'error: datapoint "' + originId + '" not found'});
                                if (!cnt) doResponse(res, responseType, status, headers, response, values.prettyPrint);
                            } else {
                                adapter.setForeignState(id, values[originId], function (err, id) {
                                    status = 200;
                                    cnt--;
                                    response.push({id:  id, val: values[originId]});
                                    if (!cnt) doResponse(res, responseType, status, headers, response, values.prettyPrint);
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

    function findState(idOrName, type, callback) {
        if (typeof type == 'function') {
            callback = type;
            type = null;
        }
        //todo
        adapter.findForeignObject(idOrName, type, callback);
    }

    function getState(idOrName, type, callback) {
        if (typeof type == 'function') {
            callback = type;
            type = null;
        }

        findState(idOrName, type, function (id, originId) {
            if (id) {
                that.adapter.getForeignState(id, function (err, obj) {
                    if (err || !obj) {
                        obj = undefined;
                    }
                    if (callback) callback (obj, id, originId);
                });
            } else {
                if (callback) callback (undefined, null, originId);
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
        getStates:      {type: 'state',    operation: 'list'}
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

    this.calculatePermissions = function (user, callback) {
        if (this.users[user]) {
            if (callback) callback(user, this.users[user]);
            return;
        }
        // read all groups
        var acl = {};
        if (user == 'admin') {
            for (var c in commandsPermissions) {
                acl[commandsPermissions[c].type] = acl[commandsPermissions[c].type] || {};
                acl[commandsPermissions[c].type][commandsPermissions[c].operation] = true;
            }
            this.users[user] = acl;
            if (callback) callback(user, acl);
            return;
        }

        adapter.getForeignObjects('*', 'group', function (err, groups) {
            // aggregate all groups permissions, where this user is
            if (groups) {
                for (var g in groups) {
                    if (groups[g] &&
                        groups[g].common &&
                        groups[g].common.members &&
                        groups[g].common.members.indexOf('system.user.' + user) != -1) {
                        for (var type in groups[g].common.acl) {
                            acl[type] = acl[type] || {};
                            for (var op in groups[g].common.acl[type]) {
                                acl[type][op] = acl[type][op] || groups[g].common.acl[type][op];
                            }
                        }
                    }
                }
            }

            that.users[user] = acl;
            if (callback) callback(user, acl);
        });
    };

    this.checkPermissions = function (user, command, callback) {
        this.calculatePermissions(user, function (u, acl) {
            if (user && user != 'admin') {
                // type: file, object, state, other
                // operation: create, read, write, list, delete, sendto, execute, sendto
                if (commandsPermissions[command]) {
                    // If permission required
                    if (commandsPermissions[command].type) {
                        if (acl[commandsPermissions[command].type] && acl[commandsPermissions[command].type][commandsPermissions[command].operation]) {
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
                that.checkPermissions(values.user, command, function (err) {
                    if (!err) {
                        that.restApi(req, res, true, true);
                    } else {
                        doResponse(res, 'plain', 401, headers, 'error: ' + err, values.prettyPrint);
                    }
                });
                return;
            }
        }



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
                    getState(oId[g], function (obj, id, originId) {
                        if ((!id && originId) || obj === undefined) {
                            response += (response ? '\n' : '') + 'error: datapoint "' + originId + '" not found';
                        } else {
                            response += (response ? '\n' : '') + JSON.stringify(obj.val);
                            status = 200;
                        }
                        pcnt--;
                        if (!pcnt) doResponse(res, responseType, status, headers, response, values.prettyPrint);
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
                    getState(oId[k], function (state, id, originId) {
                        if ((!id && originId)) {
                            if (!response) {
                                response = 'error: datapoint "' + originId + '" not found';
                            } else {
                                if (typeof response != 'object' || response.constructor !== Array) {
                                    response = [response];
                                }
                                response.push('error: datapoint "' + originId + '" not found');
                            }
                            gcnt--;
                            if (!gcnt) doResponse(res, responseType, status, headers, response, values.prettyPrint);
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

                                gcnt--;
                                if (!gcnt) doResponse(res, responseType, status, headers, response, values.prettyPrint);
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
                    getState(oId[b], function (state, id, originId) {
                        if (id) status = 200;
                        state = state || {};
                        response.push({val: state.val, ts: state.ts});
                        bcnt--;
                        if (!bcnt) doResponse(res, responseType, status, headers, response, values.prettyPrint);
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
                    findState(oId[0], function (id, originId) {
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

                            adapter.setForeignState(id, values.value, function () {
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

                findState(oId[0], function (id, originId) {
                    if (id) {
                        wait = values.wait || 0;
                        if (wait) wait = parseInt(wait, 10);

                        // Read type of object
                        adapter.getForeignObject(id, function (err, obj) {
                            // Read actual value
                            adapter.getForeignState(id, function (err, state) {
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
                                            doResponse(res, responseType, status, headers, {error: 'state is neither number nor boolean'}, values.prettyPrint);
                                            return;
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

                                    adapter.setForeignState(id, state.val, function () {
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
                            });
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
                    findState(_id, function (id, originId) {
                        if (!id) {
                            cnt--;
                            response.push({error:  'error: datapoint "' + originId + '" not found'});
                            if (!cnt) doResponse(res, responseType, status, headers, response, values.prettyPrint);
                        } else {
                            adapter.setForeignState(id, values[originId], function (err, id) {
                                cnt--;
                                response.push({id:  id, val: values[originId]});
                                if (!cnt) doResponse(res, responseType, status, headers, response, values.prettyPrint);
                            });
                        }
                    });
                }
                break;

            case 'getObjects':
            case 'objects':
                adapter.getForeignObjects(values.pattern || parts[2] || '*', function (err, list) {
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
                adapter.getForeignStates(values.pattern || parts[2] || '*', function (err, list) {
                    if (err) {
                        status = 500;
                        doResponse(res, responseType, status, headers, {error: JSON.stringify(err)}, values.prettyPrint);
                    } else {
                        status = 200;
                        doResponse(res, responseType, status, headers, list, values.prettyPrint);
                    }
                });
                break;

            default:
                var obj =  {error: 'command ' + command + ' unknown'};
                var request = 'http' + (settings.secure ? 's' : '') + '://' + req.headers.host;
                var auth = '';
                if (that.settings.auth) auth = 'user=UserName&pass=Password';
                obj.getPlainValue = request + '/getPlainValue/admin.0.memHeapTotal' + (auth ? '?' + auth : '');
                obj.get           = request + '/get/admin.0.memHeapTotal/?prettyPrint' + (auth ? '&' + auth : '');
                obj.getBulk       = request + '/getBulk/admin.0.memHeapTotal,admin.0.memHeapUsed/?prettyPrint' + (auth ? '&' + auth : '');
                obj.set           = request + '/set/hm-rpc.0.IEQ12345.LEVEL?value=1&prettyPrint' + (auth ? '&' + auth : '');
                obj.set           = request + '/toggle/hm-rpc.0.IEQ12345.LEVEL&prettyPrint' + (auth ? '&' + auth : '');
                obj.setBulk       = request + '/setBulk?hm-rpc.0.FEQ1234567:1.LEVEL=0.7&Anwesenheit=0&prettyPrint' + (auth ? '&' + auth : '');
                obj.objects       = request + '/objects?pattern=system.adapter.admin.0*&prettyPrint' + (auth ? '&' + auth : '');
                obj.states        = request + '/states?pattern=system.adapter.admin.0*&prettyPrint' + (auth ? '&' + auth : '');

                doResponse(res, responseType, status, headers, obj, true);
                break;
        }
    };
}

module.exports = SimpleAPI;
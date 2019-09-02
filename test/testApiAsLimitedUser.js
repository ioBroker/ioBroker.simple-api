/* jshint -W097 */// jshint strict:false
/*jslint node: true */
/*jshint expr: true*/
var expect  = require('chai').expect;
var setup   = require('./lib/setup');
var request = require('request');

var objects = null;
var states  = null;

const PORT = 18183;

process.env.NO_PROXY = '127.0.0.1';

function checkConnectionOfAdapter(cb, counter) {
    counter = counter || 0;
    console.log('Try check #' + counter);
    if (counter > 30) {
        if (cb) cb('Cannot check connection');
        return;
    }

    states.getState('system.adapter.simple-api.0.alive', function (err, state) {
        if (err) console.error(err);
        if (state && state.val) {
            if (cb) cb();
        } else {
            setTimeout(function () {
                checkConnectionOfAdapter(cb, counter + 1);
            }, 1000);
        }
    });
}

describe('Test RESTful API as Owner-User', function() {
    before('Test RESTful API as Owner-User: Start js-controller', function (_done) {
        this.timeout(600000); // because of first install from npm
        setup.adapterStarted = false;

        var brokerStarted   = false;
        setup.setupController(() => {
            const config = setup.getAdapterConfig();
            // enable adapter
            config.common.enabled = true;
            config.common.loglevel = 'debug';
            config.native.port = PORT;
            config.native.defaultUser = 'myuser';
            config.native.onlyAllowWhenUserIsOwner = true;
            setup.setAdapterConfig(config.common, config.native);

            setup.startController(function (_objects, _states) {
                objects = _objects;
                states  = _states;
                // give some time to start server
                setTimeout(() => _done(), 2000);
            });
        });
    });

    it('Test adapter: Check if adapter started and create upload datapoint', function (done) {
        this.timeout(60000);
        checkConnectionOfAdapter(function (res) {
            if (res) console.log(res);
            expect(res).not.to.be.equal('Cannot check connection');
            objects.setObject('system.group.writer', {
              "common": {
                "name": "Writer",
                "desc": "",
                "members": [
                  "system.user.myuser"
                ],
                "acl": {
                  "object": {
                    "list": true,
                    "read": true,
                    "write": false,
                    "delete": false
                  },
                  "state": {
                    "list": false,
                    "read": true,
                    "write": true,
                    "create": false,
                    "delete": false
                  },
                  "users": {
                    "write": false,
                    "create": false,
                    "delete": false
                  },
                  "other": {
                    "execute": false,
                    "http": false,
                    "sendto": false
                  },
                  "file": {
                    "list": false,
                    "read": false,
                    "write": false,
                    "create": false,
                    "delete": false
                  }
                }
              },
              "native": {},
              "acl": {
                "object": 1638,
                "owner": "system.user.admin",
                "ownerGroup": "system.group.administrator"
              },
              "_id": "system.group.writer",
              "type": "group"
            }, function (err) {
                expect(err).to.be.null;

                objects.setObject('system.user.myuser', {
                    "type": "user",
                    "common": {
                        "name": "myuser",
                        "enabled": true,
                        "groups": [],
                        "password": "pbkdf2$10000$ab4104d8bb68390ee7e6c9397588e768de6c025f0c732c18806f3d1270c83f83fa86a7bf62583770e5f8d0b405fbb3ad32214ef3584f5f9332478f2506414443a910bf15863b36ebfcaa7cbb19253ae32cd3ca390dab87b29cd31e11be7fa4ea3a01dad625d9de44e412680e1a694227698788d71f1e089e5831dc1bbacfa794b45e1c995214bf71ee4160d98b4305fa4c3e36ee5f8da19b3708f68e7d2e8197375c0f763d90e31143eb04760cc2148c8f54937b9385c95db1742595634ed004fa567655dfe1d9b9fa698074a9fb70c05a252b2d9cf7ca1c9b009f2cd70d6972ccf0ee281d777d66a0346c6c6525436dd7fe3578b28dca2c7adbfde0ecd45148$31c3248ba4dc9600a024b4e0e7c3e585"
                    },
                    "_id": "system.user.myuser",
                    "native": {},
                    "acl": {
                        "object": 1638
                    }
                }, function (err) {
                    expect(err).to.be.null;
                    objects.setObject('javascript.0.test', {
                        common: {
                            name: 'test',
                            type: 'number',
                            role: 'level',
                            min: -100,
                            max: 100,
                            def: 1
                        },
                        native: {
                        },
                        type: 'state',
                        acl: {
                            object: 1638,
                            owner: "system.user.myuser",
                            ownerGroup:"system.group.administrator",
                            state: 1638
                        }
                    }, function (err) {
                        expect(err).to.be.null;
                        states.setState('javascript.0.test',1, function(err) {
                            console.log('END javascript.0.test ' + err);
                            expect(err).to.be.null;
                            objects.setObject('javascript.0.test-number', {
                                common: {
                                    name: 'test',
                                    type: 'number',
                                    role: 'value',
                                    def: 0
                                },
                                native: {
                                },
                                type: 'state'
                            }, err => {
                                expect(err).to.be.null;
                                states.setState('javascript.0.test-number', 0, err => {
                                    expect(err).to.be.null;
                                    done();
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    it('Test RESTful API as Owner-User: get - must return value', function (done) {
        console.log('START get/system.adapter.simple-api.0.alive');
        request('http://127.0.0.1:' + PORT + '/get/system.adapter.simple-api.0.alive', (error, response, body) => {
            console.log('get/system.adapter.simple-api.0.alive => ' + body);
            expect(error).to.be.not.ok;
            expect(body).to.be.equal('error: permissionError');
            expect(response.statusCode).to.equal(401);
            done();
        });
    });

    it('Test RESTful API as Owner-User: getPlainValue - must return plain value', function (done) {
        request('http://127.0.0.1:' + PORT + '/getPlainValue/system.adapter.simple-api.0.alive', (error, response, body) => {
            console.log('getPlainValue/system.adapter.simple-api.0.alive => ' + body);
            expect(body).to.be.equal('error: permissionError');
            expect(response.statusCode).to.equal(401);
            done();
        });
    });

    it('Test RESTful API as Owner-User: getPlainValue 4 Test-Endpoint - must return plain value', function (done) {
        request('http://127.0.0.1:' + PORT + '/getPlainValue/javascript.0.test', (error, response, body) => {
            console.log('getPlainValue/javascript.0.test => ' + body);
            expect(error).to.be.not.ok;
            expect(body).equal('1');
            expect(response.statusCode).to.equal(200);
            done();
        });
    });

    it('Test RESTful API as Owner-User: set 4 Test-Endpoint  - must set value', function (done) {
        request('http://127.0.0.1:' + PORT + '/set/javascript.0.test?val=2', (error, response, body) => {
            console.log('set/javascript.0.test?val=false => ' + body);
            expect(error).to.be.not.ok;
            var obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj.val).to.be.equal(2);
            expect(obj.id).to.equal('javascript.0.test');
            expect(response.statusCode).to.equal(200);
            request('http://127.0.0.1:' + PORT + '/getPlainValue/javascript.0.test', (error, response, body) => {
                console.log('getPlainValue/javascript.0.test => ' + body);
                expect(error).to.be.not.ok;
                expect(body).equal('2');
                expect(response.statusCode).to.equal(200);
                done();
            });
        });
    });

    it('Test RESTful API as Owner-User: set - must set value', function (done) {
        request('http://127.0.0.1:' + PORT + '/set/system.adapter.simple-api.0.alive?val=false', (error, response, body) => {
            console.log('set/system.adapter.simple-api.0.alive?val=false => ' + body);
            expect(body).to.be.equal('error: permissionError');
            expect(response.statusCode).to.equal(401);
            done();
        });
    });

    it('Test RESTful API as Owner-User: set - must set val', function (done) {
        request('http://127.0.0.1:' + PORT + '/set/system.adapter.simple-api.0.alive?val=true', (error, response, body) => {
            console.log('set/system.adapter.simple-api.0.alive?val=true => ' + body);
            expect(body).to.be.equal('error: permissionError');
            expect(response.statusCode).to.equal(401);
            done();
        });
    });


    it('Test RESTful API as Owner-User: objects - must return objects', function (done) {
        request('http://127.0.0.1:' + PORT + '/objects?pattern=system.adapter.*', (error, response, body) => {
            //console.log('objects?pattern=system.adapter.* => ' + body);
            expect(!!body).to.be.true;
            expect(response.statusCode).to.equal(200);
            done();
        });
    });

    it('Test RESTful API as Owner-User: objects - must return objects', function (done) {
        request('http://127.0.0.1:' + PORT + '/objects?pattern=system.adapter.*&type=instance', (error, response, body) => {
            //console.log('objects?pattern=system.adapter.* => ' + body);
            //expect(body).to.be.equal('error: permissionError');
            expect(!!body).to.be.true;
            expect(response.statusCode).to.equal(200);
            done();
        });
    });

    it('Test RESTful API as Owner-User: states - must return states', function (done) {
        request('http://127.0.0.1:' + PORT + '/states?pattern=system.adapter.*', (error, response, body) => {
            console.log('states?pattern=system.adapter.* => ' + body);
            expect(body).to.be.equal('error: permissionError');
            expect(response.statusCode).to.equal(401);
            done();
        });
    });

    it('Test RESTful API as Owner-User: setValueFromBody(POST) - must set one value', function (done) {
        request({
            uri: 'http://127.0.0.1:' + PORT + '/setValueFromBody/system.adapter.simple-api.upload',
            method: 'POST',
            body: '55'
        }, (error, response, body) => {
            console.log('setValueFromBody/?system.adapter.simple-api.upload => ' + JSON.stringify(body));
            expect(body).to.be.equal('error: permissionError');
            expect(response.statusCode).to.equal(401);
            done();
        });
    });

    after('Test RESTful API as Owner-User: Stop js-controller', function (done) {
        this.timeout(6000);
        setup.stopController(normalTerminated => {
            console.log('Adapter normal terminated: ' + normalTerminated);
            done();
        });
    });
});

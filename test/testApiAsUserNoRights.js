/* jshint -W097 */// jshint strict:false
/*jslint node: true */
/*jshint expr: true*/
const expect  = require('chai').expect;
const setup   = require(__dirname + '/lib/setup');
const request = require('request');

let objects = null;
let states  = null;
const TEST_STATE_ID = 'simple-api.0.testNumber';

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

function createTestState(cb) {
    objects.setObject(TEST_STATE_ID, {
        _id: TEST_STATE_ID,
        type: 'state',
        common: {
            name: 'Test state',
            type: 'number',
            read: true,
            write: false,
            role: 'indicator.state',
            unit: '%',
            def: 0,
            desc: 'test state'
        },
        native: {}
    }, () => {
        states.setState(TEST_STATE_ID, {val: 0, ack: true}, cb && cb);
    });
}

describe('Test RESTful API as User(No rights)', function() {
    before('Test RESTful API as User:(No rights) Start js-controller', function (_done) {
        this.timeout(600000); // because of first install from npm
        setup.adapterStarted = false;

        setup.setupController(function () {
            const config = setup.getAdapterConfig();
            // enable adapter
            config.common.enabled = true;
            config.common.loglevel = 'debug';
            config.native.port = 18183;
            config.native.defaultUser = 'norights';
            setup.setAdapterConfig(config.common, config.native);

            setup.startController(function (_objects, _states) {
                objects = _objects;
                states  = _states;
                // give some time to start server
                setTimeout(() => createTestState(() => _done()), 2000);
            });
        });
    });

    it('Test adapter: Check if adapter started and create upload datapoint', done => {
        this.timeout(60000);
        checkConnectionOfAdapter(function (res) {
            if (res) console.log(res);
            expect(res).not.to.be.equal('Cannot check connection');
            objects.setObject('system.group.norights', {
              "common": {
                "name": "norights",
                "desc": "",
                "members": [
                  "system.user.norights"
                ],
                "acl": {
                  "object": {
                    "list": false,
                    "read": false,
                    "write": false,
                    "delete": false
                  },
                  "state": {
                    "list": true,
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
              "_id": "system.group.norights",
              "type": "group"
            }, function (err) {
                expect(err).to.be.null;

                objects.setObject('system.user.norights', {
                    "type": "user",
                    "common": {
                        "name": "norights",
                        "enabled": true,
                        "groups": [],
                        "password": "pbkdf2$10000$ab4104d8bb68390ee7e6c9397588e768de6c025f0c732c18806f3d1270c83f83fa86a7bf62583770e5f8d0b405fbb3ad32214ef3584f5f9332478f2506414443a910bf15863b36ebfcaa7cbb19253ae32cd3ca390dab87b29cd31e11be7fa4ea3a01dad625d9de44e412680e1a694227698788d71f1e089e5831dc1bbacfa794b45e1c995214bf71ee4160d98b4305fa4c3e36ee5f8da19b3708f68e7d2e8197375c0f763d90e31143eb04760cc2148c8f54937b9385c95db1742595634ed004fa567655dfe1d9b9fa698074a9fb70c05a252b2d9cf7ca1c9b009f2cd70d6972ccf0ee281d777d66a0346c6c6525436dd7fe3578b28dca2c7adbfde0ecd45148$31c3248ba4dc9600a024b4e0e7c3e585"
                    },
                    "_id": "system.user.norights",
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
                            owner: "system.user.norights",
                            ownerGroup:"system.group.administrator",
                            state: 1638
                        }
                    }, function (err) {
                        expect(err).to.be.null;
                        states.setState('javascript.0.test',1, function(err) {
                            expect(err).to.be.null;
                            done();
                        });
                    });
                });
            });
        });
    });

    it('Test RESTful API as User:(No rights) get - must return value', done => {
        request('http://127.0.0.1:18183/get/system.adapter.simple-api.0.alive', (error, response, body) => {
            console.log('get/system.adapter.simple-api.0.alive => ' + body);
            expect(body).to.be.equal('{"error":"permissionError"}');
            expect(response.statusCode).to.equal(401);
            done();
        });
    });

    it('Test RESTful API as User:(No rights) getPlainValue - must return plain value', done => {
        request('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', (error, response, body) => {
            console.log('getPlainValue/system.adapter.simple-api.0.alive => ' + body);
            expect(body).to.be.equal('error: Error: permissionError');
            expect(response.statusCode).to.equal(401);
            done();
        });
    });

    it('Test RESTful API as User:(No rights) getPlainValue 4 Test-Endpoint - must return plain value', done => {
        request('http://127.0.0.1:18183/getPlainValue/javascript.0.test', (error, response, body) => {
            console.log('getPlainValue/javascript.0.test => ' + body);
            expect(body).to.be.equal('error: Error: permissionError');
            expect(response.statusCode).to.equal(401);
            done();
        });
    });

    it('Test RESTful API as User:(No rights) set 4 Test-Endpoint  - must set value', done => {
        request('http://127.0.0.1:18183/set/javascript.0.test?val=2', (error, response, body) => {
            console.log('set/javascript.0.test?val=false => ' + body);
            expect(body).to.be.equal('{"error":"permissionError"}');
            expect(response.statusCode).to.equal(401);
            request('http://127.0.0.1:18183/getPlainValue/javascript.0.test', (error, response, body) => {
                console.log('getPlainValue/javascript.0.test => ' + body);
                expect(body).to.be.equal('error: permissionError');
                expect(response.statusCode).to.equal(401);
                done();
            });
        });
    });

    it('Test RESTful API as User:(No rights) set - must set value', done => {
        request('http://127.0.0.1:18183/set/system.adapter.simple-api.0.alive?val=false', (error, response, body) => {
            console.log('set/system.adapter.simple-api.0.alive?val=false => ' + body);
            expect(body).to.be.equal('{"error":"permissionError"}');
            expect(response.statusCode).to.equal(401);
            request('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', (error, response, body) => {
                console.log('getPlainValue/system.adapter.simple-api.0.alive => ' + body);
                expect(body).to.be.equal('error: permissionError');
                expect(response.statusCode).to.equal(401);
                done();
            });
        });
    });

    it('Test RESTful API as User:(No rights) set - must set val', done => {
        request('http://127.0.0.1:18183/set/system.adapter.simple-api.0.alive?val=true', (error, response, body) => {
            console.log('set/system.adapter.simple-api.0.alive?val=true => ' + body);
            expect(body).to.be.equal('{"error":"permissionError"}');
            expect(response.statusCode).to.equal(401);
            request('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', (error, response, body) => {
                console.log('getPlainValue/system.adapter.simple-api.0.alive => ' + body);
                expect(body).to.be.equal('error: permissionError');
                expect(response.statusCode).to.equal(401);
                done();
            });
        });
    });

    it('Test RESTful API as User:(No rights) objects - must return objects', done => {
        request('http://127.0.0.1:18183/objects?pattern=system.adapter.*', (error, response, body) => {
            console.log('objects?pattern=system.adapter.* => ' + body);
            expect(body).to.be.equal('{"error":"permissionError"}');
            expect(response.statusCode).to.equal(401);
            done();
        });
    });

    it('Test RESTful API as User:(No rights) objects - must return objects', done => {
        request('http://127.0.0.1:18183/objects?pattern=system.adapter.*&type=instance', (error, response, body) => {
            console.log('objects?pattern=system.adapter.* => ' + body);
            expect(body).to.be.equal('{"error":"permissionError"}');
            expect(response.statusCode).to.equal(401);
            done();
        });
    });

    it('Test RESTful API as User:(No rights) states - must return states', done => {
        request('http://127.0.0.1:18183/states?pattern=system.adapter.*', (error, response, body) => {
            console.log('states?pattern=system.adapter.* => ' + body);
            expect(body).to.be.equal('{"error":"permissionError"}');
            expect(response.statusCode).to.equal(401);
            done();
        });
    });

    it('Test RESTful API as User:(No rights) setBulk(POST) - must set values', done => {
        request({
            uri: 'http://127.0.0.1:18183/setBulk',
            method: 'POST',
            body: `${TEST_STATE_ID}=50&system.adapter.simple-api.0.alive=false&javascript.0.test=4`
        }, (error, response, body) => {
            console.log(`setBulk/?${TEST_STATE_ID}=50&system.adapter.simple-api.0.alive=false&javascript.0.test=4 => ${JSON.stringify(body)}`);
            expect(body).to.be.equal('{"error":"permissionError"}');
            expect(response.statusCode).to.equal(401);

            request(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive,javascript.0.test`, (error, response, body) => {
                console.log(`getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive,javascript.0.test => ${body}`);
                expect(body).to.be.equal('{"error":"permissionError"}');
                expect(response.statusCode).to.equal(401);
                done();
            });
        });
    });

    it('Test RESTful API as User:(No rights) setBulk(POST-GET-Mix) - must set values', done => {

        request({
            uri: `http://127.0.0.1:18183/setBulk?${TEST_STATE_ID}=51&system.adapter.simple-api.0.alive=false`,
            method: 'POST',
            body: ''
        }, (error, response, body) => {
            console.log(`setBulk/?${TEST_STATE_ID}=51&system.adapter.simple-api.0.alive=false => ` + JSON.stringify(body));
            expect(body).to.be.equal('{"error":"permissionError"}');
            expect(response.statusCode).to.equal(401);

            request(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive`, (error, response, body) => {
                console.log(`getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive => ` + body);
                expect(body).to.be.equal('{"error":"permissionError"}');
                expect(response.statusCode).to.equal(401);
                done();
            });
        });
    });

    it('Test RESTful API as User:(No rights) setValueFromBody(POST) - must set one value', done => {
        request({
            uri: `http://127.0.0.1:18183/setValueFromBody/${TEST_STATE_ID}`,
            method: 'POST',
            body: '55'
        }, (error, response, body) => {
            console.log(`setValueFromBody/?${TEST_STATE_ID} => ` + JSON.stringify(body));
            expect(body).to.be.equal('{"error":"permissionError"}');
            expect(response.statusCode).to.equal(401);

            request(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID}`, (error, response, body) => {
                console.log(`getBulk/${TEST_STATE_ID} => ` + body);
                expect(body).to.be.equal('{"error":"permissionError"}');
                expect(response.statusCode).to.equal(401);
                done();
            });
        });
    });

    after('Test RESTful API as User:(No rights) Stop js-controller', function (done) {
        this.timeout(6000);
        setup.stopController((normalTerminated) => {
            console.log('Adapter normal terminated: ' + normalTerminated);
            done();
        });
    });
});

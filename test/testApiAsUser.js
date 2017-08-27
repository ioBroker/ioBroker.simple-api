/* jshint -W097 */// jshint strict:false
/*jslint node: true */
/*jshint expr: true*/
var expect  = require('chai').expect;
var setup   = require(__dirname + '/lib/setup');
var request = require('request');

var objects = null;
var states  = null;

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

describe('Test RESTful API as User', function() {
    before('Test RESTful API as User: Start js-controller', function (_done) {
        this.timeout(600000); // because of first install from npm
        setup.adapterStarted = false;

        var brokerStarted   = false;
        setup.setupController(function () {
            var config = setup.getAdapterConfig();
            // enable adapter
            config.common.enabled = true;
            config.common.loglevel = 'debug';
            config.native.port = 18183;
            config.native.defaultUser = 'myuser';
            setup.setAdapterConfig(config.common, config.native);

            setup.startController(function (_objects, _states) {
                objects = _objects;
                states  = _states;
                // give some time to start server
                setTimeout(function () {
                    _done();
                }, 2000);
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
                    "list": false,
                    "read": false,
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
                            expect(err).to.be.null;
                            done();
                        });
                    });
                });
            });
        });
    });

    it('Test RESTful API as User: get - must return value', function (done) {
        request('http://127.0.0.1:18183/get/system.adapter.simple-api.0.alive', function (error, response, body) {
            console.log('get/system.adapter.simple-api.0.alive => ' + body);
            expect(error).to.be.not.ok;
            var obj = JSON.parse(body);
            //{
            //    "val" : true,
            //    "ack" : true,
            //    "ts" : 1455009717,
            //    "q" : 0,
            //    "from" : "system.adapter.simple-api.0",
            //    "lc" : 1455009717,
            //    "expire" : 30000,
            //    "_id" : "system.adapter.simple-api.0.alive",
            //    "type" : "state",
            //    "common" : {
            //      "name" : "simple-api.0.alive",
            //        "type" : "boolean",
            //        "role" : "indicator.state"
            //       },
            //    "native" : {}
            //
            //}

            expect(obj).to.be.ok;
            expect(obj.val).to.be.true;
            expect(obj.ack).to.be.true;
            expect(obj.ts).to.be.ok;
            expect(obj.from).to.equal("system.adapter.simple-api.0");
            expect(obj.type).to.equal("state");
            expect(obj._id).to.equal("system.adapter.simple-api.0.alive");
            expect(obj.common).to.be.ok;
            expect(obj.native).to.be.ok;
            expect(obj.common.name).to.equal("simple-api.0.alive");
            expect(obj.common.role).to.equal("indicator.state");
            done();
        });
    });

    it('Test RESTful API as User: getPlainValue - must return plain value', function (done) {
        request('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', function (error, response, body) {
            console.log('getPlainValue/system.adapter.simple-api.0.alive => ' + body);
            expect(error).to.be.not.ok;
            expect(body).equal('true');
            done();
        });
    });

    it('Test RESTful API as User: getPlainValue 4 Test-Endpoint - must return plain value', function (done) {
        request('http://127.0.0.1:18183/getPlainValue/javascript.0.test', function (error, response, body) {
            console.log('getPlainValue/javascript.0.test => ' + body);
            expect(error).to.be.not.ok;
            expect(body).equal('1');
            done();
        });
    });

    it('Test RESTful API as User: set 4 Test-Endpoint  - must set value', function (done) {
        request('http://127.0.0.1:18183/set/javascript.0.test?val=2', function (error, response, body) {
            console.log('set/javascript.0.test?val=false => ' + body);
            expect(error).to.be.not.ok;
            var obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj.val).to.be.equal(2);
            expect(obj.id).to.equal('javascript.0.test');
            request('http://127.0.0.1:18183/getPlainValue/javascript.0.test', function (error, response, body) {
                console.log('getPlainValue/javascript.0.test => ' + body);
                expect(error).to.be.not.ok;
                expect(body).equal('2');
                done();
            });
        });
    });

    it('Test RESTful API as User: set - must set value', function (done) {
        request('http://127.0.0.1:18183/set/system.adapter.simple-api.0.alive?val=false', function (error, response, body) {
            console.log('set/system.adapter.simple-api.0.alive?val=false => ' + body);
            expect(error).to.be.not.ok;
            var obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj.val).to.be.false;
            expect(obj.id).to.equal('system.adapter.simple-api.0.alive');
            request('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', function (error, response, body) {
                console.log('getPlainValue/system.adapter.simple-api.0.alive => ' + body);
                expect(error).to.be.not.ok;
                expect(body).equal('false');
                done();
            });
        });
    });

    it('Test RESTful API as User: set - must set val', function (done) {
        request('http://127.0.0.1:18183/set/system.adapter.simple-api.0.alive?val=true', function (error, response, body) {
            console.log('set/system.adapter.simple-api.0.alive?val=true => ' + body);
            expect(error).to.be.not.ok;
            var obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj.val).to.be.true;
            expect(obj.id).to.equal('system.adapter.simple-api.0.alive');
            request('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', function (error, response, body) {
                console.log('getPlainValue/system.adapter.simple-api.0.alive => ' + body);
                expect(error).to.be.not.ok;
                expect(body).equal('true');
                done();
            });
        });
    });

    it('Test RESTful API as User: toggle - must toggle boolean value to false', function (done) {
        request('http://127.0.0.1:18183/toggle/system.adapter.simple-api.0.alive', function (error, response, body) {
            console.log('toggle/system.adapter.simple-api.0.alive => ' + body);
            expect(error).to.be.not.ok;
            var obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj.val).to.be.false;
            expect(obj.id).to.equal('system.adapter.simple-api.0.alive');

            request('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', function (error, response, body) {
                console.log('getPlainValue/system.adapter.simple-api.0.alive => ' + body);
                expect(error).to.be.not.ok;
                expect(body).equal('false');
                done();
            });
        });
    });

    it('Test RESTful API as User: toggle - must toggle boolean value to true', function (done) {
        request('http://127.0.0.1:18183/toggle/system.adapter.simple-api.0.alive', function (error, response, body) {
            console.log('toggle/system.adapter.simple-api.0.alive => ' + body);
            expect(error).to.be.not.ok;
            var obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj.val).to.be.true;
            expect(obj.id).to.equal('system.adapter.simple-api.0.alive');

            request('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', function (error, response, body) {
                console.log('getPlainValue/system.adapter.simple-api.0.alive => ' + body);
                expect(error).to.be.not.ok;
                expect(body).equal('true');
                done();
            });
        });
    });

    it('Test RESTful API as User: toggle - must toggle number value to 100', function (done) {
        request('http://127.0.0.1:18183/toggle/system.adapter.simple-api.upload', function (error, response, body) {
            console.log('toggle/system.adapter.simple-api.upload => ' + body);
            expect(error).to.be.not.ok;
            var obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj.val).to.be.equal(100);
            expect(obj.id).to.equal('system.adapter.simple-api.upload');

            request('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.upload', function (error, response, body) {
                console.log('getPlainValue/system.adapter.simple-api.upload => ' + body);
                expect(error).to.be.not.ok;
                expect(body).equal('100');
                request('http://127.0.0.1:18183/set/system.adapter.simple-api.upload?val=49', function (error, response, body) {
                    console.log('set/system.adapter.simple-api.upload?val=49 => ' + body);
                    request('http://127.0.0.1:18183/toggle/system.adapter.simple-api.upload', function (error, response, body) {
                        console.log('toggle/system.adapter.simple-api.upload => ' + body);
                        expect(error).to.be.not.ok;
                        var obj = JSON.parse(body);
                        expect(obj).to.be.ok;
                        expect(obj.val).to.be.equal(51);
                        expect(obj.id).to.equal('system.adapter.simple-api.upload');

                        request('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.upload', function (error, response, body) {
                            console.log('getPlainValue/system.adapter.simple-api.upload => ' + body);
                            expect(error).to.be.not.ok;
                            expect(body).equal('51');
                            done();
                        });
                    });
                });
            });
        });
    });

    it('Test RESTful API as User: setBulk - must set values', function (done) {
        request('http://127.0.0.1:18183/setBulk/?system.adapter.simple-api.upload=50&system.adapter.simple-api.0.alive=false&javascript.0.test=3', function (error, response, body) {
            console.log('setBulk/?system.adapter.simple-api.upload=50&system.adapter.simple-api.0.alive=false&javascript.0.test=3 => ' + body);
            expect(error).to.be.not.ok;

            var obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj[0].val).to.be.equal(50);
            expect(obj[0].id).to.equal('system.adapter.simple-api.upload');
            expect(obj[1].val).to.be.equal(false);
            expect(obj[1].id).to.equal('system.adapter.simple-api.0.alive');
            expect(obj[2].val).to.be.equal(3);
            expect(obj[2].id).to.equal('javascript.0.test');

            request('http://127.0.0.1:18183/getBulk/system.adapter.simple-api.upload,system.adapter.simple-api.0.alive,javascript.0.test', function (error, response, body) {
                console.log('getBulk/system.adapter.simple-api.upload,system.adapter.simple-api.0.alive&javascript.0.test => ' + body);
                expect(error).to.be.not.ok;
                var obj = JSON.parse(body);
                expect(obj[0].val).equal(50);
                expect(obj[1].val).equal(false);
                expect(obj[2].val).equal(3);
                done();
            });
        });
    });

    it('Test RESTful API as User: objects - must return objects', function (done) {
        request('http://127.0.0.1:18183/objects?pattern=system.adapter.*', function (error, response, body) {
            console.log('objects?pattern=system.adapter.* => ' + body);
            expect(body).to.be.equal('error: permissionError');
            done();
        });
    });

    it('Test RESTful API as User: objects - must return objects', function (done) {
        request('http://127.0.0.1:18183/objects?pattern=system.adapter.*&type=instance', function (error, response, body) {
            console.log('objects?pattern=system.adapter.* => ' + body);
            expect(body).to.be.equal('error: permissionError');
            done();
        });
    });

    it('Test RESTful API as User: states - must return states', function (done) {
        request('http://127.0.0.1:18183/states?pattern=system.adapter.*', function (error, response, body) {
            console.log('states?pattern=system.adapter.* => ' + body);
            expect(body).to.be.equal('error: permissionError');
            done();
        });
    });

    it('Test RESTful API as User: setBulk(POST) - must set values', function (done) {

        request({
            uri: 'http://127.0.0.1:18183/setBulk',
            method: 'POST',
            body: 'system.adapter.simple-api.upload=50&system.adapter.simple-api.0.alive=false&javascript.0.test=4'
        }, function(error, response, body) {
            console.log('setBulk/?system.adapter.simple-api.upload=50&system.adapter.simple-api.0.alive=false&javascript.0.test=4 => ' + JSON.stringify(body));
            expect(error).to.be.not.ok;

            var obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj[0].val).to.be.equal(50);
            expect(obj[0].id).to.equal('system.adapter.simple-api.upload');
            expect(obj[1].val).to.be.equal(false);
            expect(obj[1].id).to.equal('system.adapter.simple-api.0.alive');
            expect(obj[2].val).to.be.equal(4);
            expect(obj[2].id).to.equal('javascript.0.test');

            request('http://127.0.0.1:18183/getBulk/system.adapter.simple-api.upload,system.adapter.simple-api.0.alive,javascript.0.test', function (error, response, body) {
                console.log('getBulk/system.adapter.simple-api.upload,system.adapter.simple-api.0.alive,javascript.0.test => ' + body);
                expect(error).to.be.not.ok;
                var obj = JSON.parse(body);
                expect(obj[0].val).equal(50);
                expect(obj[1].val).equal(false);
                expect(obj[2].val).equal(4);
                done();
            });
        });
    });

    it('Test RESTful API as User: setBulk(POST-GET-Mix) - must set values', function (done) {

        request({
            uri: 'http://127.0.0.1:18183/setBulk?system.adapter.simple-api.upload=51&system.adapter.simple-api.0.alive=false',
            method: 'POST',
            body: ''
        }, function(error, response, body) {
            console.log('setBulk/?system.adapter.simple-api.upload=51&system.adapter.simple-api.0.alive=false => ' + JSON.stringify(body));
            expect(error).to.be.not.ok;

            var obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj[0].val).to.be.equal(51);
            expect(obj[0].id).to.equal('system.adapter.simple-api.upload');
            expect(obj[1].val).to.be.equal(false);
            expect(obj[1].id).to.equal('system.adapter.simple-api.0.alive');

            request('http://127.0.0.1:18183/getBulk/system.adapter.simple-api.upload,system.adapter.simple-api.0.alive', function (error, response, body) {
                console.log('getBulk/system.adapter.simple-api.upload,system.adapter.simple-api.0.alive => ' + body);
                expect(error).to.be.not.ok;
                var obj = JSON.parse(body);
                expect(obj[0].val).equal(51);
                expect(obj[1].val).equal(false);
                done();
            });
        });
    });

    it('Test RESTful API as User: setValueFromBody(POST) - must set one value', function (done) {
        request({
            uri: 'http://127.0.0.1:18183/setValueFromBody/system.adapter.simple-api.upload',
            method: 'POST',
            body: '55'
        }, function(error, response, body) {
            console.log('setValueFromBody/?system.adapter.simple-api.upload => ' + JSON.stringify(body));
            expect(error).to.be.not.ok;

            var obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj[0].val).to.be.equal(55);
            expect(obj[0].id).to.equal('system.adapter.simple-api.upload');

            request('http://127.0.0.1:18183/getBulk/system.adapter.simple-api.upload', function (error, response, body) {
                console.log('getBulk/system.adapter.simple-api.upload => ' + body);
                expect(error).to.be.not.ok;
                var obj = JSON.parse(body);
                expect(obj[0].val).equal(55);
                done();
            });
        });
    });

    after('Test RESTful API as User: Stop js-controller', function (done) {
        this.timeout(6000);
        setup.stopController(function (normalTerminated) {
            console.log('Adapter normal terminated: ' + normalTerminated);
            done();
        });
    });
});

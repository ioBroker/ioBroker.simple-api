/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
/* jshint expr: true*/
const expect  = require('chai').expect;
const setup   = require('./lib/setup');
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

    states.getState('system.adapter.simple-api.0.alive', (err, state) => {
        if (err) console.error(err);
        if (state && state.val) {
            if (cb) cb();
        } else {
            setTimeout(() => checkConnectionOfAdapter(cb, counter + 1), 1000);
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

describe('Test RESTful API', function () {
    before('Test RESTful API: Start js-controller', function (_done) {
        this.timeout(600000); // because of first install from npm
        setup.adapterStarted = false;

        setup.setupController(() => {
            const config = setup.getAdapterConfig();
            // enable adapter
            config.common.enabled = true;
            config.common.loglevel = 'debug';
            config.native.port = 18183;
            setup.setAdapterConfig(config.common, config.native);

            setup.startController((_objects, _states) => {
                objects = _objects;
                states  = _states;

                // give some time to start server
                setTimeout(() => createTestState(() => _done()), 2000);
            });
        });
    });

    it('Test adapter: Check if adapter started and create datapoint', done => {
        checkConnectionOfAdapter(res => {
            res && console.log(res);
            expect(res).not.to.be.equal('Cannot check connection');
            objects.setObject('javascript.0.test-string', {
                common: {
                    name: 'test',
                    type: 'string',
                    role: 'value',
                    def: ''
                },
                native: {
                },
                type: 'state'
            }, err => {
                expect(err).to.be.null;
                states.setState('javascript.0.test-string', '', err => {
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
    }).timeout(60000);

    it('Test RESTful API: get - must return value', done => {
        request('http://127.0.0.1:18183/get/system.adapter.simple-api.0.alive', (error, response, body) => {
            console.log('get/system.adapter.simple-api.0.alive => ' + body);
            expect(error).to.be.not.ok;
            const obj = JSON.parse(body);
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
            //expect(obj.from).to.equal("system.adapter.simple-api.0");
            expect(obj.type).to.equal("state");
            expect(obj._id).to.equal("system.adapter.simple-api.0.alive");
            expect(obj.common).to.be.ok;
            expect(obj.native).to.be.ok;
            expect(obj.common.name).to.equal("simple-api.0 alive");
            expect(obj.common.role).to.equal("indicator.state");
            expect(response.statusCode).to.equal(200);
            done();
        });
    });

    it('Test RESTful API: get - must return error', done => {
        request('http://127.0.0.1:18183/get/system.adapter.simple-api.0.alive%23test', (error, response, body) => {
            console.log('get/system.adapter.simple-api.0.alive%23test => ' + body);
            expect(error).to.be.not.ok;
            expect(body).to.be.equal('{"error":"datapoint \\"system.adapter.simple-api.0.alive#test\\" not found"}');
            expect(response.statusCode).to.equal(500);
            done();
        });
    });

    it('Test RESTful API: get - must return error', done => {
        request('http://127.0.0.1:18183/get/system.adapter.simple-api.0.%23alive%23test', (error, response, body) => {
            console.log('get/system.adapter.simple-api.0.alive#%23test => ' + body);
            expect(error).to.be.not.ok;
            expect(body).to.be.equal('{"error":"datapoint \\"system.adapter.simple-api.0.#alive#test\\" not found"}');
            expect(response.statusCode).to.equal(500);
            done();
        });
    });

    it('Test RESTful API: getPlainValue - must return plain value', done => {
        request('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', (error, response, body) => {
            console.log('getPlainValue/system.adapter.simple-api.0.alive => ' + body);
            expect(error).to.be.not.ok;
            expect(body).equal('true');
            expect(response.statusCode).to.equal(200);
            done();
        });
    });

    it('Test RESTful API: set - must set value', done => {
        request('http://127.0.0.1:18183/set/system.adapter.simple-api.0.alive?val=false', (error, response, body) => {
            console.log('set/system.adapter.simple-api.0.alive?val=false => ' + body);
            expect(error).to.be.not.ok;
            const obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj.val).to.be.false;
            expect(obj.id).to.equal('system.adapter.simple-api.0.alive');
            expect(response.statusCode).to.equal(200);
            request('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', (error, response, body) => {
                console.log('getPlainValue/system.adapter.simple-api.0.alive => ' + body);
                expect(error).to.be.not.ok;
                expect(body).equal('false');
                expect(response.statusCode).to.equal(200);
                request('http://127.0.0.1:18183/get/system.adapter.simple-api.0.alive', (error, response, body) => {
                    console.log('get/system.adapter.simple-api.0.alive => ' + body);
                    expect(error).to.be.not.ok;
                    expect(JSON.parse(body).val).equal(false);
                    expect(response.statusCode).to.equal(200);
                    done();
                });
            });
        });
    });

    it('Test RESTful API: set - must set easy string value', done => {
        request('http://127.0.0.1:18183/set/javascript.0.test-string?val=bla', (error, response, body) => {
            console.log('set/javascript.0.test-string?val=bla => ' + body);
            expect(error).to.be.not.ok;
            const obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj.val).equal('bla');
            expect(obj.id).to.equal('javascript.0.test-string');
            expect(response.statusCode).to.equal(200);
            request('http://127.0.0.1:18183/getPlainValue/javascript.0.test-string', (error, response, body) => {
                console.log('getPlainValue/javascript.0.test-string => ' + body);
                expect(error).to.be.not.ok;
                expect(body).equal('"bla"');
                expect(response.statusCode).to.equal(200);
                request('http://127.0.0.1:18183/get/javascript.0.test-string', (error, response, body) => {
                    console.log('get/javascript.0.test-string => ' + body);
                    expect(error).to.be.not.ok;
                    expect(JSON.parse(body).val).equal('bla');
                    expect(response.statusCode).to.equal(200);
                    done();
                });
            });
        });
    });

    it('Test RESTful API: set - must set encoded string value', done => {
        request('http://127.0.0.1:18183/set/javascript.0.test-string?val=bla%26fasel%2efoo%3Dhummer+hey', (error, response, body) => {
            console.log('set/javascript.0.test-string?val=bla%20fasel%2efoo => ' + body);
            expect(error).to.be.not.ok;
            const obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj.val).equal('bla&fasel.foo=hummer hey');
            expect(obj.id).to.equal('javascript.0.test-string');
            expect(response.statusCode).to.equal(200);
            request('http://127.0.0.1:18183/getPlainValue/javascript.0.test-string', (error, response, body) => {
                console.log('getPlainValue/javascript.0.test-string => ' + body);
                expect(error).to.be.not.ok;
                expect(body).equal('"bla&fasel.foo=hummer hey"');
                expect(response.statusCode).to.equal(200);
                request('http://127.0.0.1:18183/get/javascript.0.test-string', (error, response, body) => {
                    console.log('get/javascript.0.test-string => ' + body);
                    expect(error).to.be.not.ok;
                    expect(JSON.parse(body).val).equal('bla&fasel.foo=hummer hey');
                    expect(response.statusCode).to.equal(200);
                    done();
                });
            });
        });
    });

    it('Test RESTful API: set - must set val', done => {
        request('http://127.0.0.1:18183/set/system.adapter.simple-api.0.alive?val=true', (error, response, body) => {
            console.log('set/system.adapter.simple-api.0.alive?val=true => ' + body);
            expect(error).to.be.not.ok;
            const obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj.val).to.be.true;
            expect(typeof obj.val).to.be.equal('boolean');
            expect(obj.id).to.equal('system.adapter.simple-api.0.alive');
            expect(response.statusCode).to.equal(200);
            request('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', (error, response, body) => {
                console.log('getPlainValue/system.adapter.simple-api.0.alive => ' + body);
                expect(error).to.be.not.ok;
                expect(body).equal('true');
                expect(response.statusCode).to.equal(200);
                done();
            });
        });
    });

    it('Test RESTful API: set - must have ack true', done => {
        request('http://127.0.0.1:18183/set/system.adapter.simple-api.0.alive?val=true&ack=true', (error, response, body) => {
            console.log('set/system.adapter.simple-api.0.alive?val=true => ' + body);
            expect(error).to.be.not.ok;
            const obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj.val).to.be.true;
            expect(typeof obj.val).to.be.equal('boolean');
            expect(obj.id).to.equal('system.adapter.simple-api.0.alive');
            expect(response.statusCode).to.equal(200);
            request('http://127.0.0.1:18183/get/system.adapter.simple-api.0.alive', (error, response, body) => {
                console.log('get/system.adapter.simple-api.0.alive => ' + body);
                try {
                    body = JSON.parse(body);
                } catch (e) {
                    expect(e).to.be.false;
                }

                expect(error).to.be.not.ok;
                expect(body.val).equal(true);
                expect(body.ack).equal(true);
                expect(response.statusCode).to.equal(200);
                done();
            });
        });
    });

    it('Test RESTful API: toggle - must toggle boolean value to false', done => {
        request('http://127.0.0.1:18183/toggle/system.adapter.simple-api.0.alive', (error, response, body) => {
            console.log('toggle/system.adapter.simple-api.0.alive => ' + body);
            expect(error).to.be.not.ok;
            const obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj.val).to.be.false;
            expect(typeof obj.val).to.be.equal('boolean');
            expect(obj.id).to.equal('system.adapter.simple-api.0.alive');
            expect(response.statusCode).to.equal(200);

            request('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', (error, response, body) => {
                console.log('getPlainValue/system.adapter.simple-api.0.alive => ' + body);
                expect(error).to.be.not.ok;
                expect(body).equal('false');
                expect(response.statusCode).to.equal(200);
                done();
            });
        });
    });

    it('Test RESTful API: toggle - must toggle boolean value to true', done => {
        request('http://127.0.0.1:18183/toggle/system.adapter.simple-api.0.alive', (error, response, body) => {
            console.log('toggle/system.adapter.simple-api.0.alive => ' + body);
            expect(error).to.be.not.ok;
            const obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj.val).to.be.true;
            expect(obj.id).to.equal('system.adapter.simple-api.0.alive');
            expect(response.statusCode).to.equal(200);

            request('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', (error, response, body) => {
                console.log('getPlainValue/system.adapter.simple-api.0.alive => ' + body);
                expect(error).to.be.not.ok;
                expect(body).equal('true');
                expect(response.statusCode).to.equal(200);
                done();
            });
        });
    });

    it('Test RESTful API: toggle - must toggle number value to 100', done => {
        request(`http://127.0.0.1:18183/toggle/${TEST_STATE_ID}`, (error, response, body) => {
            console.log(`toggle/${TEST_STATE_ID} => ${body}`);
            expect(error).to.be.not.ok;
            const obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj.val).to.be.equal(100);
            expect(typeof obj.val).to.be.equal('number');
            expect(obj.id).to.equal(TEST_STATE_ID);
            expect(response.statusCode).to.equal(200);

            request(`http://127.0.0.1:18183/getPlainValue/${TEST_STATE_ID}`, (error, response, body) => {
                console.log(`getPlainValue/${TEST_STATE_ID} => ${body}`);
                expect(error).to.be.not.ok;
                expect(body).equal('100');
                expect(response.statusCode).to.equal(200);
                request(`http://127.0.0.1:18183/set/${TEST_STATE_ID}?val=49`, (error, response, body) => {
                    console.log(`set/${TEST_STATE_ID}?val=49 => ${body}`);
                    request(`http://127.0.0.1:18183/toggle/${TEST_STATE_ID}`, (error, response, body) => {
                        console.log(`toggle/${TEST_STATE_ID} => ${body}`);
                        expect(error).to.be.not.ok;
                        const obj = JSON.parse(body);
                        expect(obj).to.be.ok;
                        expect(obj.val).to.be.equal(51);
                        expect(obj.id).to.equal(TEST_STATE_ID);
                        expect(response.statusCode).to.equal(200);

                        request(`http://127.0.0.1:18183/getPlainValue/${TEST_STATE_ID}`, (error, response, body) => {
                            console.log(`getPlainValue/${TEST_STATE_ID} => ${body}`);
                            expect(error).to.be.not.ok;
                            expect(body).equal('51');
                            expect(response.statusCode).to.equal(200);
                            done();
                        });
                    });
                });
            });
        });
    });

    it('Test RESTful API: setBulk - must set values', done => {
        request(`http://127.0.0.1:18183/setBulk?${TEST_STATE_ID}=50&system.adapter.simple-api.0.alive=false`, (error, response, body) => {
            console.log(`setBulk/?${TEST_STATE_ID}=50&system.adapter.simple-api.0.alive=false => ${body}`);
            expect(error).to.be.not.ok;

            const obj = JSON.parse(body);

            console.log(JSON.stringify(obj, null, 2));

            expect(obj).to.be.ok;
            expect(obj[0].val).to.be.equal(50);
            expect(obj[0].id).to.equal(TEST_STATE_ID);
            expect(obj[1].val).to.be.equal(false);
            expect(obj[1].id).to.equal('system.adapter.simple-api.0.alive');
            expect(response.statusCode).to.equal(200);

            request(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive`, (error, response, body) => {
                console.log(`getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive => ${body}`);
                expect(error).to.be.not.ok;
                const obj = JSON.parse(body);
                expect(obj[0].val).equal(50);
                expect(obj[1].val).equal(false);
                expect(response.statusCode).to.equal(200);
                done();
            });
        });
    });

    it('Test RESTful API: objects - must return objects', done => {
        request('http://127.0.0.1:18183/objects?pattern=system.adapter.*', (error, response, body) => {
            console.log('objects?pattern=system.adapter.* => ' + body);
            expect(error).to.be.not.ok;
            const obj = JSON.parse(body);
            expect(obj['system.adapter.simple-api.0.alive']._id).to.be.ok;
            expect(response.statusCode).to.equal(200);
            done();
        });
    });

    it('Test RESTful API: objects - must return objects', done => {
        request('http://127.0.0.1:18183/objects?pattern=system.adapter.*&type=instance', (error, response, body) => {
            console.log('objects?pattern=system.adapter.* => ' + body);
            expect(error).to.be.not.ok;
            const obj = JSON.parse(body);
            expect(obj['system.adapter.simple-api.0']._id).to.be.ok;
            expect(response.statusCode).to.equal(200);
            done();
        });
    });

    it('Test RESTful API: states - must return states', done => {
        request('http://127.0.0.1:18183/states?pattern=system.adapter.*', (error, response, body) => {
            console.log('states?pattern=system.adapter.* => ' + body);
            expect(error).to.be.not.ok;
            const states = JSON.parse(body);
            expect(states['system.adapter.simple-api.0.uptime'].val).to.be.least(0);
            expect(response.statusCode).to.equal(200);
            done();
        });
    });

    it('Test RESTful API: setBulk(POST) - must set values', done => {
        request({
            uri: 'http://127.0.0.1:18183/setBulk',
            method: 'POST',
            body: `${TEST_STATE_ID}=50&system.adapter.simple-api.0.alive=false&javascript.0.test-string=bla%26fasel%2efoo%3Dhummer+hey`
        }, (error, response, body) => {
            console.log(`setBulk/?${TEST_STATE_ID}=50&system.adapter.simple-api.0.alive=false&javascript.0.test-string=bla%26fasel%2efoo%3Dhummer+hey => ${JSON.stringify(body)}`);
            expect(error).to.be.not.ok;

            const obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj[0].val).to.be.equal(50);
            expect(obj[0].id).to.equal(TEST_STATE_ID);
            expect(obj[1].val).to.be.equal(false);
            expect(obj[1].id).to.equal('system.adapter.simple-api.0.alive');
            expect(obj[2].val).to.be.equal('bla&fasel.foo=hummer hey');
            expect(obj[2].id).to.equal('javascript.0.test-string');
            expect(response.statusCode).to.equal(200);

            request(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive,javascript.0.test-string`, (error, response, body) => {
                console.log(`getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive,javascript.0.test-string => ${body}`);
                expect(error).to.be.not.ok;
                const obj = JSON.parse(body);
                expect(obj[0].val).equal(50);
                expect(obj[1].val).equal(false);
                expect(obj[2].val).equal('bla&fasel.foo=hummer hey');
                expect(response.statusCode).to.equal(200);
                done();
            });
        });
    });

    it('Test RESTful API: setBulk(POST-GET-Mix) - must set values', done => {
        request({
            uri: `http://127.0.0.1:18183/setBulk?${TEST_STATE_ID}=51&system.adapter.simple-api.0.alive=false`,
            method: 'POST',
            body: ''
        }, (error, response, body) => {
            console.log(`setBulk/?${TEST_STATE_ID}=51&system.adapter.simple-api.0.alive=false => ${JSON.stringify(body)}`);
            expect(error).to.be.not.ok;

            const obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj[0].val).to.be.equal(51);
            expect(obj[0].id).to.equal(TEST_STATE_ID);
            expect(obj[1].val).to.be.equal(false);
            expect(obj[1].id).to.equal('system.adapter.simple-api.0.alive');
            expect(response.statusCode).to.equal(200);

            request(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive`, (error, response, body) => {
                console.log(`getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive => ${body}`);
                expect(error).to.be.not.ok;
                const obj = JSON.parse(body);
                expect(obj[0].val).equal(51);
                expect(obj[1].val).equal(false);
                expect(response.statusCode).to.equal(200);
                done();
            });
        });
    });

    it('Test RESTful API: setValueFromBody(POST) - must set one value', done => {
        request({
            uri: `http://127.0.0.1:18183/setValueFromBody/${TEST_STATE_ID}`,
            method: 'POST',
            body: '55'
        }, (error, response, body) => {
            console.log(`setValueFromBody/?${TEST_STATE_ID} => ${JSON.stringify(body)}`);
            expect(error).to.be.not.ok;

            const obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj[0].val).to.be.equal(55);
            expect(obj[0].id).to.equal(TEST_STATE_ID);
            expect(response.statusCode).to.equal(200);

            request(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID}`, (error, response, body) => {
                console.log(`getBulk/${TEST_STATE_ID} => ${body}`);
                expect(error).to.be.not.ok;
                const obj = JSON.parse(body);
                expect(obj[0].val).equal(55);
                expect(response.statusCode).to.equal(200);
                done();
            });
        });
    });

    after('Test RESTful API: Stop js-controller', function (done) {
        this.timeout(9000);
        setup.stopController(normalTerminated => {
            console.log('Adapter normal terminated: ' + normalTerminated);
            setTimeout(done, 3000);
        });
    });
});

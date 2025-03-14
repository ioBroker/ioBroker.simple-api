/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
/* jshint expr: true*/
const expect = require('chai').expect;
const setup = require('@iobroker/legacy-testing');
const axios = require('axios');

let objects = null;
let states = null;
const TEST_STATE_ID = 'simple-api.0.testNumber';

process.env.NO_PROXY = '127.0.0.1';

function checkConnectionOfAdapter(cb, counter) {
    counter = counter || 0;
    console.log(`Try check #${counter}`);
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
    objects.setObject(
        TEST_STATE_ID,
        {
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
                desc: 'test state',
            },
            native: {},
        },
        () => {
            states.setState(TEST_STATE_ID, { val: 0, ack: true }, cb && cb);
        },
    );
}

describe('Test RESTful API', function () {
    before('Test RESTful API: Start js-controller', function (_done) {
        this.timeout(600000); // because of the first installation from npm
        setup.adapterStarted = false;

        setup.setupController(async () => {
            const config = await setup.getAdapterConfig();
            // enable adapter
            config.common.enabled = true;
            config.common.loglevel = 'debug';
            config.native.port = 18183;
            await setup.setAdapterConfig(config.common, config.native);

            setup.startController((_objects, _states) => {
                objects = _objects;
                states = _states;

                // give some time to start server
                setTimeout(() => createTestState(() => _done()), 2000);
            });
        });
    });

    it('Test adapter: Check if adapter started and create datapoint', done => {
        checkConnectionOfAdapter(res => {
            res && console.log(res);
            expect(res).not.to.be.equal('Cannot check connection');
            objects.setObject(
                'javascript.0.test-string',
                {
                    common: {
                        name: 'test',
                        type: 'string',
                        role: 'value',
                        def: '',
                    },
                    native: {},
                    type: 'state',
                },
                err => {
                    expect(err).to.be.null;
                    states.setState('javascript.0.test-string', '', err => {
                        expect(err).to.be.null;
                        objects.setObject(
                            'javascript.0.test-number',
                            {
                                common: {
                                    name: 'test',
                                    type: 'number',
                                    role: 'value',
                                    def: 0,
                                },
                                native: {},
                                type: 'state',
                            },
                            err => {
                                expect(err).to.be.null;
                                states.setState('javascript.0.test-number', 0, err => {
                                    expect(err).to.be.null;
                                    done();
                                });
                            },
                        );
                    });
                },
            );
        });
    }).timeout(60000);

    it('Test RESTful API: get - must return value', done => {
        axios
            .get('http://127.0.0.1:18183/get/system.adapter.simple-api.0.alive')
            .then(response => {
                console.log(`get/system.adapter.simple-api.0.alive => ${response.data}`);
                const obj = response.data;
                expect(obj).to.be.ok;
                expect(obj.val).to.be.true;
                expect(obj.ack).to.be.true;
                expect(obj.ts).to.be.ok;
                expect(obj.type).to.equal('state');
                expect(obj._id).to.equal('system.adapter.simple-api.0.alive');
                expect(obj.common).to.be.ok;
                expect(obj.native).to.be.ok;
                expect(obj.common.name).to.equal('simple-api.0 alive');
                expect(obj.common.role).to.equal('indicator.state');
                expect(response.status).to.equal(200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: get - must return error', done => {
        axios
            .get('http://127.0.0.1:18183/get/system.adapter.simple-api.0.alive%23test', { validateStatus: false, responseType: 'text' })
            .then(response => {
                console.log(`get/system.adapter.simple-api.0.alive%23test => ${response.data}`);
                expect(response.data).to.be.equal(
                    '{"error":"datapoint \\"system.adapter.simple-api.0.alive#test\\" not found"}',
                );
                expect(response.status).to.equal(404);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: get - must return error 2', done => {
        axios
            .get('http://127.0.0.1:18183/get/system.adapter.simple-api.0.%23alive%23test', { validateStatus: false, responseType: 'text' })
            .then(response => {
                console.log(`get/system.adapter.simple-api.0.alive#%23test => ${response.data}`);
                expect(response.data).to.be.equal(
                    '{"error":"datapoint \\"system.adapter.simple-api.0.#alive#test\\" not found"}',
                );
                expect(response.status).to.equal(404);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: getPlainValue - must return plain value', done => {
        axios
            .get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', { responseType: 'text' })
            .then(response => {
                console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                expect(response.data).equal('true');
                expect(response.status).to.equal(200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: set - must set value', done => {
        axios
            .get('http://127.0.0.1:18183/set/system.adapter.simple-api.0.alive?val=false')
            .then(response => {
                console.log(`set/system.adapter.simple-api.0.alive?val=false => ${response.data}`);
                const obj = response.data;
                expect(obj).to.be.ok;
                expect(obj.val).to.be.false;
                expect(obj.id).to.equal('system.adapter.simple-api.0.alive');
                expect(response.status).to.equal(200);
                return axios.get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', { responseType: 'text' });
            })
            .then(response => {
                console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                expect(response.data).equal('false');
                expect(response.status).to.equal(200);
                return axios.get('http://127.0.0.1:18183/get/system.adapter.simple-api.0.alive');
            })
            .then(response => {
                console.log(`get/system.adapter.simple-api.0.alive => ${response.data}`);
                expect(response.data.val).equal(false);
                expect(response.status).to.equal(200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: set - must set easy string value', done => {
        axios
            .get('http://127.0.0.1:18183/set/javascript.0.test-string?val=19,1-bla')
            .then(response => {
                console.log(`set/javascript.0.test-string?val=19,1-bla => ${response.data}`);
                const obj = response.data;
                expect(obj).to.be.ok;
                expect(obj.val).equal('19,1-bla');
                expect(obj.id).to.equal('javascript.0.test-string');
                expect(response.status).to.equal(200);
                return axios.get('http://127.0.0.1:18183/getPlainValue/javascript.0.test-string', { responseType: 'text' });
            })
            .then(response => {
                console.log(`getPlainValue/javascript.0.test-string => ${response.data}`);
                expect(response.data).equal('"19,1-bla"');
                expect(response.status).to.equal(200);
                return axios.get('http://127.0.0.1:18183/get/javascript.0.test-string');
            })
            .then(response => {
                console.log(`get/javascript.0.test-string => ${response.data}`);
                expect(response.data.val).equal('19,1-bla');
                expect(response.status).to.equal(200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: set - must set encoded string value', done => {
        axios
            .get('http://127.0.0.1:18183/set/javascript.0.test-string?val=bla%26fasel%2efoo%3Dhummer+hey')
            .then(response => {
                console.log(`set/javascript.0.test-string?val=bla%20fasel%2efoo => ${response.data}`);
                const obj = response.data;
                expect(obj).to.be.ok;
                expect(obj.val).equal('bla&fasel.foo=hummer hey');
                expect(obj.id).to.equal('javascript.0.test-string');
                expect(response.status).to.equal(200);
                return axios.get('http://127.0.0.1:18183/getPlainValue/javascript.0.test-string', { responseType: 'text' });
            })
            .then(response => {
                console.log(`getPlainValue/javascript.0.test-string => ${response.data}`);
                expect(response.data).equal('"bla&fasel.foo=hummer hey"');
                expect(response.status).to.equal(200);
                return axios.get('http://127.0.0.1:18183/get/javascript.0.test-string');
            })
            .then(response => {
                console.log(`get/javascript.0.test-string => ${response.data}`);
                expect(response.data.val).equal('bla&fasel.foo=hummer hey');
                expect(response.status).to.equal(200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: set - must set val', done => {
        axios
            .get('http://127.0.0.1:18183/set/system.adapter.simple-api.0.alive?val=true')
            .then(response => {
                console.log(`set/system.adapter.simple-api.0.alive?val=true => ${response.data}`);
                const obj = response.data;
                expect(obj).to.be.ok;
                expect(obj.val).to.be.true;
                expect(typeof obj.val).to.be.equal('boolean');
                expect(obj.id).to.equal('system.adapter.simple-api.0.alive');
                expect(response.status).to.equal(200);
                return axios.get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', { responseType: 'text' });
            })
            .then(response => {
                console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                expect(response.data).equal('true');
                expect(response.status).to.equal(200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: set - must have ack true', done => {
        axios
            .get('http://127.0.0.1:18183/set/system.adapter.simple-api.0.alive?val=true&ack=true')
            .then(response => {
                console.log(`set/system.adapter.simple-api.0.alive?val=true => ${response.data}`);
                const obj = response.data;
                expect(obj).to.be.ok;
                expect(obj.val).to.be.true;
                expect(typeof obj.val).to.be.equal('boolean');
                expect(obj.id).to.equal('system.adapter.simple-api.0.alive');
                expect(response.status).to.equal(200);
                return axios.get('http://127.0.0.1:18183/get/system.adapter.simple-api.0.alive');
            })
            .then(response => {
                console.log(`get/system.adapter.simple-api.0.alive => ${response.data}`);
                const body = response.data;
                expect(body.val).equal(true);
                expect(body.ack).equal(true);
                expect(response.status).to.equal(200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: toggle - must toggle boolean value to false', done => {
        axios
            .get('http://127.0.0.1:18183/toggle/system.adapter.simple-api.0.alive')
            .then(response => {
                console.log(`toggle/system.adapter.simple-api.0.alive => ${response.data}`);
                const obj = response.data;
                expect(obj).to.be.ok;
                expect(obj.val).to.be.false;
                expect(typeof obj.val).to.be.equal('boolean');
                expect(obj.id).to.equal('system.adapter.simple-api.0.alive');
                expect(response.status).to.equal(200);
                return axios.get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', { responseType: 'text' });
            })
            .then(response => {
                console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                expect(response.data).equal('false');
                expect(response.status).to.equal(200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: toggle - must toggle boolean value to true', done => {
        axios
            .get('http://127.0.0.1:18183/toggle/system.adapter.simple-api.0.alive')
            .then(response => {
                console.log(`toggle/system.adapter.simple-api.0.alive => ${response.data}`);
                const obj = response.data;
                expect(obj).to.be.ok;
                expect(obj.val).to.be.true;
                expect(obj.id).to.equal('system.adapter.simple-api.0.alive');
                expect(response.status).to.equal(200);
                return axios.get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', { responseType: 'text' });
            })
            .then(response => {
                console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                expect(response.data).equal('true');
                expect(response.status).to.equal(200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: toggle - must toggle number value to 100', done => {
        axios
            .get(`http://127.0.0.1:18183/toggle/${TEST_STATE_ID}`)
            .then(response => {
                console.log(`toggle/${TEST_STATE_ID} => ${response.data}`);
                const obj = response.data;
                expect(obj).to.be.ok;
                expect(obj.val).to.be.equal(100);
                expect(typeof obj.val).to.be.equal('number');
                expect(obj.id).to.equal(TEST_STATE_ID);
                expect(response.status).to.equal(200);
                return axios.get(`http://127.0.0.1:18183/getPlainValue/${TEST_STATE_ID}`, { responseType: 'text' });
            })
            .then(response => {
                console.log(`getPlainValue/${TEST_STATE_ID} => ${response.data}`);
                expect(response.data).equal('100');
                expect(response.status).to.equal(200);
                return axios.get(`http://127.0.0.1:18183/set/${TEST_STATE_ID}?val=49`);
            })
            .then(response => {
                console.log(`set/${TEST_STATE_ID}?val=49 => ${response.data}`);
                return axios.get(`http://127.0.0.1:18183/toggle/${TEST_STATE_ID}`);
            })
            .then(response => {
                console.log(`toggle/${TEST_STATE_ID} => ${response.data}`);
                const obj = response.data;
                expect(obj).to.be.ok;
                expect(obj.val).to.be.equal(51);
                expect(obj.id).to.equal(TEST_STATE_ID);
                expect(response.status).to.equal(200);
                return axios.get(`http://127.0.0.1:18183/getPlainValue/${TEST_STATE_ID}`, { responseType: 'text' });
            })
            .then(response => {
                console.log(`getPlainValue/${TEST_STATE_ID} => ${response.data}`);
                expect(response.data).equal('51');
                expect(response.status).to.equal(200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: setBulk - must set values', done => {
        axios
            .get(`http://127.0.0.1:18183/setBulk?${TEST_STATE_ID}=50&system.adapter.simple-api.0.alive=false`)
            .then(response => {
                console.log(`setBulk/?${TEST_STATE_ID}=50&system.adapter.simple-api.0.alive=false => ${response.data}`);
                const obj = response.data;
                expect(obj).to.be.ok;
                expect(obj[0].val).to.be.equal(50);
                expect(obj[0].id).to.equal(TEST_STATE_ID);
                expect(obj[1].val).to.be.equal(false);
                expect(obj[1].id).to.equal('system.adapter.simple-api.0.alive');
                expect(response.status).to.equal(200);
                return axios.get(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive`);
            })
            .then(response => {
                console.log(`getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive => ${response.data}`);
                const obj = response.data;
                expect(obj[0].val).equal(50);
                expect(obj[1].val).equal(false);
                expect(response.status).to.equal(200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: objects - must return objects', done => {
        axios.get('http://127.0.0.1:18183/objects?pattern=system.adapter.*').then(response => {
            console.log(`objects?pattern=system.adapter.* => ${response.data}`);
            const obj = response.data;
            expect(obj['system.adapter.simple-api.0.alive']._id).to.be.ok;
            expect(response.status).to.equal(200);
            done();
        });
    });

    it('Test RESTful API: objects - must return objects', done => {
        axios
            .get('http://127.0.0.1:18183/objects?pattern=system.adapter.*&type=instance')
            .then(response => {
                console.log(`objects?pattern=system.adapter.* => ${response.data}`);
                const obj = response.data;
                expect(obj['system.adapter.simple-api.0']._id).to.be.ok;
                expect(response.status).to.equal(200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: states - must return states', done => {
        axios
            .get('http://127.0.0.1:18183/states?pattern=system.adapter.*')
            .then(response => {
                console.log(`states?pattern=system.adapter.* => ${response.data}`);
                const states = response.data;
                expect(states['system.adapter.simple-api.0.uptime'].val).to.be.least(0);
                expect(response.status).to.equal(200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: setBulk(POST) - must set values', done => {
        axios
            .post(
                'http://127.0.0.1:18183/setBulk',
                `${TEST_STATE_ID}=50&system.adapter.simple-api.0.alive=false&javascript.0.test-string=bla%26fasel%2efoo%3Dhummer+hey&ack=true`,
            )
            .then(response => {
                console.log(
                    `setBulk/?${TEST_STATE_ID}=50&system.adapter.simple-api.0.alive=false&javascript.0.test-string=bla%26fasel%2efoo%3Dhummer+hey => ${JSON.stringify(response.data)}`,
                );
                const obj = response.data;
                expect(obj).to.be.ok;
                expect(obj[0].val).to.be.equal(50);
                expect(obj[0].id).to.equal(TEST_STATE_ID);
                expect(obj[1].val).to.be.equal(false);
                expect(obj[1].id).to.equal('system.adapter.simple-api.0.alive');
                expect(obj[2].val).to.be.equal('bla&fasel.foo=hummer hey');
                expect(obj[2].id).to.equal('javascript.0.test-string');
                expect(response.status).to.equal(200);

                return axios.get(
                    `http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive,javascript.0.test-string`,
                );
            })
            .then(response => {
                console.log(
                    `getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive,javascript.0.test-string => ${response.data}`,
                );
                const obj = response.data;
                expect(obj[0].val).equal(50);
                expect(obj[0].ack).equal(true);
                expect(obj[1].val).equal(false);
                expect(obj[1].ack).equal(true);
                expect(obj[2].val).equal('bla&fasel.foo=hummer hey');
                expect(obj[2].ack).equal(true);
                expect(response.status).to.equal(200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: setBulk(POST-GET-Mix) - must set values', done => {
        axios
            .post(`http://127.0.0.1:18183/setBulk?${TEST_STATE_ID}=51&system.adapter.simple-api.0.alive=false`, '')
            .then(response => {
                console.log(
                    `setBulk/?${TEST_STATE_ID}=51&system.adapter.simple-api.0.alive=false => ${JSON.stringify(response.data)}`,
                );
                const obj = response.data;
                expect(obj).to.be.ok;
                expect(obj[0].val).to.be.equal(51);
                expect(obj[0].id).to.equal(TEST_STATE_ID);
                expect(obj[1].val).to.be.equal(false);
                expect(obj[1].id).to.equal('system.adapter.simple-api.0.alive');
                expect(response.status).to.equal(200);

                return axios.get(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive`);
            })
            .then(response => {
                console.log(`getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive => ${response.data}`);
                const obj = response.data;
                expect(obj[0].val).equal(51);
                expect(obj[1].val).equal(false);
                expect(response.status).to.equal(200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: setValueFromBody(POST) - must set one value', done => {
        axios
            .post(`http://127.0.0.1:18183/setValueFromBody/${TEST_STATE_ID}`, '55')
            .then(response => {
                console.log(`setValueFromBody/?${TEST_STATE_ID} => ${JSON.stringify(response.data)}`);
                const obj = response.data;
                expect(obj).to.be.ok;
                expect(obj[0].val).to.be.equal(55);
                expect(obj[0].id).to.equal(TEST_STATE_ID);
                expect(response.status).to.equal(200);

                return axios.get(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID}`);
            })
            .then(response => {
                console.log(`getBulk/${TEST_STATE_ID} => ${response.data}`);
                const obj = response.data;
                expect(obj[0].val).equal(55);
                expect(response.status).to.equal(200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    after('Test RESTful API: Stop js-controller', function (done) {
        this.timeout(9000);
        setup.stopController(normalTerminated => {
            console.log(`Adapter normal terminated: ${normalTerminated}`);
            setTimeout(done, 3000);
        });
    });
});

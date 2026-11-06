/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
/* jshint expr: true*/
const assert = require('node:assert');
const setup = require('@iobroker/legacy-testing');
const axios = require('axios');

let objects = null;
let states = null;
const TEST_STATE_ID = 'simple-api.0.testNumber';
const TEST_WAIT_ID = 'simple-api.0.testWait';

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

function createWaitState() {
    return new Promise(resolve =>
        objects.setObject(
            TEST_WAIT_ID,
            {
                _id: TEST_WAIT_ID,
                type: 'state',
                common: { name: 'Test wait', type: 'number', read: true, write: true, role: 'level' },
                native: {},
            },
            () => resolve(),
        ),
    );
}

function getTestState(id) {
    return new Promise((resolve, reject) => states.getState(id, (err, state) => (err ? reject(err) : resolve(state))));
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

            setup.startController(true, null, null, (_objects, _states) => {
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
            assert.notStrictEqual(res, 'Cannot check connection');
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
                    assert.strictEqual(err, null);
                    states.setState('javascript.0.test-string', '', err => {
                        assert.strictEqual(err, null);
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
                                assert.strictEqual(err, null);
                                states.setState('javascript.0.test-number', 0, err => {
                                    assert.strictEqual(err, null);
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
                assert.ok(obj);
                assert.strictEqual(obj.val, true);
                assert.strictEqual(obj.ack, true);
                assert.ok(obj.ts);
                assert.strictEqual(obj.type, 'state');
                assert.strictEqual(obj._id, 'system.adapter.simple-api.0.alive');
                assert.ok(obj.common);
                assert.ok(obj.native);
                assert.strictEqual(obj.common.name, 'simple-api.0 alive');
                assert.strictEqual(obj.common.role, 'indicator.state');
                assert.strictEqual(response.status, 200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: get - must return error', done => {
        axios
            .get('http://127.0.0.1:18183/get/system.adapter.simple-api.0.alive%23test', {
                validateStatus: false,
                responseType: 'text',
            })
            .then(response => {
                console.log(`get/system.adapter.simple-api.0.alive%23test => ${response.data}`);
                assert.strictEqual(
                    response.data,
                    '{"error":"datapoint \\"system.adapter.simple-api.0.alive#test\\" not found"}',
                );
                assert.strictEqual(response.status, 404);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: get - must return error 2', done => {
        axios
            .get('http://127.0.0.1:18183/get/system.adapter.simple-api.0.%23alive%23test', {
                validateStatus: false,
                responseType: 'text',
            })
            .then(response => {
                console.log(`get/system.adapter.simple-api.0.alive#%23test => ${response.data}`);
                assert.strictEqual(
                    response.data,
                    '{"error":"datapoint \\"system.adapter.simple-api.0.#alive#test\\" not found"}',
                );
                assert.strictEqual(response.status, 404);
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
                assert.strictEqual(response.data, 'true');
                assert.strictEqual(response.status, 200);
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
                assert.ok(obj);
                assert.strictEqual(obj.val, false);
                assert.strictEqual(obj.id, 'system.adapter.simple-api.0.alive');
                assert.strictEqual(response.status, 200);
                return axios.get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', {
                    responseType: 'text',
                });
            })
            .then(response => {
                console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                assert.strictEqual(response.data, 'false');
                assert.strictEqual(response.status, 200);
                return axios.get('http://127.0.0.1:18183/get/system.adapter.simple-api.0.alive');
            })
            .then(response => {
                console.log(`get/system.adapter.simple-api.0.alive => ${response.data}`);
                assert.strictEqual(response.data.val, false);
                assert.strictEqual(response.status, 200);
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
                assert.ok(obj);
                assert.strictEqual(obj.val, '19,1-bla');
                assert.strictEqual(obj.id, 'javascript.0.test-string');
                assert.strictEqual(response.status, 200);
                return axios.get('http://127.0.0.1:18183/getPlainValue/javascript.0.test-string', {
                    responseType: 'text',
                });
            })
            .then(response => {
                console.log(`getPlainValue/javascript.0.test-string => ${response.data}`);
                assert.strictEqual(response.data, '"19,1-bla"');
                assert.strictEqual(response.status, 200);
                return axios.get('http://127.0.0.1:18183/get/javascript.0.test-string');
            })
            .then(response => {
                console.log(`get/javascript.0.test-string => ${response.data}`);
                assert.strictEqual(response.data.val, '19,1-bla');
                assert.strictEqual(response.status, 200);
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
                assert.ok(obj);
                assert.strictEqual(obj.val, 'bla&fasel.foo=hummer hey');
                assert.strictEqual(obj.id, 'javascript.0.test-string');
                assert.strictEqual(response.status, 200);
                return axios.get('http://127.0.0.1:18183/getPlainValue/javascript.0.test-string', {
                    responseType: 'text',
                });
            })
            .then(response => {
                console.log(`getPlainValue/javascript.0.test-string => ${response.data}`);
                assert.strictEqual(response.data, '"bla&fasel.foo=hummer hey"');
                assert.strictEqual(response.status, 200);
                return axios.get('http://127.0.0.1:18183/get/javascript.0.test-string');
            })
            .then(response => {
                console.log(`get/javascript.0.test-string => ${response.data}`);
                assert.strictEqual(response.data.val, 'bla&fasel.foo=hummer hey');
                assert.strictEqual(response.status, 200);
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
                assert.ok(obj);
                assert.strictEqual(obj.val, true);
                assert.strictEqual(typeof obj.val, 'boolean');
                assert.strictEqual(obj.id, 'system.adapter.simple-api.0.alive');
                assert.strictEqual(response.status, 200);
                return axios.get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', {
                    responseType: 'text',
                });
            })
            .then(response => {
                console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                assert.strictEqual(response.data, 'true');
                assert.strictEqual(response.status, 200);
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
                assert.ok(obj);
                assert.strictEqual(obj.val, true);
                assert.strictEqual(typeof obj.val, 'boolean');
                assert.strictEqual(obj.id, 'system.adapter.simple-api.0.alive');
                assert.strictEqual(response.status, 200);
                return axios.get('http://127.0.0.1:18183/get/system.adapter.simple-api.0.alive');
            })
            .then(response => {
                console.log(`get/system.adapter.simple-api.0.alive => ${response.data}`);
                const body = response.data;
                assert.strictEqual(body.val, true);
                assert.strictEqual(body.ack, true);
                assert.strictEqual(response.status, 200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API: set - must wait for ack and return the acknowledged state', async function () {
        this.timeout(10000);
        await createWaitState();
        const request = axios.get(`http://127.0.0.1:18183/set/${TEST_WAIT_ID}?val=5&wait=5000`);

        // Acknowledge the value like a driver, as soon as it is written
        let state;
        for (let i = 0; i < 50 && !(state?.val === 5 && !state.ack); i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            state = await getTestState(TEST_WAIT_ID);
        }
        assert.strictEqual(state.val, 5);
        await new Promise(resolve => states.setState(TEST_WAIT_ID, { val: 5, ack: true }, () => resolve()));

        const response = await request;
        console.log(`set/${TEST_WAIT_ID}?val=5&wait=5000 => ${JSON.stringify(response.data)}`);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.data.val, 5);
        assert.strictEqual(response.data.ack, true);
    });

    it('Test RESTful API: set - must return null if the value is not acknowledged in time', async function () {
        this.timeout(10000);
        const start = Date.now();
        const response = await axios.get(`http://127.0.0.1:18183/set/${TEST_WAIT_ID}?val=6&wait=500`);
        console.log(`set/${TEST_WAIT_ID}?val=6&wait=500 => ${JSON.stringify(response.data)}`);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.data, null);
        assert.ok(Date.now() - start >= 450);
    });

    it('Test RESTful API: toggle - must toggle boolean value to false', done => {
        axios
            .get('http://127.0.0.1:18183/toggle/system.adapter.simple-api.0.alive')
            .then(response => {
                console.log(`toggle/system.adapter.simple-api.0.alive => ${response.data}`);
                const obj = response.data;
                assert.ok(obj);
                assert.strictEqual(obj.val, false);
                assert.strictEqual(typeof obj.val, 'boolean');
                assert.strictEqual(obj.id, 'system.adapter.simple-api.0.alive');
                assert.strictEqual(response.status, 200);
                return axios.get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', {
                    responseType: 'text',
                });
            })
            .then(response => {
                console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                assert.strictEqual(response.data, 'false');
                assert.strictEqual(response.status, 200);
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
                assert.ok(obj);
                assert.strictEqual(obj.val, true);
                assert.strictEqual(obj.id, 'system.adapter.simple-api.0.alive');
                assert.strictEqual(response.status, 200);
                return axios.get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', {
                    responseType: 'text',
                });
            })
            .then(response => {
                console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                assert.strictEqual(response.data, 'true');
                assert.strictEqual(response.status, 200);
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
                assert.ok(obj);
                assert.strictEqual(obj.val, 100);
                assert.strictEqual(typeof obj.val, 'number');
                assert.strictEqual(obj.id, TEST_STATE_ID);
                assert.strictEqual(response.status, 200);
                return axios.get(`http://127.0.0.1:18183/getPlainValue/${TEST_STATE_ID}`, { responseType: 'text' });
            })
            .then(response => {
                console.log(`getPlainValue/${TEST_STATE_ID} => ${response.data}`);
                assert.strictEqual(response.data, '100');
                assert.strictEqual(response.status, 200);
                return axios.get(`http://127.0.0.1:18183/set/${TEST_STATE_ID}?val=49`);
            })
            .then(response => {
                console.log(`set/${TEST_STATE_ID}?val=49 => ${response.data}`);
                return axios.get(`http://127.0.0.1:18183/toggle/${TEST_STATE_ID}`);
            })
            .then(response => {
                console.log(`toggle/${TEST_STATE_ID} => ${response.data}`);
                const obj = response.data;
                assert.ok(obj);
                assert.strictEqual(obj.val, 51);
                assert.strictEqual(obj.id, TEST_STATE_ID);
                assert.strictEqual(response.status, 200);
                return axios.get(`http://127.0.0.1:18183/getPlainValue/${TEST_STATE_ID}`, { responseType: 'text' });
            })
            .then(response => {
                console.log(`getPlainValue/${TEST_STATE_ID} => ${response.data}`);
                assert.strictEqual(response.data, '51');
                assert.strictEqual(response.status, 200);
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
                assert.ok(obj);
                assert.strictEqual(obj[0].val, 50);
                assert.strictEqual(obj[0].id, TEST_STATE_ID);
                assert.strictEqual(obj[1].val, false);
                assert.strictEqual(obj[1].id, 'system.adapter.simple-api.0.alive');
                assert.strictEqual(response.status, 200);
                return axios.get(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive`);
            })
            .then(response => {
                console.log(`getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive => ${response.data}`);
                const obj = response.data;
                assert.strictEqual(obj[0].val, 50);
                assert.strictEqual(obj[1].val, false);
                assert.strictEqual(response.status, 200);
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
            assert.ok(obj['system.adapter.simple-api.0.alive']._id);
            assert.strictEqual(response.status, 200);
            done();
        });
    });

    it('Test RESTful API: objects - must return objects', done => {
        axios
            .get('http://127.0.0.1:18183/objects?pattern=system.adapter.*&type=instance')
            .then(response => {
                console.log(`objects?pattern=system.adapter.* => ${response.data}`);
                const obj = response.data;
                assert.ok(obj['system.adapter.simple-api.0']._id);
                assert.strictEqual(response.status, 200);
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
                assert.ok(states['system.adapter.simple-api.0.uptime'].val >= 0);
                assert.strictEqual(response.status, 200);
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
                assert.ok(obj);
                assert.strictEqual(obj[0].val, 50);
                assert.strictEqual(obj[0].id, TEST_STATE_ID);
                assert.strictEqual(obj[1].val, false);
                assert.strictEqual(obj[1].id, 'system.adapter.simple-api.0.alive');
                assert.strictEqual(obj[2].val, 'bla&fasel.foo=hummer hey');
                assert.strictEqual(obj[2].id, 'javascript.0.test-string');
                assert.strictEqual(response.status, 200);

                return axios.get(
                    `http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive,javascript.0.test-string`,
                );
            })
            .then(response => {
                console.log(
                    `getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive,javascript.0.test-string => ${response.data}`,
                );
                const obj = response.data;
                assert.strictEqual(obj[0].val, 50);
                assert.strictEqual(obj[0].ack, true);
                assert.strictEqual(obj[1].val, false);
                assert.strictEqual(obj[1].ack, true);
                assert.strictEqual(obj[2].val, 'bla&fasel.foo=hummer hey');
                assert.strictEqual(obj[2].ack, true);
                assert.strictEqual(response.status, 200);
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
                assert.ok(obj);
                assert.strictEqual(obj[0].val, 51);
                assert.strictEqual(obj[0].id, TEST_STATE_ID);
                assert.strictEqual(obj[1].val, false);
                assert.strictEqual(obj[1].id, 'system.adapter.simple-api.0.alive');
                assert.strictEqual(response.status, 200);

                return axios.get(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive`);
            })
            .then(response => {
                console.log(`getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive => ${response.data}`);
                const obj = response.data;
                assert.strictEqual(obj[0].val, 51);
                assert.strictEqual(obj[1].val, false);
                assert.strictEqual(response.status, 200);
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
                assert.ok(obj);
                assert.strictEqual(obj[0].val, 55);
                assert.strictEqual(obj[0].id, TEST_STATE_ID);
                assert.strictEqual(response.status, 200);

                return axios.get(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID}`);
            })
            .then(response => {
                console.log(`getBulk/${TEST_STATE_ID} => ${response.data}`);
                const obj = response.data;
                assert.strictEqual(obj[0].val, 55);
                assert.strictEqual(response.status, 200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    // #245: a number with a trailing zero was written as text into a number state
    it('Test RESTful API: setBulk - must convert values to the type of the datapoint', async () => {
        let response = await axios.get(
            `http://127.0.0.1:18183/setBulk?${TEST_STATE_ID}=21.0&javascript.0.test-number=23,50&javascript.0.test-string=1.10`,
        );
        console.log(`setBulk with trailing zeros => ${JSON.stringify(response.data)}`);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.data[0].val, 21);
        assert.strictEqual(response.data[1].val, 23.5);
        // #209: the text of a string state must stay as it is
        assert.strictEqual(response.data[2].val, '1.10');

        response = await axios.get(
            `http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},javascript.0.test-number,javascript.0.test-string`,
        );
        assert.strictEqual(response.data[0].val, 21);
        assert.strictEqual(response.data[1].val, 23.5);
        assert.strictEqual(response.data[2].val, '1.10');
    });

    it('Test RESTful API: setBulk(POST) - must convert values to the type of the datapoint', async () => {
        let response = await axios.post(
            'http://127.0.0.1:18183/setBulk',
            `${TEST_STATE_ID}=22.50&javascript.0.test-string=2.0`,
        );
        console.log(`setBulk(POST) with trailing zeros => ${JSON.stringify(response.data)}`);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.data[0].val, 22.5);
        assert.strictEqual(response.data[1].val, '2.0');

        response = await axios.get(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},javascript.0.test-string`);
        assert.strictEqual(response.data[0].val, 22.5);
        assert.strictEqual(response.data[1].val, '2.0');
    });

    after('Test RESTful API: Stop js-controller', function (done) {
        this.timeout(9000);
        setup.stopController(normalTerminated => {
            console.log(`Adapter normal terminated: ${normalTerminated}`);
            setTimeout(done, 3000);
        });
    });
});

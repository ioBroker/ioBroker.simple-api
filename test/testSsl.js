const assert = require('node:assert');
const setup = require('@iobroker/legacy-testing');
const axios = require('axios');
const { Agent } = require('node:https');

let objects = null;
let states = null;
const httpsAgent = new Agent({ rejectUnauthorized: false });

process.env.NO_PROXY = 'localhost';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const TEST_STATE_ID = 'simple-api.0.testNumber';

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
            cb && cb();
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
            states.setState(TEST_STATE_ID, { val: 0, ack: true }, () => {
                objects.setObject(
                    'javascript.0.test-boolean',
                    {
                        common: {
                            name: 'test',
                            type: 'boolean',
                            role: 'value',
                            def: 0,
                        },
                        native: {},
                        type: 'state',
                    },
                    err => {
                        states.setState('javascript.0.test-boolean', { val: false, ack: false }, err => {
                            cb();
                        });
                    },
                );
            });
        },
    );
}

describe('Test RESTful API SSL', function () {
    before('Test RESTful API SSL: Start js-controller', function (_done) {
        this.timeout(600000); // because of the first installation from npm
        setup.adapterStarted = false;

        setup.setupController(async () => {
            const config = await setup.getAdapterConfig();
            // enable adapter
            config.common.enabled = true;
            config.common.loglevel = 'debug';
            config.native.port = 18183;
            config.native.auth = true;
            config.native.secure = true;
            config.native.certPublic = 'defaultPublic';
            config.native.certPrivate = 'defaultPrivate';

            await setup.setAdapterConfig(config.common, config.native);

            setup.startController(true, null, null, (_objects, _states) => {
                objects = _objects;
                states = _states;
                // give some time to start server
                setTimeout(() => createTestState(() => _done()), 2000);
            });
        });
    });

    it('Test adapter: Check if adapter started and create upload datapoint', done => {
        checkConnectionOfAdapter(res => {
            if (res) {
                console.log(res);
            }

            assert.notStrictEqual(res, 'Cannot check connection');

            objects.setObject(
                'javascript.0.test-boolean',
                {
                    common: {
                        name: 'boolean',
                        type: 'boolean',
                        role: 'value',
                        def: 0,
                    },
                    native: {},
                    type: 'state',
                },
                err => {
                    assert.strictEqual(err, null);
                    states.setState('javascript.0.test-boolean', true, err => {
                        assert.strictEqual(err, null);
                        done();
                    });
                },
            );
        });
    }).timeout(60000);

    it('Test RESTful API SSL: get - must return value', done => {
        axios
            .get('https://localhost:18183/get/system.adapter.simple-api.0.alive?user=admin&pass=iobroker', {
                httpsAgent,
            })
            .then(response => {
                console.log(`get/system.adapter.simple-api.0.alive => ${JSON.stringify(response.data)}`);
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

    it('Test RESTful API SSL: get - must return value with basic authentication', done => {
        axios
            .get('https://localhost:18183/get/system.adapter.simple-api.0.alive', {
                auth: {
                    username: 'admin',
                    password: 'iobroker',
                },
                httpsAgent,
            })
            .then(response => {
                console.log(`get/system.adapter.simple-api.0.alive => ${JSON.stringify(response.data)}`);
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

    it('Test RESTful API SSL: get with no credentials', done => {
        axios
            .get('https://localhost:18183/get/system.adapter.simple-api.0.alive?user=admin&pass=io', {
                validateStatus: false,
                httpsAgent,
            })
            .then(response => {
                console.log(`get/system.adapter.simple-api.0.alive => ${JSON.stringify(response.data)}`);
                assert.strictEqual(response.status, 401);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API SSL: get with wrong credentials', done => {
        axios
            .get('https://localhost:18183/get/system.adapter.simple-api.0.alive', { validateStatus: false, httpsAgent })
            .then(response => {
                console.log(`get/system.adapter.simple-api.0.alive => ${JSON.stringify(response.data)}`);
                assert.strictEqual(response.status, 401);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API SSL: setBulk(POST) - must set values', done => {
        axios
            .post(
                'https://127.0.0.1:18183/setBulk?user=admin&pass=iobroker',
                `${TEST_STATE_ID}=50&javascript.0.test-boolean=true`,
                { validateStatus: false, responseType: 'text', httpsAgent, headers: { 'Content-Type': 'text/plain' } },
            )
            .then(response => {
                console.log(`setBulk/?${TEST_STATE_ID}=50&javascript.0.test-boolean=true => ${response.data}`);
                const obj = JSON.parse(response.data);
                assert.ok(obj);
                assert.strictEqual(obj[0].val, 50);
                assert.strictEqual(obj[0].id, TEST_STATE_ID);
                assert.strictEqual(obj[1].val, true);
                assert.strictEqual(obj[1].id, 'javascript.0.test-boolean');
                assert.strictEqual(response.status, 200);

                return axios.get(
                    `https://localhost:18183/getBulk/${TEST_STATE_ID},javascript.0.test-boolean?user=admin&pass=iobroker`,
                    {
                        validateStatus: false,
                        responseType: 'text',
                        httpsAgent,
                    },
                );
            })
            .then(response => {
                console.log(`getBulk/${TEST_STATE_ID},javascript.0.test-boolean => ${response.data}`);
                const obj = JSON.parse(response.data);
                assert.strictEqual(obj[0].val, 50);
                assert.strictEqual(obj[1].val, true);
                assert.strictEqual(response.status, 200);
                done();
            })
            .catch(error => {
                console.log(`CAnnot get response: ${error}`);
            });
    });

    it('Test RESTful API SSL: setValueFromBody(POST) - must set values', done => {
        axios
            .post(`https://localhost:18183/setValueFromBody/${TEST_STATE_ID}?user=admin&pass=iobroker`, '55', {
                validateStatus: false,
                responseType: 'text',
                httpsAgent,
                headers: { 'Content-Type': 'text/plain' },
            })
            .then(response => {
                console.log(`setValueFromBody/?${TEST_STATE_ID} => ${response.data}`);
                const obj = JSON.parse(response.data);
                assert.ok(obj);
                assert.strictEqual(obj[0].val, 55);
                assert.strictEqual(obj[0].id, TEST_STATE_ID);
                assert.strictEqual(response.status, 200);

                return axios.get(`https://localhost:18183/getBulk/${TEST_STATE_ID}?user=admin&pass=iobroker`, {
                    validateStatus: false,
                    responseType: 'text',
                    httpsAgent,
                });
            })
            .then(response => {
                console.log(`getBulk/${TEST_STATE_ID} => ${response.data}`);
                const obj = JSON.parse(response.data);
                assert.strictEqual(obj[0].val, 55);
                assert.strictEqual(response.status, 200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    // #316: with authentication, a POST with a form or JSON body never got an answer
    it('Test RESTful API SSL: setValueFromBody(POST) with a form body - must answer', async () => {
        const response = await axios.post(
            `https://localhost:18183/setValueFromBody/${TEST_STATE_ID}?user=admin&pass=iobroker`,
            '56',
            {
                httpsAgent,
                timeout: 5000,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            },
        );
        console.log(`setValueFromBody(form) => ${JSON.stringify(response.data)}`);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.data[0].id, TEST_STATE_ID);
        assert.strictEqual(response.data[0].val, 56);
    });

    it('Test RESTful API SSL: setValueFromBody(POST) with a JSON body - must answer', async () => {
        const response = await axios.post(
            `https://localhost:18183/setValueFromBody/${TEST_STATE_ID}?user=admin&pass=iobroker`,
            '57',
            {
                httpsAgent,
                timeout: 5000,
                headers: { 'Content-Type': 'application/json' },
            },
        );
        console.log(`setValueFromBody(JSON) => ${JSON.stringify(response.data)}`);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.data[0].val, 57);
    });

    it('Test RESTful API SSL: setBulk(POST) with a form body - must answer', async () => {
        const response = await axios.post(
            'https://127.0.0.1:18183/setBulk?user=admin&pass=iobroker',
            `${TEST_STATE_ID}=21.0&javascript.0.test-boolean=false`,
            {
                httpsAgent,
                timeout: 5000,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            },
        );
        console.log(`setBulk(form) => ${JSON.stringify(response.data)}`);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.data[0].val, 21);
        assert.strictEqual(response.data[1].val, false);
    });

    // the body parsers run for the OAuth2 routes only now: the token endpoint must still get its form body
    it('Test RESTful API SSL: OAuth2 token - must answer with a token that grants access', async () => {
        let response = await axios.post(
            'https://localhost:18183/oauth/token',
            'grant_type=password&username=admin&password=iobroker&client_id=ioBroker',
            {
                httpsAgent,
                timeout: 5000,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            },
        );
        assert.strictEqual(response.status, 200);
        assert.ok(response.data.access_token);

        response = await axios.get('https://localhost:18183/get/system.adapter.simple-api.0.alive', {
            httpsAgent,
            timeout: 5000,
            headers: { Authorization: `Bearer ${response.data.access_token}` },
        });
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.data.val, true);
    });

    after('Test RESTful API SSL: Stop js-controller', function (done) {
        this.timeout(9000);
        setup.stopController(normalTerminated => {
            console.log(`Adapter normal terminated: ${normalTerminated}`);
            setTimeout(done, 3000);
        });
    });
});

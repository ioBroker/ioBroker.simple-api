const expect = require('chai').expect;
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

            setup.startController((_objects, _states) => {
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

            expect(res).not.to.be.equal('Cannot check connection');

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
                    expect(err).to.be.null;
                    states.setState('javascript.0.test-boolean', true, err => {
                        expect(err).to.be.null;
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

    it('Test RESTful API SSL: get with no credentials', done => {
        axios
            .get('https://localhost:18183/get/system.adapter.simple-api.0.alive?user=admin&pass=io', {
                validateStatus: false,
                httpsAgent,
            })
            .then(response => {
                console.log(`get/system.adapter.simple-api.0.alive => ${JSON.stringify(response.data)}`);
                expect(response.status).to.be.equal(401);
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
                expect(response.status).to.be.equal(401);
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
                expect(obj).to.be.ok;
                expect(obj[0].val).to.be.equal(50);
                expect(obj[0].id).to.equal(TEST_STATE_ID);
                expect(obj[1].val).to.be.equal(true);
                expect(obj[1].id).to.equal('javascript.0.test-boolean');
                expect(response.status).to.equal(200);

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
                expect(obj[0].val).equal(50);
                expect(obj[1].val).equal(true);
                expect(response.status).to.equal(200);
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
                expect(obj).to.be.ok;
                expect(obj[0].val).to.be.equal(55);
                expect(obj[0].id).to.equal(TEST_STATE_ID);
                expect(response.status).to.equal(200);

                return axios.get(`https://localhost:18183/getBulk/${TEST_STATE_ID}?user=admin&pass=iobroker`, {
                    validateStatus: false,
                    responseType: 'text',
                    httpsAgent,
                });
            })
            .then(response => {
                console.log(`getBulk/${TEST_STATE_ID} => ${response.data}`);
                const obj = JSON.parse(response.data);
                expect(obj[0].val).equal(55);
                expect(response.status).to.equal(200);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    after('Test RESTful API SSL: Stop js-controller', function (done) {
        this.timeout(9000);
        setup.stopController(normalTerminated => {
            console.log(`Adapter normal terminated: ${normalTerminated}`);
            setTimeout(done, 3000);
        });
    });
});

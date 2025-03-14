/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
/* jshint expr: true*/

const expect = require('chai').expect;
const setup = require('@iobroker/legacy-testing');
const request = require('request');

let objects = null;
let states = null;

process.env.NO_PROXY = '127.0.0.1';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const TEST_STATE_ID = 'simple-api.0.testNumber';

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
            states.setState(TEST_STATE_ID, { val: 0, ack: true }, cb);
        },
    );
}

describe('Test RESTful API SSL', function () {
    before('Test RESTful API SSL: Start js-controller', function (_done) {
        this.timeout(600000); // because of the first installation from npm
        setup.adapterStarted = false;

        const brokerStarted = false;
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
            res && console.log(res);

            expect(res).not.to.be.equal('Cannot check connection');

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
    }).timeout(60000);

    it('Test RESTful API SSL: get - must return value', done => {
        request(
            'https://127.0.0.1:18183/get/system.adapter.simple-api.0.alive?user=admin&pass=iobroker',
            (error, response, body) => {
                console.log(`get/system.adapter.simple-api.0.alive => ${body}`);
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
                expect(obj.type).to.equal('state');
                expect(obj._id).to.equal('system.adapter.simple-api.0.alive');
                expect(obj.common).to.be.ok;
                expect(obj.native).to.be.ok;
                expect(obj.common.name).to.equal('simple-api.0 alive');
                expect(obj.common.role).to.equal('indicator.state');
                expect(response.statusCode).to.equal(200);
                done();
            },
        );
    });

    it('Test RESTful API SSL: get - must return value with basic authentication', done => {
        request(
            {
                url: 'https://127.0.0.1:18183/get/system.adapter.simple-api.0.alive',
                auth: {
                    user: 'admin',
                    pass: 'iobroker',
                },
            },
            (error, response, body) => {
                console.log(`get/system.adapter.simple-api.0.alive => ${body}`);
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
                expect(obj.type).to.equal('state');
                expect(obj._id).to.equal('system.adapter.simple-api.0.alive');
                expect(obj.common).to.be.ok;
                expect(obj.native).to.be.ok;
                expect(obj.common.name).to.equal('simple-api.0 alive');
                expect(obj.common.role).to.equal('indicator.state');
                expect(response.statusCode).to.equal(200);
                done();
            },
        );
    });

    it('Test RESTful API SSL: get with no credentials', done => {
        request(
            'https://127.0.0.1:18183/get/system.adapter.simple-api.0.alive?user=admin&pass=io',
            (error, response, body) => {
                console.log(`get/system.adapter.simple-api.0.alive => ${body}`);
                expect(error).to.be.not.ok;
                expect(response.statusCode).to.be.equal(401);
                done();
            },
        );
    });

    it('Test RESTful API SSL: get with wrong credentials', done => {
        request('https://127.0.0.1:18183/get/system.adapter.simple-api.0.alive', (error, response, body) => {
            console.log(`get/system.adapter.simple-api.0.alive => ${body}`);
            expect(error).to.be.not.ok;
            expect(response.statusCode).to.be.equal(401);
            done();
        });
    });

    it('Test RESTful API SSL: setBulk(POST) - must set values', done => {
        request(
            {
                uri: 'https://127.0.0.1:18183/setBulk?user=admin&pass=iobroker',
                method: 'POST',
                body: `${TEST_STATE_ID}=50&system.adapter.simple-api.0.alive=false`,
            },
            (error, response, body) => {
                console.log(
                    `setBulk/?${TEST_STATE_ID}=50&system.adapter.simple-api.0.alive=false => ${JSON.stringify(body)}`,
                );
                expect(error).to.be.not.ok;

                const obj = JSON.parse(body);
                expect(obj).to.be.ok;
                expect(obj[0].val).to.be.equal(50);
                expect(obj[0].id).to.equal(TEST_STATE_ID);
                expect(obj[1].val).to.be.equal(false);
                expect(obj[1].id).to.equal('system.adapter.simple-api.0.alive');
                expect(response.statusCode).to.equal(200);

                request(
                    `https://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive?user=admin&pass=iobroker`,
                    (error, response, body) => {
                        console.log(`getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive => ${body}`);
                        expect(error).to.be.not.ok;
                        const obj = JSON.parse(body);
                        expect(obj[0].val).equal(50);
                        expect(obj[1].val).equal(false);
                        expect(response.statusCode).to.equal(200);
                        done();
                    },
                );
            },
        );
    });

    it('Test RESTful API SSL: setValueFromBody(POST) - must set values', done => {
        request(
            {
                uri: `https://127.0.0.1:18183/setValueFromBody/${TEST_STATE_ID}?user=admin&pass=iobroker&`,
                method: 'POST',
                body: '55',
            },
            (error, response, body) => {
                console.log(`setValueFromBody/?${TEST_STATE_ID} => ${JSON.stringify(body)}`);
                expect(error).to.be.not.ok;

                const obj = JSON.parse(body);
                expect(obj).to.be.ok;
                expect(obj[0].val).to.be.equal(55);
                expect(obj[0].id).to.equal(TEST_STATE_ID);
                expect(response.statusCode).to.equal(200);

                request(
                    `https://127.0.0.1:18183/getBulk/${TEST_STATE_ID}?user=admin&pass=iobroker`,
                    (error, response, body) => {
                        console.log(`getBulk/${TEST_STATE_ID} => ` + body);
                        expect(error).to.be.not.ok;
                        const obj = JSON.parse(body);
                        expect(obj[0].val).equal(55);
                        expect(response.statusCode).to.equal(200);
                        done();
                    },
                );
            },
        );
    });
    after('Test RESTful API SSL: Stop js-controller', function (done) {
        this.timeout(9000);
        setup.stopController(normalTerminated => {
            console.log('Adapter normal terminated: ' + normalTerminated);
            setTimeout(done, 3000);
        });
    });
});

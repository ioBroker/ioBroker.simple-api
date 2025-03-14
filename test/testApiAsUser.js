/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
/* jshint expr: true*/

const expect = require('chai').expect;
const setup = require('@iobroker/legacy-testing');
const axios = require('axios');

let objects = null;
let states = null;

process.env.NO_PROXY = '127.0.0.1';
const TEST_STATE_ID = 'simple-api.0.testNumber';

function checkConnectionOfAdapter(cb, counter) {
    counter = counter || 0;
    console.log(`Try check #${counter}`);
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

describe.only('Test RESTful API as User', function () {
    before('Test RESTful API as User: Start js-controller', function (_done) {
        this.timeout(600000); // because of the first installation from npm
        setup.adapterStarted = false;

        setup.setupController(async () => {
            const config = await setup.getAdapterConfig();
            // enable adapter
            config.common.enabled = true;
            config.common.loglevel = 'debug';
            config.native.port = 18183;
            config.native.defaultUser = 'myuser';
            await setup.setAdapterConfig(config.common, config.native);

            setup.startController(function (_objects, _states) {
                objects = _objects;
                states = _states;
                // give some time to start server
                setTimeout(() => createTestState(() => _done()), 2000);
            });
        });
    });

    it('Test adapter: Check if adapter started and create upload datapoint', done => {
        checkConnectionOfAdapter(function (res) {
            if (res) console.log(res);
            expect(res).not.to.be.equal('Cannot check connection');
            objects.setObject(
                'system.group.writer',
                {
                    common: {
                        name: 'Writer',
                        desc: '',
                        members: ['system.user.myuser'],
                        acl: {
                            object: {
                                list: true,
                                read: true,
                                write: false,
                                delete: false,
                            },
                            state: {
                                list: true,
                                read: true,
                                write: true,
                                create: false,
                                delete: false,
                            },
                            users: {
                                write: false,
                                create: false,
                                delete: false,
                            },
                            other: {
                                execute: false,
                                http: false,
                                sendto: false,
                            },
                            file: {
                                list: false,
                                read: false,
                                write: false,
                                create: false,
                                delete: false,
                            },
                        },
                    },
                    native: {},
                    acl: {
                        object: 1638,
                        owner: 'system.user.admin',
                        ownerGroup: 'system.group.administrator',
                    },
                    _id: 'system.group.writer',
                    type: 'group',
                },
                function (err) {
                    expect(err).to.be.null;

                    objects.setObject(
                        'system.user.myuser',
                        {
                            type: 'user',
                            common: {
                                name: 'myuser',
                                enabled: true,
                                groups: [],
                                password:
                                    'pbkdf2$10000$ab4104d8bb68390ee7e6c9397588e768de6c025f0c732c18806f3d1270c83f83fa86a7bf62583770e5f8d0b405fbb3ad32214ef3584f5f9332478f2506414443a910bf15863b36ebfcaa7cbb19253ae32cd3ca390dab87b29cd31e11be7fa4ea3a01dad625d9de44e412680e1a694227698788d71f1e089e5831dc1bbacfa794b45e1c995214bf71ee4160d98b4305fa4c3e36ee5f8da19b3708f68e7d2e8197375c0f763d90e31143eb04760cc2148c8f54937b9385c95db1742595634ed004fa567655dfe1d9b9fa698074a9fb70c05a252b2d9cf7ca1c9b009f2cd70d6972ccf0ee281d777d66a0346c6c6525436dd7fe3578b28dca2c7adbfde0ecd45148$31c3248ba4dc9600a024b4e0e7c3e585',
                            },
                            _id: 'system.user.myuser',
                            native: {},
                            acl: {
                                object: 1638,
                            },
                        },
                        function (err) {
                            expect(err).to.be.null;
                            objects.setObject(
                                'javascript.0.test',
                                {
                                    common: {
                                        name: 'test',
                                        type: 'number',
                                        role: 'level',
                                        min: -100,
                                        max: 100,
                                        def: 1,
                                    },
                                    native: {},
                                    type: 'state',
                                    acl: {
                                        object: 1638,
                                        owner: 'system.user.myuser',
                                        ownerGroup: 'system.group.administrator',
                                        state: 1638,
                                    },
                                },
                                function (err) {
                                    expect(err).to.be.null;
                                    states.setState('javascript.0.test', 1, function (err) {
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
                        },
                    );
                },
            );
        });
    }).timeout(60000);

    it('Test RESTful API as User: get - must return value', done => {
        axios.get('http://127.0.0.1:18183/get/system.adapter.simple-api.0.alive').then(response => {
            console.log(`get/system.adapter.simple-api.0.alive => ${JSON.stringify(response.data)}`);
            const obj = response.data;
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
            expect(response.status).to.equal(200);
            done();
        });
    });

    it('Test RESTful API as User: getPlainValue - must return plain value', done => {
        axios
            .get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', { responseType: 'text' })
            .then(response => {
                console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                expect(response.data).equal('true');
                expect(response.status).to.equal(200);
                done();
            });
    });

    it('Test RESTful API as User: getPlainValue 4 Test-Endpoint - must return plain value', done => {
        axios.get('http://127.0.0.1:18183/getPlainValue/javascript.0.test', { responseType: 'text' }).then(response => {
            console.log(`getPlainValue/javascript.0.test => ${response.data}`);
            expect(response.data).equal('1');
            expect(response.status).to.equal(200);
            done();
        });
    });

    it('Test RESTful API as User: set 4 Test-Endpoint  - must set value', done => {
        axios.get('http://127.0.0.1:18183/set/javascript.0.test?val=2').then(response => {
            console.log(`set/javascript.0.test?val=false => ${response.data}`);
            const obj = response.data;
            expect(obj).to.be.ok;
            expect(obj.val).to.be.equal(2);
            expect(obj.id).to.equal('javascript.0.test');
            expect(response.status).to.equal(200);
            axios
                .get('http://127.0.0.1:18183/getPlainValue/javascript.0.test', { responseType: 'text' })
                .then(response => {
                    console.log(`getPlainValue/javascript.0.test => ${response.data}`);
                    expect(response.data).equal('2');
                    expect(response.status).to.equal(200);
                    done();
                });
        });
    });

    it('Test RESTful API as User: set - must set value', done => {
        axios.get('http://127.0.0.1:18183/set/system.adapter.simple-api.0.alive?val=false').then(response => {
            console.log(`set/system.adapter.simple-api.0.alive?val=false => ${response.data}`);
            const obj = response.data;
            expect(obj).to.be.ok;
            expect(obj.val).to.be.false;
            expect(obj.id).to.equal('system.adapter.simple-api.0.alive');
            expect(response.status).to.equal(200);
            axios
                .get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', { responseType: 'text' })
                .then(response => {
                    console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                    expect(response.data).equal('false');
                    expect(response.status).to.equal(200);
                    done();
                });
        });
    });

    it('Test RESTful API as User: set - must set val', done => {
        axios.get('http://127.0.0.1:18183/set/system.adapter.simple-api.0.alive?val=true').then(response => {
            console.log(`set/system.adapter.simple-api.0.alive?val=true => ${response.data}`);
            const obj = response.data;
            expect(obj).to.be.ok;
            expect(obj.val).to.be.true;
            expect(obj.id).to.equal('system.adapter.simple-api.0.alive');
            expect(response.status).to.equal(200);
            axios
                .get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', { responseType: 'text' })
                .then(response => {
                    console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                    expect(response.data).equal('true');
                    expect(response.status).to.equal(200);
                    done();
                });
        });
    });

    it('Test RESTful API as User: toggle - must toggle boolean value to false', done => {
        axios.get('http://127.0.0.1:18183/toggle/system.adapter.simple-api.0.alive').then(response => {
            console.log(`toggle/system.adapter.simple-api.0.alive => ${response.data}`);
            const obj = response.data;
            expect(obj).to.be.ok;
            expect(obj.val).to.be.false;
            expect(obj.id).to.equal('system.adapter.simple-api.0.alive');
            expect(response.status).to.equal(200);

            axios
                .get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', { responseType: 'text' })
                .then(response => {
                    console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                    expect(response.data).equal('false');
                    expect(response.status).to.equal(200);
                    done();
                });
        });
    });

    it('Test RESTful API as User: toggle - must toggle boolean value to true', done => {
        axios.get('http://127.0.0.1:18183/toggle/system.adapter.simple-api.0.alive').then(response => {
            console.log(`toggle/system.adapter.simple-api.0.alive => ${response.data}`);
            const obj = response.data;
            expect(obj).to.be.ok;
            expect(obj.val).to.be.true;
            expect(obj.id).to.equal('system.adapter.simple-api.0.alive');
            expect(response.status).to.equal(200);

            axios
                .get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', { responseType: 'text' })
                .then(response => {
                    console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                    expect(response.data).equal('true');
                    expect(response.status).to.equal(200);
                    done();
                });
        });
    });

    it('Test RESTful API as User: toggle - must toggle number value to 100', done => {
        axios.get(`http://127.0.0.1:18183/toggle/${TEST_STATE_ID}`).then(response => {
            console.log(`toggle/${TEST_STATE_ID} => ${response.data}`);
            const obj = response.data;
            expect(obj).to.be.ok;
            expect(obj.val).to.be.equal(100);
            expect(obj.id).to.equal(TEST_STATE_ID);
            expect(response.status).to.equal(200);

            axios
                .get(`http://127.0.0.1:18183/getPlainValue/${TEST_STATE_ID}`, { responseType: 'text' })
                .then(response => {
                    console.log(`getPlainValue/${TEST_STATE_ID} => ${response.data}`);
                    expect(response.data).equal('100');
                    expect(response.status).to.equal(200);
                    axios.get(`http://127.0.0.1:18183/set/${TEST_STATE_ID}?val=49`).then(response => {
                        console.log(`set/${TEST_STATE_ID}?val=49 => ` + response.data);
                        axios.get(`http://127.0.0.1:18183/toggle/${TEST_STATE_ID}`).then(response => {
                            console.log(`toggle/${TEST_STATE_ID} => ${response.data}`);
                            const obj = response.data;
                            expect(obj).to.be.ok;
                            expect(obj.val).to.be.equal(51);
                            expect(obj.id).to.equal(TEST_STATE_ID);
                            expect(response.status).to.equal(200);

                            axios
                                .get(`http://127.0.0.1:18183/getPlainValue/${TEST_STATE_ID}`, { responseType: 'text' })
                                .then(response => {
                                    console.log(`getPlainValue/${TEST_STATE_ID} => ${response.data}`);
                                    expect(response.data).equal('51');
                                    expect(response.status).to.equal(200);
                                    done();
                                });
                        });
                    });
                });
        });
    });

    it('Test RESTful API as User: setBulk - must set values', done => {
        axios
            .get(
                `http://127.0.0.1:18183/setBulk/?${TEST_STATE_ID}=50&system.adapter.simple-api.0.alive=false&javascript.0.test=3`,
            )
            .then(response => {
                console.log(
                    `setBulk/?${TEST_STATE_ID}=50&system.adapter.simple-api.0.alive=false&javascript.0.test=3 => ${response.data}`,
                );
                const obj = response.data;
                expect(obj).to.be.ok;

                expect(obj[0].val).to.be.equal(50);
                expect(obj[0].id).to.equal(TEST_STATE_ID);
                expect(obj[1].val).to.be.equal(false);
                expect(obj[1].id).to.equal('system.adapter.simple-api.0.alive');
                expect(obj[2].val).to.be.equal(3);
                expect(obj[2].id).to.equal('javascript.0.test');
                expect(response.status).to.equal(200);

                axios
                    .get(
                        `http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive,javascript.0.test`,
                    )
                    .then(response => {
                        console.log(
                            `getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive&javascript.0.test => ${response.data}`,
                        );
                        const obj = response.data;
                        expect(obj[0].val).equal(50);
                        expect(obj[1].val).equal(false);
                        expect(obj[2].val).equal(3);
                        expect(response.status).to.equal(200);
                        done();
                    });
            });
    });

    it('Test RESTful API as User: objects - must return objects', done => {
        axios.get('http://127.0.0.1:18183/objects?pattern=system.adapter.*').then(response => {
            console.log(`objects?pattern=system.adapter.* => ${response.data}`);
            expect(response.data).to.be.not.equal('error: permissionError');
            expect(response.status).to.equal(200);
            done();
        });
    });

    it('Test RESTful API as User: objects - must return objects', done => {
        axios.get('http://127.0.0.1:18183/objects?pattern=system.adapter.*&type=instance').then(response => {
            console.log(`objects?pattern=system.adapter.* => ${response.data}`);
            expect(response.data).to.be.not.equal('error: permissionError');
            expect(response.status).to.equal(200);
            done();
        });
    });

    it('Test RESTful API as User: states - must return states', done => {
        axios.get('http://127.0.0.1:18183/states?pattern=system.adapter.*').then(response => {
            console.log(`states?pattern=system.adapter.* => ${response.data}`);
            expect(response.data).to.be.not.equal('error: permissionError');
            expect(response.status).to.equal(200);
            done();
        });
    });

    it('Test RESTful API as User: setBulk(POST) - must set values', done => {
        axios
            .post(
                'http://127.0.0.1:18183/setBulk',
                `${TEST_STATE_ID}=50&system.adapter.simple-api.0.alive=false&javascript.0.test=4`,
            )
            .then(response => {
                console.log(
                    `setBulk/?${TEST_STATE_ID}=50&system.adapter.simple-api.0.alive=false&javascript.0.test=4 => ${JSON.stringify(response.data)}`,
                );
                const obj = response.data;
                expect(obj).to.be.ok;
                expect(obj[0].val).to.be.equal(50);
                expect(obj[0].id).to.equal(TEST_STATE_ID);
                expect(obj[1].val).to.be.equal(false);
                expect(obj[1].id).to.equal('system.adapter.simple-api.0.alive');
                expect(obj[2].val).to.be.equal(4);
                expect(obj[2].id).to.equal('javascript.0.test');
                expect(response.status).to.equal(200);

                axios
                    .get(
                        `http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive,javascript.0.test`,
                    )
                    .then(response => {
                        console.log(
                            `getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive,javascript.0.test => ${JSON.stringify(response.data)}`,
                        );
                        const obj = response.data;
                        expect(obj[0].val).equal(50);
                        expect(obj[1].val).equal(false);
                        expect(obj[2].val).equal(4);
                        expect(response.status).to.equal(200);
                        done();
                    });
            });
    });

    it('Test RESTful API as User: setBulk(POST-GET-Mix) - must set values', done => {
        axios
            .post(`http://127.0.0.1:18183/setBulk?${TEST_STATE_ID}=51&system.adapter.simple-api.0.alive=false`, '')
            .then(response => {
                console.log(
                    `setBulk/?${TEST_STATE_ID}=51&system.adapter.simple-api.0.alive=false => ${JSON.stringify(response.data)}`,
                );
                expect(response.status).to.equal(200);

                const obj = response.data;
                expect(obj).to.be.ok;
                expect(obj[0].val).to.be.equal(51);
                expect(obj[0].id).to.equal(TEST_STATE_ID);
                expect(obj[1].val).to.be.equal(false);
                expect(obj[1].id).to.equal('system.adapter.simple-api.0.alive');

                return axios.get(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive`);
            })
            .then(response => {
                console.log(`getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive => ${response.data}`);
                expect(response.status).to.equal(200);

                const obj = response.data;
                expect(obj[0].val).equal(51);
                expect(obj[1].val).equal(false);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    it('Test RESTful API as User: setValueFromBody(POST) - must set one value', done => {
        axios
            .post(`http://127.0.0.1:18183/setValueFromBody/${TEST_STATE_ID}`, '55')
            .then(response => {
                console.log(`setValueFromBody/?${TEST_STATE_ID} => ${JSON.stringify(response.data)}`);
                expect(response.status).to.equal(200);

                const obj = response.data;
                expect(obj).to.be.ok;
                expect(obj[0].val).to.be.equal(55);
                expect(obj[0].id).to.equal(TEST_STATE_ID);

                return axios.get(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID}`);
            })
            .then(response => {
                console.log(`getBulk/${TEST_STATE_ID} => ${response.data}`);
                expect(response.status).to.equal(200);

                const obj = response.data;
                expect(obj[0].val).equal(55);
                done();
            })
            .catch(error => {
                console.error(error);
                done(error);
            });
    });

    after('Test RESTful API as User: Stop js-controller', function (done) {
        this.timeout(9000);
        setup.stopController(normalTerminated => {
            console.log(`Adapter normal terminated: ${normalTerminated}`);
            setTimeout(done, 3000);
        });
    });
});

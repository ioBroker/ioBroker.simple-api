/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
/* jshint expr: true*/

const assert = require('node:assert');
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

describe('Test RESTful API as User', function () {
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

            setup.startController(true, null, null, function (_objects, _states) {
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
            assert.notStrictEqual(res, 'Cannot check connection');
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
                    assert.strictEqual(err, null);

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
                            assert.strictEqual(err, null);
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
                                    assert.strictEqual(err, null);
                                    states.setState('javascript.0.test', 1, function (err) {
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

            assert.ok(obj);
            assert.strictEqual(obj.val, true);
            assert.strictEqual(obj.ack, true);
            assert.ok(obj.ts);
            //assert.strictEqual(obj.from, "system.adapter.simple-api.0");
            assert.strictEqual(obj.type, 'state');
            assert.strictEqual(obj._id, 'system.adapter.simple-api.0.alive');
            assert.ok(obj.common);
            assert.ok(obj.native);
            assert.strictEqual(obj.common.name, 'simple-api.0 alive');
            assert.strictEqual(obj.common.role, 'indicator.state');
            assert.strictEqual(response.status, 200);
            done();
        });
    });

    it('Test RESTful API as User: getPlainValue - must return plain value', done => {
        axios
            .get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', { responseType: 'text' })
            .then(response => {
                console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                assert.strictEqual(response.data, 'true');
                assert.strictEqual(response.status, 200);
                done();
            });
    });

    it('Test RESTful API as User: getPlainValue 4 Test-Endpoint - must return plain value', done => {
        axios.get('http://127.0.0.1:18183/getPlainValue/javascript.0.test', { responseType: 'text' }).then(response => {
            console.log(`getPlainValue/javascript.0.test => ${response.data}`);
            assert.strictEqual(response.data, '1');
            assert.strictEqual(response.status, 200);
            done();
        });
    });

    it('Test RESTful API as User: set 4 Test-Endpoint  - must set value', done => {
        axios.get('http://127.0.0.1:18183/set/javascript.0.test?val=2').then(response => {
            console.log(`set/javascript.0.test?val=false => ${response.data}`);
            const obj = response.data;
            assert.ok(obj);
            assert.strictEqual(obj.val, 2);
            assert.strictEqual(obj.id, 'javascript.0.test');
            assert.strictEqual(response.status, 200);
            axios
                .get('http://127.0.0.1:18183/getPlainValue/javascript.0.test', { responseType: 'text' })
                .then(response => {
                    console.log(`getPlainValue/javascript.0.test => ${response.data}`);
                    assert.strictEqual(response.data, '2');
                    assert.strictEqual(response.status, 200);
                    done();
                });
        });
    });

    it('Test RESTful API as User: set - must set value', done => {
        axios.get('http://127.0.0.1:18183/set/system.adapter.simple-api.0.alive?val=false').then(response => {
            console.log(`set/system.adapter.simple-api.0.alive?val=false => ${response.data}`);
            const obj = response.data;
            assert.ok(obj);
            assert.strictEqual(obj.val, false);
            assert.strictEqual(obj.id, 'system.adapter.simple-api.0.alive');
            assert.strictEqual(response.status, 200);
            axios
                .get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', { responseType: 'text' })
                .then(response => {
                    console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                    assert.strictEqual(response.data, 'false');
                    assert.strictEqual(response.status, 200);
                    done();
                });
        });
    });

    it('Test RESTful API as User: set - must set val', done => {
        axios.get('http://127.0.0.1:18183/set/system.adapter.simple-api.0.alive?val=true').then(response => {
            console.log(`set/system.adapter.simple-api.0.alive?val=true => ${response.data}`);
            const obj = response.data;
            assert.ok(obj);
            assert.strictEqual(obj.val, true);
            assert.strictEqual(obj.id, 'system.adapter.simple-api.0.alive');
            assert.strictEqual(response.status, 200);
            axios
                .get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', { responseType: 'text' })
                .then(response => {
                    console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                    assert.strictEqual(response.data, 'true');
                    assert.strictEqual(response.status, 200);
                    done();
                });
        });
    });

    it('Test RESTful API as User: toggle - must toggle boolean value to false', done => {
        axios.get('http://127.0.0.1:18183/toggle/system.adapter.simple-api.0.alive').then(response => {
            console.log(`toggle/system.adapter.simple-api.0.alive => ${response.data}`);
            const obj = response.data;
            assert.ok(obj);
            assert.strictEqual(obj.val, false);
            assert.strictEqual(obj.id, 'system.adapter.simple-api.0.alive');
            assert.strictEqual(response.status, 200);

            axios
                .get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', { responseType: 'text' })
                .then(response => {
                    console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                    assert.strictEqual(response.data, 'false');
                    assert.strictEqual(response.status, 200);
                    done();
                });
        });
    });

    it('Test RESTful API as User: toggle - must toggle boolean value to true', done => {
        axios.get('http://127.0.0.1:18183/toggle/system.adapter.simple-api.0.alive').then(response => {
            console.log(`toggle/system.adapter.simple-api.0.alive => ${response.data}`);
            const obj = response.data;
            assert.ok(obj);
            assert.strictEqual(obj.val, true);
            assert.strictEqual(obj.id, 'system.adapter.simple-api.0.alive');
            assert.strictEqual(response.status, 200);

            axios
                .get('http://127.0.0.1:18183/getPlainValue/system.adapter.simple-api.0.alive', { responseType: 'text' })
                .then(response => {
                    console.log(`getPlainValue/system.adapter.simple-api.0.alive => ${response.data}`);
                    assert.strictEqual(response.data, 'true');
                    assert.strictEqual(response.status, 200);
                    done();
                });
        });
    });

    it('Test RESTful API as User: toggle - must toggle number value to 100', done => {
        axios.get(`http://127.0.0.1:18183/toggle/${TEST_STATE_ID}`).then(response => {
            console.log(`toggle/${TEST_STATE_ID} => ${response.data}`);
            const obj = response.data;
            assert.ok(obj);
            assert.strictEqual(obj.val, 100);
            assert.strictEqual(obj.id, TEST_STATE_ID);
            assert.strictEqual(response.status, 200);

            axios
                .get(`http://127.0.0.1:18183/getPlainValue/${TEST_STATE_ID}`, { responseType: 'text' })
                .then(response => {
                    console.log(`getPlainValue/${TEST_STATE_ID} => ${response.data}`);
                    assert.strictEqual(response.data, '100');
                    assert.strictEqual(response.status, 200);
                    axios.get(`http://127.0.0.1:18183/set/${TEST_STATE_ID}?val=49`).then(response => {
                        console.log(`set/${TEST_STATE_ID}?val=49 => ` + response.data);
                        axios.get(`http://127.0.0.1:18183/toggle/${TEST_STATE_ID}`).then(response => {
                            console.log(`toggle/${TEST_STATE_ID} => ${response.data}`);
                            const obj = response.data;
                            assert.ok(obj);
                            assert.strictEqual(obj.val, 51);
                            assert.strictEqual(obj.id, TEST_STATE_ID);
                            assert.strictEqual(response.status, 200);

                            axios
                                .get(`http://127.0.0.1:18183/getPlainValue/${TEST_STATE_ID}`, { responseType: 'text' })
                                .then(response => {
                                    console.log(`getPlainValue/${TEST_STATE_ID} => ${response.data}`);
                                    assert.strictEqual(response.data, '51');
                                    assert.strictEqual(response.status, 200);
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
                assert.ok(obj);

                assert.strictEqual(obj[0].val, 50);
                assert.strictEqual(obj[0].id, TEST_STATE_ID);
                assert.strictEqual(obj[1].val, false);
                assert.strictEqual(obj[1].id, 'system.adapter.simple-api.0.alive');
                assert.strictEqual(obj[2].val, 3);
                assert.strictEqual(obj[2].id, 'javascript.0.test');
                assert.strictEqual(response.status, 200);

                axios
                    .get(
                        `http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive,javascript.0.test`,
                    )
                    .then(response => {
                        console.log(
                            `getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive&javascript.0.test => ${response.data}`,
                        );
                        const obj = response.data;
                        assert.strictEqual(obj[0].val, 50);
                        assert.strictEqual(obj[1].val, false);
                        assert.strictEqual(obj[2].val, 3);
                        assert.strictEqual(response.status, 200);
                        done();
                    });
            });
    });

    it('Test RESTful API as User: objects - must return objects', done => {
        axios.get('http://127.0.0.1:18183/objects?pattern=system.adapter.*').then(response => {
            console.log(`objects?pattern=system.adapter.* => ${response.data}`);
            assert.notStrictEqual(response.data, 'error: permissionError');
            assert.strictEqual(response.status, 200);
            done();
        });
    });

    it('Test RESTful API as User: objects - must return objects', done => {
        axios.get('http://127.0.0.1:18183/objects?pattern=system.adapter.*&type=instance').then(response => {
            console.log(`objects?pattern=system.adapter.* => ${response.data}`);
            assert.notStrictEqual(response.data, 'error: permissionError');
            assert.strictEqual(response.status, 200);
            done();
        });
    });

    it('Test RESTful API as User: states - must return states', done => {
        axios.get('http://127.0.0.1:18183/states?pattern=system.adapter.*').then(response => {
            console.log(`states?pattern=system.adapter.* => ${response.data}`);
            assert.notStrictEqual(response.data, 'error: permissionError');
            assert.strictEqual(response.status, 200);
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
                assert.ok(obj);
                assert.strictEqual(obj[0].val, 50);
                assert.strictEqual(obj[0].id, TEST_STATE_ID);
                assert.strictEqual(obj[1].val, false);
                assert.strictEqual(obj[1].id, 'system.adapter.simple-api.0.alive');
                assert.strictEqual(obj[2].val, 4);
                assert.strictEqual(obj[2].id, 'javascript.0.test');
                assert.strictEqual(response.status, 200);

                axios
                    .get(
                        `http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive,javascript.0.test`,
                    )
                    .then(response => {
                        console.log(
                            `getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive,javascript.0.test => ${JSON.stringify(response.data)}`,
                        );
                        const obj = response.data;
                        assert.strictEqual(obj[0].val, 50);
                        assert.strictEqual(obj[1].val, false);
                        assert.strictEqual(obj[2].val, 4);
                        assert.strictEqual(response.status, 200);
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
                assert.strictEqual(response.status, 200);

                const obj = response.data;
                assert.ok(obj);
                assert.strictEqual(obj[0].val, 51);
                assert.strictEqual(obj[0].id, TEST_STATE_ID);
                assert.strictEqual(obj[1].val, false);
                assert.strictEqual(obj[1].id, 'system.adapter.simple-api.0.alive');

                return axios.get(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive`);
            })
            .then(response => {
                console.log(`getBulk/${TEST_STATE_ID},system.adapter.simple-api.0.alive => ${response.data}`);
                assert.strictEqual(response.status, 200);

                const obj = response.data;
                assert.strictEqual(obj[0].val, 51);
                assert.strictEqual(obj[1].val, false);
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
                assert.strictEqual(response.status, 200);

                const obj = response.data;
                assert.ok(obj);
                assert.strictEqual(obj[0].val, 55);
                assert.strictEqual(obj[0].id, TEST_STATE_ID);

                return axios.get(`http://127.0.0.1:18183/getBulk/${TEST_STATE_ID}`);
            })
            .then(response => {
                console.log(`getBulk/${TEST_STATE_ID} => ${response.data}`);
                assert.strictEqual(response.status, 200);

                const obj = response.data;
                assert.strictEqual(obj[0].val, 55);
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

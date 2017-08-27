/* jshint -W097 */// jshint strict:false
/*jslint node: true */
/*jshint expr: true*/
var expect  = require('chai').expect;
var setup   = require(__dirname + '/lib/setup');
var request = require('request');

var objects = null;
var states  = null;

process.env.NO_PROXY = '127.0.0.1';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

describe('Test RESTful API SSL', function() {
    before('Test RESTful API SSL: Start js-controller', function (_done) {
        this.timeout(600000); // because of first install from npm
        setup.adapterStarted = false;

        var brokerStarted   = false;
        setup.setupController(function () {
            var config = setup.getAdapterConfig();
            // enable adapter
            config.common.enabled = true;
            config.common.loglevel = 'debug';
            config.native.port = 18183;
            config.native.auth = true;
            config.native.secure = true;
            config.native.certPublic = 'defaultPublic';
            config.native.certPrivate = 'defaultPrivate';

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
            done();
        });
    });

    it('Test RESTful API SSL: get - must return value', function (done) {
        request('https://127.0.0.1:18183/get/system.adapter.simple-api.0.alive?user=admin&pass=iobroker', function (error, response, body) {
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

    it('Test RESTful API SSL: get with no credentials', function (done) {
        request('https://127.0.0.1:18183/get/system.adapter.simple-api.0.alive?user=admin&pass=io', function (error, response, body) {
            console.log('get/system.adapter.simple-api.0.alive => ' + body);
            expect(error).to.be.not.ok;
            expect(response.statusCode).to.be.equal(401);
            done();
        });
    });

    it('Test RESTful API SSL: get with wrong credentials', function (done) {
        request('https://127.0.0.1:18183/get/system.adapter.simple-api.0.alive', function (error, response, body) {
            console.log('get/system.adapter.simple-api.0.alive => ' + body);
            expect(error).to.be.not.ok;
            expect(response.statusCode).to.be.equal(401);
            done();
        });
    });

    it('Test RESTful API SSL: setBulk(POST) - must set values', function (done) {

        request({
            uri:    'https://127.0.0.1:18183/setBulk?user=admin&pass=iobroker',
            method: 'POST',
            body:   'system.adapter.simple-api.upload=50&system.adapter.simple-api.0.alive=false'
        }, function(error, response, body) {
            console.log('setBulk/?system.adapter.simple-api.upload=50&system.adapter.simple-api.0.alive=false => ' + JSON.stringify(body));
            expect(error).to.be.not.ok;

            var obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj[0].val).to.be.equal(50);
            expect(obj[0].id).to.equal('system.adapter.simple-api.upload');
            expect(obj[1].val).to.be.equal(false);
            expect(obj[1].id).to.equal('system.adapter.simple-api.0.alive');

            request('https://127.0.0.1:18183/getBulk/system.adapter.simple-api.upload,system.adapter.simple-api.0.alive?user=admin&pass=iobroker', function (error, response, body) {
                console.log('getBulk/system.adapter.simple-api.upload,system.adapter.simple-api.0.alive => ' + body);
                expect(error).to.be.not.ok;
                var obj = JSON.parse(body);
                expect(obj[0].val).equal(50);
                expect(obj[1].val).equal(false);
                done();
            });
        });
    });

    it('Test RESTful API SSL: setValueFromBody(POST) - must set values', function (done) {
        request({
            uri: 'https://127.0.0.1:18183/setValueFromBody/system.adapter.simple-api.upload?user=admin&pass=iobroker&',
            method: 'POST',
            body:   '55'
        }, function(error, response, body) {
            console.log('setValueFromBody/?system.adapter.simple-api.upload => ' + JSON.stringify(body));
            expect(error).to.be.not.ok;

            var obj = JSON.parse(body);
            expect(obj).to.be.ok;
            expect(obj[0].val).to.be.equal(55);
            expect(obj[0].id).to.equal('system.adapter.simple-api.upload');

            body = "";
            request('https://127.0.0.1:18183/getBulk/system.adapter.simple-api.upload?user=admin&pass=iobroker', function (error, response, body) {
                console.log('getBulk/system.adapter.simple-api.upload => ' + body);
                expect(error).to.be.not.ok;
                var obj = JSON.parse(body);
                expect(obj[0].val).equal(55);
                done();
            });
        });
});
    after('Test RESTful API SSL: Stop js-controller', function (done) {
        this.timeout(6000);
        setup.stopController(function (normalTerminated) {
            console.log('Adapter normal terminated: ' + normalTerminated);
            done();
        });
    });
});

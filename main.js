/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

var utils     = require(__dirname + '/lib/utils'); // Get common adapter utils
var SimpleAPI = require(__dirname + '/lib/simpleapi.js');

var webServer =  null;
var fs = null;

var adapter = utils.adapter({
    name: 'simple-api',
    stateChange: function (id, state) {
        if (webServer && webServer.api) {
            webServer.api.stateChange(id, state);
        }
    },
    objectChange: function (id, obj) {
        if (webServer && webServer.api) {
            webServer.api.objectChange(id, obj);
        }
    },
    unload: function (callback) {
        try {
            adapter.log.info("terminating http" + (webServer.settings.secure ? "s" : "") + " server on port " + webServer.settings.port);
            //if (webServer.api) webServer.api.close();

            callback();
        } catch (e) {
            callback();
        }
    },
    ready: function () {
        main();
    }
});

function main() {
    if (adapter.config.secure) {
        // subscribe on changes of permissions
        adapter.subscribeForeignObjects('system.group.*');
        adapter.subscribeForeignObjects('system.user.*');

        // Load certificates
        adapter.getForeignObject('system.certificates', function (err, obj) {
            if (err || !obj ||
                !obj.native.certificates ||
                !adapter.config.certPublic ||
                !adapter.config.certPrivate ||
                !obj.native.certificates[adapter.config.certPublic] ||
                !obj.native.certificates[adapter.config.certPrivate]
                ) {
                adapter.log.error('Cannot enable secure web server, because no certificates found: ' + adapter.config.certPublic + ', ' + adapter.config.certPrivate);
            } else {
                adapter.config.certificates = {
                    key:  obj.native.certificates[adapter.config.certPrivate],
                    cert: obj.native.certificates[adapter.config.certPublic]
                };

            }
            webServer = initWebServer(adapter.config);
        });
    } else {
        webServer = initWebServer(adapter.config);
    }
}

function requestProcessor(req, res) {
    if (req.url.indexOf('favicon.ico') != -1) {
        if (!fs) fs = require('fs');
        var stat = fs.statSync(__dirname + '/img/favicon.ico');

        res.writeHead(200, {
            'Content-Type': 'image/x-icon',
            'Content-Length': stat.size
        });

        var readStream = fs.createReadStream(__dirname + '/img/favicon.ico');
        // We replaced all the event handlers with a simple call to readStream.pipe()
        readStream.pipe(res);
    } else {
        webServer.api.restApi(req, res);
    }
}

//settings: {
//    "port":   8080,
//    "auth":   false,
//    "secure": false,
//    "bind":   "0.0.0.0", // "::"
//    "cache":  false
//}
function initWebServer(settings) {

    var server = {
        app:       null,
        server:    null,
        api:       null,
        io:        null,
        settings:  settings
    };

    if (settings.port) {
        if (settings.secure) {
            if (!adapter.config.certificates) {
                return null;
            }
        }

        if (settings.secure) {
            server.server = require('https').createServer(adapter.config.certificates, requestProcessor);
        } else {
            server.server = require('http').createServer(requestProcessor);
        }

        server.server.__server = server;
    } else {
        adapter.log.error('port missing');
        process.exit(1);
    }

    if (server.server) {
        adapter.getPort(settings.port, function (port) {
            if (port != settings.port && !adapter.config.findNextPort) {
                adapter.log.error('port ' + settings.port + ' already in use');
                process.exit(1);
            }
            server.server.listen(port);
            adapter.log.info('http' + (settings.secure ? 's' : '') + ' server listening on port ' + port);
        });
    }

    server.api = new SimpleAPI(server.server, settings, adapter);

    if (server.server) {
        return server;
    } else {
        return null;
    }
}

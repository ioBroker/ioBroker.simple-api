/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

const utils       = require('@iobroker/adapter-core'); // Get common adapter utils
const SimpleAPI   = require('./lib/simpleapi.js');
const LE          = require(utils.controllerDir + '/lib/letsencrypt.js');
const adapterName = require('./package.json').name.split('.').pop();

let webServer = null;
let fs        = null;
let adapter;

function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
        name: adapterName,
        stateChange: (id, state) => webServer && webServer.api && webServer.api.stateChange(id, state),
        unload: callback => {
            try {
                if (webServer && webServer.server) {
                    adapter.log.info(`terminating http${webServer.settings.secure ? 's' : ''} server on port ${webServer.settings.port}`);
                    webServer.server.close();
                    webServer.server = null;
                }
            } catch (e) {

            }
            callback();
        },
        ready: main
    });

    adapter = new utils.Adapter(options);
    return adapter;
}

async function main() {
    if (adapter.config.webInstance) {
        console.log('Adapter runs as a part of web service');
        adapter.log.warn('Adapter runs as a part of web service');
        return adapter.setForeignState(`system.adapter.${adapter.namespace}.alive`, false, true, () =>
            setTimeout(() => adapter.terminate ? adapter.terminate() : process.exit(), 1000));
    }

    if (adapter.config.secure) {
        // Load certificates
        adapter.getCertificates(async (err, certificates, leConfig) => {
            adapter.config.certificates = certificates;
            adapter.config.leConfig     = leConfig;
            webServer = await initWebServer(adapter.config);
        });
    } else {
        webServer = await initWebServer(adapter.config);
    }
}

function requestProcessor(req, res) {
    if (req.url.indexOf('favicon.ico') !== -1) {
        fs = fs || require('fs');
        let stat;
        try {
            if (fs.existsSync(__dirname + '/img/favicon.ico')) {
                stat = fs.statSync(__dirname + '/img/favicon.ico');
            }
        } catch (err) {
            // no special handling
        }
        if (stat) {
            res.writeHead(200, {
                'Content-Type': 'image/x-icon',
                'Content-Length': stat.size
            });

            const readStream = fs.createReadStream(__dirname + '/img/favicon.ico');
            // We replaced all the event handlers with a simple call to readStream.pipe()
            readStream.pipe(res);
        } else {
            res.writeHead(404, {'Content-Type': 'text/plain'});
            res.write('404 Not Found\n');
            res.end();
        }

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
async function initWebServer(settings) {
    const server = {
        app:       null,
        server:    null,
        api:       null,
        io:        null,
        settings:  settings
    };

    settings.port = parseInt(settings.port, 10);

    if (settings.port) {
        if (settings.secure && !adapter.config.certificates) {
            return null;
        }

        try {
            if (typeof LE.createServerAsync === 'function') {
                server.server = await LE.createServerAsync(requestProcessor, settings, adapter.config.certificates, adapter.config.leConfig, adapter.log, adapter);
            } else {
                server.server = LE.createServer(requestProcessor, settings, adapter.config.certificates, adapter.config.leConfig, adapter.log);
            }
        } catch (err) {
            adapter.log.error(`Cannot create webserver: ${err}`);
            adapter.terminate ? adapter.terminate(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION) : process.exit(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
            return;
        }
        if (!server.server) {
            adapter.log.error(`Cannot create webserver`);
            adapter.terminate ? adapter.terminate(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION) : process.exit(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
            return;
        }
        server.server.__server = server;
    } else {
        adapter.log.error('port missing');
        if (adapter.terminate) {
            adapter.terminate(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
        } else {
            process.exit(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
        }
        return;
    }

    if (server.server) {
        let serverListening = false;
        let serverPort = settings.port;
        server.server.on('error', e => {
            if (e.toString().includes('EACCES') && serverPort <= 1024) {
                adapter.log.error(`node.js process has no rights to start server on the port ${serverPort}.\n` +
                    `Do you know that on linux you need special permissions for ports under 1024?\n` +
                    `You can call in shell following scrip to allow it for node.js: "iobroker fix"`
                );
            } else {
                adapter.log.error(`Cannot start server on ${settings.bind || '0.0.0.0'}:${serverPort}: ${e}`);
            }
            if (!serverListening) {
                adapter.terminate ? adapter.terminate(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION) : process.exit(utils.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
            }
        });

        adapter.getPort(settings.port, port => {
            if (port !== settings.port && !adapter.config.findNextPort) {
                adapter.log.error(`port ${settings.port} already in use`);
                if (adapter.terminate) {
                    adapter.terminate(1);
                } else {
                    process.exit(1);
                }
                return;
            }
            serverPort = port;

            if (server.server) {
                // create web server
                server.server.listen(port, (!settings.bind || settings.bind === '0.0.0.0') ? undefined : settings.bind || undefined, () => {
                    serverListening = true;
                });

                adapter.log.info(`http${settings.secure ? 's' : ''} server listening on port ${port}`);
            } else {
                adapter.log.error('server initialization failed');
                if (adapter.terminate) {
                    adapter.terminate(1);
                } else {
                    process.exit(1);
                }
            }
        });
    }

    server.api = new SimpleAPI(server.server, settings, adapter);

    if (server.server) {
        return server;
    } else {
        return null;
    }
}

// If started as allInOne mode => return function to create instance
if (module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}

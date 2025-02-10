"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleApiAdapter = void 0;
const node_fs_1 = require("node:fs");
const adapter_core_1 = require("@iobroker/adapter-core");
const SimpleAPI_1 = require("./lib/SimpleAPI");
const webserver_1 = require("@iobroker/webserver");
class SimpleApiAdapter extends adapter_core_1.Adapter {
    webServer = {
        server: null,
        api: null,
    };
    certificates;
    constructor(options = {}) {
        super({
            ...options,
            name: 'simple-api',
            unload: callback => this.onUnload(callback),
            stateChange: (id, state) => {
                this.webServer?.api?.stateChange(id, state);
            },
            ready: () => this.main(),
            objectChange: (id, obj) => {
                this.webServer?.api?.objectChange(id, obj);
            },
        });
        this.config = this.config;
    }
    onUnload(callback) {
        try {
            if (this.webServer.server) {
                this.log.info(`terminating http${this.config.secure ? 's' : ''} server on port ${this.config.port}`);
                this.webServer.server.close();
                this.webServer.server = null;
            }
        }
        catch {
            // ignore
        }
        if (callback) {
            callback();
        }
    }
    async main() {
        this.config = this.config;
        if (this.config.webInstance) {
            console.log('Adapter runs as a part of web service');
            this.log.warn('Adapter runs as a part of web service');
            return this.setForeignState(`system.adapter.${this.namespace}.alive`, false, true, () => setTimeout(() => (this.terminate ? this.terminate() : process.exit()), 1000));
        }
        if (this.config.secure) {
            // Load certificates
            await new Promise(resolve => this.getCertificates(undefined, undefined, undefined, (err, certificates, leConfig) => {
                this.certificates = certificates;
                resolve();
            }));
        }
        await this.initWebServer();
    }
    requestProcessor = (req, res) => {
        if ((req.url || '').includes('favicon.ico')) {
            let stat;
            try {
                if ((0, node_fs_1.existsSync)(`${__dirname}/../img/favicon.ico`)) {
                    stat = (0, node_fs_1.statSync)(`${__dirname}/../img/favicon.ico`);
                }
            }
            catch {
                // no special handling
            }
            if (stat) {
                res.writeHead(200, {
                    'Content-Type': 'image/x-icon',
                    'Content-Length': stat.size,
                });
                const readStream = (0, node_fs_1.createReadStream)(`${__dirname}/../img/favicon.ico`);
                // We replaced all the event handlers with a simple call to readStream.pipe()
                readStream.pipe(res);
            }
            else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.write('404 Not Found\n');
                res.end();
            }
        }
        else {
            this.webServer.api?.restApi(req, res);
        }
    };
    async initWebServer() {
        this.config.port = parseInt(this.config.port, 10);
        if (this.config.port) {
            if (this.config.secure && !this.certificates) {
                return null;
            }
            try {
                const webserver = new webserver_1.WebServer({
                    app: this.requestProcessor,
                    adapter: this,
                    secure: this.config.secure,
                });
                this.webServer.server = (await webserver.init());
            }
            catch (err) {
                this.log.error(`Cannot create webserver: ${err}`);
                this.terminate
                    ? this.terminate(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                    : process.exit(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                return;
            }
            if (!this.webServer.server) {
                this.log.error(`Cannot create webserver`);
                this.terminate
                    ? this.terminate(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                    : process.exit(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                return;
            }
            this.webServer.server.__server = this.webServer;
        }
        else {
            this.log.error('port missing');
            if (this.terminate) {
                this.terminate(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
            }
            else {
                process.exit(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
            }
            return;
        }
        if (this.webServer.server) {
            let serverListening = false;
            let serverPort = this.config.port;
            this.webServer.server.on('error', e => {
                if (e.toString().includes('EACCES') && serverPort <= 1024) {
                    this.log.error(`node.js process has no rights to start server on the port ${serverPort}.\n` +
                        `Do you know that on linux you need special permissions for ports under 1024?\n` +
                        `You can call in shell following scrip to allow it for node.js: "iobroker fix"`);
                }
                else {
                    this.log.error(`Cannot start server on ${this.config.bind || '0.0.0.0'}:${serverPort}: ${e}`);
                }
                if (!serverListening) {
                    this.terminate
                        ? this.terminate(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                        : process.exit(adapter_core_1.EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                }
            });
            this.getPort(this.config.port, !this.config.bind || this.config.bind === '0.0.0.0' ? undefined : this.config.bind || undefined, port => {
                if (port !== this.config.port) {
                    this.log.error(`port ${this.config.port} already in use`);
                    if (this.terminate) {
                        this.terminate(1);
                    }
                    else {
                        process.exit(1);
                    }
                    return;
                }
                serverPort = port;
                if (this.webServer.server) {
                    // create web server
                    this.webServer.server.listen(port, !this.config.bind || this.config.bind === '0.0.0.0'
                        ? undefined
                        : this.config.bind || undefined, () => (serverListening = true));
                    this.log.info(`http${this.config.secure ? 's' : ''} server listening on port ${port}`);
                }
                else {
                    this.log.error('server initialization failed');
                    if (this.terminate) {
                        this.terminate(1);
                    }
                    else {
                        process.exit(1);
                    }
                }
            });
        }
        this.webServer.api = new SimpleAPI_1.SimpleAPI(this.webServer.server, this.config, this, {
            native: this.config,
            _id: `system.adapter.${this.namespace}`,
            common: this.common,
            type: 'instance',
            objects: [],
            instanceObjects: [],
        });
    }
}
exports.SimpleApiAdapter = SimpleApiAdapter;
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options) => new SimpleApiAdapter(options);
}
else {
    // otherwise start the instance directly
    (() => new SimpleApiAdapter())();
}
//# sourceMappingURL=main.js.map
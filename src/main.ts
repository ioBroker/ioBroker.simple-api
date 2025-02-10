import { type Request, type Response } from 'express';
import { createReadStream, existsSync, type Stats, statSync } from 'node:fs';
import type { RequestListener } from 'http';

import { Adapter, type AdapterOptions, EXIT_CODES } from '@iobroker/adapter-core';
import { SimpleAPI, type Server } from './lib/SimpleAPI';
import { WebServer } from '@iobroker/webserver';
import { SimpleApiAdapterConfig } from './types';

interface WebStructure {
    server: null | (Server & { __server: WebStructure });
    api: SimpleAPI | null;
}

export class SimpleApiAdapter extends Adapter {
    declare public config: SimpleApiAdapterConfig;
    private webServer: WebStructure = {
        server: null,
        api: null,
    };
    private certificates: ioBroker.Certificates | undefined;

    public constructor(options: Partial<AdapterOptions> = {}) {
        super({
            ...options,
            name: 'simple-api',
            unload: callback => this.onUnload(callback),
            stateChange: (id, state) => {
                this.webServer?.api?.stateChange(id, state);
            },
            ready: () => this.main(),
            objectChange: (id: string, obj: ioBroker.Object | null | undefined): void => {
                this.webServer?.api?.objectChange(id, obj);
            },
        });

        this.config = this.config as SimpleApiAdapterConfig;
    }

    onUnload(callback: () => void): void {
        try {
            if (this.webServer.server) {
                this.log.info(`terminating http${this.config.secure ? 's' : ''} server on port ${this.config.port}`);
                this.webServer.server.close();
                this.webServer.server = null;
            }
        } catch {
            // ignore
        }
        if (callback) {
            callback();
        }
    }

    async main(): Promise<void> {
        this.config = this.config as SimpleApiAdapterConfig;

        if (this.config.webInstance) {
            console.log('Adapter runs as a part of web service');
            this.log.warn('Adapter runs as a part of web service');
            return this.setForeignState(`system.adapter.${this.namespace}.alive`, false, true, () =>
                setTimeout(() => (this.terminate ? this.terminate() : process.exit()), 1000),
            );
        }

        if (this.config.secure) {
            // Load certificates
            await new Promise<void>(resolve =>
                this.getCertificates(undefined, undefined, undefined, (err, certificates, leConfig): void => {
                    this.certificates = certificates;
                    resolve();
                }),
            );
        }

        await this.initWebServer();
    }

    requestProcessor = (req: Request, res: Response): void => {
        if ((req.url || '').includes('favicon.ico')) {
            let stat: Stats | undefined;
            try {
                if (existsSync(`${__dirname}/../img/favicon.ico`)) {
                    stat = statSync(`${__dirname}/../img/favicon.ico`);
                }
            } catch {
                // no special handling
            }

            if (stat) {
                res.writeHead(200, {
                    'Content-Type': 'image/x-icon',
                    'Content-Length': stat.size,
                });

                const readStream = createReadStream(`${__dirname}/../img/favicon.ico`);
                // We replaced all the event handlers with a simple call to readStream.pipe()
                readStream.pipe(res);
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.write('404 Not Found\n');
                res.end();
            }
        } else {
            this.webServer.api?.restApi(req, res);
        }
    };

    async initWebServer() {
        this.config.port = parseInt(this.config.port as string, 10);

        if (this.config.port) {
            if (this.config.secure && !this.certificates) {
                return null;
            }

            try {
                const webserver = new WebServer({
                    app: this.requestProcessor as RequestListener,
                    adapter: this,
                    secure: this.config.secure,
                });

                this.webServer.server = (await webserver.init()) as Server & { __server: WebStructure };
            } catch (err) {
                this.log.error(`Cannot create webserver: ${err}`);
                this.terminate
                    ? this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                    : process.exit(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                return;
            }
            if (!this.webServer.server) {
                this.log.error(`Cannot create webserver`);
                this.terminate
                    ? this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                    : process.exit(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                return;
            }
            this.webServer.server.__server = this.webServer;
        } else {
            this.log.error('port missing');
            if (this.terminate) {
                this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
            } else {
                process.exit(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
            }
            return;
        }

        if (this.webServer.server) {
            let serverListening = false;
            let serverPort = this.config.port;

            this.webServer.server.on('error', e => {
                if (e.toString().includes('EACCES') && serverPort <= 1024) {
                    this.log.error(
                        `node.js process has no rights to start server on the port ${serverPort}.\n` +
                            `Do you know that on linux you need special permissions for ports under 1024?\n` +
                            `You can call in shell following scrip to allow it for node.js: "iobroker fix"`,
                    );
                } else {
                    this.log.error(`Cannot start server on ${this.config.bind || '0.0.0.0'}:${serverPort}: ${e}`);
                }
                if (!serverListening) {
                    this.terminate
                        ? this.terminate(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION)
                        : process.exit(EXIT_CODES.ADAPTER_REQUESTED_TERMINATION);
                }
            });

            this.getPort(
                this.config.port,
                !this.config.bind || this.config.bind === '0.0.0.0' ? undefined : this.config.bind || undefined,
                port => {
                    if (port !== this.config.port) {
                        this.log.error(`port ${this.config.port} already in use`);
                        if (this.terminate) {
                            this.terminate(1);
                        } else {
                            process.exit(1);
                        }
                        return;
                    }
                    serverPort = port;

                    if (this.webServer.server) {
                        // create web server
                        this.webServer.server.listen(
                            port,
                            !this.config.bind || this.config.bind === '0.0.0.0'
                                ? undefined
                                : this.config.bind || undefined,
                            () => (serverListening = true),
                        );

                        this.log.info(`http${this.config.secure ? 's' : ''} server listening on port ${port}`);
                    } else {
                        this.log.error('server initialization failed');
                        if (this.terminate) {
                            this.terminate(1);
                        } else {
                            process.exit(1);
                        }
                    }
                },
            );
        }

        this.webServer.api = new SimpleAPI(this.webServer.server, this.config, this, {
            native: this.config,
            _id: `system.adapter.${this.namespace}`,
            common: this.common as ioBroker.InstanceCommon,
            type: 'instance',
            objects: [],
            instanceObjects: [],
        });
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<AdapterOptions> | undefined) => new SimpleApiAdapter(options);
} else {
    // otherwise start the instance directly
    (() => new SimpleApiAdapter())();
}

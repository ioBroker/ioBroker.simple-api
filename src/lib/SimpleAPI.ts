import type { Server as HttpServer } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import type { SimpleApiAdapterConfig } from '../types';
import { Express, type Request, type Response } from 'express';
import { CommandsPermissionsObject } from '@iobroker/types/build/types';

// copied from here: https://github.com/component/escape-html/blob/master/index.js
const matchHtmlRegExp = /["'&<>]/;
function escapeHtml(string: string): string {
    const str = `${string}`;
    const match = matchHtmlRegExp.exec(str);

    if (!match) {
        return str;
    }

    let escape;
    let html = '';
    let index;
    let lastIndex = 0;

    for (index = match.index; index < str.length; index++) {
        switch (str.charCodeAt(index)) {
            case 34: // "
                escape = '&quot;';
                break;
            case 38: // &
                escape = '&amp;';
                break;
            case 39: // '
                escape = '&#39;';
                break;
            case 60: // <
                escape = '&lt;';
                break;
            case 62: // >
                escape = '&gt;';
                break;
            default:
                continue;
        }

        if (lastIndex !== index) {
            html += str.substring(lastIndex, index);
        }

        lastIndex = index + 1;
        html += escape;
    }

    return lastIndex !== index ? html + str.substring(lastIndex, index) : html;
}

const ERROR_PERMISSION = 'permissionError';
const ERROR_UNKNOWN_COMMAND = 'unknownCommand';

export type Server = HttpServer | HttpsServer;

// static information
const commandsPermissions: {
    [operation: string]: { type: 'state' | 'object' | ''; operation: 'read' | 'write' | 'list' | '' };
} = {
    getPlainValue: { type: 'state', operation: 'read' },
    get: { type: 'state', operation: 'read' },
    getBulk: { type: 'state', operation: 'read' },
    set: { type: 'state', operation: 'write' },
    toggle: { type: 'state', operation: 'write' },
    setBulk: { type: 'state', operation: 'write' },
    setValueFromBody: { type: 'state', operation: 'write' },
    getObjects: { type: 'object', operation: 'list' },
    objects: { type: 'object', operation: 'list' },
    states: { type: 'state', operation: 'list' },
    getStates: { type: 'state', operation: 'list' },
    search: { type: 'state', operation: 'list' },
    query: { type: 'state', operation: 'read' },
    annotations: { type: '', operation: '' },
    help: { type: '', operation: '' },
};

type CommandName = keyof typeof commandsPermissions;

/**
 * SimpleAPI class
 *
 * From settings used only secure, auth and crossDomain
 *
 * @class
 * @param webSettings settings of the web server, like <pre><code>{secure: settings.secure, port: settings.port}</code></pre>
 * @param adapter web adapter object
 * @param instanceSettings instance object with common and native
 * @param app express application
 * @return object instance
 */
export class SimpleAPI {
    private readonly adapter: ioBroker.Adapter;
    private readonly settings: {
        secure: boolean;
        port: number | string;
        defaultUser?: string;
        auth?: boolean;
        language?: ioBroker.Languages;
    };
    private readonly config: SimpleApiAdapterConfig;
    private readonly namespace: string;
    private readonly app?: Express;
    private readonly cachedNames: Map<string, { id: string; name: string }> = new Map();
    private readonly cachedIds: Map<string, { id: string; name: string }> = new Map();

    private readonly restApiDelayed: {
        id: string;
        timer: ioBroker.Timeout | undefined;
        resolve: (index: string) => void;
        index: string;
        value: ioBroker.StateValue;
    }[] = [];

    constructor(
        _server: Server,
        webSettings: {
            secure: boolean;
            port: number | string;
            defaultUser?: string;
            auth?: boolean;
            language?: ioBroker.Languages;
        },
        adapter: ioBroker.Adapter,
        instanceSettings: ioBroker.InstanceObject,
        app?: Express,
    ) {
        this.app = app;
        this.adapter = adapter;
        this.settings = webSettings;
        this.config = instanceSettings
            ? (instanceSettings.native as SimpleApiAdapterConfig)
            : ({} as SimpleApiAdapterConfig);
        this.namespace = instanceSettings ? instanceSettings._id.substring('system.adapter.'.length) : 'simple-api';

        this.adapter.log.info(
            `${this.settings.secure ? 'Secure ' : ''}simpleAPI server listening on port ${this.settings.port}`,
        );
        this.config.defaultUser = webSettings.defaultUser || this.config.defaultUser || 'system.user.admin';
        if (!this.config.defaultUser.match(/^system\.user\./)) {
            this.config.defaultUser = `system.user.${this.config.defaultUser}`;
        }
        this.config.onlyAllowWhenUserIsOwner = !!this.config.onlyAllowWhenUserIsOwner;

        this.adapter.log.info(`Allow states only when user is owner: ${this.config.onlyAllowWhenUserIsOwner}`);

        if (this.app) {
            this.adapter.log.info(`Install extension on /${this.namespace}/`);

            this.app.use(`/${this.namespace}/`, (req: Request, res: Response): void => {
                this.restApi(req, res);
            });

            // let it be accessible under old address too
            for (const c in commandsPermissions) {
                ((command: string): void => {
                    this.adapter.log.info(`Install extension on /${command}/`);
                    this.app.use(`/${command}/`, (req: Request, res: Response): void => {
                        void this.restApi(req, res, `/${command}${req.url}`);
                    });
                })(c);
            }
        }

        // Subscribe on object changes to manage cache
        this.adapter.subscribeForeignObjects('*');
    }

    async isAuthenticated(query: { user?: string; pass?: string }): Promise<boolean> {
        if (!query.user || !query.pass) {
            this.adapter.log.warn('No password or username!');
            return false;
        }

        const res = await this.adapter.checkPasswordAsync(query.user, query.pass);
        if (res) {
            this.adapter.log.debug(`Logged in: ${query.user}`);
        } else {
            this.adapter.log.warn(`Invalid password or user name: ${query.user}`);
        }
        return res;
    }

    stateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (state?.ack) {
            for (let i = this.restApiDelayed.length - 1; i >= 0; i--) {
                if (this.restApiDelayed[i].id === id) {
                    if (this.restApiDelayed[i].timer) {
                        this.restApiDelayed[i].timer = undefined;
                        this.adapter.clearTimeout(this.restApiDelayed[i].timer);
                        this.restApiDelayed[i].resolve(this.restApiDelayed[i].index);
                    }
                    this.restApiDelayed.splice(i, 1);
                }
            }
        }
    }

    objectChange(id: string, _obj: ioBroker.Object | null | undefined): void {
        // Clear from cache, will be reinitialized on next usage
        if (this.cachedIds.has(id)) {
            const name = this.cachedIds.get(id)?.name;
            if (name) {
                this.cachedIds.delete(id);
                this.cachedNames.delete(name);
            }
        }
    }

    static parseQuery(
        input: string | undefined,
        query: {
            user?: string;
            pass?: string;
            prettyPrint?: boolean;
            json?: boolean;
            noStringify?: boolean;
            wait?: number;
            ack: boolean;
        },
        values: Record<string, string | null>,
    ): void {
        const parts = (input || '').split('&');
        for (const part of parts) {
            const [name, value] = part.split('=');
            try {
                if (name === 'user') {
                    query.user = decodeURIComponent(value.trim());
                } else if (name === 'pass') {
                    query.pass = decodeURIComponent(value);
                } else if (name === 'prettyPrint') {
                    query.prettyPrint = !value ? true : decodeURIComponent(value.trim()) === 'true';
                } else if (name === 'json') {
                    query.json = !value ? true : decodeURIComponent(value.trim()) === 'true';
                } else if (name === 'noStringify') {
                    query.noStringify = !value ? true : decodeURIComponent(value.trim()) === 'true';
                } else if (name === 'wait') {
                    query.wait = !value ? 2000 : parseInt(decodeURIComponent(value.trim()), 10) || 0;
                } else if (name === 'ack') {
                    const val = decodeURIComponent(value.trim());
                    query.ack = val === 'true' || val === '1';
                } else {
                    values[name] =
                        value === undefined ? null : decodeURIComponent(`${value.trim()}`.replace(/\+/g, '%20'));
                }
            } catch {
                values[name] = value;
            }
        }
        if (query.ack === undefined) {
            query.ack = false;
        }
    }

    async setStates(
        values: Record<string, string | null>,
        query: {
            user?: string;
            pass?: string;
            prettyPrint?: boolean;
            json?: boolean;
            noStringify?: boolean;
            wait?: number;
            ack: boolean;
        },
    ): Promise<{ id?: string; val?: boolean | string | number; error?: string }[]> {
        let response: { id?: string; val?: boolean | string | number; error?: string }[] = [];
        const names = Object.keys(values);

        for (let i = 0; i < names.length; i++) {
            const stateId = names[i];
            this.adapter.log.debug(`${i}: "${stateId}"`);

            try {
                const { id, name } = await this.findState(stateId, query.user as `system.user.${string}`);
                if (!id) {
                    response[i] = { error: `datapoint "${stateId}" not found` };
                } else {
                    let value: string | number | boolean;
                    if (values[stateId] === 'true') {
                        value = true;
                    } else if (values[stateId] === 'false') {
                        value = false;
                    } else {
                        const f = parseFloat(values[stateId] as string);
                        if (!isNaN(f) && values[stateId] === f.toString()) {
                            value = f;
                        } else {
                            value = values[stateId] as string;
                        }
                    }

                    try {
                        await this.adapter.setForeignState(id, value, !!query.ack, {
                            user: query.user,
                            limitToOwnerRights: this.config.onlyAllowWhenUserIsOwner,
                        });
                        response[i] = { id, val: value };
                        this.adapter.log.debug(`Add to Response: ${JSON.stringify(response[i])}`);
                    } catch (err) {
                        throw err;
                    }
                }
            } catch (err) {
                // State isn't found or no permission
                if (err.toString().includes(ERROR_PERMISSION)) {
                    throw err;
                }
                response[i] = { error: err.toString() };
            }
        }
        return response;
    }

    async restApiPost(
        req: Request,
        res: Response,
        command: CommandName,
        oId: string[],
        values: Record<string, string | null>,
        query: {
            user?: string;
            pass?: string;
            prettyPrint?: boolean;
            json?: boolean;
            noStringify?: boolean;
            wait?: number;
            ack: boolean;
        },
    ): Promise<void> {
        let body = '';
        req.on('data', (data: Buffer): void => {
            body += data.toString();
        });

        await new Promise<void>(resolve => req.on('end', resolve));

        switch (command) {
            case 'setBulk': {
                this.adapter.log.debug(`POST-${command}: body = ${body}`);
                SimpleAPI.parseQuery(body, query, values);
                this.adapter.log.debug(`POST-${command}: values = ${JSON.stringify(values)}`);
                try {
                    const response = await this.setStates(values, query);
                    this.doResponse(res, 'json', response, query.prettyPrint);
                } catch (err) {
                    // State not found
                    if (err.toString().includes(ERROR_PERMISSION)) {
                        this.doErrorResponse(res, 'json', 401, err.toString());
                    } else if (err.toString().includes('found')) {
                        this.doErrorResponse(res, 'json', 404, err.toString());
                    } else {
                        this.doErrorResponse(res, 'json', 500, err.toString());
                    }
                }
                break;
            }

            case 'setValueFromBody': {
                // all given variables will get the same value
                Object.values(oId).forEach(id => {
                    values[id] = body;
                });

                if (!oId.length || !oId[0]) {
                    this.doErrorResponse(res, 'json', 422, 'no object/datapoint given');
                    return;
                }
                try {
                    const response = await this.setStates(values, query);
                    this.doResponse(res, 'json', response, query.prettyPrint);
                } catch (err) {
                    // State not found
                    if (err.toString().includes(ERROR_PERMISSION)) {
                        this.doErrorResponse(res, 'json', 403, err.toString());
                    } else if (err.toString().includes('found')) {
                        this.doErrorResponse(res, 'json', 404, err.toString());
                    } else {
                        this.doErrorResponse(res, 'json', 500, err.toString());
                    }
                }
                break;
            }

            case 'search':
                if (this.config.dataSource && this.config.allDatapoints) {
                    const result = await this.adapter.sendToAsync(this.config.dataSource, 'getEnabledDPs');
                    this.doResponse(res, 'json', Object.keys(result as Record<string, any>), query.prettyPrint);
                } else {
                    try {
                        const target = JSON.parse(body).target || '';
                        this.adapter.log.debug(`[SEARCH] target = ${target}`);
                        const list = await this.adapter.getForeignStatesAsync(values.pattern || `${target}*`, {
                            user: query.user,
                            limitToOwnerRights: this.config.onlyAllowWhenUserIsOwner,
                        });
                        oId = Object.keys(list);
                        this.doResponse(res, 'json', oId, query.prettyPrint);
                    } catch (err) {
                        if (err.includes(ERROR_PERMISSION)) {
                            this.doErrorResponse(res, 'json', 401, err);
                        } else {
                            this.doErrorResponse(res, 'json', 500, err);
                        }
                    }
                }
                break;

            case 'query': {
                let bodyQuery: {
                    targets: { target: string; data: { noHistory: boolean } }[];
                    range: { from: string; to: string };
                };

                try {
                    bodyQuery = JSON.parse(body);
                    let dateFrom = Date.now();
                    let dateTo = Date.now();

                    this.adapter.log.debug(`[QUERY] targets = ${JSON.stringify(bodyQuery.targets)}`);
                    this.adapter.log.debug(`[QUERY] range = ${JSON.stringify(bodyQuery.range)}`);

                    if (bodyQuery.range) {
                        dateFrom = Date.parse(bodyQuery.range.from);
                        dateTo = Date.parse(bodyQuery.range.to);
                    }

                    const options: ioBroker.GetHistoryOptions = {
                        start: dateFrom,
                        end: dateTo,
                        aggregate: (values.aggregate as ioBroker.GetHistoryOptions['aggregate']) || 'onchange',
                    };

                    if (values.count) {
                        options.count = parseInt(values.count, 10);
                    }
                    if (values.step) {
                        options.step = parseInt(values.step, 10);
                    }

                    oId = [];
                    if (Array.isArray(bodyQuery.targets)) {
                        bodyQuery.targets.forEach(t => oId.push(t.target));
                    }

                    if (!oId.length || !oId[0]) {
                        this.doErrorResponse(res, 'json', 422, 'no datapoints given');
                        break;
                    }
                    const list: { target: string; datapoints: [ioBroker.StateValue, number | null][] }[] = [];
                    for (let b = 0; b < bodyQuery.targets.length; b++) {
                        const element: { target: string; datapoints: [ioBroker.StateValue, number | null][] } = {
                            target: bodyQuery.targets[b].target,
                            datapoints: [],
                        };

                        if (
                            this.config.dataSource &&
                            !(bodyQuery.targets[b].data && bodyQuery.targets[b].data.noHistory === true)
                        ) {
                            this.adapter.log.debug(`Read data from: ${this.config.dataSource}`);

                            const result = await this.adapter.getHistoryAsync(
                                this.config.dataSource,
                                bodyQuery.targets[b].target,
                                options,
                            );

                            this.adapter.log.debug(`[QUERY] sendTo result = ${JSON.stringify(result)}`);

                            for (let i = 0; i < result.result.length; i++) {
                                element.datapoints.push([result.result[i].val, result.result[i].ts]);
                            }

                            list.push(element);
                        } else {
                            this.adapter.log.debug('Read last state');

                            try {
                                const { state, id } = await this.getState(
                                    bodyQuery.targets[b].target,
                                    query.user as `system.user.${string}`,
                                );
                                element.target = id;
                                if (state) {
                                    element.datapoints = [[state.val, state.ts]];
                                } else {
                                    element.datapoints = [[null, null]];
                                }

                                list.push(element);
                            } catch (err) {
                                if (err.toString().includes('not found')) {
                                    list.push({ target: bodyQuery.targets[b].target, datapoints: [] });
                                } else {
                                    if (err.toString().includes(ERROR_PERMISSION)) {
                                        this.doErrorResponse(res, 'json', 401, err);
                                    } else {
                                        this.doErrorResponse(res, 'json', 500, err);
                                    }
                                    return;
                                }
                            }
                        }
                    }

                    this.doResponse(res, 'json', list, query.prettyPrint);
                } catch (err) {
                    if (err.includes(ERROR_PERMISSION)) {
                        this.doErrorResponse(res, 'json', 403, err);
                    } else {
                        this.doErrorResponse(res, 'json', 500, `Cannot parse request: ${body}`);
                    }
                }

                break;
            }

            case 'annotations':
                // iobroker does not support annotations
                this.adapter.log.debug('[ANNOTATIONS]');
                this.doResponse(res, 'json', [], query.prettyPrint);
                break;

            default:
                this.doErrorResponse(res, 'json', 422, `command "${command}" unknown`);
                break;
        }
    }

    async findState(idOrName: string, user: `system.user.${string}`): Promise<{ id: string; name: string }> {
        // By ID
        let r = this.cachedIds.get(idOrName);
        if (r) {
            return r;
        }
        // By name
        r = this.cachedNames.get(idOrName);
        if (r) {
            return r;
        }

        const result: { id: string | undefined; name: ioBroker.StringOrTranslated | undefined } =
            // @ts-expect-error fixed in js-controller
            await this.adapter.findForeignObjectAsync(idOrName, null, { user, lang: this.settings.language });
        if (result.id) {
            let name: string;
            if (result.name && typeof result.name === 'object') {
                name = result.name[this.settings.language || 'en'] || result.name.en;
            } else {
                name = (result.name as string) || '';
            }
            this.cachedIds.set(result.id, { id: result.id, name });
            if (idOrName !== result.id) {
                // search was for a name, so also cache the name
                this.cachedNames.set(name, { id: result.id, name });
            }
            return { id: result.id, name };
        }

        throw new Error(`datapoint "${idOrName}" not found`);
    }

    async getState(
        idOrName: string,
        user: `system.user.${string}`,
    ): Promise<{ state: ioBroker.State | null | undefined; id: string }> {
        const result: { id: string; name: string } = await this.findState(idOrName, user);

        return {
            state: await this.adapter.getForeignStateAsync(result.id, {
                user,
                limitToOwnerRights: this.config.onlyAllowWhenUserIsOwner,
            }),
            id: result.id,
        };
    }

    doResponse(res: Response, type: 'json' | 'plain', content?: any, pretty?: boolean): void {
        let response: string;
        if (pretty && typeof content === 'object') {
            type = 'plain';
            response = JSON.stringify(content, null, 2);
        } else {
            response = JSON.stringify(content);
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

        res.setHeader('Content-Type', type === 'json' ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8');
        res.statusCode = 200;
        res.end(response, 'utf8');
    }

    doErrorResponse(res: Response, type: 'json' | 'plain', status: 401 | 403 | 404 | 422 | 500, error?: string): void {
        let response: string;
        response = escapeHtml(error || 'unknown');
        if (!response.startsWith('error: ')) {
            response = `error: ${response}`;
        }
        if (type === 'json') {
            response = JSON.stringify({ error: response });
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        res.setHeader('Content-Type', type === 'json' ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8');
        res.statusCode = status;
        res.end(response, 'utf8');
    }

    async checkPermissions(user: `system.user.${string}`, command: CommandName): Promise<boolean> {
        const acl = await this.adapter.calculatePermissionsAsync(
            user,
            commandsPermissions as CommandsPermissionsObject,
        );
        if (user !== 'system.user.admin') {
            // type: file, object, state, other
            // operation: create, read, write, list, delete, sendto, execute, sendto
            if (commandsPermissions[command]) {
                // If permission required
                if (commandsPermissions[command].type) {
                    if (commandsPermissions[command].type === 'object') {
                        if (commandsPermissions[command].operation === 'list') {
                            return !!acl.object?.list;
                        }
                        if (commandsPermissions[command].operation === 'read') {
                            return !!acl.object?.read;
                        }
                        return !!acl.object?.write;
                    }
                    if (commandsPermissions[command].type === 'state') {
                        if (commandsPermissions[command].operation === 'list') {
                            return !!acl.state?.list;
                        }
                        if (commandsPermissions[command].operation === 'read') {
                            return !!acl.state?.read;
                        }
                        return !!acl.state?.write;
                    }
                }

                return true;
            }

            // unknown command
            this.adapter.log.warn(`Unknown command from "${user}": ${command}`);
            return false;
        }

        return true;
    }

    async setValue(
        id: string,
        value: ioBroker.StateValue,
        res: Response,
        wait: number,
        query: { ack: boolean; user?: string; prettyPrint?: boolean },
        responseType: 'json' | 'plain',
    ): Promise<void> {
        if (wait) {
            await this.adapter.subscribeForeignStatesAsync(id);
        }

        try {
            await this.adapter.setForeignState(id, value, query.ack, {
                user: query.user as `system.user.${string}`,
                limitToOwnerRights: this.config.onlyAllowWhenUserIsOwner,
            });
        } catch (err) {
            if (wait && !this.restApiDelayed.find(it => it.id === id)) {
                this.adapter.unsubscribeForeignStates(id);
            }
            if (err.toString().includes(ERROR_PERMISSION)) {
                this.doErrorResponse(res, responseType, 403, err);
            } else {
                this.doErrorResponse(res, responseType, 500, err);
            }
            return;
        }

        if (!wait) {
            this.doResponse(res, responseType, { id, value, val: value }, query.prettyPrint);
        } else {
            // Wait for ack=true
            await new Promise<string>((resolve, reject): void => {
                let timer: ioBroker.Timeout | undefined;
                const index = `${Date.now()}_${Math.round(Math.random() * 1000000)}`;

                timer = this.adapter.setTimeout(() => {
                    timer = undefined;
                    reject(new Error(`timeout ${index}`));
                }, wait);
                this.restApiDelayed.push({ id, resolve, timer, index, value });
            })
                .then((index: string): void => {
                    // Delete the timer
                    for (let i = 0; i < this.restApiDelayed.length; i++) {
                        if (this.restApiDelayed[i].index === index) {
                            const id = this.restApiDelayed[i].id;
                            const value = this.restApiDelayed[i].value;
                            if (this.restApiDelayed[i].timer) {
                                this.adapter.clearTimeout(this.restApiDelayed[i].timer);
                                this.restApiDelayed[i].timer = undefined;
                            }
                            this.restApiDelayed.splice(i, 1);

                            this.doResponse(res, responseType, { id, value, val: value }, query.prettyPrint);

                            // Unsubscribe if no other request is waiting
                            if (!this.restApiDelayed.find(it => it.id === id)) {
                                this.adapter.unsubscribeForeignStates(id);
                            }

                            break;
                        }
                    }
                })
                .catch((err: Error): void => {
                    const [error, index] = err.toString().split(' ');

                    for (let i = 0; i < this.restApiDelayed.length; i++) {
                        if (this.restApiDelayed[i].index === index) {
                            const id = this.restApiDelayed[i].id;
                            if (this.restApiDelayed[i].timer) {
                                this.adapter.clearTimeout(this.restApiDelayed[i].timer);
                                this.restApiDelayed[i].timer = undefined;
                            }
                            this.restApiDelayed.splice(i, 1);

                            if (!this.restApiDelayed.find(it => it.id === id)) {
                                this.adapter.unsubscribeForeignStates(id);
                            }

                            this.doErrorResponse(res, responseType, 500, error);

                            break;
                        }
                    }
                });
        }
    }

    async restApi(req: Request, res: Response, overwriteUrl?: string): Promise<void> {
        let url: string = overwriteUrl || req.url || '';
        const values: Record<string, string | null> = {};
        const query: {
            user?: string;
            pass?: string;
            prettyPrint?: boolean;
            json?: boolean;
            noStringify?: boolean;
            wait?: number;
            ack: boolean;
        } = { ack: false };
        let oId: string[] = [];

        try {
            url = decodeURI(url);
        } catch (e) {
            this.adapter.log.warn(`Malformed URL encoding for ${url}: ${e}`);
        }

        const pos = url.indexOf('?');

        if (pos !== -1) {
            url = url.substring(0, pos);
            SimpleAPI.parseQuery(url.substring(pos + 1), query, values);
        }

        const [, _command, varsName] = url.split('/');
        const command = _command as CommandName;
        const responseType: 'plain' | 'json' = command === 'getPlainValue' ? 'plain' : 'json';

        // Analyse system.adapter.socketio.0.uptime,system.adapter.history.0.memRss?value=78&wait=300
        if (varsName) {
            oId = varsName.split(',');
            for (let j = oId.length - 1; j >= 0; j--) {
                try {
                    oId[j] = decodeURIComponent(oId[j]);
                } catch (e) {
                    this.adapter.log.warn(`Malformed URL encoding for "${oId[j]}": ${e}`);
                    oId[j] = oId[j].trim().replace(/%23/g, '#'); // do old style minimal parsing
                }
            }
            oId = oId.filter(id => id.trim());
        }

        let user: `system.user.${string}`;

        // If authentication check is required
        if (this.settings.auth) {
            query.user ||= (req as any).user as string;
            const isAuth: boolean = !!(req as any).user || (await this.isAuthenticated(query));
            if (!isAuth) {
                this.doErrorResponse(
                    res,
                    responseType,
                    401,
                    `authentication failed. Please write "http${this.settings.secure ? 's' : ''}://${req.headers.host}?user=UserName&pass=Password"`,
                );
                return;
            }
        } else {
            query.user = ((req as any).user as string | undefined) || this.config.defaultUser;
        }

        if (query.user && !query.user.startsWith('system.user.')) {
            user = `system.user.${query.user}`;
        } else {
            user = query.user as `system.user.${string}`;
        }

        if (!(await this.checkPermissions(user, command))) {
            this.doErrorResponse(res, responseType, 401, `No permission for "${query.user}" to call ${command}`);
            return;
        }

        if (req.method === 'POST') {
            await this.restApiPost(req, res, command, oId, values, query);
            return;
        }

        switch (command) {
            case 'getPlainValue': {
                if (!oId.length || !oId[0]) {
                    this.doErrorResponse(res, responseType, 422, 'no datapoint given');
                    break;
                }

                const response: string[] = [];
                for (let i = 0; i < oId.length; i++) {
                    try {
                        const { state, id } = await this.getState(oId[i], user);
                        if (state) {
                            let val = state.val;
                            if (query.json) {
                                let obj: any;
                                try {
                                    obj = JSON.parse(typeof val === 'string' ? val : JSON.stringify(val));
                                } catch {
                                    // ignore
                                    obj = val;
                                }
                                val = JSON.stringify(obj);
                            } else {
                                if (query.noStringify) {
                                    val =
                                        state.val === null
                                            ? 'null'
                                            : state.val === undefined
                                              ? 'undefined'
                                              : state.val.toString();
                                } else {
                                    val = JSON.stringify(state.val);
                                }
                            }
                            response[i] = val;
                        } else {
                            response[i] = `error: cannot read state "${oId[i]}"`;
                        }
                    } catch (err) {
                        if (err.toString().includes('not found')) {
                            response[i] = `error: datapoint "${oId[i]}" not found`;
                        } else {
                            this.adapter.log.error(`Cannot get state: ${err}`);

                            if (err.toString().includes(ERROR_PERMISSION)) {
                                this.doErrorResponse(res, responseType, 403, err);
                            } else {
                                this.doErrorResponse(res, responseType, 500, err);
                            }
                            return;
                        }
                    }
                }
                this.doResponse(res, responseType, response.join('\n'), query.prettyPrint);
                break;
            }

            case 'get': {
                if (!oId.length || !oId[0]) {
                    this.doErrorResponse(res, responseType, 422, 'no object/datapoint given');
                    break;
                }

                const response: any[] = [];
                for (let k = 0; k < oId.length; k++) {
                    this.adapter.log.debug(`work for ID ${oId[k]}`);
                    try {
                        const { state, id } = await this.getState(oId[k], query.user as `system.user.${string}`);
                        if (!id) {
                            response[k] = { error: `datapoint "${oId[k]}" not found` };
                        } else {
                            const obj = this.adapter.getForeignObjectAsync(id);
                            response[k] = { ...obj, ...state };
                        }
                    } catch (err) {
                        if (err.toString().includes(ERROR_PERMISSION)) {
                            this.doErrorResponse(res, responseType, 403, err);
                            return;
                        }
                        response[k] = { error: `datapoint "${oId[k]}" not found` };
                    }
                }
                this.doResponse(res, responseType, response.length === 1 ? response[0] : response, query.prettyPrint);
                break;
            }
            case 'getBulk': {
                if (!oId.length || !oId[0]) {
                    this.doErrorResponse(res, responseType, 422, 'no datapoints given');
                    break;
                }
                const response: {
                    id: string;
                    val: ioBroker.StateValue | undefined;
                    ts: number | undefined;
                    ack: boolean | undefined;
                }[] = [];
                for (let b = 0; b < oId.length; b++) {
                    try {
                        const { id, state } = await this.getState(oId[b], query.user as `system.user.${string}`);
                        response[b] = { id, val: state?.val, ts: state?.ts, ack: state?.ack };
                    } catch (err) {
                        if (err.toString().includes(ERROR_PERMISSION)) {
                            this.doErrorResponse(res, responseType, 403, err);
                            return;
                        }
                        response[b] = { id: oId[b], val: undefined, ts: undefined, ack: undefined };
                    }
                }
                this.doResponse(res, responseType, response, query.prettyPrint);
                break;
            }

            case 'set': {
                if (!oId.length || !oId[0]) {
                    this.doErrorResponse(res, responseType, 422, 'object/datapoint not given');
                    return;
                }
                if (values.value === undefined && values.val === undefined) {
                    this.doErrorResponse(
                        res,
                        responseType,
                        422,
                        `error: no value found for "${oId[0]}". Use /set/id?value=1 or /set/id?value=1&wait=1000`,
                    );
                    return;
                }
                try {
                    const { id } = await this.findState(oId[0], query.user as `system.user.${string}`);
                    if (!id) {
                        this.doErrorResponse(res, responseType, 404, `error: datapoint "${oId[0]}" not found`);
                        return;
                    }
                    const type = values.type;
                    let value: ioBroker.StateValue;

                    if (values.val === undefined) {
                        value = values.value;
                    } else {
                        value = values.val;
                    }

                    // Ack=true cannot be awaited
                    const wait = !query.ack ? query.wait || 0 : 0;

                    // If type is not defined or not known
                    if (
                        !type ||
                        (type !== 'boolean' &&
                            type !== 'number' &&
                            type !== 'string' &&
                            type !== 'json' &&
                            type !== 'object' &&
                            type !== 'array')
                    ) {
                        // Maybe this is JSON
                        if (values.val && (values.val[0] === '[' || values.val[0] === '{')) {
                            try {
                                values.val = JSON.parse(values.val);
                            } catch (e) {
                                // keep it as string
                            }
                        }

                        if (value === 'true') {
                            value = true;
                        } else if (value === 'false') {
                            value = false;
                        } else if (!isNaN(parseFloat(value as string))) {
                            value = parseFloat(value as string);
                        }
                    } else {
                        // type is known
                        if (type === 'boolean') {
                            value = value === 'true' || value === '1';
                        } else if (type === 'number') {
                            value = parseFloat(value as string);
                        } else if (type === 'json' || type === 'array' || type === 'object') {
                            try {
                                value = JSON.parse(value as string);
                            } catch (e) {
                                this.doErrorResponse(res, responseType, 500, e);
                                return;
                            }
                        }
                        // string must not be formatted
                    }

                    await this.setValue(id, value, res, wait, query, responseType);
                } catch (err) {
                    if (err.toString().includes(ERROR_PERMISSION)) {
                        this.doErrorResponse(res, responseType, 403, err);
                    } else {
                        this.doErrorResponse(res, responseType, 404, err);
                    }
                }
                break;
            }

            case 'toggle':
                if (!oId.length || !oId[0]) {
                    this.doErrorResponse(res, responseType, 422, 'state not given');
                    return;
                }

                try {
                    const { id } = await this.findState(oId[0], query.user as `system.user.${string}`);
                    if (id) {
                        const wait = query.wait || 0;

                        // Read a type of object
                        const obj = await this.adapter.getForeignObjectAsync(id, {
                            user: query.user as `system.user.${string}`,
                        });
                        if (obj) {
                            const state = await this.adapter.getForeignStateAsync(id, {
                                user: query.user as `system.user.${string}`,
                            });
                            if (state) {
                                let value = state.val;
                                if (obj.common.type === 'boolean' || (!obj.common.type && typeof value === 'boolean')) {
                                    if (value === 'true') {
                                        value = true;
                                    } else if (value === 'false') {
                                        value = false;
                                    }
                                    value = !value;
                                } else if (
                                    obj.common.type === 'number' ||
                                    (!obj.common.type && typeof value === 'number')
                                ) {
                                    value = parseFloat(value as string);
                                    if (obj.common.max !== undefined) {
                                        obj.common.min = obj.common.min === undefined ? 0 : obj.common.min;

                                        if (value > obj.common.max) {
                                            value = obj.common.max;
                                        } else if (value < obj.common.min) {
                                            value = obj.common.min;
                                        }
                                        // Invert
                                        value = obj.common.max + obj.common.min - (value as number);
                                    } else {
                                        // the default number is from 0 to 100
                                        if (value > 100) {
                                            value = 100;
                                        }
                                        if (value < 0) {
                                            value = 0;
                                        }
                                        value = 100 - value;
                                    }
                                } else {
                                    if (value === 'true' || value === true) {
                                        value = false;
                                    } else if (value === 'on') {
                                        value = 'off';
                                    } else if (value === 'off') {
                                        value = 'on';
                                    } else if (value === 'OFF') {
                                        value = 'ON';
                                    } else if (value === 'ON') {
                                        value = 'OFF';
                                    } else if (value === 'false' || value === false) {
                                        value = true;
                                    } else if (parseFloat(value as string).toString() === value?.toString()) {
                                        value = parseFloat(value as string).toString() ? 0 : 1;
                                    } else {
                                        this.doErrorResponse(
                                            res,
                                            responseType,
                                            422,
                                            'state is neither number nor boolean',
                                        );
                                        return;
                                    }
                                }

                                await this.setValue(id, value, res, wait, query, responseType);
                                return;
                            }

                            this.doErrorResponse(
                                res,
                                responseType,
                                404,
                                `error: state "${oId[0]}" does not exist or null`,
                            );
                            return;
                        }
                    }

                    this.doErrorResponse(res, responseType, 404, `error: datapoint "${oId[0]}" not found`);
                } catch (err) {
                    if (err.toString().includes(ERROR_PERMISSION)) {
                        this.doErrorResponse(res, responseType, 403, err);
                    } else {
                        this.doErrorResponse(res, responseType, 404, err);
                    }
                }

                break;

            // /setBulk?BidCos-RF.FEQ1234567:1.LEVEL=0.7&Licht-Küche/LEVEL=0.7&Anwesenheit=0&950=1
            case 'setBulk': {
                const response: (
                    | { error: string }
                    | { id: string; val: number | string | boolean | null; value: number | string | boolean | null }
                )[] = [];
                this.adapter.log.debug(`Values: ${JSON.stringify(values)}`);
                const names = Object.keys(values);
                for (let n = 0; n < names.length; n++) {
                    try {
                        const { id, name } = await this.findState(names[n], query.user as `system.user.${string}`);
                        if (!id) {
                            response[n] = { error: `error: datapoint "${names[n]}" not found` };
                            continue;
                        }
                        this.adapter.log.debug(
                            `GET-${command} for id=${id}, oid=${names[n]}, value=${values[names[n]]}`,
                        );

                        let value: ioBroker.StateValue = values[names[n]];
                        if (value === 'true') {
                            value = true;
                        } else if (value === 'false') {
                            value = false;
                        } else {
                            const f = parseFloat(value as string);
                            if (!isNaN(f) && value === f.toString()) {
                                value = f;
                            }
                        }

                        try {
                            await this.adapter.setForeignState(id, value, query.ack, {
                                user: query.user,
                                limitToOwnerRights: this.config.onlyAllowWhenUserIsOwner,
                            });
                            response[n] = { id: id, val: value, value };
                            this.adapter.log.debug(`Add to Response-Get: ${JSON.stringify(response[n])}`);
                        } catch (err) {
                            if (err.toString().includes(ERROR_PERMISSION)) {
                                this.doErrorResponse(res, responseType, 403, err);
                                return;
                            } else {
                                response[n] = { error: err.toString() };
                            }
                        }
                    } catch (err) {
                        if (err.toString().includes(ERROR_PERMISSION)) {
                            this.doErrorResponse(res, responseType, 403, err);
                            return;
                        } else {
                            response[n] = { error: err.toString() };
                        }
                    }
                }

                this.doResponse(res, responseType, response, query.prettyPrint);
                break;
            }

            case 'getObjects':
            case 'objects': {
                try {
                    const list = await this.adapter.getForeignObjectsAsync(
                        values.pattern || varsName || '*',
                        (values.type as ioBroker.ObjectType) || null,
                        {
                            user: query.user,
                            limitToOwnerRights: this.config.onlyAllowWhenUserIsOwner,
                        },
                    );
                    this.doResponse(res, responseType, list, query.prettyPrint);
                } catch (err) {
                    if (err.toString().includes(ERROR_PERMISSION)) {
                        this.doResponse(res, responseType, 403, err.toString());
                    } else {
                        this.doResponse(res, responseType, 500, err.toString());
                    }
                }
                break;
            }

            case 'getStates':
            case 'states': {
                try {
                    const list = await this.adapter.getForeignStatesAsync(values.pattern || varsName || '*', {
                        user: query.user,
                        limitToOwnerRights: this.config.onlyAllowWhenUserIsOwner,
                    });
                    this.doResponse(res, responseType, list, query.prettyPrint);
                } catch (err) {
                    if (err.toString().includes(ERROR_PERMISSION)) {
                        this.doResponse(res, responseType, 403, err.toString());
                    } else {
                        this.doResponse(res, responseType, 500, err.toString());
                    }
                }
                break;
            }

            case 'search':
                try {
                    if (this.config.dataSource && this.config.allDatapoints !== true) {
                        const result = await this.adapter.sendToAsync(this.config.dataSource, 'getEnabledDPs');
                        this.doResponse(res, responseType, Object.keys(result || {}), query.prettyPrint);
                    } else {
                        this.adapter.log.debug(`[SEARCH] target = ${varsName}`);

                        const list = await this.adapter.getForeignStatesAsync(values.pattern || varsName || '*', {
                            user: query.user,
                            limitToOwnerRights: this.config.onlyAllowWhenUserIsOwner,
                        });
                        this.doResponse(res, responseType, Object.keys(list), query.prettyPrint);
                    }
                } catch (err) {
                    if (err.toString().includes(ERROR_PERMISSION)) {
                        this.doResponse(res, responseType, 403, err.toString());
                    } else {
                        this.doResponse(res, responseType, 500, err.toString());
                    }
                }
                break;

            case 'query': {
                this.adapter.log.debug(JSON.stringify(values));

                let dateFrom = Date.now();
                let dateTo = Date.now();

                if (values.dateFrom) {
                    dateFrom = Date.parse(values.dateFrom);
                }
                if (values.dateTo) {
                    dateTo = Date.parse(values.dateTo);
                }

                const options: ioBroker.GetHistoryOptions = {
                    start: dateFrom,
                    end: dateTo,
                    aggregate: (values.aggregate as ioBroker.GetHistoryOptions['aggregate']) || 'onchange',
                };

                if (values.count) {
                    options.count = parseInt(values.count, 10);
                }
                if (values.step) {
                    options.step = parseInt(values.step, 10);
                }

                if (!oId.length || !oId[0]) {
                    this.doErrorResponse(res, responseType, 422, 'no datapoints given');
                    return;
                }
                const response: { target: string; datapoints: [ioBroker.StateValue, number | null][] }[] = [];

                for (let b = 0; b < oId.length; b++) {
                    const element: { target: string; datapoints: [ioBroker.StateValue, number | null][] } = {
                        target: oId[b],
                        datapoints: [],
                    };

                    if (this.config.dataSource && !(values.noHistory && values.noHistory === 'true')) {
                        this.adapter.log.debug(`Read data from: ${this.config.dataSource}`);

                        const result = await this.adapter.getHistoryAsync(this.config.dataSource, oId[b], options);
                        this.adapter.log.debug(`[QUERY] sendTo result = ${JSON.stringify(result)}`);

                        for (let i = 0; i < result.result.length; i++) {
                            element.datapoints.push([result.result[i].val, result.result[i].ts]);
                        }

                        response[b] = element;
                    } else {
                        this.adapter.log.debug('Read last state');

                        const { state } = await this.getState(oId[b], query.user as `system.user.${string}`);
                        if (state) {
                            element.datapoints = [[state.val, state.ts]];
                        } else {
                            element.datapoints = [[null, null]];
                        }
                    }
                }

                this.doResponse(res, responseType, response, query.prettyPrint);
                break;
            }

            case 'annotations':
                // ioBroker does not support annotations
                this.adapter.log.debug('[ANNOTATIONS]');
                this.doResponse(res, responseType, [], query.prettyPrint);
                break;

            case 'help':
            // is default behaviour too
            default:
                const _obj: Record<string, string> = command === 'help' ? {} : { error: `command ${command} unknown` };
                let request = `http${this.settings.secure ? 's' : ''}://${req.headers.host}`;
                if (this.app) {
                    request += `/${this.namespace}/`;
                }
                let auth = '';
                if (this.settings.auth) {
                    auth = 'user=UserName&pass=Password';
                }
                _obj.getPlainValue = `${request}/getPlainValue/stateID${auth ? `?${auth}` : ''}`;
                _obj.get = `${request}/get/stateID/?prettyPrint${auth ? `&${auth}` : ''}`;
                _obj.getBulk = `${request}/getBulk/stateID1,stateID2/?prettyPrint${auth ? `&${auth}` : ''}`;
                _obj.set = `${request}/set/stateID?value=1&prettyPrint${auth ? `&${auth}` : ''}`;
                _obj.toggle = `${request}/toggle/stateID&prettyPrint${auth ? `&${auth}` : ''}`;
                _obj.setBulk = `${request}/setBulk?stateID1=0.7&stateID2=0&prettyPrint${auth ? `&${auth}` : ''}`;
                _obj.setValueFromBody = `${request}/setValueFromBody?stateID1${auth ? `&${auth}` : ''}`;
                _obj.objects = `${request}/objects?pattern=system.adapter.admin.0*&prettyPrint${auth ? `&${auth}` : ''}`;
                _obj.states = `${request}/states?pattern=system.adapter.admin.0*&prettyPrint${auth ? `&${auth}` : ''}`;
                _obj.search = `${request}/search?pattern=system.adapter.admin.0*&prettyPrint${auth ? `&${auth}` : ''}`;
                _obj.query = `${request}/query/stateID1,stateID2/?dateFrom=2019-06-06T12:00:00.000Z&dateTo=2019-06-06T12:00:00.000Z&noHistory=false&aggregate=minmax&count=3000&prettyPrint${auth ? `&${auth}` : ''}`;

                this.doResponse(res, responseType, _obj, true);
                break;
        }
    }
}

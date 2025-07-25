"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleAPI = void 0;
// copied from here: https://github.com/component/escape-html/blob/master/index.js
const matchHtmlRegExp = /["'&<>]/;
function escapeHtml(string, noQuote) {
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
                if (!noQuote) {
                    escape = '&quot;';
                }
                else {
                    escape = '"';
                }
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
// static information
const commandsPermissions = {
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
/**
 * SimpleAPI class
 *
 * From settings used only secure, auth and crossDomain
 *
 * @param webSettings settings of the web server, like <pre><code>{secure: settings.secure, port: settings.port}</code></pre>
 * @param adapter web adapter object
 * @param instanceSettings instance object with common and native
 * @param app express application
 * @returns object instance
 */
class SimpleAPI {
    adapter;
    settings;
    config;
    namespace;
    app;
    cachedNames = new Map();
    cachedIds = new Map();
    restApiDelayed = [];
    constructor(_server, webSettings, adapter, instanceSettings, app) {
        this.app = app;
        this.adapter = adapter;
        this.settings = webSettings;
        this.config = instanceSettings
            ? instanceSettings.native
            : {};
        this.namespace = instanceSettings ? instanceSettings._id.substring('system.adapter.'.length) : 'simple-api';
        this.adapter.log.info(`${this.settings.secure ? 'Secure ' : ''}simpleAPI server listening on port ${this.settings.port}`);
        this.config.defaultUser = webSettings.defaultUser || this.config.defaultUser || 'system.user.admin';
        if (!this.config.defaultUser.match(/^system\.user\./)) {
            this.config.defaultUser = `system.user.${this.config.defaultUser}`;
        }
        this.config.onlyAllowWhenUserIsOwner = !!this.config.onlyAllowWhenUserIsOwner;
        this.adapter.log.info(`Allow states only when user is owner: ${this.config.onlyAllowWhenUserIsOwner}`);
        if (this.app) {
            this.adapter.log.info(`Install extension on /${this.namespace}/`);
            this.app.use(`/${this.namespace}/`, (req, res) => {
                void this.restApi(req, res);
            });
            // let it be accessible under old address too
            for (const c in commandsPermissions) {
                ((command) => {
                    this.adapter.log.info(`Install extension on /${command}/`);
                    this.app.use(`/${command}/`, (req, res) => {
                        void this.restApi(req, res, `/${command}${req.url}`);
                    });
                })(c);
            }
        }
        // Subscribe on object changes to manage cache
        this.adapter.subscribeForeignObjects('*');
    }
    static convertRelativeTime(relativeTime) {
        if (!relativeTime) {
            return null;
        }
        const now = new Date();
        const date = new Date(now);
        switch (relativeTime) {
            case 'today':
                date.setHours(0, 0, 0, 0);
                break;
            case 'yesterday':
                date.setDate(now.getDate() - 1);
                date.setHours(0, 0, 0, 0);
                break;
            case 'week':
            case 'thisWeek':
            case 'this week':
                date.setDate(now.getDate() - now.getDay());
                date.setHours(0, 0, 0, 0);
                break;
            case 'hour':
            case 'thisHour':
            case 'this hour':
                date.setHours(date.getHours(), 0, 0, 0);
                break;
            case 'lastHour':
            case 'last hour':
                date.setHours(date.getHours() - 1, 0, 0, 0);
                break;
            case 'lastWeek':
            case 'last week':
                date.setDate(now.getDate() - now.getDay() - 7);
                date.setHours(0, 0, 0, 0);
                break;
            case 'month':
            case 'thisMonth':
            case 'this month':
                date.setDate(1);
                date.setHours(0, 0, 0, 0);
                break;
            case 'lastMonth':
            case 'last month':
                date.setMonth(now.getMonth() - 1);
                date.setDate(1);
                date.setHours(0, 0, 0, 0);
                break;
            case 'year':
            case 'thisYear':
            case 'this year':
                date.setMonth(0, 1);
                date.setHours(0, 0, 0, 0);
                break;
            case 'lastYear':
            case 'last year':
                date.setFullYear(now.getFullYear() - 1, 0, 1);
                date.setHours(0, 0, 0, 0);
                break;
            default: {
                const match = relativeTime.match(/^(-?\d+)([dMhms])$/);
                if (match) {
                    const value = parseInt(match[1], 10);
                    const unit = match[2];
                    switch (unit) {
                        case 'd':
                            date.setDate(now.getDate() + value);
                            break;
                        case 'M':
                            date.setMonth(now.getMonth() + value);
                            break;
                        case 'h':
                            date.setHours(now.getHours() + value);
                            break;
                        case 'm':
                            date.setMinutes(now.getMinutes() + value);
                            break;
                        case 's':
                            date.setSeconds(now.getSeconds() + value);
                            break;
                        case 'y':
                            date.setFullYear(now.getFullYear() + value);
                            break;
                    }
                }
                else {
                    return null;
                }
            }
        }
        return date.getTime();
    }
    async isAuthenticated(req, query) {
        // Authenticated via OAuth2
        if (req.user) {
            query.user = req.user;
            return true;
        }
        // Authenticated via Basic Auth
        if (req.headers.authorization?.startsWith('Basic ')) {
            const auth = Buffer.from(req.headers.authorization.split(' ')[1], 'base64').toString('utf8');
            const pos = auth.indexOf(':');
            if (pos !== -1) {
                query.user = auth.substring(0, pos);
                query.pass = auth.substring(pos + 1);
            }
        }
        if (!query.user || !query.pass) {
            this.adapter.log.warn('No password or username!');
            return false;
        }
        const res = await new Promise(resolve => this.adapter.checkPassword(query.user, query.pass, (success) => resolve(success)));
        if (res) {
            this.adapter.log.debug(`Logged in: ${query.user}`);
        }
        else {
            this.adapter.log.warn(`Invalid password or user name: ${query.user}`);
        }
        return res;
    }
    stateChange(id, state) {
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
    objectChange(id, _obj) {
        // Clear from cache, will be reinitialized on next usage
        if (this.cachedIds.has(id)) {
            const cachedItem = this.cachedIds.get(id);
            const name = cachedItem?.name;
            if (name) {
                this.cachedIds.delete(id);
                this.cachedNames.delete(name);
            }
        }
    }
    static parseQuery(input, query, values) {
        const parts = (input || '').split('&');
        for (const part of parts) {
            const pos = part.indexOf('=');
            let name;
            let value;
            if (pos !== -1) {
                name = part.substring(0, pos);
                value = part.substring(pos + 1);
            }
            else {
                name = part;
            }
            if (!name) {
                continue;
            }
            try {
                if (name === 'user') {
                    query.user = decodeURIComponent(value?.trim() || '');
                }
                else if (name === 'pass') {
                    query.pass = decodeURIComponent(value || '');
                }
                else if (name === 'prettyPrint') {
                    query.prettyPrint = !value ? true : decodeURIComponent(value?.trim() || '') === 'true';
                }
                else if (name === 'json') {
                    query.json = !value ? true : decodeURIComponent(value?.trim() || '') === 'true';
                }
                else if (name === 'noStringify') {
                    query.noStringify = !value ? true : decodeURIComponent(value?.trim() || '') === 'true';
                }
                else if (name === 'wait') {
                    query.wait = !value ? 2000 : parseInt(decodeURIComponent(value?.trim() || ''), 10) || 0;
                }
                else if (name === 'ack') {
                    const val = decodeURIComponent(value?.trim() || '');
                    query.ack = val === 'true' || val === '1';
                }
                else if (name === 'timeRFC3339') {
                    const val = decodeURIComponent(value?.trim() || '');
                    query.timeRFC3339 = val === 'true' || val === '1';
                }
                else if (name === 'type') {
                    query.type = decodeURIComponent(value?.trim() || '');
                }
                else if (name === 'callback') {
                    query.callback = decodeURIComponent(value?.trim() || '');
                }
                else {
                    values[name] =
                        value === undefined ? null : decodeURIComponent(`${value?.trim() || ''}`.replace(/\+/g, '%20'));
                }
            }
            catch {
                values[name] = value === undefined ? null : value;
            }
        }
        if (query.ack === undefined) {
            query.ack = false;
        }
    }
    async setStates(values, query) {
        const response = [];
        const names = Object.keys(values);
        let user;
        if (query.user && !query.user.startsWith('system.user.')) {
            user = `system.user.${query.user}`;
        }
        else {
            user = query.user;
        }
        for (let i = 0; i < names.length; i++) {
            const stateId = names[i];
            this.adapter.log.debug(`${i}: "${stateId}"`);
            try {
                const { id } = await this.findState(stateId, user);
                if (!id) {
                    response[i] = { error: `datapoint "${stateId}" not found` };
                }
                else {
                    let value;
                    if (values[stateId] === 'true') {
                        value = true;
                    }
                    else if (values[stateId] === 'false') {
                        value = false;
                    }
                    else {
                        const f = parseFloat(values[stateId]);
                        if (!isNaN(f) && values[stateId] === f.toString()) {
                            value = f;
                        }
                        else {
                            value = values[stateId];
                        }
                    }
                    await this.adapter.setForeignStateAsync(id, value, !!query.ack, {
                        user,
                        limitToOwnerRights: this.config.onlyAllowWhenUserIsOwner,
                    });
                    response[i] = { id, val: value };
                    this.adapter.log.debug(`Add to Response: ${JSON.stringify(response[i])}`);
                }
            }
            catch (err) {
                // State isn't found or no permission
                if (err.toString().includes(ERROR_PERMISSION)) {
                    throw err;
                }
                response[i] = { error: err.toString() };
            }
        }
        return response;
    }
    async restApiPost(req, res, command, oId, values, query) {
        let body = '';
        if (this.settings.auth &&
            (req.headers.contentType === 'application/json' ||
                req.headers.contentType === 'application/x-www-form-urlencoded')) {
            // body is already parsed by express
            body = JSON.stringify(req.body);
        }
        else {
            req.on('data', (data) => {
                body += data.toString();
            });
            await new Promise(resolve => req.on('end', resolve));
        }
        let user;
        if (query.user && !query.user.startsWith('system.user.')) {
            user = `system.user.${query.user}`;
        }
        else {
            user = query.user;
        }
        switch (command) {
            case 'setBulk': {
                this.adapter.log.debug(`POST-${command}: body = ${body}`);
                SimpleAPI.parseQuery(body, query, values);
                this.adapter.log.debug(`POST-${command}: values = ${JSON.stringify(values)}`);
                try {
                    const response = await this.setStates(values, query);
                    this.doResponse(res, 'json', response, query);
                }
                catch (err) {
                    // State not found
                    if (err.toString().includes(ERROR_PERMISSION)) {
                        this.doErrorResponse(res, 'json', 403, err.toString());
                    }
                    else if (err.toString().includes('found')) {
                        this.doErrorResponse(res, 'json', 404, err.toString());
                    }
                    else {
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
                    this.doResponse(res, 'json', response, query);
                }
                catch (err) {
                    // State not found
                    if (err.toString().includes(ERROR_PERMISSION)) {
                        this.doErrorResponse(res, 'json', 403, err.toString());
                    }
                    else if (err.toString().includes('found')) {
                        this.doErrorResponse(res, 'json', 404, err.toString());
                    }
                    else {
                        this.doErrorResponse(res, 'json', 500, err.toString());
                    }
                }
                break;
            }
            case 'search':
                if (this.config.dataSource && this.config.allDatapoints) {
                    const result = await this.adapter.sendToAsync(this.config.dataSource, 'getEnabledDPs');
                    this.doResponse(res, 'json', Object.keys(result), query);
                }
                else {
                    try {
                        const target = JSON.parse(body).target || '';
                        this.adapter.log.debug(`[SEARCH] target = ${target}`);
                        const list = await this.adapter.getForeignStatesAsync(values.pattern || `${target}*`, {
                            user,
                            limitToOwnerRights: this.config.onlyAllowWhenUserIsOwner,
                        });
                        oId = Object.keys(list);
                        this.doResponse(res, 'json', oId, query);
                    }
                    catch (err) {
                        if (err.includes(ERROR_PERMISSION)) {
                            this.doErrorResponse(res, 'json', 403, err);
                        }
                        else {
                            this.doErrorResponse(res, 'json', 500, err);
                        }
                    }
                }
                break;
            case 'query': {
                let bodyQuery;
                try {
                    bodyQuery = JSON.parse(body);
                    let dateFrom = Date.now();
                    let dateTo = Date.now();
                    this.adapter.log.debug(`[QUERY] targets = ${JSON.stringify(bodyQuery.targets)}`);
                    this.adapter.log.debug(`[QUERY] range = ${JSON.stringify(bodyQuery.range)}`);
                    if (bodyQuery.range) {
                        dateFrom =
                            SimpleAPI.convertRelativeTime(bodyQuery.range.from) || Date.parse(bodyQuery.range.from);
                        dateTo = SimpleAPI.convertRelativeTime(bodyQuery.range.to) || Date.parse(bodyQuery.range.to);
                    }
                    const options = {
                        instance: this.config.dataSource,
                        start: dateFrom,
                        end: dateTo,
                        aggregate: values.aggregate || 'onchange',
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
                        this.doErrorResponse(res, 'json', 422, 'no data points given');
                        break;
                    }
                    const list = [];
                    for (let b = 0; b < bodyQuery.targets.length; b++) {
                        const element = {
                            target: bodyQuery.targets[b].target,
                            datapoints: [],
                        };
                        if (this.config.dataSource &&
                            !(bodyQuery.targets[b].data && bodyQuery.targets[b].data.noHistory === true)) {
                            this.adapter.log.debug(`Read data from: ${this.config.dataSource}`);
                            const result = await this.adapter.getHistoryAsync(bodyQuery.targets[b].target, options);
                            this.adapter.log.debug(`[QUERY] sendTo result = ${JSON.stringify(result)}`);
                            if (result.result) {
                                for (let i = 0; i < result.result.length; i++) {
                                    element.datapoints.push([result.result[i].val, result.result[i].ts]);
                                }
                            }
                            list.push(element);
                        }
                        else {
                            this.adapter.log.debug('Read last state');
                            try {
                                const { state, id } = await this.getState(bodyQuery.targets[b].target, user, query);
                                element.target = id;
                                if (state) {
                                    element.datapoints = [[state.val, state.ts || null]];
                                }
                                else {
                                    element.datapoints = [[null, null]];
                                }
                                list.push(element);
                            }
                            catch (err) {
                                if (err.toString().includes('not found')) {
                                    list.push({ target: bodyQuery.targets[b].target, datapoints: [] });
                                }
                                else {
                                    if (err.toString().includes(ERROR_PERMISSION)) {
                                        this.doErrorResponse(res, 'json', 403, err);
                                    }
                                    else {
                                        this.doErrorResponse(res, 'json', 500, err);
                                    }
                                    return;
                                }
                            }
                        }
                    }
                    this.doResponse(res, 'json', list, query);
                }
                catch (err) {
                    if (err.includes(ERROR_PERMISSION)) {
                        this.doErrorResponse(res, 'json', 403, err);
                    }
                    else {
                        this.doErrorResponse(res, 'json', 500, `Cannot parse request: ${body}`);
                    }
                }
                break;
            }
            case 'annotations':
                // iobroker does not support annotations
                this.adapter.log.debug('[ANNOTATIONS]');
                this.doResponse(res, 'json', [], query);
                break;
            default:
                this.doErrorResponse(res, 'json', 422, `command "${command}" unknown`);
                break;
        }
    }
    async findState(idOrName, user) {
        // By ID
        let r = this.cachedIds.get(idOrName);
        if (r && r.time > Date.now()) {
            return r;
        }
        // By name
        r = this.cachedNames.get(idOrName);
        if (r && r.time > Date.now()) {
            return r;
        }
        const result = await this.adapter.findForeignObjectAsync(idOrName, null, { user, language: this.settings.language });
        if (result.id) {
            let name;
            if (result.name && typeof result.name === 'object') {
                name = result.name[this.settings.language || 'en'] || result.name.en;
            }
            else {
                name = result.name || '';
            }
            // Cache is valid only 10 minutes
            this.cachedIds.set(result.id, { id: result.id, name, time: Date.now() + 600_000 });
            if (idOrName !== result.id) {
                // search was for a name, so also cache the name
                this.cachedNames.set(name, { id: result.id, name, time: Date.now() + 600_000 });
            }
            return { id: result.id, name };
        }
        throw new Error(`datapoint "${idOrName}" not found`);
    }
    async getState(idOrName, user, query) {
        const result = await this.findState(idOrName, user);
        const state = (await this.adapter.getForeignStateAsync(result.id, {
            user,
            limitToOwnerRights: this.config.onlyAllowWhenUserIsOwner,
        })) || null;
        if (query.timeRFC3339 && state?.ts) {
            state.ts = new Date(state.ts).toISOString();
            if (state.lc) {
                state.lc = new Date(state.lc).toISOString();
            }
        }
        return {
            state,
            id: result.id,
        };
    }
    doResponse(res, responseType, content, query) {
        let response;
        if (query?.callback) {
            response = `${query.callback}(${JSON.stringify(content, null, 2)});`;
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
        else if (query?.prettyPrint && typeof content === 'object') {
            response = JSON.stringify(content, null, 2);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
        else if (responseType === 'json') {
            response = JSON.stringify(content);
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
        else if (typeof content === 'object') {
            response = JSON.stringify(content);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
        else {
            response = content.toString();
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
        res.statusCode = 200;
        res.end(response, 'utf8');
    }
    doErrorResponse(res, responseType, status, error) {
        let response;
        response = escapeHtml(error || 'unknown', true);
        if (responseType === 'json') {
            response = JSON.stringify({ error: response.replace('Error: ', '') });
        }
        else if (!response.startsWith('error: ') && !response.startsWith('Error: ')) {
            response = `error: ${response}`;
        }
        else {
            response = response.replace('Error: ', 'error: ').trim();
        }
        res.setHeader('Content-Type', responseType === 'json' ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8');
        res.statusCode = status;
        res.end(response, 'utf8');
    }
    async checkPermissions(user, command) {
        const acl = await this.adapter.calculatePermissionsAsync(user, commandsPermissions);
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
    async setValue(id, value, res, wait, query, responseType) {
        if (wait) {
            await this.adapter.subscribeForeignStatesAsync(id);
        }
        let user;
        if (query.user && !query.user.startsWith('system.user.')) {
            user = `system.user.${query.user}`;
        }
        else {
            user = query.user;
        }
        try {
            await this.adapter.setForeignStateAsync(id, value, query.ack, {
                user,
                limitToOwnerRights: this.config.onlyAllowWhenUserIsOwner,
            });
        }
        catch (err) {
            if (wait && !this.restApiDelayed.find(it => it.id === id)) {
                this.adapter.unsubscribeForeignStates(id);
            }
            if (err.toString().includes(ERROR_PERMISSION)) {
                this.doErrorResponse(res, responseType, 403, err);
            }
            else {
                this.doErrorResponse(res, responseType, 500, err);
            }
            return;
        }
        if (!wait) {
            this.doResponse(res, responseType, { id, value, val: value }, query);
        }
        else {
            // Wait for ack=true
            await new Promise((resolve, reject) => {
                let timer;
                const index = `${Date.now()}_${Math.round(Math.random() * 1000000)}`;
                timer = this.adapter.setTimeout(() => {
                    timer = undefined;
                    reject(new Error(`timeout ${index}`));
                }, wait);
                this.restApiDelayed.push({ id, resolve, timer, index, value });
            })
                .then((index) => {
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
                        this.doResponse(res, responseType, { id, value, val: value }, query);
                        // Unsubscribe if no other request is waiting
                        if (!this.restApiDelayed.find(it => it.id === id)) {
                            this.adapter.unsubscribeForeignStates(id);
                        }
                        break;
                    }
                }
            })
                .catch((err) => {
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
    async restApi(req, res, overwriteUrl) {
        let url = overwriteUrl || req.url || '';
        const values = {};
        const query = { ack: false };
        let oId = [];
        if (this.config.accessControlAllowOrigin) {
            res.setHeader('Access-Control-Allow-Origin', this.config.accessControlAllowOrigin);
            res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
            res.setHeader('Access-Control-Max-Age', '3600');
        }
        if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
        }
        try {
            url = decodeURI(url);
        }
        catch (e) {
            this.adapter.log.warn(`Malformed URL encoding for ${url}: ${e}`);
        }
        const pos = url.indexOf('?');
        if (pos !== -1) {
            SimpleAPI.parseQuery(url.substring(pos + 1), query, values);
            url = url.substring(0, pos);
        }
        const [, _command, varsName] = url.split('/');
        const command = _command;
        const responseType = command === 'getPlainValue' ? 'plain' : 'json';
        // Analyse system.adapter.socketio.0.uptime,system.adapter.history.0.memRss?value=78&wait=300
        if (varsName) {
            oId = varsName.split(',');
            for (let j = oId.length - 1; j >= 0; j--) {
                try {
                    oId[j] = decodeURIComponent(oId[j]);
                }
                catch (e) {
                    this.adapter.log.warn(`Malformed URL encoding for "${oId[j]}": ${e}`);
                    oId[j] = oId[j].trim().replace(/%23/g, '#'); // do old style minimal parsing
                }
            }
            oId = oId.filter(id => id.trim());
        }
        let user;
        // If authentication check is required
        if (this.settings.auth) {
            const isAuth = await this.isAuthenticated(req, query);
            if (!isAuth) {
                this.doErrorResponse(res, responseType, 401, `authentication failed. Please write "http${this.settings.secure ? 's' : ''}://${req.headers.host}?user=UserName&pass=Password"`);
                return;
            }
        }
        else {
            query.user = req.user || this.config.defaultUser;
        }
        if (query.user && !query.user.startsWith('system.user.')) {
            user = `system.user.${query.user}`;
        }
        else {
            user = query.user;
        }
        query.user = user;
        if (!(await this.checkPermissions(user, command))) {
            this.doErrorResponse(res, responseType, 403, ERROR_PERMISSION);
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
                const response = [];
                for (let i = 0; i < oId.length; i++) {
                    try {
                        const { state } = await this.getState(oId[i], user, query);
                        if (state) {
                            let val = state.val;
                            if (query.json) {
                                let obj;
                                try {
                                    obj = JSON.parse(typeof val === 'string' ? val : JSON.stringify(val));
                                }
                                catch {
                                    // ignore
                                    obj = val;
                                }
                                val = JSON.stringify(obj);
                            }
                            else {
                                if (query.noStringify) {
                                    val =
                                        state.val === null
                                            ? 'null'
                                            : state.val === undefined
                                                ? 'undefined'
                                                : state.val.toString();
                                }
                                else {
                                    val = JSON.stringify(state.val);
                                }
                            }
                            response[i] = val;
                        }
                        else {
                            response[i] = `error: cannot read state "${oId[i]}"`;
                        }
                    }
                    catch (err) {
                        if (err.toString().includes('not found')) {
                            response[i] = `error: datapoint "${oId[i]}" not found`;
                        }
                        else {
                            this.adapter.log.error(`Cannot get state: ${err}`);
                            if (err.toString().includes(ERROR_PERMISSION)) {
                                this.doErrorResponse(res, responseType, 403, err);
                            }
                            else {
                                this.doErrorResponse(res, responseType, 500, err);
                            }
                            return;
                        }
                    }
                }
                this.doResponse(res, responseType, response.join('\n'), query);
                break;
            }
            case 'get': {
                if (!oId.length || !oId[0]) {
                    this.doErrorResponse(res, responseType, 422, 'no object/datapoint given');
                    break;
                }
                const response = [];
                for (let k = 0; k < oId.length; k++) {
                    this.adapter.log.debug(`work for ID ${oId[k]}`);
                    try {
                        const { state, id } = await this.getState(oId[k], user, query);
                        if (!id) {
                            response[k] = { error: `datapoint "${oId[k]}" not found` };
                        }
                        else {
                            const obj = await this.adapter.getForeignObjectAsync(id);
                            response[k] = { ...obj, ...state };
                        }
                    }
                    catch (err) {
                        if (err.toString().includes(ERROR_PERMISSION)) {
                            this.doErrorResponse(res, responseType, 403, err);
                            return;
                        }
                        response[k] = { error: `datapoint "${oId[k]}" not found` };
                    }
                }
                if (response.length === 1 && response[0].error) {
                    this.doErrorResponse(res, responseType, 404, response[0].error);
                    return;
                }
                this.doResponse(res, responseType, response.length === 1 ? response[0] : response, query);
                break;
            }
            case 'getBulk': {
                if (!oId.length || !oId[0]) {
                    this.doErrorResponse(res, responseType, 422, 'no data points given');
                    break;
                }
                const response = [];
                for (let b = 0; b < oId.length; b++) {
                    try {
                        const { id, state } = await this.getState(oId[b], user, query);
                        response[b] = { id, val: state?.val, ts: state?.ts, ack: state?.ack };
                    }
                    catch (err) {
                        if (err.toString().includes(ERROR_PERMISSION)) {
                            this.doErrorResponse(res, responseType, 403, err);
                            return;
                        }
                        response[b] = { id: oId[b], val: undefined, ts: undefined, ack: undefined };
                    }
                }
                this.doResponse(res, responseType, response, query);
                break;
            }
            case 'set': {
                if (!oId.length || !oId[0]) {
                    this.doErrorResponse(res, responseType, 422, 'object/datapoint not given');
                    return;
                }
                if (values.value === undefined && values.val === undefined) {
                    this.doErrorResponse(res, responseType, 422, `error: no value found for "${oId[0]}". Use /set/id?value=1 or /set/id?value=1&wait=1000`);
                    return;
                }
                try {
                    const { id } = await this.findState(oId[0], user);
                    if (!id) {
                        this.doErrorResponse(res, responseType, 404, `error: datapoint "${oId[0]}" not found`);
                        return;
                    }
                    let type = query.type;
                    let value;
                    if (values.val === undefined) {
                        value = values.value;
                    }
                    else {
                        value = values.val;
                    }
                    // Ack=true cannot be awaited
                    const wait = !query.ack ? query.wait || 0 : 0;
                    if (!type ||
                        (type !== 'boolean' &&
                            type !== 'number' &&
                            type !== 'string' &&
                            type !== 'json' &&
                            type !== 'object' &&
                            type !== 'array')) {
                        // try to read type from an object
                        const obj = await this.adapter.getForeignObjectAsync(id, { user });
                        if (!obj) {
                            this.doErrorResponse(res, responseType, 404, `error: datapoint "${oId[0]}" not found`);
                            return;
                        }
                        type = obj.common?.type;
                    }
                    // If type is not defined or not known
                    if (!type ||
                        (type !== 'boolean' &&
                            type !== 'number' &&
                            type !== 'string' &&
                            type !== 'json' &&
                            type !== 'object' &&
                            type !== 'array')) {
                        // Maybe this is JSON
                        if (values.val && (values.val[0] === '[' || values.val[0] === '{')) {
                            try {
                                values.val = JSON.parse(values.val);
                            }
                            catch {
                                // keep it as string
                            }
                        }
                        if (value === 'true') {
                            value = true;
                        }
                        else if (value === 'false') {
                            value = false;
                        }
                        else if (value &&
                            parseFloat(value.replace(',', '.')).toString() === value.replace(',', '.')) {
                            value = parseFloat(value.replace(',', '.'));
                        }
                    }
                    else {
                        // type is known
                        if (type === 'boolean') {
                            value = value === 'true' || value === '1';
                        }
                        else if (type === 'number') {
                            if (value) {
                                value = parseFloat(value.replace(',', '.'));
                            }
                            else {
                                value = null;
                            }
                        }
                        else if (type === 'json' || type === 'array' || type === 'object') {
                            try {
                                value = JSON.parse(value);
                            }
                            catch (e) {
                                this.doErrorResponse(res, responseType, 500, e);
                                return;
                            }
                        }
                        // string must not be formatted
                    }
                    await this.setValue(id, value, res, wait, query, responseType);
                }
                catch (err) {
                    if (err.toString().includes(ERROR_PERMISSION)) {
                        this.doErrorResponse(res, responseType, 403, err);
                    }
                    else {
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
                    const { id } = await this.findState(oId[0], user);
                    if (id) {
                        const wait = query.wait || 0;
                        // Read a type of object
                        const obj = await this.adapter.getForeignObjectAsync(id, {
                            user,
                        });
                        if (obj) {
                            const state = await this.adapter.getForeignStateAsync(id, {
                                user,
                            });
                            if (state) {
                                let value = state.val;
                                if (obj.common.type === 'boolean' || (!obj.common.type && typeof value === 'boolean')) {
                                    if (value === 'true') {
                                        value = true;
                                    }
                                    else if (value === 'false') {
                                        value = false;
                                    }
                                    value = !value;
                                }
                                else if (obj.common.type === 'number' ||
                                    (!obj.common.type && typeof value === 'number')) {
                                    value = parseFloat(value);
                                    if (obj.common.max !== undefined) {
                                        obj.common.min = obj.common.min === undefined ? 0 : obj.common.min;
                                        if (value > obj.common.max) {
                                            value = obj.common.max;
                                        }
                                        else if (value < obj.common.min) {
                                            value = obj.common.min;
                                        }
                                        // Invert
                                        value = obj.common.max + obj.common.min - value;
                                    }
                                    else {
                                        // the default number is from 0 to 100
                                        if (value > 100) {
                                            value = 100;
                                        }
                                        if (value < 0) {
                                            value = 0;
                                        }
                                        value = 100 - value;
                                    }
                                }
                                else {
                                    if (value === 'true' || value === true) {
                                        value = false;
                                    }
                                    else if (value === 'on') {
                                        value = 'off';
                                    }
                                    else if (value === 'off') {
                                        value = 'on';
                                    }
                                    else if (value === 'OFF') {
                                        value = 'ON';
                                    }
                                    else if (value === 'ON') {
                                        value = 'OFF';
                                    }
                                    else if (value === 'false' || value === false) {
                                        value = true;
                                    }
                                    else if (parseFloat(value).toString() === value?.toString()) {
                                        value = parseFloat(value).toString() ? 0 : 1;
                                    }
                                    else {
                                        this.doErrorResponse(res, responseType, 422, 'state is neither number nor boolean');
                                        return;
                                    }
                                }
                                await this.setValue(id, value, res, wait, query, responseType);
                                return;
                            }
                            this.doErrorResponse(res, responseType, 404, `error: state "${oId[0]}" does not exist or null`);
                            return;
                        }
                    }
                    this.doErrorResponse(res, responseType, 404, `error: datapoint "${oId[0]}" not found`);
                }
                catch (err) {
                    if (err.toString().includes(ERROR_PERMISSION)) {
                        this.doErrorResponse(res, responseType, 403, err);
                    }
                    else {
                        this.doErrorResponse(res, responseType, 404, err);
                    }
                }
                break;
            // /setBulk?BidCos-RF.FEQ1234567:1.LEVEL=0.7&Licht-Küche/LEVEL=0.7&Anwesenheit=0&950=1
            case 'setBulk': {
                const response = [];
                this.adapter.log.debug(`Values: ${JSON.stringify(values)}`);
                const names = Object.keys(values);
                for (let n = 0; n < names.length; n++) {
                    try {
                        const { id } = await this.findState(names[n], user);
                        if (!id) {
                            response[n] = { error: `error: datapoint "${names[n]}" not found` };
                            continue;
                        }
                        this.adapter.log.debug(`GET-${command} for id=${id}, oid=${names[n]}, value=${values[names[n]]}`);
                        let value = values[names[n]];
                        if (value === 'true') {
                            value = true;
                        }
                        else if (value === 'false') {
                            value = false;
                        }
                        else if (value) {
                            const f = parseFloat(value.replace(',', '.'));
                            if (!isNaN(f) && value === f.toString()) {
                                value = f;
                            }
                        }
                        try {
                            await this.adapter.setForeignStateAsync(id, value, query.ack, {
                                user,
                                limitToOwnerRights: this.config.onlyAllowWhenUserIsOwner,
                            });
                            response[n] = { id: id, val: value, value };
                            this.adapter.log.debug(`Add to Response-Get: ${JSON.stringify(response[n])}`);
                        }
                        catch (err) {
                            if (err.toString().includes(ERROR_PERMISSION)) {
                                this.doErrorResponse(res, responseType, 403, err);
                                return;
                            }
                            response[n] = { error: err.toString() };
                        }
                    }
                    catch (err) {
                        if (err.toString().includes(ERROR_PERMISSION)) {
                            this.doErrorResponse(res, responseType, 403, err);
                            return;
                        }
                        response[n] = { error: err.toString() };
                    }
                }
                this.doResponse(res, responseType, response, query);
                break;
            }
            case 'getObjects':
            case 'objects': {
                try {
                    const list = await this.adapter.getForeignObjectsAsync(values.pattern || varsName || '*', query.type || null, {
                        user,
                        limitToOwnerRights: this.config.onlyAllowWhenUserIsOwner,
                    });
                    if (values.pattern?.includes('*') && !values.pattern.match(/\*$/)) {
                        // pattern to regex
                        const reg = new RegExp(values.pattern.replace(/\./g, '\\.').replace(/\*/g, '.*'));
                        const filteredList = {};
                        Object.keys(list).forEach(id => {
                            if (reg.test(id)) {
                                filteredList[id] = list[id];
                            }
                        });
                        this.doResponse(res, responseType, filteredList, query);
                    }
                    else {
                        this.doResponse(res, responseType, list, query);
                    }
                }
                catch (err) {
                    if (err.toString().includes(ERROR_PERMISSION)) {
                        this.doResponse(res, responseType, 403, err.toString());
                    }
                    else {
                        this.doResponse(res, responseType, 500, err.toString());
                    }
                }
                break;
            }
            case 'getStates':
            case 'states': {
                try {
                    const list = await this.adapter.getForeignStatesAsync(values.pattern || varsName || '*', {
                        user,
                        limitToOwnerRights: this.config.onlyAllowWhenUserIsOwner,
                    });
                    this.doResponse(res, responseType, list, query);
                }
                catch (err) {
                    if (err.toString().includes(ERROR_PERMISSION)) {
                        this.doErrorResponse(res, responseType, 403, err.toString());
                    }
                    else {
                        this.doErrorResponse(res, responseType, 500, err.toString());
                    }
                }
                break;
            }
            case 'search':
                try {
                    if (this.config.dataSource && this.config.allDatapoints !== true) {
                        const result = await this.adapter.sendToAsync(this.config.dataSource, 'getEnabledDPs');
                        this.doResponse(res, responseType, Object.keys(result || {}), query);
                    }
                    else {
                        this.adapter.log.debug(`[SEARCH] target = ${varsName}`);
                        const list = await this.adapter.getForeignStatesAsync(values.pattern || varsName || '*', {
                            user,
                            limitToOwnerRights: this.config.onlyAllowWhenUserIsOwner,
                        });
                        this.doResponse(res, responseType, Object.keys(list), query);
                    }
                }
                catch (err) {
                    if (err.toString().includes(ERROR_PERMISSION)) {
                        this.doErrorResponse(res, responseType, 403, err.toString());
                    }
                    else {
                        this.doErrorResponse(res, responseType, 500, err.toString());
                    }
                }
                break;
            case 'query': {
                this.adapter.log.debug(JSON.stringify(values));
                let dateFrom = Date.now();
                let dateTo = Date.now();
                if (values.dateFrom) {
                    dateFrom = SimpleAPI.convertRelativeTime(values.dateFrom) || Date.parse(values.dateFrom);
                }
                if (values.dateTo) {
                    dateTo = SimpleAPI.convertRelativeTime(values.dateTo) || Date.parse(values.dateTo);
                }
                const options = {
                    instance: this.config.dataSource,
                    start: dateFrom,
                    end: dateTo,
                    aggregate: values.aggregate || 'onchange',
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
                const response = [];
                for (let b = 0; b < oId.length; b++) {
                    const element = {
                        target: oId[b],
                        datapoints: [],
                    };
                    if (this.config.dataSource && !(values.noHistory && values.noHistory === 'true')) {
                        this.adapter.log.debug(`Read data from: ${this.config.dataSource}`);
                        const result = await this.adapter.getHistoryAsync(oId[b], options);
                        this.adapter.log.debug(`[QUERY] sendTo result = ${JSON.stringify(result)}`);
                        if (result.result) {
                            for (let i = 0; i < result.result.length; i++) {
                                element.datapoints.push([result.result[i].val, result.result[i].ts]);
                            }
                        }
                        response[b] = element;
                    }
                    else {
                        this.adapter.log.debug('Read last state');
                        const { state } = await this.getState(oId[b], user, query);
                        if (state) {
                            element.datapoints = [[state.val, state.ts || null]];
                        }
                        else {
                            element.datapoints = [[null, null]];
                        }
                    }
                }
                this.doResponse(res, responseType, response, query);
                break;
            }
            case 'annotations':
                // ioBroker does not support annotations
                this.adapter.log.debug('[ANNOTATIONS]');
                this.doResponse(res, responseType, [], query);
                break;
            // is default behaviour too
            case 'help':
            default:
                {
                    const _obj = command === 'help' ? {} : { error: `command ${command} unknown` };
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
                    this.doResponse(res, responseType, _obj, query);
                }
                break;
        }
    }
}
exports.SimpleAPI = SimpleAPI;
//# sourceMappingURL=SimpleAPI.js.map
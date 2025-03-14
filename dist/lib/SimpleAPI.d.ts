import type { Server as HttpServer } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import type { Express, Request, Response } from 'express';
export type Server = HttpServer | HttpsServer;
declare const commandsPermissions: {
    [operation: string]: {
        type: 'state' | 'object' | '';
        operation: 'read' | 'write' | 'list' | '';
    };
};
type SimpleApiQuery = {
    user?: string;
    pass?: string;
    prettyPrint?: boolean;
    json?: boolean;
    noStringify?: boolean;
    wait?: number;
    timeRFC3339?: boolean;
    type?: ioBroker.CommonType | 'json';
    ack: boolean;
};
type IoBrokerStateWithIsoTime = (Omit<ioBroker.State, 'ts' | 'lc'> & {
    ts?: string | number;
    lc?: string | number;
}) | null;
type CommandName = keyof typeof commandsPermissions;
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
export declare class SimpleAPI {
    private readonly adapter;
    private readonly settings;
    private readonly config;
    private readonly namespace;
    private readonly app?;
    private readonly cachedNames;
    private readonly cachedIds;
    private readonly restApiDelayed;
    constructor(_server: Server, webSettings: {
        secure: boolean;
        port: number | string;
        defaultUser?: string;
        auth?: boolean;
        language?: ioBroker.Languages;
    }, adapter: ioBroker.Adapter, instanceSettings: ioBroker.InstanceObject, app?: Express);
    isAuthenticated(req: Request & {
        user?: string;
    }, query: SimpleApiQuery): Promise<boolean>;
    stateChange(id: string, state: ioBroker.State | null | undefined): void;
    objectChange(id: string, _obj: ioBroker.Object | null | undefined): void;
    static parseQuery(input: string | undefined, query: SimpleApiQuery, values: Record<string, string | null>): void;
    setStates(values: Record<string, string | null>, query: SimpleApiQuery): Promise<{
        id?: string;
        val?: boolean | string | number;
        error?: string;
    }[]>;
    restApiPost(req: Request, res: Response, command: CommandName, oId: string[], values: Record<string, string | null>, query: SimpleApiQuery): Promise<void>;
    findState(idOrName: string, user: `system.user.${string}`): Promise<{
        id: string;
        name: string;
    }>;
    getState(idOrName: string, user: `system.user.${string}`, query: SimpleApiQuery): Promise<{
        state: IoBrokerStateWithIsoTime;
        id: string;
    }>;
    doResponse(res: Response, responseType: 'json' | 'plain', content?: any, pretty?: boolean): void;
    doErrorResponse(res: Response, responseType: 'json' | 'plain', status: 401 | 403 | 404 | 422 | 500, error?: string): void;
    checkPermissions(user: `system.user.${string}`, command: CommandName): Promise<boolean>;
    setValue(id: string, value: ioBroker.StateValue, res: Response, wait: number, query: SimpleApiQuery, responseType: 'json' | 'plain'): Promise<void>;
    restApi(req: Request, res: Response, overwriteUrl?: string): Promise<void>;
}
export {};

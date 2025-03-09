import { type Request, type Response } from 'express';
import { Adapter, type AdapterOptions } from '@iobroker/adapter-core';
import type { SimpleApiAdapterConfig } from './types';
export declare class SimpleApiAdapter extends Adapter {
    config: SimpleApiAdapterConfig;
    private webServer;
    private certificates;
    constructor(options?: Partial<AdapterOptions>);
    onUnload(callback: () => void): void;
    main(): Promise<void>;
    requestProcessor: (req: Request, res: Response) => void;
    initWebServer(): Promise<void>;
}

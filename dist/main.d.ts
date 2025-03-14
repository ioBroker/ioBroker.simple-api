import { NextFunction, type Request, type Response } from 'express';
import { Adapter, type AdapterOptions } from '@iobroker/adapter-core';
import type { SimpleApiAdapterConfig } from './types';
export declare class SimpleApiAdapter extends Adapter {
    config: SimpleApiAdapterConfig;
    private webServer;
    private certificates;
    constructor(options?: Partial<AdapterOptions>);
    onUnload(callback: () => void): void;
    main(): Promise<void>;
    serveStatic: (req: Request, res: Response, next: NextFunction) => void;
    initWebServer(): Promise<void>;
}

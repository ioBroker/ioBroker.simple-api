export interface SimpleApiAdapterConfig {
    port: number | string;
    auth: boolean;
    ttl: number | string;
    secure: boolean;
    bind: string;
    certPublic: string;
    certPrivate: string;
    certChained: string;
    defaultUser: string; // without 'system.user.'
    onlyAllowWhenUserIsOwner: boolean;
    webInstance: string;
    leEnabled: boolean;
    leUpdate: boolean;
    leCheckPort: number | string;
    dataSource: string;
    allDatapoints: boolean;
    accessControlAllowOrigin: string;
}

declare class ExtAPI {
    public waitForReadyTime?: number;

    constructor(
        webServer: Server,
        settings: { secure: boolean; port: number | string; defaultUser?: string },
        adapter: ioBroker.Adapter,
        config?: ioBroker.InstanceObject,
        app?: Express,
        io?: SocketIO,
    );

    welcomePage?(): LocalMultipleLinkEntry;
    fileChange?(id: string, fileName: string, size: number | null): void;
    stateChange?(id: string, state: ioBroker.State | null | undefined): void;
    objectChange?(id: string, state: ioBroker.Object | null | undefined): void;
    /** Give to the extension up to 5 seconds to be loaded */
    waitForReady?(onReady: () => void): void;
    unload?(): Promise<void>;
}

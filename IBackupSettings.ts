export interface IBackupSettings {
    backupOnStart?: boolean;
    backupOnPlayerConnected?: boolean;
    backupOnPlayerDisconnected?: boolean;
    interval?: number;
    minIntervalBetweenBackups?: number;
    skipIfNoActivity?: boolean;
    bedrockServerPath?: string;
}

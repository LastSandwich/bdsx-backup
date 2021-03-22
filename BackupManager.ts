import { bedrockServer } from "bdsx";

import { BackupUtils } from "./BackupUtils";
import { IBackupSettings } from "./IBackupSettings";

export class BackupManager {
    private worldName = "Unknown";
    private activePlayerCount = 0;
    private runNextBackup = false;
    private lastBackup = new Date(0, 0, 0);
    private backupSettings: IBackupSettings = {};

    constructor(private bds: typeof bedrockServer, private testOnly?: boolean, private tempName?: string) {}

    public async init(settings: IBackupSettings): Promise<void> {
        this.backupSettings = settings;
        this.worldName = await BackupUtils.getWorldName();
        if (!this.testOnly) {
            await BackupUtils.removeDirectory("temp");
        }

        await this.registerHandlers();

        if (settings.interval && settings.interval > 0) {
            setInterval(async () => {
                await this.backup();
            }, settings.interval * 60000);
        }

        if (settings.backupOnStart) {
            this.runNextBackup = true;
            await this.backup();
        }

        this.displayStatus("Initialized");
    }

    public async backup(): Promise<void> {
        if (this.backupSettings.minIntervalBetweenBackups) {
            let diffTime = Math.abs(Date.now() - this.lastBackup.valueOf()) / 1000 / 60;
            diffTime = Math.round(diffTime * 100) / 100;
            console.log(diffTime);
            if (diffTime < this.backupSettings.minIntervalBetweenBackups) {
                console.log(`Skip backup - last processed ${diffTime}`);
                return;
            }
        }

        if (this.backupSettings.skipIfNoActivity) {
            if (this.activePlayerCount > 0 || this.runNextBackup) {
                console.log("Call save hold due to activity");
                this.bds.executeCommandOnConsole("save hold");
            } else {
                console.log("Skip backup - no activity");
            }
        } else {
            console.log("Call save hold (no activity)");
            this.bds.executeCommandOnConsole("save hold");
        }
    }

    private async registerHandlers() {
        this.bds.commandOutput.on((result: string) => {
            if (result.indexOf("A previous save") > -1 || result.indexOf("The command is already running") > -1) {
                this.bds.executeCommandOnConsole("save resume");
                this.runNextBackup = true;
            }

            if (result === "Saving...") {
                this.bds.executeCommandOnConsole("save query");
            }

            if (result.indexOf("Data saved. Files are now ready to be copied.") > -1) {
                const files = result.split(", ");
                this.runBackup(files);
            }

            if (result === "Changes to the level are resumed.") {
                // no action
            }
        });

        this.bds.bedrockLog.on((result: string | string[]) => {
            if (result.indexOf("Player connected") > -1) {
                this.activePlayerCount++;
                this.runNextBackup = true;

                if (this.backupSettings.backupOnPlayerConnected) {
                    this.backup();
                }
            }

            if (result.indexOf("Player disconnected") > -1) {
                this.activePlayerCount = this.activePlayerCount > 0 ? this.activePlayerCount - 1 : 0;
                this.runNextBackup = true;

                if (this.backupSettings.backupOnPlayerDisconnected) {
                    this.backup();
                }
            }
        });
    }

    private async runBackup(files: string[]) {
        if (this.testOnly) {
            this.bds.executeCommandOnConsole("save resume");
            return;
        }

        const handleError = (error?: string) => {
            error && console.log(error);
            this.runNextBackup = true;
            this.bds.executeCommandOnConsole("save resume");
        };

        this.runNextBackup = false;
        this.displayStatus("Starting...");
        const tempDirectory = await BackupUtils.createTempDirectory(this.worldName, handleError, this.tempName);
        await BackupUtils.moveFiles(tempDirectory, this.worldName, handleError);
        await Promise.all(
            files.slice(1).map(async (file) => {
                await BackupUtils.truncate(file, tempDirectory);
            })
        );
        await BackupUtils.zipDirectory(tempDirectory, this.worldName, handleError);
        await BackupUtils.removeTempDirectory(tempDirectory);

        this.bds.executeCommandOnConsole("save resume");
        this.lastBackup = new Date();
        console.log("Finished");
        setTimeout(() => {
            this.displayStatus("Finished!");
        }, 2000);
    }

    private displayStatus = (message: string) => {
        if (this.activePlayerCount > 0) {
            // eslint-disable-next-line no-useless-escape
            this.bds.executeCommandOnConsole(`tellraw @a {\"rawtext\": [{\"text\": \"§lBackup\"},{\"text\": \"§r ${message}\"}]}`);
        }
    };
}

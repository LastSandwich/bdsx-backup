import { bedrockServer } from "bdsx/launcher";
import { command } from "bdsx/index";
import BackupUtils from "./BackupUtils";
import commandOutput = bedrockServer.commandOutput;

export interface IBackupSettings {
    backupOnStart?: boolean;
    backupOnPlayerConnected?: boolean;
    backupOnPlayerDisconnected?: boolean;
    interval?: number;
    minIntervalBetweenBackups?: number;
    skipIfNoActivity?: boolean;
}

export default class BackupManager {
    private worldName = "Unknown";
    private activePlayerCount = 0;
    private runNextBackup = false;
    private lastBackup = new Date(0, 0, 0);
    private backupSettings: IBackupSettings = {};

    constructor(private testOnly?: boolean) {
    }

    public async init(settings: IBackupSettings): Promise<void> {
        this.backupSettings = settings;
        this.worldName = await BackupUtils.getWorldName();
        if (!this.testOnly){
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
                console.log("Save hold 1");
                bedrockServer.executeCommandOnConsole("save hold");
            } else {
                console.log("Skip backup - no activity");
            }
        } else {
            console.log("Save hold 2");
            bedrockServer.executeCommandOnConsole("save hold");
        }
    }

    public runNext(): void {
        this.runNextBackup = true;
    }

    private async registerHandlers() {
        commandOutput.on((result) => {
            if (result === "A previous save has not been completed" || result === "The command is already running") {
                bedrockServer.executeCommandOnConsole("save resume");
            }

            if (result === "Saving...") {
                bedrockServer.executeCommandOnConsole("save query");
            }

            if (result.indexOf("Data saved. Files are now ready to be copied.") > -1) {
                const files = result.split(", ");
                this.runBackup(files);
            }

            if (result === "Changes to the level are resumed.") {
                // no action
            }
        });

        bedrockServer.bedrockLog.on((result) => {
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

        command.hook.on((command, originName) => {
            if (command.startsWith("/backup")) {
                console.log("Backup command triggered");
                this.runNextBackup = true;
                this.backup();
                return 0;
            }
        });
    }

    private async runBackup(files: string[]) {
        if (!!this.testOnly){
            bedrockServer.executeCommandOnConsole("save resume");
            return;
        }

        const handleError = (error?: string) => {
            error && console.log(error);
            this.runNextBackup = true;
            bedrockServer.executeCommandOnConsole("save resume");
        };

        this.runNextBackup = false;
        this.displayStatus("Starting...");
        const tempDirectory = await BackupUtils.createTempDirectory(this.worldName, handleError);
        await BackupUtils.moveFiles(tempDirectory, this.worldName, handleError);
        await Promise.all(
            files.slice(1).map(async (file) => {
                await BackupUtils.truncate(file, tempDirectory);
            })
        );
        await BackupUtils.zipDirectory(tempDirectory, this.worldName, handleError);
        await BackupUtils.removeTempDirectory(tempDirectory);

        bedrockServer.executeCommandOnConsole("save resume");
        this.lastBackup = new Date();
        console.log("Finished");
        setTimeout(() => {
            this.displayStatus("Finished!");
        }, 2000);
    }

    private displayStatus = (message: string) => {
        if (this.activePlayerCount > 0) {
            bedrockServer.executeCommandOnConsole(`tellraw @a {\"rawtext\": [{\"text\": \"§lBackup\"},{\"text\": \"§r ${message}\"}]}`);
        }
    };
}

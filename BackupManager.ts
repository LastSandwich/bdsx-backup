import { ServerPlayer } from "bdsx/bds/player";
import { events } from "bdsx/event";
import { bedrockServer } from "bdsx/launcher";

import { BackupUtils } from "./BackupUtils";
import { IBackupSettings } from "./IBackupSettings";

export class BackupManager {
    private worldName = "Unknown";
    private runNextBackup = false;
    private lastBackup = 0;
    private backupSettings: IBackupSettings = {};
    private bedrockServerPath: string;
    private resumeRetryCounter = 0;

    private actorList: ServerPlayer[] = [];

    constructor(private bds: typeof bedrockServer, private evt: typeof events, private testOnly?: boolean, private tempName?: string) {}

    public async init(settings: IBackupSettings): Promise<void> {
        this.backupSettings = settings;
        this.bedrockServerPath = settings.bedrockServerPath ?? ".";
        this.worldName = await BackupUtils.getWorldName(this.bedrockServerPath);

        console.log("bedrockServerPath:", this.bedrockServerPath);
        console.log("worldName:", this.worldName);

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
            let diffTime = Math.abs(Date.now() - this.lastBackup) / 1000 / 60;
            diffTime = Math.round(diffTime * 100) / 100;
            console.log(diffTime);
            if (diffTime < this.backupSettings.minIntervalBetweenBackups) {
                console.log(`Skip backup - last processed ${diffTime}`);
                return;
            }
        }

        if (this.backupSettings.skipIfNoActivity) {
            if (this.actorList.length > 0 || this.runNextBackup) {
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
        this.evt.commandOutput.on((result: string) => {
            if (result.indexOf("A previous save") > -1 || result.indexOf("The command is already running") > -1) {
                this.resumeRetryCounter++;
                if (this.resumeRetryCounter < 3) {
                    setTimeout(() => {
                        this.bds.executeCommandOnConsole("save resume");
                        this.runNextBackup = true;
                    }, 1000);
                } else {
                    this.resumeRetryCounter = 0;
                }
            }

            if (result === "Saving...") {
                this.bds.executeCommandOnConsole("save query");
            }

            if (result.indexOf("Data saved. Files are now ready to be copied.") > -1) {
                const files = result.split(", ");
                this.runBackup(files);
            }

            if (result === "Changes to the level are resumed." || result === "Changes to the world are resumed.") {
                this.resumeRetryCounter = 0;
            }
        });

        this.evt.playerJoin.on((e) => {
            const actor = e.player.getNetworkIdentifier().getActor();
            if (actor !== null) {
                this.actorList.push(actor);

                this.runNextBackup = true;
                if (this.backupSettings.backupOnPlayerConnected) {
                    this.backup();
                }
            }
        });

        this.evt.networkDisconnected.on((netId) => {
            const actor = netId.getActor()?.getNetworkIdentifier().getActor();
            if (actor) {
                this.actorList.splice(this.actorList.findIndex(() => actor));

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
        await BackupUtils.moveFiles(`${this.bedrockServerPath}/worlds`, tempDirectory, this.worldName, handleError);
        await Promise.all(
            files.slice(1).map(async (file) => {
                await BackupUtils.truncate(file, tempDirectory);
            })
        );
        await BackupUtils.zipDirectory(`${this.bedrockServerPath}/backups`, tempDirectory, this.worldName, handleError);
        await BackupUtils.removeTempDirectory(tempDirectory);

        this.bds.executeCommandOnConsole("save resume");
        this.lastBackup = Date.now();
        console.log("Finished");
        setTimeout(() => {
            this.displayStatus("Finished!");
        }, 2000);
    }

    private displayStatus = (message: string) => {
        if (this.actorList.length > 0) {
            // eslint-disable-next-line no-useless-escape
            this.bds.executeCommandOnConsole(`tellraw @a {\"rawtext\": [{\"text\": \"§lBackup\"},{\"text\": \"§r ${message}\"}]}`);
        }
    };
}

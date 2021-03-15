"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupManager = void 0;
const launcher_1 = require("bdsx/launcher");
const index_1 = require("bdsx/index");
const backupUtils_1 = require("./backupUtils");
var backupManager;
(function (backupManager) {
    var commandOutput = launcher_1.bedrockServer.commandOutput;
    async function init(settings) {
        backupSettings = settings;
        worldName = await backupUtils_1.backupUtils.getWorldName();
        await backupUtils_1.backupUtils.removeDirectory("temp");
        await registerHandlers();
        if (settings.interval && settings.interval > 0) {
            setInterval(async () => {
                await backup();
            }, settings.interval * 60000);
        }
        if (settings.backupOnStart) {
            runNextBackup = true;
            await backup();
        }
        displayStatus("Initialized");
    }
    backupManager.init = init;
    async function backup() {
        if (backupSettings.minIntervalBetweenBackups) {
            let diffTime = Math.abs(Date.now() - lastBackup.valueOf()) / 1000 / 60;
            diffTime = Math.round(diffTime * 100) / 100;
            console.log(diffTime);
            if (diffTime < backupSettings.minIntervalBetweenBackups) {
                console.log(`Skip backup - last processed ${diffTime}`);
                return;
            }
        }
        if (backupSettings.skipIfNoActivity) {
            if (activePlayerCount > 0 || runNextBackup) {
                console.log("Save hold 1");
                launcher_1.bedrockServer.executeCommandOnConsole("save hold");
            }
            else {
                console.log("Skip backup - no activity");
            }
        }
        else {
            console.log("Save hold 2");
            launcher_1.bedrockServer.executeCommandOnConsole("save hold");
        }
    }
    backupManager.backup = backup;
    let worldName = "Unknown";
    let activePlayerCount = 0;
    let runNextBackup = false;
    let lastBackup = new Date(0, 0, 0);
    let backupSettings = {};
    async function registerHandlers() {
        commandOutput.on((result) => {
            if (result === "A previous save has not been completed" || result === "The command is already running") {
                launcher_1.bedrockServer.executeCommandOnConsole("save resume");
            }
            if (result === "Saving...") {
                launcher_1.bedrockServer.executeCommandOnConsole("save query");
            }
            if (result.indexOf("Data saved. Files are now ready to be copied.") > -1) {
                const files = result.split(", ");
                runBackup(files);
            }
            if (result === "Changes to the level are resumed.") {
                // no action
            }
        });
        launcher_1.bedrockServer.bedrockLog.on((result) => {
            if (result.indexOf("Player connected") > -1) {
                activePlayerCount++;
                runNextBackup = true;
                if (backupSettings.backupOnPlayerConnected) {
                    backup();
                }
            }
            if (result.indexOf("Player disconnected") > -1) {
                activePlayerCount = activePlayerCount > 0 ? activePlayerCount - 1 : 0;
                runNextBackup = true;
                if (backupSettings.backupOnPlayerDisconnected) {
                    backup();
                }
            }
        });
        index_1.command.hook.on((command, originName) => {
            if (command.startsWith("/backup")) {
                console.log("Backup command triggered");
                runNextBackup = true;
                backup();
                return 0;
            }
        });
    }
    async function runBackup(files) {
        const handleError = (error) => {
            error && console.log(error);
            runNextBackup = true;
            launcher_1.bedrockServer.executeCommandOnConsole("save resume");
        };
        runNextBackup = false;
        displayStatus("Starting...");
        const tempDirectory = await backupUtils_1.backupUtils.createTempDirectory(worldName, handleError);
        await backupUtils_1.backupUtils.moveFiles(tempDirectory, worldName, handleError);
        await Promise.all(files.slice(1).map(async (file) => {
            await backupUtils_1.backupUtils.truncate(file, tempDirectory);
        }));
        await backupUtils_1.backupUtils.zipDirectory(tempDirectory, worldName, handleError);
        await backupUtils_1.backupUtils.removeTempDirectory(tempDirectory);
        launcher_1.bedrockServer.executeCommandOnConsole("save resume");
        lastBackup = new Date();
        console.log("Finished");
        setTimeout(() => {
            displayStatus("Finished!");
        }, 2000);
    }
    const displayStatus = (message) => {
        if (activePlayerCount > 0) {
            launcher_1.bedrockServer.executeCommandOnConsole(`tellraw @a {\"rawtext\": [{\"text\": \"§lBackup\"},{\"text\": \"§r ${message}\"}]}`);
        }
    };
})(backupManager = exports.backupManager || (exports.backupManager = {}));
// backupManager
//     .init({
//         backupOnStart: true,
//         interval: 30,
//         skipIfNoActivity: true,
//         backupOnPlayerConnected: true,
//         backupOnPlayerDisconnected: true,
//         minIntervalBetweenBackups: 10,
//     })
//     .then(() => {
//         console.log("Backup Manager initialized");
//     })
//     .catch((err) => {
//         console.log(`Failed to initialize Backup Manager: ${err}`);
//     });
//# sourceMappingURL=backupManager.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupUtils = void 0;
const path_1 = require("path");
const fs_1 = require("fs");
const fs = require("fs");
const ncp = require("ncp");
const AdmZip = require("adm-zip");
const util_1 = require("util");
var backupUtils;
(function (backupUtils) {
    async function getWorldName() {
        return await fs_1.promises.readFile("server.properties", "utf8").then((data) => {
            const reg = /^level\-name\=(.+)/igm;
            let matches = (data.match(reg) || []).map(e => e.replace(reg, '$1'));
            return matches ? matches[0].trim() : "Unknown";
        });
    }
    backupUtils.getWorldName = getWorldName;
    async function removeDirectory(path) {
        if (!(await directoryExists(path))) {
            return;
        }
        const removeEmptyFolder = (path) => {
            return fs_1.promises.rmdir(path).catch((err) => {
                console.log(`Failed to remove ${path}: ${err}`);
            });
        };
        return fs_1.promises.lstat(path).then((stats) => {
            if (stats.isDirectory()) {
                return fs_1.promises
                    .readdir(path)
                    .then((files) => Promise.all(files.map((file) => removeDirectory(path_1.join(path, file)))))
                    .then(() => removeEmptyFolder(path));
            }
            else {
                return fs_1.promises.unlink(path).catch((err) => {
                    console.log(`Failed to remove ${path}: ${err}`);
                });
            }
        });
    }
    backupUtils.removeDirectory = removeDirectory;
    async function directoryExists(filePath) {
        return new Promise(async (resolve) => {
            await fs_1.promises
                .access(filePath)
                .then(() => {
                resolve(true);
            })
                .catch(() => {
                resolve(false);
            });
        });
    }
    backupUtils.directoryExists = directoryExists;
    ;
    const ensureDirectoryExists = async (filePath, handleError) => {
        if (!(await directoryExists(filePath))) {
            await fs_1.promises.mkdir(filePath, { recursive: true }).catch((err) => {
                if (err.indexOf("EEXIST:") === -1) {
                    handleError(`Failed to create directory: ${filePath}: ${err}`);
                }
            });
        }
    };
    async function createTempDirectory(worldName, handleError) {
        const now = new Date();
        const addLeadingZero = (value) => {
            return `0${value}`.slice(-2);
        };
        const getTime = (date) => {
            return addLeadingZero(date.getHours()) + addLeadingZero(date.getMinutes()) + addLeadingZero(date.getSeconds());
        };
        const timeStamp = [now.getFullYear(), addLeadingZero(now.getMonth() + 1), addLeadingZero(now.getDate()), getTime(now)].join("-");
        const directory = `temp/${timeStamp}`;
        await ensureDirectoryExists(`${directory}/${worldName}`, handleError);
        return directory;
    }
    backupUtils.createTempDirectory = createTempDirectory;
    async function removeTempDirectory(tempDirectory) {
        await removeDirectory(tempDirectory).catch((err) => {
            console.log(`Failed to remove ${tempDirectory}: ${err}`);
        });
    }
    backupUtils.removeTempDirectory = removeTempDirectory;
    async function truncate(file, tempDirectory) {
        const truncateFile = util_1.promisify(fs.truncate);
        const [filePath, bytesCount] = file.split(":");
        await truncateFile(`${tempDirectory}/${filePath}`, Number(bytesCount)).catch((err) => {
            console.log(`Failed to truncate ${filePath}: ${err}`);
        });
    }
    backupUtils.truncate = truncate;
    async function zipDirectory(tempDirectory, worldName, handleError) {
        const destination = `backups/${path_1.basename(tempDirectory)}_${worldName}.zip`;
        await ensureDirectoryExists("backups", handleError);
        await new Promise((resolve) => {
            const zip = new AdmZip();
            zip.addLocalFolder(`${tempDirectory}/${worldName}`);
            zip.writeZip(destination, (err) => {
                if (err) {
                    handleError("Failed to create zip");
                    resolve(false);
                }
                console.log(`Saved to ${destination}`);
                resolve(true);
            });
        });
    }
    backupUtils.zipDirectory = zipDirectory;
    async function moveFiles(tempDirectory, worldName, handleError) {
        await new Promise((resolve) => {
            ncp(`worlds/${worldName}`, `${tempDirectory}/${worldName}`, {
                filter: (source) => {
                    return source.indexOf("lost") === -1;
                },
            }, (err) => {
                if (err) {
                    handleError(`${err}`);
                    resolve(false);
                }
                resolve(true);
            });
        });
    }
    backupUtils.moveFiles = moveFiles;
})(backupUtils = exports.backupUtils || (exports.backupUtils = {}));
//# sourceMappingURL=backupUtils.js.map
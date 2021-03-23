import { promises as fsp } from "fs";
import * as fs from "fs";
import { basename, join } from "path";
import { promisify } from "util";

import * as AdmZip from "adm-zip";
import * as ncp from "ncp";

export class BackupUtils {
    public static async getWorldName(bedrockServerPath: string): Promise<string> {
        return BackupUtils.readFile(`${bedrockServerPath}/server.properties`)
            .then((data) => {
                const reg = /^level-name=(.+)/gim;
                const matches = (data.match(reg) || []).map((e) => e.replace(reg, "$1"));
                return matches ? matches[0].trim() : "Unknown";
            })
            .catch((err) => {
                console.log(`Failed to read ${bedrockServerPath}/server.properties ${err}`);
                return "Unknown";
            });
    }

    public static async readFile(path: string): Promise<string> {
        return await fsp.readFile(path, "utf8");
    }

    public static async removeDirectory(path: string): Promise<any> {
        if (!(await BackupUtils.directoryExists(path))) {
            return;
        }

        const removeEmptyFolder = (path: string) => {
            return fsp.rmdir(path).catch((err) => {
                console.log(`Failed to remove ${path}: ${err}`);
            });
        };
        return fsp.lstat(path).then((stats) => {
            if (stats.isDirectory()) {
                return fsp
                    .readdir(path)
                    .then((files: string[]) => Promise.all(files.map((file) => BackupUtils.removeDirectory(join(path, file)))))
                    .then(() => removeEmptyFolder(path));
            } else {
                return fsp.unlink(path).catch((err) => {
                    console.log(`Failed to remove ${path}: ${err}`);
                });
            }
        });
    }

    public static async directoryExists(filePath: string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            fsp.access(filePath)
                .then(() => {
                    resolve(true);
                })
                .catch(() => {
                    resolve(false);
                });
        });
    }

    private static ensureDirectoryExists = async (filePath: string, handleError: (error?: string) => void) => {
        if (!(await BackupUtils.directoryExists(filePath))) {
            await fsp.mkdir(filePath, { recursive: true }).catch((err) => {
                if (err.indexOf("EEXIST:") === -1) {
                    handleError(`Failed to create directory: ${filePath}: ${err}`);
                }
            });
        }
    };

    public static async createTempDirectory(worldName: string, handleError: (error?: string) => void, tempName?: string): Promise<string> {
        const now = new Date(Date.now());
        const addLeadingZero = (value: number) => {
            return `0${value}`.slice(-2);
        };

        const getTime = (date: Date) => {
            return addLeadingZero(date.getHours()) + addLeadingZero(date.getMinutes()) + addLeadingZero(date.getSeconds());
        };

        const timeStamp = [now.getFullYear(), addLeadingZero(now.getMonth() + 1), addLeadingZero(now.getDate()), getTime(now)].join("-");
        const directory = tempName ? `temp/${tempName}` : `temp/${timeStamp}`;
        await BackupUtils.ensureDirectoryExists(`${directory}/${worldName}`, handleError);
        return directory;
    }

    public static async removeTempDirectory(tempDirectory: string): Promise<void> {
        await BackupUtils.removeDirectory(tempDirectory).catch((err) => {
            console.log(`Failed to remove ${tempDirectory}: ${err}`);
        });
    }

    public static async truncate(file: string, tempDirectory: string): Promise<void> {
        const truncateFile = promisify(fs.truncate);
        const [filePath, bytesCount] = file.split(":");
        await truncateFile(`${tempDirectory}/${filePath}`, Number(bytesCount)).catch((err) => {
            console.log(`Failed to truncate ${filePath}: ${err}`);
        });
    }

    public static async zipDirectory(backupsPath: string, tempDirectory: string, worldName: string, handleError: (error?: string) => void): Promise<void> {
        const destination = `${backupsPath}/${basename(tempDirectory)}_${worldName}.zip`;
        await BackupUtils.ensureDirectoryExists("backups", handleError);

        await new Promise<boolean>((resolve) => {
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

    public static async moveFiles(worldsPath: string, tempDirectory: string, worldName: string, handleError: any): Promise<void> {
        await new Promise<boolean>((resolve) => {
            ncp(
                `${worldsPath}/${worldName}`,
                `${tempDirectory}/${worldName}`,
                {
                    filter: (source) => {
                        return source.indexOf("lost") === -1;
                    },
                },
                (err) => {
                    if (err) {
                        handleError(`${err}`);
                        resolve(false);
                    }

                    resolve(true);
                }
            );
        });
    }
}

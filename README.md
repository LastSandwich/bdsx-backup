# @bdsx/backup
Backup manager for Minecraft worlds running on [Bdsx](https://github.com/bdsx/bdsx)

## How to install

1. From your Bdsx installation folder, run `plugin-manager.bat` on Windows or `plugin-manager.sh` on Linux
2. Choose `@bdsx/backup` and press `Enter` to install
3. Insert this code in your index.ts file:
````
import { bedrockServer } from "bdsx/launcher";
import { events } from "bdsx/event";
import { BackupManager } from "@bdsx/backup/BackupManager";

const backupManager = new BackupManager(bedrockServer, events);
backupManager.init({
    backupOnStart: true,
    skipIfNoActivity: true,
    backupOnPlayerConnected: true,
    backupOnPlayerDisconnected: true,
    interval: 30,
    minIntervalBetweenBackups: 5,
}).then((res) => {
    console.log(`backup manager initiated`);
});
````
You can tweak the following settings:
- backupOnStart: backup will occur when the server is started
- interval: minutes between each backup
- skipIfNoActivity: only create a backup if players have been active the previous backup
- backupOnPlayerConnected: run a backup when a player joins
- backupOnPlayerDisconnected: run a backup when a player leaves
- minIntervalBetweenBackups: minimum minutes between backups
- bedrockServerPath: path to the bedrock_server folder - defaults to `"."`

## How to run
Next time you restart the Bdsx server the backup manager should start up.

Backups will be zipped and saved in `./bedrock_server/backups`.

## Caution
This software has not been battle tested so please use with caution!

## TODO
- Provide a setting to automatically clean up old backups

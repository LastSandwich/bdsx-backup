# bdsx-backup
Backup manager for Minecraft worlds running on bdsx

## How to install

1. Copy `./src/BackupManager.ts` and `./src/backupUtil.ts` into your bdsx project
2. Run `npm i ncp adm-zip`
3. Run `npm i -D @types/ncp @types/adm-zip`
4. Open `index.ts` from the bdsx folder and import the backupManager e.g. `import './backupManager';`
5. Insert this code in your index.ts file:
````
const backupManager = new BackupManager();
backupManager
    .init({
        backupOnStart: true,
        interval: 30,
        skipIfNoActivity: true,
        backupOnPlayerConnected: true,
        backupOnPlayerDisconnected: true,
        minIntervalBetweenBackups: 10,
     })
     .then(() => {
         console.log("Backup Manager initialized");
     })
     .catch((err) => {
         console.log(`Failed to initialize Backup Manager: ${err}`);
     });
````
You can tweak the following settings:
- backupOnStart: backup will occur when the server is started
- interval: minutes between each backup
- skipIfNoActivity: only create a backup if players have be online
- backupOnPlayerConnected: run a backup when a player joins
- backupOnPlayerDisconnected: run a backup when a player leaves
- minIntervalBetweenBackups: minimum minutes between backups

## How to run
Next time you restart the bdsx server the backup manager should start up.

Backups will be zipped and saved in ./bedrock_server/backups folder.

## Caution
This software has not been battle tested so please use with caution!

## TODO
- Implement this as a plugin - in progress
- Write tests - in progress
- Provide a setting to automatically clean up old backups

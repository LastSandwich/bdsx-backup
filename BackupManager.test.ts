import { bedrockServer } from "bdsx";
import Event from "krevent";
import { Mock, It, Times, IMock } from "moq.ts";
import * as unzipper from "unzipper";
import waitForExpect from "wait-for-expect";

import { BackupManager } from "./BackupManager";
import { BackupUtils } from "./BackupUtils";

describe("BackupManager", () => {
    const mockBedrockLogEvents = new Event<(log: string, color: any) => void>();
    const mockCommandOutputEvents = new Event<(command: string, originName: string) => void>();
    const mockExecuteCommandOnConsole = (command: string): void => {
        console.log(command);
    };

    afterAll(async () => {
        setTimeout(async () => {
            await BackupUtils.removeDirectory("backups");
        }, 0);
    });

    const createBackupManager = (bds: typeof bedrockServer, testOnly?: boolean, tempName?: string): BackupManager => {
        return new BackupManager(bds, testOnly, tempName);
    };

    const createMock = (): IMock<typeof bedrockServer> => {
        const bedrockServerStub = ({
            bedrockLog: mockBedrockLogEvents,
            commandOutput: mockCommandOutputEvents,
            executeCommandOnConsole: mockExecuteCommandOnConsole,
        } as unknown) as typeof bedrockServer;

        return new Mock<typeof bedrockServer>().setup(() => It.IsAny()).mimics(bedrockServerStub);
    };

    test("Can init", async () => {
        const mock = createMock();
        const backupManager = createBackupManager(mock.object(), true);
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: false });
        mock.verify((instance) => instance.executeCommandOnConsole(It.IsAny<string>()), Times.Never());
    });

    test("Backup is skipped if no activity with skipIfNoActivity=true", async () => {
        const mock = createMock();
        const backupManager = createBackupManager(mock.object(), true);
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: true });
        await backupManager.backup();
        mock.verify((instance) => instance.executeCommandOnConsole(It.IsAny<string>()), Times.Never());
    });

    test("Backup does not run when user connects with backupOnPlayerConnected=false and backupOnPlayerDisconnected=false", async () => {
        const mock = createMock();
        const backupManager = createBackupManager(mock.object(), true);
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: true, backupOnPlayerConnected: false, backupOnPlayerDisconnected: false });

        mockBedrockLogEvents.fire("Player connected", "test");
        mockBedrockLogEvents.fire("Player disconnected", "test");
        mock.verify((instance) => instance.executeCommandOnConsole(It.IsAny<string>()), Times.Never());
    });

    test("Backup runs when player connects with backupOnPlayerConnected=true", async () => {
        const mock = createMock();
        const backupManager = createBackupManager(mock.object(), true);
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: true, backupOnPlayerConnected: true });
        mockBedrockLogEvents.fire("Player connected", "test");
        mock.verify((instance) => instance.executeCommandOnConsole("save hold"), Times.Once());
    });

    test("Backup run when user connects with backupOnPlayerConnected=false and backupOnPlayerDisconnected=true", async () => {
        const mock = createMock();
        const backupManager = createBackupManager(mock.object(), true);
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: true, backupOnPlayerConnected: false, backupOnPlayerDisconnected: true });
        mockBedrockLogEvents.fire("Player connected", "test");
        mockBedrockLogEvents.fire("Player disconnected", "test");
        mock.verify((instance) => instance.executeCommandOnConsole("save hold"), Times.Once());
    });

    test("Backup runs next backup after play connects or disconnects", async () => {
        const mock = createMock();
        const backupManager = createBackupManager(mock.object(), true);
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: true, backupOnPlayerConnected: true, backupOnPlayerDisconnected: true });

        mockBedrockLogEvents.fire("Player connected", "test");
        mock.verify((instance) => instance.executeCommandOnConsole("save hold"), Times.Once());

        mockBedrockLogEvents.fire("Player disconnected", "test");
        mock.verify((instance) => instance.executeCommandOnConsole("save hold"), Times.Exactly(2));
    });

    test("Can run a backup on start", async () => {
        const mock = createMock();
        const backupManager = createBackupManager(mock.object(), true);
        await backupManager.init({ backupOnStart: true });
        mock.verify((instance) => instance.executeCommandOnConsole("save hold"), Times.Once());
    });

    test("Backup always runs with skipIfNoActivity=false", async () => {
        const mock = createMock();
        const backupManager = createBackupManager(mock.object(), true);
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: false });
        await backupManager.backup();
        mock.verify((instance) => instance.executeCommandOnConsole("save hold"), Times.Once());
    });

    test("Backup manager responds to events", async () => {
        jest.setTimeout(10000);
        jest.useFakeTimers();
        const mock = createMock();
        const backupManager = createBackupManager(mock.object(), false, "testing");
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: false, backupOnPlayerConnected: true });
        mockBedrockLogEvents.fire("Player connected", "test");

        mock.verify((instance) => instance.executeCommandOnConsole("save hold"), Times.Once());
        mockCommandOutputEvents.fire("Saving...", "test");

        mock.verify((instance) => instance.executeCommandOnConsole("save query"), Times.Once());
        mockCommandOutputEvents.fire("Data saved. Files are now ready to be copied., WorldName123/test.txt:6", "test");

        // eslint-disable-next-line prettier/prettier
        mock.verify((instance) => instance.executeCommandOnConsole("tellraw @a {\"rawtext\": [{\"text\": \"§lBackup\"},{\"text\": \"§r Starting...\"}]}"), Times.Once());

        await waitForExpect(() => {
            mock.verify((instance) => instance.executeCommandOnConsole("save resume"), Times.Once());
        });

        jest.runAllTimers();
        await waitForExpect(() => {
            // eslint-disable-next-line prettier/prettier
            mock.verify((instance) => instance.executeCommandOnConsole("tellraw @a {\"rawtext\": [{\"text\": \"§lBackup\"},{\"text\": \"§r Finished!\"}]}"), Times.Once());
        }, 2500);

        const testFile = await extractFromZip("backups/testing_WorldName123.zip", "backups/test.txt");
        expect(testFile).toHaveLength(6);
        jest.useRealTimers();
    });

    test("Backup runs at set intervals", async () => {
        const mock = createMock();
        const backupManager = createBackupManager(mock.object(), true);
        jest.useFakeTimers();
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: false, interval: 1 });

        for (let i = 0; i < 10; i++) {
            jest.runOnlyPendingTimers();
        }

        mock.verify((instance) => instance.executeCommandOnConsole("save hold"), Times.Exactly(10));
        jest.useRealTimers();
    });

    async function extractFromZip(path: string, fileName: string) {
        unzipper.Open.file(path).then((d) => d.extract({ path: "backups", concurrency: 5 }));
        return await BackupUtils.readFile(fileName);
    }
});

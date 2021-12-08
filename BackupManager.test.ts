import { NetworkIdentifier } from "bdsx/bds/networkidentifier";
import { ServerPlayer } from "bdsx/bds/player";
import { events } from "bdsx/event";
import { PlayerJoinEvent } from "bdsx/event_impl/entityevent";
import { bedrockServer } from "bdsx/launcher";
import Event from "krevent";
import { Mock, It, Times, IMock } from "moq.ts";
import * as unzipper from "unzipper";
import waitForExpect from "wait-for-expect";

import { BackupManager } from "./BackupManager";
import { BackupUtils } from "./BackupUtils";

describe("BackupManager", () => {
    const mockBedrockLogEvents = new Event<(log: string, color: any) => void>();
    const mockCommandOutputEvents = new Event<(command: string, originName: string) => void>();
    const mockPlayerJoin = new Event<(event: PlayerJoinEvent) => void>();
    const mockNetworkDisconnected = new Event<(ni: NetworkIdentifier) => void>();
    const mockExecuteCommandOnConsole = (command: string): void => {
        console.log(command);
    };

    afterAll(async () => {
        setTimeout(async () => {
            await BackupUtils.removeDirectory("backups");
        }, 0);
    });

    const createBackupManager = (bds: typeof bedrockServer, evt: typeof events, testOnly?: boolean, tempName?: string): BackupManager => {
        return new BackupManager(bds, evt, testOnly, tempName);
    };

    const createBdsMock = (): IMock<typeof bedrockServer> => {
        const stub = ({
            executeCommandOnConsole: mockExecuteCommandOnConsole,
        } as unknown) as typeof bedrockServer;
        return new Mock<typeof bedrockServer>().setup(() => It.IsAny()).mimics(stub);
    };

    const createEvtMock = (): IMock<typeof events> => {
        const stub = ({
            commandOutput: mockCommandOutputEvents,
            playerJoin: mockPlayerJoin,
            networkDisconnected: mockNetworkDisconnected,
        } as unknown) as typeof events;
        return new Mock<typeof events>().setup(() => It.IsAny()).mimics(stub);
    };

    const firePlayerJoinEvent = () => {
        mockPlayerJoin.fire(new PlayerJoinEvent(new ServerPlayer()));
    };

    const fireDisconnectedEvent = () => {
        mockNetworkDisconnected.fire(new NetworkIdentifier());
    };

    test("Can init", async () => {
        const bdsMock = createBdsMock();
        const evtMock = createEvtMock();
        const backupManager = createBackupManager(bdsMock.object(), evtMock.object(), true);
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: false });
        bdsMock.verify((instance) => instance.executeCommandOnConsole(It.IsAny<string>()), Times.Never());
    });

    test("Backup is skipped if no activity with skipIfNoActivity=true", async () => {
        const bdsMock = createBdsMock();
        const evtMock = createEvtMock();
        const backupManager = createBackupManager(bdsMock.object(), evtMock.object(), true);
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: true });
        await backupManager.backup();
        bdsMock.verify((instance) => instance.executeCommandOnConsole(It.IsAny<string>()), Times.Never());
    });

    test("Backup does not run when user connects with backupOnPlayerConnected=false and backupOnPlayerDisconnected=false", async () => {
        const bdsMock = createBdsMock();
        const evtMock = createEvtMock();
        const backupManager = createBackupManager(bdsMock.object(), evtMock.object(), true);
        await backupManager.init({
            backupOnStart: false,
            skipIfNoActivity: true,
            backupOnPlayerConnected: false,
            backupOnPlayerDisconnected: false,
        });

        mockBedrockLogEvents.fire("Player connected", "test");
        mockBedrockLogEvents.fire("Player disconnected", "test");
        bdsMock.verify((instance) => instance.executeCommandOnConsole(It.IsAny<string>()), Times.Never());
    });

    test("Backup runs when player connects with backupOnPlayerConnected=true", async () => {
        const bdsMock = createBdsMock();
        const evtMock = createEvtMock();
        const backupManager = createBackupManager(bdsMock.object(), evtMock.object(), true);
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: true, backupOnPlayerConnected: true });
        firePlayerJoinEvent();
        bdsMock.verify((instance) => instance.executeCommandOnConsole("save hold"), Times.Once());
    });

    test("Backup run when user connects with backupOnPlayerConnected=false and backupOnPlayerDisconnected=true", async () => {
        const bdsMock = createBdsMock();
        const evtMock = createEvtMock();
        const backupManager = createBackupManager(bdsMock.object(), evtMock.object(), true);
        await backupManager.init({
            backupOnStart: false,
            skipIfNoActivity: true,
            backupOnPlayerConnected: false,
            backupOnPlayerDisconnected: true,
        });
        firePlayerJoinEvent();
        fireDisconnectedEvent();
        bdsMock.verify((instance) => instance.executeCommandOnConsole("save hold"), Times.Once());
    });

    test("Backup runs next backup after play connects or disconnects", async () => {
        const bdsMock = createBdsMock();
        const evtMock = createEvtMock();
        const backupManager = createBackupManager(bdsMock.object(), evtMock.object(), true);
        await backupManager.init({
            backupOnStart: false,
            skipIfNoActivity: true,
            backupOnPlayerConnected: true,
            backupOnPlayerDisconnected: true,
        });

        firePlayerJoinEvent();
        bdsMock.verify((instance) => instance.executeCommandOnConsole("save hold"), Times.Once());

        fireDisconnectedEvent();
        bdsMock.verify((instance) => instance.executeCommandOnConsole("save hold"), Times.Exactly(2));
    });

    test("Can run a backup on start", async () => {
        const bdsMock = createBdsMock();
        const evtMock = createEvtMock();
        const backupManager = createBackupManager(bdsMock.object(), evtMock.object(), true);
        await backupManager.init({ backupOnStart: true });
        bdsMock.verify((instance) => instance.executeCommandOnConsole("save hold"), Times.Once());
    });

    test("Backup resets and tries again if backup fails", async () => {
        jest.useFakeTimers();
        const bdsMock = createBdsMock();
        const evtMock = createEvtMock();
        const backupManager = createBackupManager(bdsMock.object(), evtMock.object(), true);
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: true });
        mockCommandOutputEvents.fire("The command is already running", "test");
        jest.runOnlyPendingTimers();
        bdsMock.verify((instance) => instance.executeCommandOnConsole("save resume"), Times.Once());
        jest.useRealTimers();
        backupManager.backup();
        bdsMock.verify((instance) => instance.executeCommandOnConsole("save hold"), Times.Once());
    });

    test("Backup always runs with skipIfNoActivity=false", async () => {
        const bdsMock = createBdsMock();
        const evtMock = createEvtMock();
        const backupManager = createBackupManager(bdsMock.object(), evtMock.object(), true);
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: false });
        await backupManager.backup();
        bdsMock.verify((instance) => instance.executeCommandOnConsole("save hold"), Times.Once());
    });

    test("Backup manager responds to events", async () => {
        jest.setTimeout(10000);
        jest.useFakeTimers();
        const bdsMock = createBdsMock();
        const evtMock = createEvtMock();
        const backupManager = createBackupManager(bdsMock.object(), evtMock.object(), false, "testing");
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: false, backupOnPlayerConnected: true, bedrockServerPath: "./bedrock_server" });
        firePlayerJoinEvent();

        bdsMock.verify((instance) => instance.executeCommandOnConsole("save hold"), Times.Once());
        mockCommandOutputEvents.fire("Saving...", "test");

        bdsMock.verify((instance) => instance.executeCommandOnConsole("save query"), Times.Once());
        mockCommandOutputEvents.fire("Data saved. Files are now ready to be copied., WorldName123/test.txt:6", "test");

        // eslint-disable-next-line prettier/prettier
        bdsMock.verify((instance) => instance.executeCommandOnConsole("tellraw @a {\"rawtext\": [{\"text\": \"§lBackup\"},{\"text\": \"§r Starting...\"}]}"), Times.Once());

        await waitForExpect(() => {
            bdsMock.verify((instance) => instance.executeCommandOnConsole("save resume"), Times.Once());
        });

        jest.runAllTimers();
        await waitForExpect(() => {
            // eslint-disable-next-line prettier/prettier
            bdsMock.verify((instance) => instance.executeCommandOnConsole("tellraw @a {\"rawtext\": [{\"text\": \"§lBackup\"},{\"text\": \"§r Finished!\"}]}"), Times.Once());
        }, 2500);

        const testFile = await extractFromZip("bedrock_server/backups/testing_WorldName123.zip", "bedrock_server/backups/test.txt");
        expect(testFile).toHaveLength(6);
        jest.useRealTimers();
    });

    test("Backup runs at set intervals", async () => {
        const bdsMock = createBdsMock();
        const evtMock = createEvtMock();
        const backupManager = createBackupManager(bdsMock.object(), evtMock.object(), true);
        jest.useFakeTimers();
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: false, interval: 1 });

        for (let i = 0; i < 10; i++) {
            jest.runOnlyPendingTimers();
        }

        bdsMock.verify((instance) => instance.executeCommandOnConsole("save hold"), Times.Exactly(10));
        jest.useRealTimers();
    });

    async function extractFromZip(path: string, fileName: string) {
        unzipper.Open.file(path).then((d) => d.extract({ path: "backups", concurrency: 5 }));
        return await BackupUtils.readFile(fileName);
    }
});

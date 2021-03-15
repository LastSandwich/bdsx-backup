import Event from "krevent";
const mockCommandOutputEvents = new Event<(command: string, originName: string) => void>();
const mockBedrockLogEvents = new Event<(command: string, originName: string) => void>();

import BackupManager from "../BackupManager";
import { bedrockServer } from "bdsx/launcher";
import { command } from "bdsx/index";
import { mocked } from "ts-jest/utils";
import BackupUtils from "../BackupUtils";

jest.mock("bdsx/launcher", () => {
    return {
        bedrockServer: {
            commandOutput: mockCommandOutputEvents,
            bedrockLog: mockBedrockLogEvents,
            executeCommandOnConsole: jest.fn<string, [void]>(),
        },
    };
});

jest.mock("bdsx/index", () => {
    return {
        command: {
            hook: {
                on: jest.fn(),
            },
        },
    };
});

describe("BackupManager", () => {
    afterAll(async () => {
        await BackupUtils.removeDirectory("backups");
    })

    const bedrockServerMock = mocked(bedrockServer);
    const commandMock = mocked(command);

    test("Can init", async () => {
        const backupManager = new BackupManager(true);
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: false });
        expect(bedrockServerMock.executeCommandOnConsole).not.toBeCalled();
    });

    test("Backup is skipped if no activity with skipIfNoActivity=true", async () => {
        const backupManager = new BackupManager(true);
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: true });
        await backupManager.backup();
        expect(bedrockServerMock.executeCommandOnConsole).not.toBeCalled();
    });

    test("Can run a backup on start ", async () => {
        const backupManager = new BackupManager(true);
        await backupManager.init({ backupOnStart: true });
        expect(bedrockServerMock.executeCommandOnConsole).toHaveBeenCalledWith("save hold");
    });

    test("Backup always runs with skipIfNoActivity=false", async () => {
        const backupManager = new BackupManager(true);
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: false });
        await backupManager.backup();
        expect(bedrockServerMock.executeCommandOnConsole).toHaveBeenCalledWith("save hold");
    });

    test("Backup runs if runNextBackup=true AND skipIfNoActivity=true", async () => {
        const backupManager = new BackupManager(true);
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: true });
        backupManager.runNext();
        await backupManager.backup();
        expect(bedrockServerMock.executeCommandOnConsole).toHaveBeenCalledWith("save hold");
    });

    test("Backup runs if backupOnPlayerConnected=true when player connects", async () => {
        const backupManager = new BackupManager(true);
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: true, backupOnPlayerConnected: true });
        mockBedrockLogEvents.fire("Player connected", "test");
        expect(bedrockServerMock.executeCommandOnConsole).toHaveBeenCalledWith("save hold");
    });

    test("Backup manager responds to events", async () => {
        const backupManager = new BackupManager();
        await backupManager.init({ backupOnStart: false, skipIfNoActivity: false });
        await backupManager.backup();

        expect(bedrockServerMock.executeCommandOnConsole).toHaveBeenCalledWith("save hold");
        mockCommandOutputEvents.fire("Saving...", "test");

        expect(bedrockServerMock.executeCommandOnConsole).toHaveBeenCalledWith("save query");
        mockCommandOutputEvents.fire("Data saved. Files are now ready to be copied., WorldName123/test.txt:6", "test");

        await new Promise((r) => setTimeout(r, 500));
        jest.useFakeTimers();
        jest.runAllTimers();
        expect(bedrockServerMock.executeCommandOnConsole).toHaveBeenCalledWith("save resume");
    });
});

import { BackupUtils } from "./BackupUtils";

describe("Backup Utils", () => {
    const handleError = () => {
        // no action
    };

    test("Can get world name from server.properties", async () => {
        const worldName = await BackupUtils.getWorldName("./bedrock_server");
        expect(worldName).toBe("WorldName123");
    });

    test("Can create temp directory and cleanup", async () => {
        const tempDirectory = await BackupUtils.createTempDirectory("test123", handleError);
        expect(tempDirectory).toContain("temp/");

        await BackupUtils.removeDirectory("temp");
        const tempExists = await BackupUtils.directoryExists("temp");
        expect(tempExists).toBeFalsy();
    });
});

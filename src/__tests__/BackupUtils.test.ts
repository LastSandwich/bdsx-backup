import BackupUtils from "../BackupUtils";

it("Can get world name from server.properties", async () => {
    const worldName = await BackupUtils.getWorldName();
    expect(worldName).toBe("WorldName123");
});

it("Can create temp directory and cleanup", async() => {
    const handleError = () => {};
    const tempDirectory = await BackupUtils.createTempDirectory("test123", handleError);
    expect(tempDirectory).toContain("temp/");

    await BackupUtils.removeDirectory("temp");
    const tempExists = await BackupUtils.directoryExists("temp");
    expect(tempExists).toBeFalsy();
});

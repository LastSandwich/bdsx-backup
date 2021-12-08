export enum CommandPermissionLevel {
    Normal,
    Operator,
    Host,
    Automation,
    Admin,
    Internal,
}

export enum CommandCheatFlag {
    Cheat,
    NotCheat = 0x40,
    /** @deprecated */
    NoCheat = 0x40,
    None = 0,
}

export enum CommandExecuteFlag {
    Allowed,
    Disallowed = 0x10,
}

export enum CommandSyncFlag {
    Synced,
    Local = 8,
}

export enum CommandTypeFlag {
    None,
    Message = 0x20,
}

export enum CommandUsageFlag {
    Normal,
    Test,
    /** @deprecated Use `CommandVisibilityFlag` */
    Hidden,
    _Unknown = 0x80,
}

/** Putting in flag1 or flag2 are both ok, you can also combine with other flags like CommandCheatFlag.NoCheat | CommandVisibilityFlag.HiddenFromCommandBlockOrigin but combining is actually not quite useful */
export enum CommandVisibilityFlag {
    Visible,
    /** Bug: Besides from being hidden from command blocks, players cannot see it also well, but they are still able to execute */
    HiddenFromCommandBlockOrigin = 2,
    HiddenFromPlayerOrigin = 4,
    /** Still visible to console */
    Hidden = 6,
}

/** @deprecated **/
export const CommandFlag = CommandCheatFlag; // CommandFlag is actually a class

export class MCRESULT {}

export enum CommandSelectionOrder {
    Sorted,
    InvertSorted,
    Random,
}

export enum CommandSelectionType {
    /** Used in @s */
    Self,
    /** Used in @e */
    Entities,
    /** Used in @a */
    Players,
    /** Used in @r */
    DefaultPlayers,
    /** Used in @c */
    OwnedAgent,
    /** Used in @v */
    Agents,
}

export class CommandContext {
    command: any;
    origin: any;
}

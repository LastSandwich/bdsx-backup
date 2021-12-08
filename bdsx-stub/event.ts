import Event from "krevent";

import { CommandContext } from "./bds/command";
import { NetworkIdentifier } from "./bds/networkidentifier";
import { CANCEL } from "./common";
import { PlayerJoinEvent } from "./event_impl/entityevent";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace events {
    export const playerJoin = new Event<(event: PlayerJoinEvent) => void>();
    export const commandOutput = new Event<(log: string) => CANCEL | void>();
    export const command = new Event<(command: string, originName: string, ctx: CommandContext) => void | number>();
    export const networkDisconnected = new Event<(ni: NetworkIdentifier) => void>();
}

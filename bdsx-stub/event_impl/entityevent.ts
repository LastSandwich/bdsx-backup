import { NetworkIdentifier } from "../bds/networkidentifier";
import { Player } from "../bds/player";
import { abstract } from "../common";

interface IPlayerJoinEvent {
    readonly player: Player;
}
export class PlayerJoinEvent implements IPlayerJoinEvent {
    constructor(readonly player: Player) {}

    public getNetworkIdentifier(): NetworkIdentifier {
        return abstract();
    }
}

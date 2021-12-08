import { Actor } from "./actor";
import { NetworkIdentifier } from "./networkidentifier";

export class Player extends Actor {}

export class ServerPlayer extends Player {
    getNetworkIdentifier(): NetworkIdentifier {
        return new NetworkIdentifier();
    }
}

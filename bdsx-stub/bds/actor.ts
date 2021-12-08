import { NetworkIdentifier } from "./networkidentifier";

export class Actor {
    public getNetworkIdentifier(): NetworkIdentifier {
        return new NetworkIdentifier();
    }
}

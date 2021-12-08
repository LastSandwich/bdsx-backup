import { ServerPlayer } from "./player";

export class NetworkHandler {}

export class NetworkIdentifier {
    public getActor(): ServerPlayer | null {
        return new ServerPlayer();
    }
}

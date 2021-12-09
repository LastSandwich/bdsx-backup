import { MCRESULT } from "./bds/command";
import { Dimension } from "./bds/dimension";

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace bedrockServer {
    export let sessionId: string;
    let launched = false;

    export function withLoading(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    export function afterOpen(): Promise<void> {
        return new Promise((resolve) => {
            resolve();
        });
    }

    export function isLaunched(): boolean {
        return launched;
    }

    export function launch(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (launched) {
                reject();
                return;
            }
            launched = true;
            resolve;
        });
    }

    export function executeCommandOnConsole(command: string): void {
        // this method is empty
    }

    export function executeCommand(command: string, mute = true, permissionLevel = 4, dimension: Dimension | null = null): MCRESULT {
        return {} as any;
    }
}

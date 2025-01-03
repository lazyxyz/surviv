import type { Eip1193Provider } from "ethers";
import { ethers } from "ethers";

export interface EIP6963ProviderInfo {
    uuid: string
    name: string
    icon: string
    rdns?: string
}

export interface Provider6963Props {
    accounts: string[]
    info: EIP6963ProviderInfo
    provider: ethers.BrowserProvider & Eip1193Provider
}

export class EIP6963 {
    providers: Provider6963Props[];
    provider: Provider6963Props | undefined;

    constructor() {
        this.providers = [];

        // default should be request to providers
        this.requestProvider();
    }

    selectorProvider(name: string): Provider6963Props | undefined {
        const getProvider = this.providers.find(argument => argument.info.name === name);

        if (!getProvider) {
            return;
        }

        this.provider = getProvider;

        return getProvider;
    }

    requestProvider(): void {
        window.addEventListener("eip6963:announceProvider", event => {
            const values = event["detail" as keyof Event] as unknown as Provider6963Props;

            this.providers.push(values);
        });

        window.dispatchEvent(new Event("eip6963:requestProvider"));
    }
}

import $ from "jquery";

import { PUBLIC_KEY, SELECTOR_WALLET, shorten } from "./utils/constants";
import { EIP6963, type Provider6963Props } from "./eip6963";

export class Account extends EIP6963 {
    address: string | null;
    chain: number | null;

    constructor() {
        super();

        this.address = null;
        this.chain = null;

        // update provider & event
        if (localStorage.getItem(SELECTOR_WALLET)?.length) {
            this.selectorProvider(String(localStorage.getItem(SELECTOR_WALLET)));

            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.eventListener();
        }

        if (this.provider?.provider && localStorage.getItem(PUBLIC_KEY)?.length) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.connect(this.provider);
        }
    }

    async eventListener(): Promise<void> {
        const getProvider = this.provider;

        if (!getProvider) {
            return this.disconnect(); // not found meaning you need login again
        }

        // handler account exactly
        {
            const accounts = await getProvider.provider.request({
                method: "eth_accounts"
            }) as string[];

            if (!accounts.length) {
                this.disconnect();
            } else {
                this.address = accounts[0];
            }
        }

        // handler emit
        {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            getProvider.provider.on("accountsChanged", (params: string[]) => {
                if (!params?.length) { return this.disconnect(); }

                this.address = params[0];

                $(".account-wallet-placeholder").text(shorten(params[0]));
            });

            // eslint-disable-next-line @stylistic/indent, @typescript-eslint/no-floating-promises
           getProvider.provider.on("chainChanged", (params: string) => {
                this.chain = parseInt(params);
            });
        }
    }

    disconnect(): void {
        // clear localStorage
        {
            localStorage.removeItem(PUBLIC_KEY);
            localStorage.removeItem(SELECTOR_WALLET);
        }

        // visible elements
        {
            $(".account-wallet-container").css("display", "none");
            $(".connect-wallet-portal").css("display", "block");
        }
    }

    async connect(getProvider: Provider6963Props): Promise<void> {
        const accounts = await getProvider.provider.request({
            method: "eth_requestAccounts"
        }) as string[];

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.eventListener();

        // update localstorage
        {
            localStorage.setItem(SELECTOR_WALLET, getProvider.info.name);
            localStorage.setItem(PUBLIC_KEY, accounts[0]);
        }

        // visible elements
        {
            $(".account-wallet-placeholder").text(shorten(accounts[0]));
            $(".connect-wallet-portal").css("display", "none");
            $(".account-wallet-container ").css("display", "block");
        }
    }

    requestProvider(): void {
        window.addEventListener("eip6963:announceProvider", event => {
            const values = event["detail" as keyof Event] as unknown as Provider6963Props;

            this.providers.push(values);
        });

        window.dispatchEvent(new Event("eip6963:requestProvider"));
    }
}

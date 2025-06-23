import $ from "jquery";

import { ACCESS_TOKEN, PUBLIC_KEY, SELECTOR_WALLET, shorten } from "./utils/constants";
import { EIP6963, type Provider6963Props } from "./eip6963";
import { ethers } from "ethers";
import { resetPlayButtons, type RegionInfo } from "./ui";
import { Config } from "./config";
import type { Game } from "./game";
import { visibleSkin } from "./skin";
import { visibleMeless } from "./weapons/weapons_meless";
import { visibleBadges } from "./badges";

const regionInfo: Record<string, RegionInfo> = Config.regions;
const selectedRegion = regionInfo[Config.defaultRegion];

export class Account extends EIP6963 {
    address: string | null | undefined;
    token: string | null | undefined;

    constructor() {
        super();

        const getAddressFromStorage = localStorage.getItem(PUBLIC_KEY);
        const getTokenFromStorage = localStorage.getItem(ACCESS_TOKEN);
        const getSelectorFromStorage = localStorage.getItem(SELECTOR_WALLET);

        if (getAddressFromStorage?.length) {
            this.address = getAddressFromStorage;

            // visible elements
            {
                $(".account-wallet-placeholder").text(shorten(getAddressFromStorage));
                $(".connect-wallet-portal").css("display", "none");
                $(".account-wallet-container ").css("display", "block");
            }
        }

        if (getTokenFromStorage?.length) {
            this.token = getTokenFromStorage;
        }

        if (getSelectorFromStorage?.length) {
            this.provider = this.providers?.find(argument => argument.info.name === getSelectorFromStorage);

            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.eventListener();
        }
    }

    disconnect(): void {
        // clear localStorage
        {
            localStorage.removeItem(ACCESS_TOKEN);
            localStorage.removeItem(PUBLIC_KEY);
            localStorage.removeItem(SELECTOR_WALLET);
        }

        // clear fields
        {
            this.address = null;
            this.token = null;
        }

        // visible elements
        {
            $(".account-wallet-container").css("display", "none");
            $(".connect-wallet-portal").css("display", "none");
            $("#connect-wallet-btn").css("display", "block");
        }

        // Check condition button
        {
            $("#buy-now-btn").on("click", () => {
                $(".connect-wallet-portal").css("display", "block");
            });
        }
    }

    async connect(getProvider: Provider6963Props, game: Game): Promise<void> {
        const accounts = await getProvider.provider.request({
            method: "eth_requestAccounts"
        }) as string[];

        const requestNonce: {
            nonce: string
            success: boolean
        } = await $.ajax({
            type: "GET",
            url: `${selectedRegion.apiAddress}/api/requestNonce`
        });

        const signature = await getProvider.provider.request({
            method: "personal_sign",
            params: [
                ethers.hexlify(ethers.toUtf8Bytes((requestNonce.nonce))),
                accounts[0]
            ]
        });

        // Send POST request to /api/verifySignature
        const response = await fetch(`${selectedRegion.apiAddress}/api/verifySignature`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                walletAddress: accounts[0],
                signature,
                nonce: requestNonce.nonce,
            }),
        });

        // Parse response
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Signature verification failed');
        }

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.eventListener();

        // call assets
        {
            this.address = accounts[0];
            await visibleSkin(game);
            await visibleMeless(game);
            await visibleBadges(game);
        }

        // update field
        {
            this.address = accounts[0];
            this.token = data.token;
            this.provider = getProvider;
        }

        // update localstorage
        {
            localStorage.setItem(PUBLIC_KEY, accounts[0]);
            localStorage.setItem(ACCESS_TOKEN, data.token);
            localStorage.setItem(SELECTOR_WALLET, getProvider.info.name);
        }

        // visible elements
        {
            $(".account-wallet-placeholder").text(shorten(accounts[0]));
            $(".connect-wallet-portal").css("display", "none");
            $(".account-wallet-container ").css("display", "block");
            $("#connect-wallet-btn").css("display", "none");

            resetPlayButtons();
        }
    }

    async eventListener(): Promise<void> {
        const getProvider = this.provider;

        if (!getProvider) {
            return this.disconnect(); // not found meaning you need login again
        }

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        getProvider.provider.on("accountsChanged", () => {
            return this.disconnect();
        });
    }

    sessionExpired(): void {
        $("#loading-text").text("Session expired. Please log in.");

        setTimeout(() => this.disconnect(), 1000);
    }

    requestProvider(): void {
        window.addEventListener("eip6963:announceProvider", event => {
            const values = event["detail" as keyof Event] as unknown as Provider6963Props;

            this.providers.push(values);
        });

        window.dispatchEvent(new Event("eip6963:requestProvider"));
    }
}

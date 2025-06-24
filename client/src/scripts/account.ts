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

import {
    SilverSkinsMapping,
    GoldSkinsMapping,
    DivineSkinsMapping,
    SilverArmsMapping,
    GoldArmsMapping,
    DivineArmsMapping,
    DivineGunsMapping,
    SurvivMemesMapping
} from "../../public/mapping";
import { abi as survivRewardsABI } from "./abi/SurvivRewards.json";

const regionInfo: Record<string, RegionInfo> = Config.regions;
const selectedRegion = regionInfo[Config.defaultRegion];

const SURVIV_REWARD_ADDRESS = "0x2B72c6b3EFb9f0c2644F1d0545943f01e16cA933";

// ERC1155 ABI for balanceOfBatch (used for SilverSkins)
const erc1155ABI = [
    "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])"
];

// const survivRewardsABI = [
//     "function claim(tuple(address to, uint256 tier, uint256 amount, bytes32 salt, uint256 expiry) crate, bytes signature)",
//     "function claimBatch(tuple(address to, uint256 tier, uint256 amount, bytes32 salt, uint256 expiry)[] crates, bytes[] signatures)"
// ]

export enum Assets {
    SilverSkins,
    GoldSkins,
    DivineSkins,
    SilverArms,
    GoldArms,
    DivineArms,
    DivineGuns,
    SurvivMemes
}

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
            $(".connect-wallet-portal").css("display", "block");
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

            resetPlayButtons();
        }

        await this.claimRewards();
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

    /**
 * Retrieves balances for a specific asset type, mapping token IDs to asset names.
 * @param assetType - The type of asset to query (e.g., SilverSkins, DivineArms).
 * @param pagination - Number of token IDs to query per page (default: 10).
 * @param page - The page number to query (default: 0, first page).
 * @param returnAll - If true, includes assets with zero balances; if false, only includes assets with balance > 0 (default: false).
 * @returns A promise resolving to an object mapping asset names to their balances.
 * @throws Error if the contract address is invalid or provider is unavailable.
 */
    async getBalances(assetType: Assets, pagination: number = 10, page: number = 0, returnAll: boolean = false): Promise<Record<string, number>> {
        const assetMappings = {
            [Assets.SilverSkins]: SilverSkinsMapping,
            [Assets.GoldSkins]: GoldSkinsMapping,
            [Assets.DivineSkins]: DivineSkinsMapping,
            [Assets.SilverArms]: SilverArmsMapping,
            [Assets.GoldArms]: GoldArmsMapping,
            [Assets.DivineArms]: DivineArmsMapping,
            [Assets.DivineGuns]: DivineGunsMapping,
            [Assets.SurvivMemes]: SurvivMemesMapping
        };

        const selectedMapping = assetMappings[assetType];

        if (!ethers.isAddress(selectedMapping.address)) {
            throw new Error(`Invalid contract address: ${selectedMapping.address}`);
        }

        if (!this.provider?.provider) {
            throw new Error("Provider not available");
        }

        const ethersProvider = new ethers.BrowserProvider(this.provider.provider);
        const signer = await ethersProvider.getSigner();
        const contract = new ethers.Contract(selectedMapping.address, erc1155ABI, signer);

        const maxTokenId = selectedMapping.assets.length;
        const startIndex = page * pagination;
        const endIndex = Math.min(startIndex + pagination, maxTokenId);
        const tokenIds = Array.from({ length: endIndex - startIndex }, (_, i) => startIndex + i);
        const accounts = Array(tokenIds.length).fill(this.address);

        const balances = await contract.balanceOfBatch(accounts, tokenIds);

        // Map token IDs to asset names with balances
        const result: Record<string, number> = {};
        for (let i = 0; i < tokenIds.length; i++) {
            const balance = Number(balances[i]); // Convert BigNumber to number
            if (returnAll || balance > 0) {
                const assetName = selectedMapping.assets[tokenIds[i]];
                if (assetName) {
                    result[assetName] = balance;
                }
            }
        }

        return result;
    }

    /**
 * Claims all available rewards (crates) for the authenticated user.
 * @returns A promise resolving to the API response.
 * @throws Error if the API request fails or authentication is invalid.
 */
    async claimRewards(): Promise<any> {
        const response = await fetch(`${selectedRegion.apiAddress}/api/getCrates`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`, // Add JWT token to Authorization header
            },
        });

        console.log("token: ", this.token);
        const data = await response.json();
        if (!data.success) {
            throw new Error("Crates not found!");
        }

        // Extract crates and signatures
        // Extract and format crates and signatures
        const crates = data.claims.map((claim: any) => ({
            to: claim.crate.to,
            tier: Number(claim.crate.tier),
            amount: Number(claim.crate.amount),
            salt: claim.crate.salt,
            expiry: Number(claim.crate.expiry),
        }));
        const signatures = data.claims.map((claim: any) => claim.signature);

        if (!this.provider?.provider) {
            throw new Error("Provider not available");
        }
        const ethersProvider = new ethers.BrowserProvider(this.provider.provider);
        const signer = await ethersProvider.getSigner();
        const contract = new ethers.Contract(SURVIV_REWARD_ADDRESS, survivRewardsABI, signer);
        try {

            // Send transaction
            const tx = await contract.claimBatch(crates, signatures);
            console.log("Transaction sent:", tx.hash);
            const receipt = await tx.wait();
            console.log("Transaction confirmed:", receipt);
            return receipt; // Return the transaction receipt
        } catch (error) {
            console.error("Error during claimBatch:", error);
            throw new Error(`Failed to claim rewards: ${error}`);
        }
    }

    /**
 * Requests to open a specified number of crates.
 * @param amount - The number of crates to request opening.
 * @returns A promise resolving to the API response.
 * @throws Error if the API request fails or authentication is invalid.
 */
    async requestOpenCrates(amount: number): Promise<any> {

    }

    /**
     * Claims all items from previously requested crate openings.
     * @returns A promise resolving to the API response.
     * @throws Error if the API request fails or authentication is invalid.
     */
    async claimItems(): Promise<any> {

    }

    /**
     * Purchases a specified item with a given payment token.
     * @param item - The name or ID of the item to purchase.
     * @param amount - The quantity of the item to purchase.
     * @param paymentToken - The token used for payment (e.g., ERC-20 token address or symbol).
     * @returns A promise resolving to the API response.
     * @throws Error if the API request fails, authentication is invalid, or payment fails.
     */
    async buyItems(item: string, amount: number, paymentToken: string): Promise<any> {

    }
}

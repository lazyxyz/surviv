import $ from "jquery";

import { ACCESS_TOKEN, PUBLIC_KEY, SELECTOR_WALLET, shorten } from "./utils/constants";
import { EIP6963, type Provider6963Props } from "./eip6963";
import { ethers, toBeHex } from "ethers";
import { resetPlayButtons, type RegionInfo } from "./ui";
import { Config } from "./config";

import {
    SilverSkinsMapping,
    GoldSkinsMapping,
    DivineSkinsMapping,
    SilverArmsMapping,
    GoldArmsMapping,
    DivineArmsMapping,
    DivineGunsMapping,
    SurvivMemesMapping,
    SurvivCratesMapping,
    SurvivKeysMapping,
    SurvivCardsMapping,
    SurvivMapping
} from "@common/mappings";

import { abi as survivRewardsABI } from "@common/abis/ISurvivRewards.json";
import { abi as crateBaseABI } from "@common/abis/ICrateBase.json";
import { abi as erc1155ABI } from "@common/abis/IERC1155.json";
import { abi as survivShopABI } from "@common/abis/ISurvivShop.json";

const regionInfo: Record<string, RegionInfo> = Config.regions;
const selectedRegion = regionInfo[Config.defaultRegion];

const CHAIN_ID = SurvivMapping.ChainId;
const SURVIV_REWARD_ADDRESS = SurvivMapping.SurvivRewards.address;
const SURVIV_BASE_ADDRESS = SurvivMapping.SurvivBase.address;
const SURVIV_SHOP_ADDRESS = SurvivMapping.SurvivShop.address;

export enum SurvivAssets {
    SilverSkins,
    GoldSkins,
    DivineSkins,
    SilverArms,
    GoldArms,
    DivineArms,
    DivineGuns,
    SurvivMemes,
    SurvivCrates,
    SurvivKeys,
    SurvivCard
}

export const SaleItems = {
    Crates: SurvivCratesMapping.address,
    Cards: SurvivCardsMapping.address,
    Keys: SurvivKeysMapping.address
} as const;

export const PaymentTokens = {
    NativeToken: SurvivMapping.NativeToken.address,
} as const;

/**
* Interface for crate data structure
*/
interface Crate {
    to: string;
    tier: number;
    amount: number;
    salt: string;
    expiry: number;
}

/**
 * Interface for API response
 */
interface ClaimResponse {
    success: boolean;
    claims: Array<{
        crate: Crate;
        signature: string;
    }>;
}

/**
 * Interface for valid rewards return type
 */
interface ValidRewards {
    validCrates: Crate[];
    validSignatures: string[];
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
                // $(".account-wallet-container ").css("display", "block");
                $("#wallet-active ").css("display", "block");
                $("#wallet-inactive").css("display", "none");
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

        // clear fields & delete assets
        {
            this.address = null;
            this.token = null;
        }

        // visible elements
        {
            $(".account-wallet-placeholder").text("Connect Wallet");
            $("#wallet-active").css("display", "none");
            $(".connect-wallet-portal").css("display", "none");
            $("#wallet-inactive").css("display", "block");
        }

        // Check condition button
    }

    async connect(getProvider: Provider6963Props): Promise<void> {
        // Check and switch network if necessary
        {
            const targetChainId = toBeHex(CHAIN_ID);
            const currentChainId = await getProvider.provider.request({
                method: "eth_chainId"
            }) as string;

            if (currentChainId !== targetChainId) {
                try {
                    // Attempt to switch to the target chain
                    await getProvider.provider.request({
                        method: "wallet_switchEthereumChain",
                        params: [{ chainId: targetChainId }]
                    });
                } catch (switchError: any) {
                    // If the chain is not added (e.g., error code 4902), add it
                    if (switchError.code === 4902) {
                        try {
                            await getProvider.provider.request({
                                method: "wallet_addEthereumChain",
                                params: [{
                                    chainId: targetChainId,
                                    chainName: "Somnia Testnet",
                                    rpcUrls: ["https://dream-rpc.somnia.network/"],
                                    nativeCurrency: {
                                        name: "Somnia Testnet Token",
                                        symbol: "STT",
                                        decimals: 18
                                    },
                                    blockExplorerUrls: ["https://shannon-explorer.somnia.network/"]
                                }]
                            });
                        } catch (addError) {
                            console.error(`Failed to add network: ${addError}`);
                            // throw new Error("Failed to add the Somnia Testnet. Please add it manually in your wallet.");
                        }
                    } else {
                        console.error(`Failed to switch network: ${switchError}`);
                        throw new Error("Failed to switch to the Somnia Testnet. Please switch networks in your wallet.");
                    }
                }
            }
        }

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

        // Update field
        {
            this.address = accounts[0];
            this.token = data.token;
            this.provider = getProvider;
        }

        // Update localStorage
        {
            localStorage.setItem(PUBLIC_KEY, accounts[0]);
            localStorage.setItem(ACCESS_TOKEN, data.token);
            localStorage.setItem(SELECTOR_WALLET, getProvider.info.name);
        }

        // Visible elements
        {
            $(".account-wallet-placeholder").text(shorten(accounts[0]));
            $(".connect-wallet-portal").css("display", "none");
            $("#wallet-active").css("display", "block");
            $("#wallet-inactive").css("display", "none");
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

    /**
 * Retrieves balances for a specific asset type, mapping token IDs to asset names.
 * @param assetType - The type of asset to query (e.g., SilverSkins, DivineArms).
 * @param returnAll - If true, includes assets with zero balances; if false, only includes assets with balance > 0 (default: false).
 * @returns A promise resolving to an object mapping asset names to their balances.
 * @throws Error if the contract address is invalid or provider is unavailable.
 */
    async getBalances(assetType: SurvivAssets, returnAll: boolean = false): Promise<Record<string, number>> {
        const assetMappings = {
            [SurvivAssets.SilverSkins]: SilverSkinsMapping,
            [SurvivAssets.GoldSkins]: GoldSkinsMapping,
            [SurvivAssets.DivineSkins]: DivineSkinsMapping,
            [SurvivAssets.SilverArms]: SilverArmsMapping,
            [SurvivAssets.GoldArms]: GoldArmsMapping,
            [SurvivAssets.DivineArms]: DivineArmsMapping,
            [SurvivAssets.DivineGuns]: DivineGunsMapping,
            [SurvivAssets.SurvivMemes]: SurvivMemesMapping,
            [SurvivAssets.SurvivCrates]: SurvivCratesMapping,
            [SurvivAssets.SurvivKeys]: SurvivKeysMapping,
            [SurvivAssets.SurvivCard]: SurvivCardsMapping,
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

        const tokenIds = Array.from({ length: selectedMapping.assets.length }, (_, i) => i);
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
     * @returns A promise resolving to the transaction receipt.
     * @throws Error if the API request fails, authentication is invalid, or transaction fails.
     */
    async claimRewards(): Promise<any> {
        if (!this.token) {
            throw new Error('Authentication token is missing');
        }

        if (!this.provider?.provider) {
            throw new Error('Web3 provider not initialized');
        }

        // Set fetch timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const { validCrates, validSignatures } = await this.getValidRewards();

            if (!validCrates.length || !validSignatures.length) {
                throw new Error('No valid crates available');
            }

            // Initialize contract
            const ethersProvider = new ethers.BrowserProvider(this.provider.provider);
            const signer = await ethersProvider.getSigner();
            const contract = new ethers.Contract(SURVIV_REWARD_ADDRESS, survivRewardsABI, signer);

            // Execute claim transaction
            const tx = await contract.claimBatch(validCrates, validSignatures);
            console.info('Transaction sent:', tx.hash);
            const receipt = await tx.wait();
            console.info('Transaction confirmed:', receipt);

            clearTimeout(timeoutId);
            return receipt;
        } catch (error: any) {
            clearTimeout(timeoutId);
            throw new Error(`${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Fetches and validates available rewards for the authenticated user.
     * @returns A promise resolving to valid crates and signatures.
     * @throws Error if the API request fails or no valid rewards are found.
     */
    async getValidRewards(): Promise<ValidRewards> {
        if (!this.token) {
            throw new Error('Authentication token is missing');
        }

        if (!this.provider?.provider) {
            throw new Error('Web3 provider not initialized');
        }

        // Set fetch timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            // Fetch available crates
            const response = await fetch(`${selectedRegion.apiAddress}/api/getCrates`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const data: ClaimResponse = await response.json();

            if (!data.success || !data.claims?.length) {
                throw new Error('No valid crates found');
            }

            // Validate and format claims
            const crates: Crate[] = [];
            const signatures: string[] = [];

            for (const claim of data.claims) {
                if (!claim.crate?.to || !ethers.isAddress(claim.crate.to) ||
                    !Number.isInteger(claim.crate.tier) || !Number.isInteger(claim.crate.amount) ||
                    !claim.crate.salt || !Number.isInteger(claim.crate.expiry) || !claim.signature) {
                    console.warn('Invalid claim data, skipping:', claim);
                    continue;
                }
                crates.push({
                    to: claim.crate.to,
                    tier: Number(claim.crate.tier),
                    amount: Number(claim.crate.amount),
                    salt: claim.crate.salt,
                    expiry: Number(claim.crate.expiry),
                });
                signatures.push(claim.signature);
            }

            // Initialize contract
            const ethersProvider = new ethers.BrowserProvider(this.provider.provider);
            const signer = await ethersProvider.getSigner();
            const contract = new ethers.Contract(SURVIV_REWARD_ADDRESS, survivRewardsABI, signer);

            // Filter out used signatures
            const validIndices: number[] = [];
            for (let i = 0; i < signatures.length; i++) {
                try {
                    const isUsed = await contract.isUsedSignature(signatures[i]);
                    if (!isUsed) {
                        validIndices.push(i);
                    }
                } catch (error) {
                    console.warn(`Failed to check signature ${signatures[i]}:`, error);
                }
            }

            const validCrates = validIndices.map(i => crates[i]);
            const validSignatures = validIndices.map(i => signatures[i]);

            // Remove invalid rewards
            if (validIndices.length < signatures.length) {
                const invalidSignatures = signatures.filter((_, i) => !validIndices.includes(i));
                await this.removeRewards(invalidSignatures);
            }

            return { validCrates, validSignatures };
        } catch (error: any) {
            clearTimeout(timeoutId);
            throw new Error(`Failed to get valid rewards: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Updates reward signatures by removing specified signatures or all signatures for the user if none provided.
     * @param signatures Optional array of signatures to remove
     * @returns Promise resolving when the operation is complete
     */
    private async removeRewards(signatures?: string[]): Promise<void> {
        if (!this.token) {
            throw new Error('Authentication token is missing');
        }

        // Set fetch timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const body = signatures?.length ? { signatures } : {};
            const response = await fetch(`${selectedRegion.apiAddress}/api/removeCrates`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            const data = await response.json();
            if (!data.success) {
                console.warn('Failed to update reward signatures:', data.error);
                throw new Error(`Failed to update signatures: ${data.error}`);
            }
            console.info(`Successfully updated ${signatures?.length || 'all'} signatures`);
        } catch (error: any) {
            clearTimeout(timeoutId);
            throw new Error(`Failed to update signatures: ${error.message || 'Unknown error'}`);
        }
    }

    /**
 * Requests to open a specified number of crates.
 * @param amount - The number of crates to request opening.
 * @returns A promise resolving to the API response.
 * @throws Error if the API request fails or authentication is invalid.
 */
    async requestOpenCrates(amount: number): Promise<any> {
        if (!this.provider?.provider) {
            throw new Error('Web3 provider not initialized');
        }

        // Set fetch timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            // Initialize contract
            const ethersProvider = new ethers.BrowserProvider(this.provider.provider);
            const signer = await ethersProvider.getSigner();

            const crateBaseContract = new ethers.Contract(SURVIV_BASE_ADDRESS, crateBaseABI, signer);
            const cratesContract = new ethers.Contract(SurvivCratesMapping.address, erc1155ABI, signer);

            const balance = await cratesContract.balanceOf(signer.address, 0);

            if (Number(balance) >= amount) {
                // Execute claim transaction
                const tx = await crateBaseContract.commitCrates(0, amount);
                console.info('Transaction sent:', tx.hash);
                const receipt = await tx.wait();
                console.info('Transaction confirmed:', receipt);
                clearTimeout(timeoutId);
                return receipt;
            } else {
                throw new Error(`Insufficient crates balance: ${balance}`);
            }

        } catch (error: any) {
            clearTimeout(timeoutId);
            throw new Error(`Failed to claim rewards: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Claims all items from previously requested crate openings.
     * @returns A promise resolving to the API response.
     * @throws Error if the API request fails or authentication is invalid.
     */
    async claimItems(): Promise<any> {
        if (!this.provider?.provider) {
            throw new Error('Web3 provider not initialized');
        }

        // Set fetch timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            // Initialize contract
            const ethersProvider = new ethers.BrowserProvider(this.provider.provider);
            const signer = await ethersProvider.getSigner();

            const crateBaseContract = new ethers.Contract(SURVIV_BASE_ADDRESS, crateBaseABI, signer);
            const remainingCommits = await crateBaseContract.getCommits(signer.address);

            if (remainingCommits.length > 0n) {
                // Execute claim transaction
                const tx = await crateBaseContract.openCratesBatch();
                console.info('Transaction sent:', tx.hash);
                const receipt = await tx.wait();
                console.info('Transaction confirmed:', receipt);
                clearTimeout(timeoutId);
                return receipt;
            } else {
                throw new Error(`No requests available`);
            }


        } catch (error: any) {
            clearTimeout(timeoutId);
            throw new Error(`Failed to claim rewards: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Purchases a specified item with a given payment token.
     * @param item - The ID of the item to purchase.
     * @param amount - The quantity of the item to purchase.
     * @param paymentToken - Token payment ID.
     * @returns A promise resolving to the API response.
     * @throws Error if the API request fails, authentication is invalid, or payment fails.
     */
    async buyItems(item: (typeof SaleItems)[keyof typeof SaleItems], amount: number, paymentToken: (typeof PaymentTokens)[keyof typeof PaymentTokens]): Promise<any> {
        if (!this.provider?.provider) {
            throw new Error('Web3 provider not initialized');
        }

        // Set fetch timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            // Initialize contract
            const ethersProvider = new ethers.BrowserProvider(this.provider.provider);
            const signer = await ethersProvider.getSigner();

            const survivShopContract = new ethers.Contract(SURVIV_SHOP_ADDRESS, survivShopABI, signer);
            const price = await survivShopContract.getPrice(paymentToken, item);
            const totalCost = price * BigInt(amount);

            if (paymentToken == PaymentTokens.NativeToken) {
                const tx = await survivShopContract.buyItems(item, amount, paymentToken, { value: totalCost });
                console.info('Transaction sent:', tx.hash);
                const receipt = await tx.wait();
                console.info('Transaction confirmed:', receipt);
                clearTimeout(timeoutId);
                return receipt;
            } else {
                throw new Error('Not supported yet.');
            }

        } catch (error: any) {
            clearTimeout(timeoutId);
            throw new Error(`Failed to claim rewards: ${error.message || 'Unknown error'}`);
        }
    }

    async queryPrice(item: (typeof SaleItems)[keyof typeof SaleItems], paymentToken: (typeof PaymentTokens)[keyof typeof PaymentTokens]): Promise<any> {
        if (!this.provider?.provider) {
            throw new Error('Web3 provider not initialized');
        }

        // Set fetch timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            // Initialize contract
            const ethersProvider = new ethers.BrowserProvider(this.provider.provider);
            const signer = await ethersProvider.getSigner();

            const survivShopContract = new ethers.Contract(SURVIV_SHOP_ADDRESS, survivShopABI, signer);
            const price = await survivShopContract.getPrice(paymentToken, item);
            clearTimeout(timeoutId);
            return price;
        } catch (error: any) {
            clearTimeout(timeoutId);
            throw new Error(`Failed to query price: ${error.message || 'Unknown error'}`);
        }
    }

    async getCommits(): Promise<any> {
        if (!this.provider?.provider) {
            throw new Error('Web3 provider not initialized');
        }

        // Set fetch timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            // Initialize contract
            const ethersProvider = new ethers.BrowserProvider(this.provider.provider);
            const signer = await ethersProvider.getSigner();

            const crateBaseContract = new ethers.Contract(SURVIV_BASE_ADDRESS, crateBaseABI, signer);
            const remainingCommits = await crateBaseContract.getCommits(signer.address);
            return remainingCommits;
        } catch (error: any) {
            clearTimeout(timeoutId);
            throw new Error(`Failed to request get commits: ${error.message || 'Unknown error'}`);
        }
    }
}

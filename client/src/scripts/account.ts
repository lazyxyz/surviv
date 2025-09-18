import $, { error } from "jquery";

import { ACCESS_TOKEN, PUBLIC_KEY, SELECTOR_WALLET, SESSION_WALLETCONNECT, shorten, WalletType } from "./utils/constants";
import { EIP6963, type Provider6963Props } from "./eip6963";
import { ethers, toBeHex } from "ethers";

import {
    SurvivAssetsMapping,
    SurvivKitsMapping,
    SurvivBadgesMapping,
    SurvivMapping,
    SurvivAssets,
    SurvivAssetRanges,
    AssetTier
} from "@common/mappings";

import { abi as survivRewardsABI } from "@common/abis/ISurvivRewards.json";
import { abi as crateBaseABI } from "@common/abis/ICrateBase.json";
import { abi as erc1155ABI } from "@common/abis/IERC1155.json";
import { abi as survivShopABI } from "@common/abis/ISurvivShop.json";
import { abi as survivShopV2ABI } from "@common/abis/ISurvivShopV2.json";
import { abi as seasonRewardsABI } from "@common/abis/INFTDistribution.json";
import { errorAlert, warningAlert } from "./modal";
import { resetPlayButtons } from "./ui/home";
import { ChainConfig } from "../config";
import { getWalletConnectInfo, getWalletConnectInit } from "./wallet/walletConnect";
import type { EthereumProviderOptions } from "@walletconnect/ethereum-provider";

const SURVIV_REWARD_ADDRESS = SurvivMapping.SurvivRewards.address;
const SURVIV_BASE_ADDRESS = SurvivMapping.SurvivBase.address;
const SURVIV_SHOP_ADDRESS = SurvivMapping.SurvivShop.address;
const SURVIV_SHOPV2_ADDRESS = SurvivMapping.SurvivShopV2.address;

export enum SurvivKits {
    Crates = "crate",
    Keys = "key",
}

export enum SurvivBadges {
    Cards = "surviv_card",
}
export type SaleItems = SurvivKits | SurvivBadges;

export enum SurvivItems {
    SurvivKits,
    SurvivBadges
};

// Mapping of SurvivItems enums to their contract mappings
const itemMappings: Record<SurvivItems, { address: string; assets: string[] }> = {
    [SurvivItems.SurvivKits]: SurvivKitsMapping,
    [SurvivItems.SurvivBadges]: SurvivBadgesMapping
};

const saleMappings: Record<SaleItems, { address: string; assets: string[] }> = {
    [SurvivKits.Crates]: SurvivKitsMapping,
    [SurvivKits.Keys]: SurvivKitsMapping,
    [SurvivBadges.Cards]: SurvivBadgesMapping
};

const saleUSDPrices: Record<SaleItems, string> = {
    [SurvivKits.Crates]: "2000000000000000000",
    [SurvivKits.Keys]: "2000000000000000000",
    [SurvivBadges.Cards]: "149000000000000000000"
};

export const PaymentTokens = {
    NativeToken: SurvivMapping.NativeToken.address,
} as const;

export type PaymentTokenType = keyof typeof PaymentTokens;

/**
* Interface for crate data structure
*/
interface Reward {
    to: string;
    tokenId: number,
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
        reward: Reward;
        signature: string;
    }>;
}

/**
 * Interface for valid rewards return type
 */
export interface ValidRewards {
    validCrates: Reward[];
    validSignatures: string[];
}

export interface MintResult {
    address: string;
    values: [number, number][];
}

export interface SeasonRewardsData {
    success: boolean;
    distributionContract: string;
    claimFee: string;
    collections: string[];
    merkleProofs: string[][];
    tokenIds: number[][];
    amounts: number[][];
}

// ABI for the TransferSingle event
const TRANSFER_SINGLE_ABI = [
    'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)'
];

export class Account extends EIP6963 {
    address: string | null | undefined;
    token: string | null | undefined;
    api: string | null | undefined;
    readonly eip6963 = new EIP6963();

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
            if (getSelectorFromStorage === WalletType.WalletConnect) {
                getWalletConnectInit({
                    session: JSON.parse(localStorage.getItem(SESSION_WALLETCONNECT) as string) as EthereumProviderOptions['session'],
                }).then(provider => {
                    const parseProvider = {
                        info: getWalletConnectInfo,
                        accounts: provider.accounts,
                        provider: provider as unknown as Provider6963Props['provider'],
                    };

                    // update providers
                    {
                        this.provider = parseProvider;
                        this.providers.push(parseProvider);
                    }
                });
                return
            };

            this.provider = this.providers?.find(argument => argument.info.name === getSelectorFromStorage);

            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.eventListener();
        }
    }

    setApi(api: string) {
        this.api = api;
    }

    disconnect(): void {
        // clear localStorage
        {
            localStorage.removeItem(SESSION_WALLETCONNECT);
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
            const currentChainId = await getProvider.provider.request({
                method: "eth_chainId"
            }) as string;

            if (currentChainId !== ChainConfig.chainId) {
                try {
                    await getProvider.provider.request({
                        method: "wallet_switchEthereumChain",
                        params: [{ chainId: ChainConfig.chainId }]
                    });
                } catch (switchError: any) {
                    // If the chain is not added (e.g., error code 4902), add it
                    if (switchError.code === 4902) {
                        try {
                            await getProvider.provider.request({
                                method: "wallet_addEthereumChain",
                                params: [ChainConfig]
                            });
                        } catch (addError) {
                            errorAlert("Failed to add the Somnia Testnet. Please add it manually in your wallet.");
                            return;
                        }
                    } else {
                        errorAlert("Failed to switch to the Somnia Testnet. Please switch networks in your wallet.", 3000);
                        return;
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
            url: `${this.api}/api/requestNonce`
        });

        const signature = await getProvider.provider.request({
            method: "personal_sign",
            params: [
                ethers.hexlify(ethers.toUtf8Bytes((requestNonce.nonce))),
                accounts[0]
            ]
        });
        // Send POST request to /api/verifySignature
        const response = await fetch(`${this.api}/api/verifySignature`, {
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
            errorAlert(data.message);
            throw new Error(data.error || 'Signature verification failed');
        }

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

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.eventListener();
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
        $("#loading-text").text("Your session has expired. Please log in again.");

        setTimeout(() => this.disconnect(), 1000);
    }

    /**
     * Retrieves balances for all SurvivAssets, mapping token IDs to asset names and tiers.
     * @param returnAll - If true, includes assets with zero balances; if false, only includes assets with balance > 0 (default: false).
     * @returns A promise resolving to a nested object mapping SurvivAssets to Tiers to asset names and their balances.
     * @throws Error if the contract address is invalid, provider is unavailable, or SurvivAssetsMapping is invalid.
     */
    async getAssetBalances(
        returnAll: boolean = false
    ): Promise<Record<SurvivAssets, Record<AssetTier, Record<string, number>>>> {
        if (!ChainConfig.rpcUrls[0]) {
            throw new Error('RPC URL not configured');
        }

        if (!SurvivAssetsMapping || !SurvivAssetsMapping.address || !Array.isArray(SurvivAssetsMapping.assets)) {
            throw new Error('Invalid SurvivAssetsMapping configuration');
        }

        const assetsAddress = SurvivAssetsMapping.address;
        if (!ethers.isAddress(assetsAddress)) {
            throw new Error('Invalid contract address in SurvivAssetsMapping');
        }

        // Initialize the ethers contract
        const ethersProvider = new ethers.JsonRpcProvider(ChainConfig.rpcUrls[0]);
        const contract = new ethers.Contract(assetsAddress, erc1155ABI, ethersProvider);

        // Initialize result with nested structure: SurvivAssets -> Tier -> assetName -> balance
        const result: Record<SurvivAssets, Record<AssetTier, Record<string, number>>> = {
            [SurvivAssets.Skins]: {
                [AssetTier.Silver]: {},
                [AssetTier.Gold]: {},
                [AssetTier.Divine]: {}
            },
            [SurvivAssets.Emotes]: {
                [AssetTier.Silver]: {}, // Emotes may not use tiers, but included for consistency
                [AssetTier.Gold]: {},
                [AssetTier.Divine]: {}
            },
            [SurvivAssets.Arms]: {
                [AssetTier.Silver]: {},
                [AssetTier.Gold]: {},
                [AssetTier.Divine]: {}
            },
            [SurvivAssets.Guns]: {
                [AssetTier.Silver]: {}, // Guns may not have Silver, but included for consistency
                [AssetTier.Gold]: {},
                [AssetTier.Divine]: {}
            }
        };

        // Mapping of mappingIndices to Tiers for Skins, Arms, and Guns
        const tierMapping: Record<number, AssetTier> = {
            // Skins
            0: AssetTier.Silver, // SilverSkins
            1: AssetTier.Gold,   // GoldSkins
            2: AssetTier.Divine, // DivineSkins
            // Emotes (no tier, default to Silver for simplicity)
            3: AssetTier.Silver, // SurvivMemes
            // Arms
            4: AssetTier.Silver, // SilverArms
            5: AssetTier.Gold,   // GoldArms
            6: AssetTier.Divine, // DivineArms
            // Guns
            7: AssetTier.Gold,   // GoldGuns
            8: AssetTier.Divine  // DivineGuns
        };

        // Iterate through all SurvivAssets enum values
        for (const assetType of Object.values(SurvivAssets).filter(val => typeof val === 'number') as SurvivAssets[]) {
            const { mappingIndices } = SurvivAssetRanges[assetType];

            // Flatten the asset names and token IDs for the current category
            const assetNames: string[] = [];
            const tokenIds: number[] = [];
            const tierIndices: AssetTier[] = [];

            for (const index of mappingIndices) {
                const subArray = SurvivAssetsMapping.assets[index] || [];
                const startId = index * 1000; // Derive startId from index
                const tier = tierMapping[index] || AssetTier.Silver; // Default to Silver if not mapped
                let currentTokenId = startId;
                for (const name of subArray) {
                    assetNames.push(name);
                    tokenIds.push(currentTokenId++);
                    tierIndices.push(tier);
                }
            }

            if (tokenIds.length === 0) {
                continue;
            }

            // Batch query balances
            const accounts = Array(tokenIds.length).fill(this.address);
            const balances = await contract.balanceOfBatch(accounts, tokenIds);

            // Map token IDs to asset names with balances, organized by tier
            for (let i = 0; i < tokenIds.length; i++) {
                const balance = Number(balances[i]); // Convert BigNumber to number
                if (returnAll || balance > 0) {
                    const assetName = assetNames[i];
                    const tier = tierIndices[i];
                    if (assetName) {
                        result[assetType][tier][assetName] = balance;
                    }
                }
            }
        }

        return result;
    }

    /**
     * Retrieves balances for a specific asset type from SurvivKits or SurvivBadges.
     * @param assetType - The type of asset to query (e.g., SurvivKits.Crates, SurvivBadges.Cards).
     * @param returnAll - If true, includes assets with zero balances; if false, only includes assets with balance > 0 (default: false).
     * @returns A promise resolving to an object mapping asset names to their balances.
     * @throws Error if the contract address is invalid, provider is unavailable, or mapping is invalid.
     */
    async getItemBalances(
        assetType: SurvivItems,
        returnAll: boolean = false
    ): Promise<Record<string, number>> {
        // Ensure RPC URL is available
        if (!ChainConfig.rpcUrls[0]) {
            throw new Error('RPC URL not configured');
        }


        const selectedMapping = itemMappings[assetType];
        if (!selectedMapping || !selectedMapping.address || !Array.isArray(selectedMapping.assets)) {
            throw new Error(`Invalid mapping configuration for asset type ${assetType}`);
        }

        const assetsAddress = selectedMapping.address;
        if (!ethers.isAddress(assetsAddress)) {
            throw new Error(`Invalid contract address: ${assetsAddress}`);
        }

        const tokenIds = Array.from({ length: selectedMapping.assets.length }, (_, i) => i);
        const assetNames = selectedMapping.assets;

        if (tokenIds.length === 0) {
            return {};
        }

        // Initialize the ethers contract
        const ethersProvider = new ethers.JsonRpcProvider(ChainConfig.rpcUrls[0]);
        const contract = new ethers.Contract(assetsAddress, erc1155ABI, ethersProvider);

        // Batch query balances
        const accounts = Array(tokenIds.length).fill(this.address);
        const balances = await contract.balanceOfBatch(accounts, tokenIds);

        // Map token IDs to asset names with balances
        const result: Record<string, number> = {};
        for (let i = 0; i < tokenIds.length; i++) {
            const balance = Number(balances[i]); // Convert BigNumber to number
            if (returnAll || balance > 0) {
                const assetName = assetNames[i];
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

            const receipt = await tx.wait();

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
        // Ensure authentication token is present
        if (!this.token) {
            throw new Error('Authentication token is missing');
        }

        // Ensure RPC URL is available
        if (!ChainConfig.rpcUrls[0]) {
            throw new Error('RPC URL not configured');
        }

        // Set fetch timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            // Fetch available crates
            const response = await fetch(`${this.api}/api/getValidRewards`, {
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
            const crates: Reward[] = [];
            const signatures: string[] = [];

            for (const claim of data.claims) {
                if (
                    !claim.reward?.to ||
                    !ethers.isAddress(claim.reward.to) ||
                    !Number.isInteger(claim.reward.amount) ||
                    !claim.reward.salt ||
                    !Number.isInteger(claim.reward.expiry) ||
                    !claim.signature
                ) {
                    console.warn('Invalid claim data, skipping:', claim);
                    continue;
                }
                crates.push({
                    to: claim.reward.to,
                    tokenId: claim.reward.tokenId,
                    amount: Number(claim.reward.amount),
                    salt: claim.reward.salt,
                    expiry: Number(claim.reward.expiry),
                });
                signatures.push(claim.signature);
            }

            // Initialize contract with read-only provider
            const ethersProvider = new ethers.JsonRpcProvider(ChainConfig.rpcUrls[0]);
            const contract = new ethers.Contract(SURVIV_REWARD_ADDRESS, survivRewardsABI, ethersProvider);

            // Batch check used signatures
            const validIndices: number[] = [];
            if (signatures.length > 0) {
                try {
                    const isUsedResults: boolean[] = await contract.isUsedSignatures(signatures);
                    isUsedResults.forEach((isUsed, index) => {
                        if (!isUsed) {
                            validIndices.push(index);
                        }
                    });
                } catch (error) {
                    console.warn('Failed to check signatures in batch:', error);
                    // Fallback to checking signatures individually
                    for (let i = 0; i < signatures.length; i++) {
                        try {
                            const isUsed = await contract.isUsedSignature(signatures[i]);
                            if (!isUsed) {
                                validIndices.push(i);
                            }
                        } catch (singleError) {
                            console.warn(`Failed to check signature ${signatures[i]}:`, singleError);
                        }
                    }
                }
            }

            const validCrates = validIndices.map((i) => crates[i]);
            const validSignatures = validIndices.map((i) => signatures[i]);

            // Remove invalid rewards (assuming removeRewards is an API call or handled separately)
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
            const response = await fetch(`${this.api}/api/claimRewards`, {
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
            const cratesContract = new ethers.Contract(SurvivKitsMapping.address, erc1155ABI, signer);

            const kitsMapping = itemMappings[SurvivItems.SurvivKits];
            const crateIndex = kitsMapping.assets.indexOf("crate");
            const keyIndex = kitsMapping.assets.indexOf("key");


            const tokenIds = [crateIndex, keyIndex];
            const accounts = Array(tokenIds.length).fill(this.address);
            const kitBalances = await cratesContract.balanceOfBatch(accounts, tokenIds);

            if (kitBalances[crateIndex] >= amount && kitBalances[keyIndex] >= amount) {
                // Execute claim transaction
                const tx = await crateBaseContract.commitCrates(amount);
                const receipt = await tx.wait();
                clearTimeout(timeoutId);
                return receipt;
            } else {
                throw new Error(`Insufficient crates or keys: crates: ${kitBalances[crateIndex]}, keys: ${kitBalances[keyIndex]}`);
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
    async claimItems(): Promise<{ hash?: string; balances?: MintResult[], error?: string }> {
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

                const feeData = await ethersProvider.getFeeData();
                const remainingCommitsArray = Array.from(remainingCommits);

                const numberOfCrates = remainingCommitsArray.reduce(
                    (sum: number, item: any) => sum + Number(item[1] ?? 0),
                    0
                );
                let gasPrice;
                const gasPriceMultiplier = 1.3 + 0.005 * numberOfCrates; // 30% base increase + 0.5% per crate

                // Check if the network supports EIP-1559
                if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                    // Increase maxFeePerGas by 1% per crate
                    gasPrice = {
                        maxFeePerGas: (feeData.maxFeePerGas * BigInt(Math.round(gasPriceMultiplier * 100))) / 100n,
                        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas, // Keep priority fee as suggested
                    };
                } else if (feeData.gasPrice) {
                    // For non-EIP-1559 networks, increase gasPrice by 1% per crate
                    gasPrice = {
                        gasPrice: (feeData.gasPrice * BigInt(Math.round(gasPriceMultiplier * 100))) / 100n,
                    };
                }

                // Execute claim transaction
                const tx = await crateBaseContract.openCratesBatch(gasPrice);
                await tx.wait();

                const claimItems = await this.getTokenMints(tx.hash)
                clearTimeout(timeoutId);
                return { hash: tx.hash, balances: claimItems };
            } else {
                clearTimeout(timeoutId);
                return { error: 'No requests available' };
            }
        } catch (error: any) {
            clearTimeout(timeoutId);
            return { error: `Failed to claim rewards: ${error.message || 'Unknown error'}` };
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
    async buyItems(item: SaleItems, amount: number, paymentToken: PaymentTokenType, value: bigint): Promise<any> {
        if (!this.provider?.provider) {
            throw new Error('Web3 provider not initialized');
        }
        let itemAddress = saleMappings[item].address;
        let itemIndex = saleMappings[item].assets.indexOf(item);
        if (!ethers.isAddress(itemAddress) || itemIndex === -1) {
            throw new Error(`Invalid contract address or tokenId for ${item}`);
        }

        // Set fetch timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            // Initialize contract
            const ethersProvider = new ethers.BrowserProvider(this.provider.provider);
            const signer = await ethersProvider.getSigner();
            let paymentTokenValue = PaymentTokens[paymentToken];

            const survivShopContract = new ethers.Contract(SURVIV_SHOP_ADDRESS, survivShopABI, signer);
            if (paymentTokenValue == PaymentTokens.NativeToken) {
                const tx = await survivShopContract.buyItems(itemAddress, itemIndex, amount, paymentTokenValue, { value });
                const receipt = await tx.wait();
                clearTimeout(timeoutId);
                return receipt;
            } else {
                throw new Error('Payment supported yet.');
            }
        } catch (error: any) {
            clearTimeout(timeoutId);
            throw new Error(`Failed to buy item: ${error.message || 'Unknown error'}`);
        }
    }


    async buyItemsV2(item: SaleItems, amount: number, value: bigint): Promise<any> {
        if (!this.provider?.provider) {
            throw new Error('Web3 provider not initialized');
        }
        let itemAddress = saleMappings[item].address;
        let itemIndex = saleMappings[item].assets.indexOf(item);
        if (!ethers.isAddress(itemAddress) || itemIndex === -1) {
            throw new Error(`Invalid contract address or tokenId for ${item}`);
        }


        // Set fetch timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            // Initialize contract
            const ethersProvider = new ethers.BrowserProvider(this.provider.provider);
            const signer = await ethersProvider.getSigner();
            const survivShopContract = new ethers.Contract(SURVIV_SHOPV2_ADDRESS, survivShopV2ABI, signer);

            const tx = await survivShopContract.buyItems(itemAddress, itemIndex, amount, { value });
            const receipt = await tx.wait();
            clearTimeout(timeoutId);
            return receipt;

        } catch (error: any) {
            clearTimeout(timeoutId);
            throw new Error(`Failed to buy item: ${error.message || 'Unknown error'}`);
        }
    }

    async queryPrice(
        item: SaleItems, // Use SaleItems key type ("Crates" | "Cards" | "Keys")
        paymentToken: PaymentTokenType // Use PaymentTokens key type ("NativeToken")
    ): Promise<any> {
        // Ensure RPC URL is available
        if (!ChainConfig.rpcUrls[0]) {
            throw new Error('RPC URL not configured');
        }

        let itemValue = saleMappings[item];
        let itemAddress = itemValue.address;

        let itemIndex = itemValue.assets.indexOf(item);
        if (!ethers.isAddress(itemValue.address) || itemIndex === -1) {
            throw new Error(`Invalid contract address or tokenId for ${item}`);
        }

        // Set fetch timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            // Initialize JSON-RPC provider
            const ethersProvider = new ethers.JsonRpcProvider(ChainConfig.rpcUrls[0]);

            // Initialize contract with read-only provider (no signer needed)
            const survivShopContract = new ethers.Contract(SURVIV_SHOP_ADDRESS, survivShopABI, ethersProvider);

            // Call the getPrice function
            const price = await survivShopContract.getPrice(PaymentTokens[paymentToken], itemAddress, itemIndex);

            clearTimeout(timeoutId);
            return price;
        } catch (error: any) {
            console.log("error: ", error);
            clearTimeout(timeoutId);
            throw new Error(`Failed to query price: ${error.message || 'Unknown error'}`);
        }
    }

    async queryPriceV2(
        item: SaleItems // Use SaleItems key type ("Crates" | "Cards" | "Keys")
    ): Promise<any> {
        // Ensure RPC URL is available
        if (!ChainConfig.rpcUrls[0]) {
            throw new Error('RPC URL not configured');
        }

        let itemValue = saleMappings[item];
        let itemAddress = itemValue.address;

        let itemIndex = itemValue.assets.indexOf(item);
        if (!ethers.isAddress(itemValue.address) || itemIndex === -1) {
            throw new Error(`Invalid contract address or tokenId for ${item}`);
        }

        // Set fetch timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            // Initialize JSON-RPC provider
            const ethersProvider = new ethers.JsonRpcProvider(ChainConfig.rpcUrls[0]);

            // Initialize contract with read-only provider (no signer needed)
            const survivShopContract = new ethers.Contract(SURVIV_SHOPV2_ADDRESS, survivShopV2ABI, ethersProvider);

            // Call the getPrice function
            const price = await survivShopContract.getPrice(itemAddress, itemIndex);

            clearTimeout(timeoutId);
            return price;
        } catch (error: any) {
            console.log("error: ", error);
            clearTimeout(timeoutId);
            throw new Error(`Failed to query price: ${error.message || 'Unknown error'}`);
        }
    }

    async getCommits(): Promise<any> {
        // Ensure RPC URL is available
        if (!ChainConfig.rpcUrls[0]) {
            throw new Error('RPC URL not configured');
        }

        // Validate userAddress
        if (!this.address) {
            warningAlert("Please connect your wallet to continue!", 3000);
            return;
        }

        // Set fetch timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            // Initialize JSON-RPC provider
            const ethersProvider = new ethers.JsonRpcProvider(ChainConfig.rpcUrls[0]);

            // Initialize contract with read-only provider (no signer needed)
            const crateBaseContract = new ethers.Contract(SURVIV_BASE_ADDRESS, crateBaseABI, ethersProvider);

            // Call the getCommits function with the provided user address
            const remainingCommits = await crateBaseContract.getCommits(this.address);

            clearTimeout(timeoutId);
            return remainingCommits;
        } catch (error: any) {
            console.log("error: ", error);
            clearTimeout(timeoutId);
            throw new Error(`Failed to request get commits: ${error.message || 'Unknown error'}`);
        }
    }

    async getTokenMints(txnHash: string): Promise<MintResult[]> {
        // Ensure RPC URL is available
        if (!ChainConfig.rpcUrls[0]) {
            throw new Error('RPC URL not configured');
        }

        try {
            // Initialize JSON-RPC provider
            const ethersProvider = new ethers.JsonRpcProvider(ChainConfig.rpcUrls[0]);

            // Fetch the transaction receipt using the provider
            const receipt = await ethersProvider.getTransactionReceipt(txnHash);

            if (!receipt) {
                throw new Error(`Transaction receipt not found for hash: ${txnHash}`);
            }

            // Find all TransferSingle event logs
            const transferSingleTopic = ethers.id('TransferSingle(address,address,address,uint256,uint256)');
            const transferSingleLogs = receipt.logs.filter(
                (log: any) => log.topics[0] === transferSingleTopic
            );

            if (transferSingleLogs.length === 0) {
                console.warn('No ERC-1155 minting events found in the transaction logs');
                return [];
            }

            // Create an interface for decoding the logs
            const iface = new ethers.Interface(TRANSFER_SINGLE_ABI);

            // Group mints by contract address
            const mintsByCollection: { [key: string]: MintResult } = {};

            for (const log of transferSingleLogs) {
                const decodedLog = iface.parseLog({
                    topics: log.topics,
                    data: log.data,
                });

                if (!decodedLog) {
                    console.warn(`Failed to decode TransferSingle event for log index ${log.index}`);
                    continue;
                }

                const { operator, from, to, id, value } = decodedLog.args;
                const contractAddress = log.address.toLowerCase();

                // Initialize MintResult for this contract if not already present
                if (!mintsByCollection[contractAddress]) {
                    mintsByCollection[contractAddress] = {
                        address: contractAddress,
                        values: [],
                    };
                }

                // Convert id and value to numbers
                const tokenId = Number(id);
                const tokenValue = Number(value);

                // Check if tokenId already exists in values
                const existingEntry = mintsByCollection[contractAddress].values.find(([id]) => id === tokenId);

                if (existingEntry) {
                    // Update the value if tokenId already exists
                    existingEntry[1] += tokenValue;
                } else {
                    // Add new entry if tokenId is unique
                    mintsByCollection[contractAddress].values.push([tokenId, tokenValue]);
                }
            }

            // Convert grouped object to array
            const result = Object.values(mintsByCollection);

            // Sort values by tokenId for consistency
            result.forEach((mint) => {
                mint.values.sort((a, b) => a[0] - b[0]);
            });

            return result;
        } catch (error: any) {
            console.log("error: ", error);
            return [];
        }
    }

    async getSeasonRewards(season: string = "1"): Promise<SeasonRewardsData> {
        if (!ChainConfig.rpcUrls[0]) {
            throw new Error('RPC URL not configured');
        }
        // Validate userAddress
        if (!this.address) {
            throw new Error('Please connect your wallet to continue!');
        }

        // Set fetch timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            // Fetch available crates
            const response = await fetch(`${this.api}/season/proof/${this.address}/?season=${season}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`,
                },
                signal: controller.signal,
            });

            const rewardsData: SeasonRewardsData = await response.json();

            if (rewardsData.success) {
                const ethersProvider = new ethers.JsonRpcProvider(ChainConfig.rpcUrls[0]);

                const distributionContract = new ethers.Contract(
                    rewardsData.distributionContract,
                    seasonRewardsABI,
                    ethersProvider
                );

                // Store valid rewards
                let validRewards: SeasonRewardsData = {
                    success: true,
                    distributionContract: rewardsData.distributionContract,
                    claimFee: rewardsData.claimFee,
                    collections: [],
                    merkleProofs: [],
                    tokenIds: [],
                    amounts: []
                };

                // Filter rewards
                for (let i = 0; i < rewardsData.collections.length; i++) {
                    const isValid = await distributionContract.verifyRewards(
                        this.address,
                        rewardsData.collections[i],
                        rewardsData.merkleProofs[i],
                        rewardsData.tokenIds[i],
                        rewardsData.amounts[i]
                    );

                    if (isValid) {
                        validRewards.collections.push(rewardsData.collections[i]);
                        validRewards.merkleProofs.push(rewardsData.merkleProofs[i]);
                        validRewards.tokenIds.push(rewardsData.tokenIds[i]);
                        validRewards.amounts.push(rewardsData.amounts[i]);
                    }
                }

                // Update rewardsData with only valid rewards
                rewardsData.collections = validRewards.collections;
                rewardsData.merkleProofs = validRewards.merkleProofs;
                rewardsData.tokenIds = validRewards.tokenIds;
                rewardsData.amounts = validRewards.amounts;

                // Set success to false if no valid rewards
                rewardsData.success = validRewards.collections.length > 0;
            }

            return rewardsData;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async claimSeasonRewards(rewardsData: SeasonRewardsData): Promise<any> {
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
            const distributionContract = new ethers.Contract(rewardsData.distributionContract, seasonRewardsABI, signer);

            const tx = await distributionContract.claimAll(rewardsData.collections, rewardsData.merkleProofs, rewardsData.tokenIds, rewardsData.amounts, {
                value: rewardsData.claimFee,
            });
            const receipt = await tx.wait();
            clearTimeout(timeoutId);
            return receipt;

        } catch (error: any) {
            clearTimeout(timeoutId);
            throw new Error(`Failed to buy item: ${error.message || 'Unknown error'}`);
        }
    }
}

import $, { error } from "jquery";

import { ACCESS_TOKEN, PUBLIC_KEY, SELECTOR_WALLET, shorten } from "./utils/constants";
import { EIP6963, type Provider6963Props } from "./eip6963";
import { ethers, toBeHex } from "ethers";

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
import { errorAlert } from "./modal";
import { resetPlayButtons } from "./ui/home";

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
    SurvivCards
}

export const SaleItems = {
    Crates: SurvivCratesMapping.address,
    Cards: SurvivCardsMapping.address,
    Keys: SurvivKeysMapping.address
} as const;

export type SaleItemType = keyof typeof SaleItems;

export const PaymentTokens = {
    NativeToken: SurvivMapping.NativeToken.address,
} as const;

export type PaymentTokenType = keyof typeof PaymentTokens;

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

export interface MintResult {
    address: string;
    values: [number, number][];
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

            // Attempt to switch to the target chain
            if (currentChainId !== targetChainId) {
                try {
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
            [SurvivAssets.SurvivCards]: SurvivCardsMapping,
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
            const response = await fetch(`${this.api}/api/getCrates`, {
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
            const response = await fetch(`${this.api}/api/removeCrates`, {
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
            const cratesContract = new ethers.Contract(SurvivCratesMapping.address, erc1155ABI, signer);

            const balance = await cratesContract.balanceOf(signer.address, 0);

            if (Number(balance) >= amount) {
                // Execute claim transaction
                const tx = await crateBaseContract.commitCrates(0, amount);
                const receipt = await tx.wait();
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
    async buyItems(item: SaleItemType, amount: number, paymentToken: PaymentTokenType, value: bigint): Promise<any> {
        if (!this.provider?.provider) {
            throw new Error('Web3 provider not initialized');
        }
        let itemValue = SaleItems[item];
        let paymentTokenValue = PaymentTokens[paymentToken];

        // Set fetch timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            // Initialize contract
            const ethersProvider = new ethers.BrowserProvider(this.provider.provider);
            const signer = await ethersProvider.getSigner();

            const survivShopContract = new ethers.Contract(SURVIV_SHOP_ADDRESS, survivShopABI, signer);
            if (paymentTokenValue == PaymentTokens.NativeToken) {
                const tx = await survivShopContract.buyItems(itemValue, amount, paymentTokenValue, { value });
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

    async queryPrice(
        item: SaleItemType, // Use SaleItems key type ("Crates" | "Cards" | "Keys")
        paymentToken: PaymentTokenType // Use PaymentTokens key type ("NativeToken")
    ): Promise<any> {
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

            const price = await survivShopContract.getPrice(PaymentTokens[paymentToken], SaleItems[item]);
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

    async getTokenMints(txnHash: string): Promise<MintResult[]> {
        if (!this.provider?.provider) {
            throw new Error('Web3 provider not initialized');
        }

        try {
            const ethersProvider = new ethers.BrowserProvider(this.provider.provider);
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
        } catch (error) {
            console.log("error: ", error);
            return [];
        }
    }
}

import { toBeHex } from "ethers";
import { Blockchain } from "./contracts"; // Adjust import path as needed

export interface ChainInfo {
    readonly chainId: number;
    readonly chainName: string;
    readonly rpcUrls: string[];
    readonly nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    readonly blockExplorerUrls: string[];
    readonly blockExplorerAPI: string;
    readonly kitsSale: boolean;
    readonly badgesSale: boolean;
}

// Chain-specific configurations
export const chainToConfig: Record<Blockchain, ChainInfo> = {
    [Blockchain.Shannon]: {
        chainId: 50312,
        chainName: Blockchain.Shannon,
        rpcUrls: ["https://dream-rpc.somnia.network/"],
        nativeCurrency: {
            name: "Somnia Testnet Token",
            symbol: "STT",
            decimals: 18,
        },
        blockExplorerUrls: ["https://shannon-explorer.somnia.network/"],
        blockExplorerAPI: "https://somnia.w3us.site/api/v2",
        kitsSale: true,
        badgesSale: true,
    },
    [Blockchain.Somnia]: {
        chainId: 5031,
        chainName: Blockchain.Somnia,
        rpcUrls: ["https://api.infra.mainnet.somnia.network/"],
        nativeCurrency: {
            name: "Somnia Token",
            symbol: "SOMI",
            decimals: 18,
        },
        blockExplorerUrls: ["https://explorer.somnia.network/"],
        blockExplorerAPI: "https://mainnet.somnia.w3us.site/api/v2",
        kitsSale: false,
        badgesSale: false,
    },
    [Blockchain.Minato]: {
        // chainId: '0x' + Number(1946).toString(16),
        chainId: 1946,
        chainName: Blockchain.Minato,
        rpcUrls: ["https://rpc.minato.soneium.org/"],
        nativeCurrency: {
            name: "Ether",
            symbol: "ETH",
            decimals: 18,
        },
        blockExplorerUrls: ["https://soneium-minato.blockscout.com/"],
        blockExplorerAPI: "https://soneium-minato.blockscout.com/api/v2", // Blockscout API endpoint
        kitsSale: true,
        badgesSale: true,
    },
    [Blockchain.Soneium]: {
        chainId: 1868,
        chainName: Blockchain.Soneium,
        rpcUrls: ["https://rpc.soneium.org/"],
        nativeCurrency: {
            name: "Ether",
            symbol: "ETH",
            decimals: 18,
        },
        blockExplorerUrls: ["https://soneium.blockscout.com/"],
        blockExplorerAPI: "https://soneium.blockscout.com/api/v2", // Blockscout API endpoint
        kitsSale: true,
        badgesSale: true,
    },
} as const;

// Helper function to get config for a specific chain
export function getChainConfig(chain: Blockchain): ChainInfo {
    return chainToConfig[chain];
}

export function chainIdToHex(chainId: number): string {
    return '0x' + Number(chainId).toString(16);
}
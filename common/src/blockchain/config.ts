import { toBeHex } from "ethers";
import { Blockchain } from "./contracts"; // Adjust import path as needed

export interface ChainInfo {
    readonly chainId: string;
    readonly chainName: string;
    readonly rpcUrls: string[];
    readonly nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    readonly blockExplorerUrls: string[];
    readonly blockExplorerAPI: string;
}

// Chain-specific configurations
export const chainToConfig: Record<Blockchain, ChainInfo> = {
    [Blockchain.Shannon]: {
        chainId: toBeHex(50312),
        chainName: Blockchain.Shannon,
        rpcUrls: ["https://dream-rpc.somnia.network/"],
        nativeCurrency: {
            name: "Somnia Testnet Token",
            symbol: "STT",
            decimals: 18,
        },
        blockExplorerUrls: ["https://shannon-explorer.somnia.network/"],
        blockExplorerAPI: "https://somnia.w3us.site/api/v2",
    },
    [Blockchain.Somnia]: {
        chainId: toBeHex(5031),
        chainName: Blockchain.Somnia,
        rpcUrls: ["https://api.infra.mainnet.somnia.network/"],
        nativeCurrency: {
            name: "Somnia Token",
            symbol: "SOMI",
            decimals: 18,
        },
        blockExplorerUrls: ["https://explorer.somnia.network/"],
        blockExplorerAPI: "https://mainnet.somnia.w3us.site/api/v2",
    },
    [Blockchain.Minato]: {
        chainId: '0x' + Number(1946).toString(16),
        chainName: Blockchain.Minato,
        rpcUrls: ["https://rpc.minato.soneium.org/"],
        nativeCurrency: {
            name: "Ether",
            symbol: "ETH",
            decimals: 18,
        },
        blockExplorerUrls: ["https://soneium-minato.blockscout.com/"],
        blockExplorerAPI: "https://soneium-minato.blockscout.com/api/v2", // Blockscout API endpoint
    },
    [Blockchain.Soneium]: {
        chainId: toBeHex(1868),
        chainName: Blockchain.Soneium,
        rpcUrls: ["https://rpc.soneium.org/"],
        nativeCurrency: {
            name: "Ether",
            symbol: "ETH",
            decimals: 18,
        },
        blockExplorerUrls: ["https://soneium.blockscout.com/"],
        blockExplorerAPI: "https://soneium.blockscout.com/api/api/v2", // Blockscout API endpoint
    },
} as const;

// Helper function to get config for a specific chain
export function getChainConfig(chain: Blockchain): ChainInfo {
    return chainToConfig[chain];
}
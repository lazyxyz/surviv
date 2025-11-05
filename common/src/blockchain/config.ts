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
        chainName: Blockchain.Shannon, // "Shannon testnet"
        rpcUrls: ["https://dream-rpc.somnia.network/"],
        nativeCurrency: {
            name: "Somnia Testnet Token",
            symbol: "STT",
            decimals: 18,
        },
        blockExplorerUrls: ["https://shannon-explorer.somnia.network/"],
        blockExplorerAPI: "https://somnia.w3us.site",
    },
    [Blockchain.Somnia]: {
        chainId: toBeHex(5031),
        chainName: "Somnia", // Or customize to "Somnia mainnet" if preferred; uses enum key as fallback
        rpcUrls: ["https://rpc.somnia.network/", "https://api.infra.mainnet.somnia.network"],
        nativeCurrency: {
            name: "Somnia",
            symbol: "SOMI",
            decimals: 18,
        },
        blockExplorerUrls: ["https://explorer.somnia.network/"],
        blockExplorerAPI: "https://api.infra.mainnet.somnia.network", // Adapted from RPC; adjust if specific API endpoint available
    },
    [Blockchain.Minato]: {
        chainId: toBeHex(1946),
        chainName: "Minato", // Enum key; or "Soneium Minato Testnet"
        rpcUrls: ["https://rpc.minato.soneium.org/", "https://soneium-minato.drpc.org"],
        nativeCurrency: {
            name: "Ether",
            symbol: "ETH",
            decimals: 18,
        },
        blockExplorerUrls: ["https://soneium-minato.blockscout.com/"],
        blockExplorerAPI: "https://soneium-minato.blockscout.com/api", // Blockscout API endpoint
    },
    [Blockchain.Soneium]: {
        chainId: toBeHex(1868),
        chainName: "Soneium", // Enum key; or "Soneium mainnet"
        rpcUrls: ["https://rpc.soneium.org/", "https://soneium.drpc.org"],
        nativeCurrency: {
            name: "Ether",
            symbol: "ETH",
            decimals: 18,
        },
        blockExplorerUrls: ["https://soneium.blockscout.com/"],
        blockExplorerAPI: "https://soneium.blockscout.com/api", // Blockscout API endpoint
    },
} as const;

// Helper function to get config for a specific chain
export function getChainConfig(chain: Blockchain): ChainInfo {
    return chainToConfig[chain];
}

// Usage example:
// const shannonConfig = getChainConfig(Blockchain.Shannon);
// console.log(shannonConfig.chainName); // "Shannon testnet"
// console.log(shannonConfig.rpcUrls[0]); // "https://dream-rpc.somnia.network/"
// project/api/src/items.ts (or a new file like erc721.ts)
import { ethers } from "ethers";

// ERC-721 ABI (only need balanceOf for this simple case)
const ERC721_ABI = [
    "function balanceOf(address owner) view returns (uint256)"
];

// Simple interface for the result
interface ERC721BalanceResult {
    address: string;
    balance: string; // String to handle BigInt serialization
}

/**
 * Get the total number of ERC-721 tokens owned by an address for a given contract.
 * @param rpcUrl The Ethereum RPC URL (e.g., Infura, Alchemy, or local node)
 * @param contractAddress The ERC-721 contract address
 * @param address The wallet address to check
 * @returns An object with the address and its balance
 */
export async function getERC721Balance(
    rpcUrl: string,
    contractAddress: string,
    address: string,
): Promise<ERC721BalanceResult> {
    if (!address) {
        throw new Error("Missing address");
    }
    if (!contractAddress) {
        throw new Error("Missing contract address");
    }
    if (!rpcUrl) {
        throw new Error("Missing RPC URL");
    }

    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);

        // Call balanceOf to get the total number of tokens owned by the address
        const balance = await contract.balanceOf(address);

        return {
            address,
            balance: balance.toString(), // Convert BigInt to string for JSON/serialization safety
        };
    } catch (err: any) {
        console.error(err);
        throw new Error(`Failed to fetch ERC-721 balance: ${err.message}`);
    }
}
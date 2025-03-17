// project/api/src/items.ts
import { IPFS_GATEWAY_URL } from "@common/constants";
import { ethers } from "ethers";
import * as https from "https";

// Extended ERC1155 interface for uri(), balanceOfBatch
const ERC1155_ABI = [
    "function uri(uint256 _id) view returns (string)",
    "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[] balances)"
];

interface TokenMetadata {
    id: number;
    name: string;
}

interface BalanceResult {
    name: string;
    tokenId: number;
    balance: string; // String to handle BigInt serialization
}

interface RequestBody {
    name: string | string[];
    address: string;
}

// Fetch metadata from IPFS
async function fetchMetadataForToken(tokenId: number, cid: string): Promise<TokenMetadata | null> {
    const metadataUrl = `${IPFS_GATEWAY_URL}${cid}/${tokenId}`;
    const metadata = await new Promise<any>((resolve, reject) => {
        https.get(metadataUrl, (resp) => {
            let data = '';
            resp.on('data', (chunk) => {
                data += chunk;
            });
            resp.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });

    if (metadata) {
        return {
            id: tokenId,
            name: metadata.name || `Token #${tokenId}`,
        };
    }
    return null;
}

// Main public function to get token balances with RPC URL input
export async function getTokenBalances(
    rpcUrl: string,
    contractAddress: string,
    name: string | string[],
    address: string,
): Promise<BalanceResult[]> {
    if (!name || !address) {
        throw new Error("Missing name or address");
    }
    if (!contractAddress) {
        throw new Error("Missing contract address");
    }
    if (!rpcUrl) {
        throw new Error("Missing RPC URL");
    }

    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);

        // 1. Get URI of collection
        const tokenUri: string = await contract.uri(0); // Assuming 0 works for base URI
        const cid = tokenUri.split("ipfs://")[1].split("/{id}")[0];

        // 2. Process names (single or array)
        const names = Array.isArray(name) ? name : [name];
        const tokenIds: number[] = [];
        const verifiedMetadata: TokenMetadata[] = [];

        for (const name of names) {
            // Parse token ID from name (e.g., "Finland #46" -> 46)
            const match = name.match(/#(\d+)$/);
            if (!match) {
                continue; // Skip invalid names
            }
            const tokenId = parseInt(match[1], 10);

            // Fetch metadata for this token ID
            const metadata = await fetchMetadataForToken(tokenId, cid);
            if (metadata && metadata.name === name) {
                tokenIds.push(tokenId);
                verifiedMetadata.push(metadata);
            }
        }

        // 3. Call balanceOfBatch for the address and verified token IDs
        if (tokenIds.length > 0) {
            const accounts = Array(tokenIds.length).fill(address);
            const balances = await contract.balanceOfBatch(accounts, tokenIds);

            // 4. Return results with balances (convert BigInt to string)
            return tokenIds.map((tokenId, index) => ({
                name: verifiedMetadata[index].name,
                tokenId,
                balance: balances[index].toString(),
            }));
        } else {
            return [];
        }
    } catch (err: any) {
        console.error(err);
        throw new Error(`Failed to fetch token balances: ${err.message}`);
    }
}

// Example specific functions for skins and melee with RPC URL
export async function getSkinBalances(
    rpcUrl: string,
    name: string | string[],
    address: string,
): Promise<BalanceResult[]> {
    return getTokenBalances(rpcUrl, "0x9a91e7b132eeadf35c07c12355355aecd5ef4a21", name, address);
}

export async function getMeleeBalances(
    rpcUrl: string,
    name: string | string[],
    address: string,
): Promise<BalanceResult[]> {
    return getTokenBalances(rpcUrl, "0xfe2cfd8c98add2c63b41dc19e353707f5e8238e9", name, address);
}
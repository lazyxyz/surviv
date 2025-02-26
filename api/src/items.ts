import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { HttpResponse, TemplatedApp } from "uWebSockets.js";
import dotenv from "dotenv";
import { resolve } from "path";
import * as https from "https"; // Using Node.js built-in https module

const envPath = resolve(__dirname, "../.env");
dotenv.config({ path: envPath });

const RPC = process.env.ETH_RPC_URL || "";

// Minimal ERC1155 interface for uri() and getTotalSupply()
const ERC1155_ABI = [
    "function uri(uint256 _id) view returns (string)",
    "function getTotalSupply() view returns (uint256)"
];

function setCORSHeaders(res: HttpResponse) {
    res.writeHeader("Access-Control-Allow-Origin", "*");
    res.writeHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.writeHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export function requestNonce(app: TemplatedApp) {
    app.get("/api/requestNonce", (res) => {
        setCORSHeaders(res);
        const nonce = uuidv4();
        res.writeHeader("Content-Type", "application/json").end(JSON.stringify({ success: true, nonce }));
    });
}

interface TokenMetadata {
    id: number;
    name: string;
    // Add other fields if needed, e.g., image, description, etc.
}

async function fetchCollectionMetadata(
    contractAddress: string,
    provider: ethers.JsonRpcProvider,
    res: HttpResponse
): Promise<TokenMetadata[]> {
    let aborted = false;
    res.onAborted(() => {
        aborted = true;
    });

    if (aborted) throw new Error("Request aborted");

    try {
        // 1. Get URI of collection
        const contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);
        const tokenUri: string = await contract.uri(0); // Assuming 0 works for base URI

        // Extract CID from URI
        const cid = tokenUri.split("ipfs://")[1].split("/{id}")[0];

        // 2. Get total supply (max token ID)
        const totalSupply: bigint = await contract.getTotalSupply();
        const maxTokenId = Number(totalSupply);

        // 3. Get list of token names from metadata
        const metadataUrl = `https://ipfs-gw.openmark.io/ipfs/${cid}/`;
        const tokens: TokenMetadata[] = [];

        // Fetch metadata for token IDs 0–maxTokenId
        for (let id = 0; id < maxTokenId; id++) {
            if (aborted) throw new Error("Request aborted");
            const specificMetadataUrl = `${metadataUrl}${id}`;
            const metadata = await new Promise<any>((resolve, reject) => {
                https.get(specificMetadataUrl, (resp) => {
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
                tokens.push({
                    id,
                    name: metadata.name || `Token #${id}`,
                });
            }
        }

        return tokens;
    } catch (err) {
        throw err;
    }
}

export function getSkinBalances(app: TemplatedApp) {
    const skinAddress = "0x9a91e7b132eeadf35c07c12355355aecd5ef4a21";
    app.get("/api/getSkinBalances", async (res) => {
        setCORSHeaders(res);

        try {
            const provider = new ethers.JsonRpcProvider(RPC);
            const skins = await fetchCollectionMetadata(skinAddress, provider, res);

            if (res.aborted) return;

            res.writeHeader("Content-Type", "application/json").end(JSON.stringify({
                success: true,
                skins
            }));
        } catch (err: any) {
            console.error(err);
            if (!res.aborted) {
                res.writeHeader("Content-Type", "application/json").end(JSON.stringify({
                    success: false,
                    error: err.message || "Failed to fetch skin data"
                }));
            }
        }
    });
}

export function getMeleeBalances(app: TemplatedApp) {
    const meleeAddress = "0xfe2cfd8c98add2c63b41dc19e353707f5e8238e9";
    app.get("/api/getMeleeBalances", async (res) => {
        setCORSHeaders(res);

        try {
            const provider = new ethers.JsonRpcProvider(RPC);
            const melees = await fetchCollectionMetadata(meleeAddress, provider, res);

            if (res.aborted) return;

            res.writeHeader("Content-Type", "application/json").end(JSON.stringify({
                success: true,
                melees
            }));
        } catch (err: any) {
            console.error(err);
            if (!res.aborted) {
                res.writeHeader("Content-Type", "application/json").end(JSON.stringify({
                    success: false,
                    error: err.message || "Failed to fetch melee data"
                }));
            }
        }
    });
}
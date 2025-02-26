import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { HttpResponse, TemplatedApp } from "uWebSockets.js";
import dotenv from "dotenv";
import { resolve } from "path";
import * as https from "https"; // Using Node.js built-in https module

const envPath = resolve(__dirname, "../.env");
dotenv.config({ path: envPath });

const RPC = process.env.ETH_RPC_URL || "";

// Extended ERC1155 interface for uri(), balanceOfBatch
const ERC1155_ABI = [
    "function uri(uint256 _id) view returns (string)",
    "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[] balances)"
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

interface BalanceResult {
    name: string;
    tokenId: number;
    balance: string; // Changed to string to handle BigInt serialization
}

interface RequestBody {
    name: string | string[];
    address: string;
}

async function fetchMetadataForToken(
    tokenId: number,
    cid: string,
    res: HttpResponse
): Promise<TokenMetadata | null> {
    let aborted = false;
    res.onAborted(() => {
        aborted = true;
    });

    if (aborted) throw new Error("Request aborted");

    const metadataUrl = `https://ipfs-gw.openmark.io/ipfs/${cid}/${tokenId}`;
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

    if (aborted) throw new Error("Request aborted");

    if (metadata) {
        return {
            id: tokenId,
            name: metadata.name || `Token #${tokenId}`,
        };
    }
    return null;
}

function createBalanceEndpoint(app: TemplatedApp, contractAddress: string, endpoint: string) {
    app.post(`/${endpoint}`, (res) => {
        setCORSHeaders(res);

        let aborted = false;
        let body = '';
        res.onAborted(() => {
            aborted = true;
        });

        res.onData((arrayBuffer, isLast) => {
            if (aborted) return;

            const chunk = Buffer.from(arrayBuffer).toString();
            body += chunk;

            if (isLast) { // When the last chunk is received
                processBody(body, res, aborted, contractAddress);
            }
        });
    });

    async function processBody(body: string, res: HttpResponse, aborted: boolean, contractAddress: string) {
        if (aborted) return;

        let requestBody: RequestBody;
        try {
            requestBody = JSON.parse(body);
        } catch (err) {
            res.writeHeader("Content-Type", "application/json").end(JSON.stringify({
                success: false,
                error: "Invalid request payload"
            }));
            return;
        }

        const { name, address } = requestBody;
        if (!name || !address) {
            res.writeHeader("Content-Type", "application/json").end(JSON.stringify({
                success: false,
                error: "Missing name or address"
            }));
            return;
        }

        try {
            const provider = new ethers.JsonRpcProvider(RPC);
            const contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);

            // 1. Get URI of collection
            const tokenUri: string = await contract.uri(0); // Assuming 0 works for base URI
            const cid = tokenUri.split("ipfs://")[1].split("/{id}")[0];

            // 2. Process names (single or array)
            const names = Array.isArray(name) ? name : [name];
            const tokenIds: number[] = [];
            const verifiedMetadata: TokenMetadata[] = [];

            for (const name of names) {
                if (aborted) throw new Error("Request aborted");

                // Parse token ID from name (e.g., "Finland #46" -> 46)
                const match = name.match(/#(\d+)$/);
                if (!match) {
                    continue; // Skip invalid names
                }
                const tokenId = parseInt(match[1], 10);

                // Fetch metadata for this token ID
                const metadata = await fetchMetadataForToken(tokenId, cid, res);
                if (aborted) throw new Error("Request aborted");

                if (metadata && metadata.name === name) {
                    tokenIds.push(tokenId);
                    verifiedMetadata.push(metadata);
                }
            }

            if (aborted) return;

            // 3. Call balanceOfBatch for the address and verified token IDs
            if (tokenIds.length > 0) {
                const accounts = Array(tokenIds.length).fill(address);
                const balances = await contract.balanceOfBatch(accounts, tokenIds);

                // 4. Prepare response with balances (convert BigInt to string)
                const results: BalanceResult[] = tokenIds.map((tokenId, index) => ({
                    name: verifiedMetadata[index].name,
                    tokenId,
                    balance: balances[index].toString(), // Convert BigInt to string
                }));

                res.writeHeader("Content-Type", "application/json").end(JSON.stringify({
                    success: true,
                    balances: results
                }));
            } else {
                res.writeHeader("Content-Type", "application/json").end(JSON.stringify({
                    success: true,
                    balances: []
                }));
            }
        } catch (err: any) {
            console.error(err);
            if (!res.aborted) {
                res.writeHeader("Content-Type", "application/json").end(JSON.stringify({
                    success: false,
                    error: err.message || `Failed to fetch ${endpoint} data`
                }));
            }
        }
    }
}

export function getSkinBalances(app: TemplatedApp) {
    createBalanceEndpoint(app, "0x9a91e7b132eeadf35c07c12355355aecd5ef4a21", "api/getSkinBalances");
}

export function getMeleeBalances(app: TemplatedApp) {
    createBalanceEndpoint(app, "0xfe2cfd8c98add2c63b41dc19e353707f5e8238e9", "api/getMeleeBalances");
}
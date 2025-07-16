import { ethers } from 'ethers';
import { Config } from '../../../config';

interface TokenBalancesResult {
    success: boolean;
    balances: FormattedBalance[];
}

interface FormattedBalance {
    contractType: string;
    contractAddress: string;
    accountAddress: string;
    tokenID: number;
    balance: number;
}

interface MintResult {
    address: string;
    values: [number, number][];
}

// ABI for the TransferSingle event
const TRANSFER_SINGLE_ABI = [
    'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)'
];

const SEQUENCE_INDEXER_BASE_URL = "https://somnia-testnet-indexer.sequence.app/rpc/Indexer";
const CHAIN_ID = "somnia-testnet";

async function getTokenBalances(
    accountAddresses: string[],
    contractAddresses: string[],
): Promise<TokenBalancesResult> {
    try {
        let allBalances: FormattedBalance[] = [];
        let after: string | undefined = undefined;

        do {
            const response = await fetch(`${SEQUENCE_INDEXER_BASE_URL}/GetTokenBalancesByContract`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Access-Key": Config.publicSequenceKey,
                },
                body: JSON.stringify({
                    chainID: CHAIN_ID,
                    // omitMetadata: true,
                    maxBlockWait: 10,
                    filter: {
                        contractStatus: "ALL",
                        accountAddresses,
                        contractAddresses,
                    },
                    ...(after ? { page: { after } } : {}),
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data: any = await response.json();
            const pageBalances = data.balances.map((item: any) => ({
                contractType: item.contractType,
                contractAddress: item.contractAddress,
                accountAddress: item.accountAddress,
                tokenID: parseInt(item.tokenID),
                balance: parseInt(item.balance),
            }));


            allBalances = [...allBalances, ...pageBalances];
            after = data.page?.more ? data.page.after : undefined;
        } while (after);

        return {
            success: true,
            balances: allBalances,
        };
    } catch (error) {
        console.error("Error fetching token balances:", error);
        return {
            success: false,
            balances: [],
        };
    }
}

async function getTokenMints(txnHash: string): Promise<MintResult[]> {
    try {
        // Make the POST request using fetch
        const response = await fetch(`${SEQUENCE_INDEXER_BASE_URL}/FetchTransactionReceipt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Access-Key': Config.publicSequenceKey,
            },
            body: JSON.stringify({
                chainID: CHAIN_ID,
                txnHash: txnHash,
                 maxBlockWait: 10,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data: any = await response.json();

        // Find all TransferSingle event logs
        const transferSingleTopic = ethers.id('TransferSingle(address,address,address,uint256,uint256)');
        const transferSingleLogs = data.receipt.logs.filter(
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
            const contractAddress = log.contractAddress.toLowerCase();

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
        throw new Error(`Error fetching ERC-1155 mints: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}


export { getTokenBalances, getTokenMints };
export type { MintResult, FormattedBalance };


import {
    SilverSkinsMapping,
    GoldSkinsMapping,
    DivineSkinsMapping,
    SilverArmsMapping,
    GoldArmsMapping,
    DivineArmsMapping,
    DivineGunsMapping,
    SurvivMemesMapping,
    SurvivCardsMapping,
} from "@common/mappings";
import { ethers } from "ethers";
import { Config } from "../config";

export async function verifySkin(player: string, item: string, timeout: number = 7000): Promise<boolean> {
    const rpc = Config.assetsConfig?.rpc;
    if (!rpc) throw new Error("RPC configuration not found");

    // Initialize provider
    const provider = new ethers.JsonRpcProvider(rpc);

    // List of skin mappings to check
    const skinMappings = [
        { mapping: SilverSkinsMapping },
        { mapping: GoldSkinsMapping },
        { mapping: DivineSkinsMapping },
    ];

    // Iterate through each mapping
    for (const { mapping } of skinMappings) {
        if (mapping.assets.includes(item)) {
            // Get token ID (index of item in assets array)
            const tokenId = mapping.assets.indexOf(item);

            try {
                // Create contract instance
                const contract = new ethers.Contract(
                    mapping.address,
                    ["function balanceOf(address account, uint256 id) view returns (uint256)"],
                    provider
                );

                // Set up timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                try {
                    // Get balance with timeout
                    const balance = await Promise.race([
                        contract.balanceOf(player, tokenId),
                        new Promise((_, reject) => {
                            controller.signal.addEventListener('abort', () => {
                                reject(new Error('Request timed out'));
                            });
                        })
                    ]);

                    clearTimeout(timeoutId);
                    // Convert balance to number and check if player owns at least 1
                    return balance > 0n;
                } catch (error: any) {
                    clearTimeout(timeoutId);
                    if (error.message === 'Request timed out') {
                        throw error;
                    }
                    throw error;
                }
            } catch (error) {
                console.error(`Error checking item ${item}:`, error);
                return false;
            }
        }
    }

    // Item not found in any mapping
    return false;
}

export async function verifyMelee(player: string, item: string, timeout: number = 5000): Promise<boolean> {
    const rpc = Config.assetsConfig?.rpc;
    if (!rpc) throw new Error("RPC configuration not found");

    // Initialize provider
    const provider = new ethers.JsonRpcProvider(rpc);

    // List of melee mappings to check
    const meleeMappings = [
        { mapping: SilverArmsMapping },
        { mapping: GoldArmsMapping },
        { mapping: DivineArmsMapping },
    ];

    // Iterate through each mapping
    for (const { mapping } of meleeMappings) {
        if (mapping.assets.includes(item)) {
            // Get token ID (index of item in assets array)
            const tokenId = mapping.assets.indexOf(item);

            try {
                // Create contract instance
                const contract = new ethers.Contract(
                    mapping.address,
                    ["function balanceOf(address account, uint256 id) view returns (uint256)"],
                    provider
                );

                // Set up timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                try {
                    // Get balance with timeout
                    const balance = await Promise.race([
                        contract.balanceOf(player, tokenId),
                        new Promise((_, reject) => {
                            controller.signal.addEventListener('abort', () => {
                                reject(new Error('Request timed out'));
                            });
                        })
                    ]);

                    clearTimeout(timeoutId);
                    // Convert balance to number and check if player owns at least 1
                    return balance > 0n;
                } catch (error: any) {
                    clearTimeout(timeoutId);
                    if (error.message === 'Request timed out') {
                        throw error;
                    }
                    throw error;
                }
            } catch (error) {
                console.error(`Error checking for item ${item}:`, error);
                return false;
            }
        }
    }

    // Item not found in any mapping
    return false;
}

export async function verifyEmotes(player: string, items: string[], timeout: number = 5000): Promise<string[]> {
    const rpc = Config.assetsConfig?.rpc;
    if (!rpc) throw new Error("RPC configuration not found");

    // Initialize provider
    const provider = new ethers.JsonRpcProvider(rpc);

    // List of emote mappings to check
    const emoteMappings = [
        { mapping: SurvivMemesMapping, type: "SurvivMemes" },
    ];

    // Initialize result array
    const result = new Array(items.length).fill("");

    // Group items by their mapping to optimize batch calls
    const itemsByMapping = new Map<string, { items: string[], indices: number[] }>();
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let itemFound = false;

        for (const { mapping, type } of emoteMappings) {
            if (mapping.assets.includes(item)) {
                itemFound = true;
                const tokenId = mapping.assets.indexOf(item);
                const key = `${type}-${mapping.address}`;

                if (!itemsByMapping.has(key)) {
                    itemsByMapping.set(key, { items: [], indices: [] });
                }
                itemsByMapping.get(key)!.items.push(item);
                itemsByMapping.get(key)!.indices.push(i);
                break;
            }
        }

        // If item not found in any mapping, keep empty string in result
        if (!itemFound) {
            console.log(`Item ${item} not found in any emote mapping`);
        }
    }

    // Process each mapping's items in batch
    for (const [key, { items: mappingItems, indices }] of itemsByMapping) {
        const [, address] = key.split('-');
        try {
            // Create contract instance
            const contract = new ethers.Contract(
                address,
                ["function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])"],
                provider
            );

            // Prepare batch inputs
            const tokenIds = mappingItems.map(item => SurvivMemesMapping.assets.indexOf(item));
            const accounts = new Array(mappingItems.length).fill(player);

            // Set up timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                // Get balances with timeout
                const balances = await Promise.race([
                    contract.balanceOfBatch(accounts, tokenIds),
                    new Promise((_, reject) => {
                        controller.signal.addEventListener('abort', () => {
                            reject(new Error('Request timed out'));
                        });
                    })
                ]);

                clearTimeout(timeoutId);

                // Update result array based on balances
                balances.forEach((balance: bigint, index: number) => {
                    if (balance > 0n) {
                        result[indices[index]] = mappingItems[index];
                    }
                });
            } catch (error: any) {
                clearTimeout(timeoutId);
                if (error.message === 'Request timed out') {
                    throw error;
                }
                throw error;
            }
        } catch (error) {
            console.error(`Error checking items for mapping ${key}:`, error);
            // Keep empty strings for failed checks
        }
    }

    return result;
}

export async function verifyGun(player: string, item: string, timeout: number = 5000): Promise<boolean> {
    const rpc = Config.assetsConfig?.rpc;
    if (!rpc) throw new Error("RPC configuration not found");

    // Initialize provider
    const provider = new ethers.JsonRpcProvider(rpc);

    // List of gun mappings to check
    const gunMappings = [
        { mapping: DivineGunsMapping },
    ];

    // Iterate through each mapping
    for (const { mapping } of gunMappings) {
        if (mapping.assets.includes(item)) {
            // Get token ID (index of item in assets array)
            const tokenId = mapping.assets.indexOf(item);

            try {
                // Create contract instance
                const contract = new ethers.Contract(
                    mapping.address,
                    ["function balanceOf(address account, uint256 id) view returns (uint256)"],
                    provider
                );

                // Set up timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                try {
                    // Get balance with timeout
                    const balance = await Promise.race([
                        contract.balanceOf(player, tokenId),
                        new Promise((_, reject) => {
                            controller.signal.addEventListener('abort', () => {
                                reject(new Error('Request timed out'));
                            });
                        })
                    ]);

                    clearTimeout(timeoutId);
                    // Convert balance to number and check if player owns at least 1
                    return balance > 0n;
                } catch (error: any) {
                    clearTimeout(timeoutId);
                    if (error.message === 'Request timed out') {
                        throw error;
                    }
                    throw error;
                }
            } catch (error) {
                console.error(`Error checkingr item ${item}:`, error);
                return false;
            }
        }
    }

    // Item not found in any mapping
    return false;
}
import { ethers } from 'ethers';
import { SurvivAssetRanges, SurvivAssetsMapping, SurvivBadgesMapping } from '@common/blockchain'; // Adjust path as needed
import { EMOTE_SLOTS } from '@common/constants';
import { BadgeDefinition, Badges } from '@common/definitions/badges';
import { EmoteDefinition, Emotes } from '@common/definitions/emotes';
import { GunDefinition, Guns } from '@common/definitions/guns';
import { MeleeDefinition, Melees } from '@common/definitions/melees';
import { SkinDefinition, Skins, DEFAULT_SKIN } from '@common/definitions/skins';
import { Blockchain, getSurvivAddress } from '@common/blockchain/contracts';
import { VehicleDefinition, Vehicles } from '@common/definitions/vehicle';

interface Mapping {
    address: string;
    assets: string[] | string[][];
}

export enum SurvivBadges {
    Cards = 0
}

interface AssetCheckResult {
    isValid: boolean;
    validItems: string[];
    tokenIds: number[];
    balances: bigint[];
}

interface VerifiedAssets {
    skin: SkinDefinition | undefined;
    melee: MeleeDefinition | undefined;
    gun: GunDefinition | undefined;
    emotes: readonly (EmoteDefinition | undefined)[];
    vehicles: (VehicleDefinition)[];
}

/**
 * Check asset balances for a player using SurvivAssetsMapping.
 * @param player - The player's address
 * @param items - Array of items to check
 * @param timeout - Timeout in milliseconds
 */
async function getAssetsBalance(
    player: string,
    rpc: string,
    assetsAddress: string,
    items: string[],
    timeout: number = 3000
): Promise<AssetCheckResult> {
    if (!rpc) throw new Error('RPC configuration not found');

    const provider = new ethers.JsonRpcProvider(rpc);

    // Initialize result arrays
    const result: string[] = new Array(items.length).fill('');
    const tokenIds: number[] = [];
    const itemIndices: number[] = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let itemFound = false;

        for (const index of Object.values(SurvivAssetRanges).flatMap(r => r.mappingIndices)) {
            const subArray = (SurvivAssetsMapping.assets[index] || []) as string[];
            if (subArray.includes(item)) {
                const tokenId = index * 1000 + subArray.indexOf(item);
                tokenIds.push(tokenId);
                itemIndices.push(i);
                itemFound = true;
                break;
            }
        }

        if (!itemFound) {
            console.log(`Item ${item} not found in SurvivAssetsMapping`);
        }
    }

    if (tokenIds.length === 0) {
        return { isValid: false, validItems: [], tokenIds: [], balances: [] };
    }

    try {
        const contract = new ethers.Contract(
            assetsAddress,
            ['function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])'],
            provider
        );

        const accounts = new Array(tokenIds.length).fill(player);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const balances = await Promise.race([
                contract.balanceOfBatch(accounts, tokenIds),
                new Promise((_, reject) => {
                    controller.signal.addEventListener('abort', () => {
                        reject(new Error('Request timed out'));
                    });
                })
            ]);

            clearTimeout(timeoutId);

            balances.forEach((balance: bigint, index: number) => {
                if (balance > 0n) {
                    result[itemIndices[index]] = items[itemIndices[index]];
                }
            });

            return {
                isValid: result.some(item => item !== ''),
                validItems: result.filter(item => item !== ''),
                tokenIds,
                balances
            };
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.message === 'Request timed out') {
                throw error;
            }
            throw error;
        }
    } catch (error: any) {
        console.error(`Error checking items for SurvivAssetsMapping:`, error.message);
        return { isValid: false, validItems: [], tokenIds: [], balances: [] };
    }
}

/**
 * Check balances for a player using a generic mapping (e.g., SurvivBadgesMapping).
 * @param player - The player's address
 * @param items - Array of items to check
 * @param mapping - The mapping to check against
 * @param timeout - Timeout in milliseconds
 */
async function getBalance(
    player: string,
    rpc: string,
    items: string[],
    mapping: Mapping,
    timeout: number = 3000
): Promise<AssetCheckResult> {
    if (!rpc) throw new Error('RPC configuration not found');

    if (!mapping || !mapping.address || !Array.isArray(mapping.assets)) {
        throw new Error('Invalid mapping configuration');
    }

    if (!ethers.isAddress(mapping.address)) {
        throw new Error(`Invalid contract address: ${mapping.address}`);
    }

    const provider = new ethers.JsonRpcProvider(rpc);

    // Initialize result arrays
    const result: string[] = new Array(items.length).fill('');
    const tokenIds: number[] = [];
    const itemIndices: number[] = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const assets = mapping.assets as string[];
        if (assets.includes(item)) {
            const tokenId = assets.indexOf(item);
            tokenIds.push(tokenId);
            itemIndices.push(i);
        } else {
            console.log(`Item ${item} not found in mapping`);
        }
    }

    if (tokenIds.length === 0) {
        return { isValid: false, validItems: [], tokenIds: [], balances: [] };
    }

    try {
        const contract = new ethers.Contract(
            mapping.address,
            ['function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])'],
            provider
        );

        const accounts = new Array(tokenIds.length).fill(player);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const balances = await Promise.race([
                contract.balanceOfBatch(accounts, tokenIds),
                new Promise((_, reject) => {
                    controller.signal.addEventListener('abort', () => {
                        reject(new Error('Request timed out'));
                    });
                })
            ]);

            clearTimeout(timeoutId);

            balances.forEach((balance: bigint, index: number) => {
                if (balance > 0n) {
                    result[itemIndices[index]] = items[itemIndices[index]];
                }
            });

            return {
                isValid: result.some(item => item !== ''),
                validItems: result.filter(item => item !== ''),
                tokenIds,
                balances
            };
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.message === 'Request timed out') {
                throw error;
            }
            throw error;
        }
    } catch (error: any) {
        console.error(`Error checking items for mapping ${mapping.address}:`, error.message);
        return { isValid: false, validItems: [], tokenIds: [], balances: [] };
    }
}


export async function verifyAllAssets(
    player: string,
    rpc: string,
    assetsAddress: string,
    assets: {
        skin?: string;
        melee?: string;
        gun?: string;
        emotes?: (string | undefined)[];
        vehicles?: string[];
    },
    timeout: number = 2000
): Promise<VerifiedAssets> {
    // Default values
    let result: VerifiedAssets = {
        skin: Skins.fromStringSafe(DEFAULT_SKIN),
        melee: undefined,
        gun: undefined,
        emotes: EMOTE_SLOTS.map(() => undefined),
        vehicles: [],
    };

    try {
        // Collect all items
        const allItems = [
            ...(assets.skin ? [{ type: 'skin', value: assets.skin }] : []),
            ...(assets.melee ? [{ type: 'melee', value: assets.melee }] : []),
            ...(assets.gun ? [{ type: 'gun', value: assets.gun }] : []),
            ...(assets.emotes ? assets.emotes.map(value => ({ type: 'emotes', value: value || '' })) : []),
            ...(Vehicles.definitions.map(vehicle => ({ type: 'vehicles', value: vehicle.idString || '' }))),
        ];

        console.log("allItems: ", allItems);
        // Prepare items for SurvivAssetsMapping
        const items = allItems.map(item => item.value);
        const itemTypes = allItems.map(item => item.type);

        if (items.length === 0) {
            return result;
        }

        // Verify balances
        const checkResult = await getAssetsBalance(player, rpc, assetsAddress, items, timeout);

        // Process results
        const emoteResults: string[] = [];
        const vehicleResults: VehicleDefinition[] = [];

        checkResult.validItems.forEach((validItem, index) => {
            const itemIndex = items.indexOf(validItem);
            const type = itemTypes[itemIndex];
            if (type === 'skin') {
                result.skin = Skins.fromStringSafe(validItem);
            } else if (type === 'melee') {
                result.melee = Melees.fromStringSafe(validItem);
            } else if (type === 'gun') {
                result.gun = Guns.fromStringSafe(validItem);
            } else if (type === 'emotes') {
                emoteResults.push(validItem);
            } else if(type === 'vehicles') {
                const validVehicle = Vehicles.fromStringSafe(validItem);
                if(validVehicle) vehicleResults.push(validVehicle);
            }
        });

        if (emoteResults.length > 0) {
            result.emotes = EMOTE_SLOTS.map((_, i) => Emotes.fromStringSafe(emoteResults[i] || ''));
        }
        result.vehicles = vehicleResults;
    } catch (err) {
        console.error('Asset verification failed:', err);
        // Return defaults on error
    }

    return result;
}



/**
 * Verify badge for a player using SurvivBadgesMapping and calculate total boost.
 * @param player - The player's address
 * @param badge - The badge item to verify
 * @param timeout - Timeout in milliseconds
 * @returns An object containing the BadgeDefinition (if valid) and the total boost percentage
 */
export async function verifyBadges(
    player: string,
    rpc: string,
    badgeAddress: string,
    badge: string,
    timeout: number = 2000
): Promise<{ badgeDefinition: BadgeDefinition | undefined; totalBoost: number }> {
    if (!badge) {
        return { badgeDefinition: undefined, totalBoost: 0 };
    }

    try {
        // Pass all badges from SurvivBadgesMapping.assets to getBalance
        const checkResult = await getBalance(player, rpc, SurvivBadgesMapping.assets,
            { address: badgeAddress, assets: SurvivBadgesMapping.assets }, timeout);

        let totalBoost = 0;
        if (checkResult.isValid && checkResult.validItems.length > 0) {
            // Calculate total boost from all owned badges
            checkResult.validItems.forEach((badgeId: string) => {
                const mappingIndex = SurvivBadgesMapping.assets.indexOf(badgeId);
                if (mappingIndex !== -1) {
                    const amount = Number(checkResult.balances[mappingIndex]); // Convert bigint to number
                    totalBoost += SurvivBadgesMapping.boosts[mappingIndex] * amount;
                }
            });
        }

        // Cap total boost at 300%
        if (totalBoost >= 300) {
            totalBoost = 300;
        }

        // Verify the requested badge
        const badgeDefinition = checkResult.isValid && checkResult.validItems.includes(badge)
            ? Badges.fromStringSafe(badge)
            : undefined;

        return { badgeDefinition, totalBoost };
    } catch (err) {
        console.error('Badge verification failed:', err);
        return { badgeDefinition: undefined, totalBoost: 0 };
    }
}
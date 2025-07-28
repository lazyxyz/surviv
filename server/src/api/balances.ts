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
import { EMOTE_SLOTS } from "@common/constants";
import { BadgeDefinition, Badges } from "@common/definitions/badges";
import { EmoteDefinition, Emotes } from "@common/definitions/emotes";
import { GunDefinition, Guns } from "@common/definitions/guns";
import { MeleeDefinition, Melees } from "@common/definitions/melees";
import { SkinDefinition, Skins, DEFAULT_SKIN } from "@common/definitions/skins";

interface Mapping {
    address: string;
    assets: string[];
}

interface AssetCheckResult {
    isValid: boolean;
    validItems: string[];
}

/**
 * Common function to check asset balances for a player
 * @param player - The player's address
 * @param items - Array of items to check
 * @param mappings - Array of mappings to check against
 * @param timeout - Timeout in milliseconds
 */
async function getAssetsBalance(
    player: string,
    items: string[],
    mappings: { mapping: Mapping }[],
    timeout: number = 3000
): Promise<AssetCheckResult> {
    const rpc = Config.assetsConfig?.rpc;
    if (!rpc) throw new Error("RPC configuration not found");

    const provider = new ethers.JsonRpcProvider(rpc);

    // Initialize result array
    const result = new Array(items.length).fill("");

    // Group items by their mapping to optimize batch calls
    const itemsByMapping = new Map<string, { items: string[], indices: number[] }>();
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let itemFound = false;

        for (const { mapping } of mappings) {
            if (mapping.assets.includes(item)) {
                itemFound = true;
                const tokenId = mapping.assets.indexOf(item);
                const key = mapping.address;

                if (!itemsByMapping.has(key)) {
                    itemsByMapping.set(key, { items: [], indices: [] });
                }
                itemsByMapping.get(key)!.items.push(item);
                itemsByMapping.get(key)!.indices.push(i);
                break;
            }
        }

        if (!itemFound) {
            console.log(`Item ${item} not found in any mapping`);
        }
    }

    // Process each mapping's items in batch
    for (const [address, { items: mappingItems, indices }] of itemsByMapping) {
        try {
            const contract = new ethers.Contract(
                address,
                ["function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])"],
                provider
            );

            const tokenIds = mappingItems.map(item => mappings.find(m => m.mapping.address === address)!.mapping.assets.indexOf(item));
            const accounts = new Array(mappingItems.length).fill(player);

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
        } catch (error: any) {
            console.error(`Error checking items for mapping ${address}:`, error.message);
        }
    }

    return {
        isValid: result.some(item => item !== ""),
        validItems: result
    };
}

interface VerifiedAssets {
    skin: SkinDefinition | undefined;
    melee: MeleeDefinition | undefined;
    gun: GunDefinition | undefined;
    emotes: readonly (EmoteDefinition | undefined)[];
    badge: BadgeDefinition | undefined;
}

/**
 * Verify all assets for a player in a single call
 * @param player - The player's address
 * @param assets - Object containing skin, melee, gun, emotes, and badge
 * @param timeout - Timeout in milliseconds
 */
export async function verifyAllAssets(
    player: string,
    assets: {
        skin: string;
        melee: string;
        gun: string;
        emotes: string;
        badge: string;
    },
    timeout: number = 2000
): Promise<VerifiedAssets> {
    const skinMappings = [
        { mapping: SilverSkinsMapping },
        { mapping: GoldSkinsMapping },
        { mapping: DivineSkinsMapping },
    ];
    const meleeMappings = [
        { mapping: SilverArmsMapping },
        { mapping: GoldArmsMapping },
        { mapping: DivineArmsMapping },
    ];
    const gunMappings = [
        { mapping: DivineGunsMapping },
    ];
    const emoteMappings = [
        { mapping: SurvivMemesMapping },
    ];
    const badgeMappings = [
        { mapping: SurvivCardsMapping },
    ];

    // Default values
    let result: VerifiedAssets = {
        skin: Skins.fromStringSafe(DEFAULT_SKIN),
        melee: undefined,
        gun: undefined,
        emotes: EMOTE_SLOTS.map(() => undefined),
        badge: undefined,
    };

    try {
        // Verify all assets in parallel
        const [
            badgeResult,
            skinResult,
            meleeResult,
            gunResult,
            emotesResult,
        ] = await Promise.all([
            assets.badge ? getAssetsBalance(player, [assets.badge], badgeMappings, timeout) : null,
            assets.skin ? getAssetsBalance(player, [assets.skin], skinMappings, timeout) : null,
            assets.melee ? getAssetsBalance(player, [assets.melee], meleeMappings, timeout) : null,
            assets.gun ? getAssetsBalance(player, [assets.gun], gunMappings, timeout) : null,
            assets.emotes ? getAssetsBalance(player, assets.emotes.split(',').filter(e => e), emoteMappings, timeout) : null,
        ]);

        // Process results
        if (badgeResult?.isValid && badgeResult.validItems[0]) {
            result.badge = Badges.fromStringSafe(badgeResult.validItems[0]);
        }

        if (skinResult?.isValid && skinResult.validItems[0]) {
            result.skin = Skins.fromStringSafe(skinResult.validItems[0]);
        }

        if (meleeResult?.isValid && meleeResult.validItems[0]) {
            result.melee = Melees.fromStringSafe(meleeResult.validItems[0]);
        }

        if (gunResult?.isValid && gunResult.validItems[0]) {
            result.gun = Guns.fromStringSafe(gunResult.validItems[0]);
        }

        if (emotesResult) {
            result.emotes = emotesResult.validItems.map(emoteId => Emotes.fromStringSafe(emoteId));
        }
    } catch (err) {
        console.error("Asset verification failed:", err);
        // Return defaults on error
    }

    return result;
}

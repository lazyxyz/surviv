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

export async function verifySkin(player: string, item: string): Promise<boolean> {
    const rpc = Config.assetsConfig?.rpc;
    if (!rpc) throw new Error("RPC configuration not found");

    // Initialize provider
    const provider = new ethers.JsonRpcProvider(rpc);

    // List of skin mappings to check
    const skinMappings = [
        { mapping: SilverSkinsMapping, type: "SilverSkins" },
        { mapping: GoldSkinsMapping, type: "GoldSkins" },
        { mapping: DivineSkinsMapping, type: "DivineSkins" },
    ];

    // Iterate through each mapping
    for (const { mapping, type } of skinMappings) {
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

                // Get balance
                const balance = await contract.balanceOf(player, tokenId);
                // Convert balance to number and check if player owns at least 1
                return balance > 0n;
            } catch (error) {
                console.error(`Error checking ${type} for item ${item}:`, error);
                return false;
            }
        }
    }

    // Item not found in any mapping
    return false;
}

export async function verifyMelee(player: string, item: string): Promise<boolean> {
    const rpc = Config.assetsConfig?.rpc;
    if (!rpc) throw new Error("RPC configuration not found");

    // Initialize provider
    const provider = new ethers.JsonRpcProvider(rpc);

    // List of melee mappings to check
    const meleeMappings = [
        { mapping: SilverArmsMapping, type: "SilverArms" },
        { mapping: GoldArmsMapping, type: "GoldArms" },
        { mapping: DivineArmsMapping, type: "DivineArms" },
    ];

    // Iterate through each mapping
    for (const { mapping, type } of meleeMappings) {
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

                // Get balance
                const balance = await contract.balanceOf(player, tokenId);
                // Convert balance to number and check if player owns at least 1
                return balance > 0n;
            } catch (error) {
                console.error(`Error checking ${type} for item ${item}:`, error);
                return false;
            }
        }
    }

    // Item not found in any mapping
    return false;
}

export async function verifyEmotes(player: string, items: string[]): Promise<boolean> {
    const rpc = Config.assetsConfig?.rpc;
    if (!rpc) throw new Error("RPC configuration not found");

    // Initialize provider
    const provider = new ethers.JsonRpcProvider(rpc);

    // List of emote mappings to check
    const emoteMappings = [
        { mapping: SurvivMemesMapping, type: "SurvivMemes" },
        { mapping: SurvivCardsMapping, type: "SurvivCards" },
    ];

    // Check each item in the provided list
    for (const item of items) {
        let itemFound = false;

        // Iterate through each mapping
        for (const { mapping, type } of emoteMappings) {
            if (mapping.assets.includes(item)) {
                itemFound = true;
                // Get token ID (index of item in assets array)
                const tokenId = mapping.assets.indexOf(item);
                
                try {
                    // Create contract instance
                    const contract = new ethers.Contract(
                        mapping.address,
                        ["function balanceOf(address account, uint256 id) view returns (uint256)"],
                        provider
                    );

                    // Get balance
                    const balance = await contract.balanceOf(player, tokenId);
                    // If player doesn't own this item, return false
                    if (balance <= 0n) {
                        return false;
                    }
                } catch (error) {
                    console.error(`Error checking ${type} for item ${item}:`, error);
                    return false;
                }
            }
        }

        // If item not found in any mapping, return false
        if (!itemFound) {
            console.log(`Item ${item} not found in any emote mapping`);
            return false;
        }
    }

    // All items were found and player owns all of them
    return true;
}


export async function verifyGun(player: string, item: string): Promise<boolean> {
    const rpc = Config.assetsConfig?.rpc;
    if (!rpc) throw new Error("RPC configuration not found");

    // Initialize provider
    const provider = new ethers.JsonRpcProvider(rpc);

    // List of gun mappings to check
    const gunMappings = [
        { mapping: DivineGunsMapping, type: "DivineGuns" },
    ];

    // Iterate through each mapping
    for (const { mapping, type } of gunMappings) {
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

                // Get balance
                const balance = await contract.balanceOf(player, tokenId);
                // Convert balance to number and check if player owns at least 1
                return balance > 0n;
            } catch (error) {
                console.error(`Error checking ${type} for item ${item}:`, error);
                return false;
            }
        }
    }

    // Item not found in any mapping
    return false;
}
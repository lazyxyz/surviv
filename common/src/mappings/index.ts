export { assetsMapping as SurvivAssetsMapping } from "./SurvivAssets";
export { assetsMapping as SurvivKitsMapping } from "./SurvivKits";
export { assetsMapping as SurvivBadgesMapping } from "./SurvivBages";
export { assetsMapping as SurvivMapping } from "./Surviv";

export enum SurvivAssets {
    Skins,
    Emotes,
    Arms,
    Guns
}

// Mapping of SurvivAssets to indices in SurvivAssetsMapping.assets
export const SurvivAssetRanges: Record<SurvivAssets, { mappingIndices: number[] }> = {
    [SurvivAssets.Skins]: {
        mappingIndices: [0, 1, 2] // SilverSkins, GoldSkins, DivineSkins
    },
    [SurvivAssets.Emotes]: {
        mappingIndices: [3] // SurvivMemes
    },
    [SurvivAssets.Arms]: {
        mappingIndices: [4, 5, 6] // SilverArms, GoldArms, DivineArms
    },
    [SurvivAssets.Guns]: {
        mappingIndices: [7, 8] // GoldGuns, DivineGuns
    }
};

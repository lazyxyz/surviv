import $ from 'jquery';
import { showBadges } from "./badges";
import { showEmotes } from "./emotes";
import { showShop } from "./shop";
import { showSkins } from "./skins";
import { showWeapons } from "./weapons";
import type { Account } from '../account';
import { GAME_CONSOLE } from '../..';
import { AssetTier, SurvivAssets } from '@common/mappings';
import { warningAlert } from '../modal';

// handler display change preview
export const updateSplashCustomize = (skinID: string): void => {
    $<HTMLDivElement>(".assets-base").attr(
        "href",
        `./img/game/shared/skins/${skinID}_base.svg`
    );

    $<HTMLDivElement>(".assets-fist").attr(
        "href",
        `./img/game/shared/skins/${skinID}_fist.svg`
    );

    $<HTMLDivElement>("#skin-base").css(
        "background-image",
        `url("./img/game/shared/skins/${skinID}_base.svg")`
    );

    $<HTMLDivElement>("#skin-left-fist, #skin-right-fist").css(
        "background-image",
        `url("./img/game/shared/skins/${skinID}_fist.svg")`
    );
};

// Store cached balances
export let SurvivAssetBalances: Record<SurvivAssets, Record<AssetTier, Record<string, number>>> = {
    [SurvivAssets.Skins]: {
        [AssetTier.Silver]: {},
        [AssetTier.Gold]: {},
        [AssetTier.Divine]: {}
    },
    [SurvivAssets.Emotes]: {
        [AssetTier.Silver]: {},
        [AssetTier.Gold]: {},
        [AssetTier.Divine]: {}
    },
    [SurvivAssets.Arms]: {
        [AssetTier.Silver]: {},
        [AssetTier.Gold]: {},
        [AssetTier.Divine]: {}
    },
    [SurvivAssets.Guns]: {
        [AssetTier.Silver]: {},
        [AssetTier.Gold]: {},
        [AssetTier.Divine]: {}
    }
};

export async function showInventory(account: Account) {
    $("#btn-customize").on('click', async () => {
        if (!account.address) {
            warningAlert("Please connect your wallet to continue!", 3000);
            return;
        }
        SurvivAssetBalances = await account.getAssetBalances();
        await showShop(account);
    })

    $('#tab-skins').on('click', async () => {
        await showSkins(account);
    })

    $('#tab-emotes').on('click', async () => {
        await showEmotes(account);
    })

    $('#tab-weapons').on('click', async () => {
        await showWeapons(account);
    })

    $('#tab-badges').on('click', async () => {
        await showBadges(account);
    })

    const idString = GAME_CONSOLE.getBuiltInCVar("cv_loadout_skin");
    updateSplashCustomize(idString);
}

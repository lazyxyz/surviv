import $ from 'jquery';
import { showBadges } from "./badges";
import { showEmotes } from "./emotes";
import { showShop } from "./shop";
import { showSkins } from "./skins";
import { showWeapons } from "./weapons";
import type { Account } from '../account';
import { GAME_CONSOLE } from '../..';
import { SurvivAssets } from '@common/mappings';

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
export let SurvivAssetBalances: Record<SurvivAssets, Record<string, number>> = {
    [SurvivAssets.Skins]: {},
    [SurvivAssets.Emotes]: {},
    [SurvivAssets.Arms]: {},
    [SurvivAssets.Guns]: {}
};

export async function showInventory(account: Account) {
    SurvivAssetBalances = await account.getAssetBalances();

    $("#btn-customize").on('click', async () => {
        showShop(account);
    })

    $('#tab-skins').on('click', () => {
        showSkins(account);
    })

    $('#tab-weapons').on('click', () => {
        showWeapons(account);
    })

    $('#tab-emotes').on('click', () => {
        showEmotes(account);
    })

    $('#tab-badges').on('click', () => {
        showBadges(account);
    })

    const idString = GAME_CONSOLE.getBuiltInCVar("cv_loadout_skin");
    updateSplashCustomize(idString);
}

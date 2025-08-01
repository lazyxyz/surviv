import $ from 'jquery';
import { showBadges } from "./badges";
import type { Game } from "../game";
import { showEmotes } from "./emotes";
import { showShop } from "./shop";
import { showSkins } from "./skins";
import { showWeapons } from "./weapons";
import type { Account } from '../account';
import { GAME_CONSOLE } from '../..';

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

export let InventoryCache: {
    shopLoaded: boolean,
    skinsLoaded: boolean,
    weaponsLoaded: boolean,
    badgesLoaded: boolean,
    emotesLoaded: boolean,
};

export async function showInventory(account: Account) {
    InventoryCache = {
        shopLoaded: false,
        skinsLoaded: false,
        weaponsLoaded: false,
        badgesLoaded: false,
        emotesLoaded: false,
    }

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



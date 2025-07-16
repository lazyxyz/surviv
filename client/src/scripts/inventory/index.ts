import $ from 'jquery';
import { showBadges } from "./badges";
import type { Game } from "../game";
import { showEmotes } from "./emotes";
import { showShop } from "./shop";
import { showSkins } from "./skins";
import { showWeapons } from "./weapons";

export let InventoryCache: {
    shopLoaded: boolean,
    skinsLoaded: boolean,
    weaponsLoaded: boolean,
    badgesLoaded: boolean,
    emotesLoaded: boolean,
};

export async function showInventory(game: Game) {
    InventoryCache = {
        shopLoaded: false,
        skinsLoaded: false,
        weaponsLoaded: false,
        badgesLoaded: false,
        emotesLoaded: false,
    }

    $("#btn-customize").on('click', async () => {
        showShop(game);
    })

    $('#tab-skins').on('click', () => {
        showSkins(game);
    })

    $('#tab-weapons').on('click', () => {
        showWeapons(game);
    })

    $('#tab-emotes').on('click', () => {
        showEmotes(game);
    })

    $('#tab-badges').on('click', () => {
        showBadges(game);
    })
}

import $ from "jquery";
import type { ReferenceTo } from "@common/utils/objectDefinitions";
import type { Game } from "../game";
import { Skins, type SkinDefinition } from "@common/definitions/skins";
import { getTranslatedString } from "../../translations";
import type { TranslationKeys } from "../../typings/translations";

import {
    SilverSkinsMapping,
    GoldSkinsMapping,
    DivineSkinsMapping,
} from "@common/mappings";
import { getTokenBalances } from "../utils/onchain/sequence";

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

// handler select and save skin
function selectSkin(idString: ReferenceTo<SkinDefinition>, game: Game): void {
    // remove previous selected
    $(".skins-list-item-container").removeClass("selected");

    // wait for dom
    setTimeout(() => $(`#skin-${idString}`).addClass("selected"), 0);

    game.console.setBuiltInCVar("cv_loadout_skin", idString);
    updateSplashCustomize(idString);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function showSkins(game: Game, newUnlockedSkinId?: string) {
    if (!game?.account?.address) return;

    const role = game.console.getBuiltInCVar("dv_role");
    const skinList = $<HTMLDivElement>("#skins-list");
    const currentSkin = game.console.getBuiltInCVar("cv_loadout_skin");


    const skinAddresses = [SilverSkinsMapping.address, GoldSkinsMapping.address, DivineSkinsMapping.address]
    let skinBalances = await getTokenBalances([game.account.address], skinAddresses);
    const skinsMappingList = [SilverSkinsMapping, GoldSkinsMapping, DivineSkinsMapping];

    const userSkins = skinBalances.balances
        .map(balance => {
            let itemId = "";
            skinsMappingList.forEach(mapping => {
                if (mapping.address === balance.contractAddress) {
                    itemId = mapping.assets[balance.tokenID];
                }
            });
            return itemId; // Return itemId regardless
        })
        .filter(itemId => !!itemId);

    /* */
    // Skins list
    const allSkins = Skins.definitions.filter(argument =>
        !(argument.hideFromLoadout || !(argument.rolesRequired ?? [role]).includes(role))
    );

    // inactive skins
    const inactiveSkins = allSkins
        .map(s => s.idString)
        .filter(id => ![, ...userSkins].includes(id));

    // sort skins
    const sortedSkinIds = [
        ...userSkins,
        ...inactiveSkins
    ];

    // reset items before render new
    skinList.empty();

    for (const idString of sortedSkinIds) {
        const skinDef = allSkins.find(s => s.idString === idString);
        if (!skinDef) continue;

        const isActive = [...(userSkins || [])].includes(idString);
        const isSelected = idString === currentSkin;

        const skinItem = $<HTMLDivElement>(`
          <div id="skin-${idString}" class="skins-list-item-container${isSelected ? " selected" : ""}">
            <div class="skin${isActive ? " active" : " inactive"}">
              <div class="skin-base" style="background-image: url('./img/game/shared/skins/${idString}_base.svg')"></div>
              <div class="skin-left-fist" style="background-image: url('./img/game/shared/skins/${idString}_fist.svg')"></div>
              <div class="skin-right-fist" style="background-image: url('./img/game/shared/skins/${idString}_fist.svg')"></div>
            </div>
            <span class="skin-name">${getTranslatedString(idString as TranslationKeys)}</span>
          </div>
        `);

        if (isActive) {
            skinItem.on("click", () => selectSkin(idString, game));
        }

        skinList.append(skinItem);
    }

}
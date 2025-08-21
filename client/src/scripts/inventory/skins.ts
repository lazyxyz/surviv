import $ from "jquery";
import type { ReferenceTo } from "@common/utils/objectDefinitions";
import { Skins, type SkinDefinition } from "@common/definitions/skins";
import { getTranslatedString } from "../../translations";
import type { TranslationKeys } from "../../typings/translations";

import {  SurvivAssetBalances, updateSplashCustomize } from ".";
import { Account } from "../account";
import { GAME_CONSOLE } from "../..";
import { SurvivAssets } from "@common/mappings";

// handler select and save skin
function selectSkin(idString: ReferenceTo<SkinDefinition>): void {
    // remove previous selected
    $(".skins-list-item-container").removeClass("selected");

    // wait for dom
    setTimeout(() => $(`#skin-${idString}`).addClass("selected"), 0);

    GAME_CONSOLE.setBuiltInCVar("cv_loadout_skin", idString);
    updateSplashCustomize(idString);

    const localName = GAME_CONSOLE.getBuiltInCVar("cv_player_name");
    $(".create-team-player-name").each(function() {
        if ($(this).text() === localName) {
            const container = $(this).closest(".create-team-player-container");
            container.find(".skin-base").css("background-image", `url('./img/game/shared/skins/${idString}_base.svg')`);
            container.find(".skin-left-fist").css("background-image", `url('./img/game/shared/skins/${idString}_fist.svg')`);
            container.find(".skin-right-fist").css("background-image", `url('./img/game/shared/skins/${idString}_fist.svg')`);
        }
    });
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function showSkins(account: Account) {
    if (!account.address) return;

    const role = GAME_CONSOLE.getBuiltInCVar("dv_role");
    const skinList = $<HTMLDivElement>("#skins-list");
    const currentSkin = GAME_CONSOLE.getBuiltInCVar("cv_loadout_skin");

    const userSkinBalance = [
        ...Object.entries(SurvivAssetBalances[SurvivAssets.Skins]),
    ];
    const userSkins = userSkinBalance.map(s => s[0]);

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
            skinItem.on("click", () => selectSkin(idString));
        }

        skinList.append(skinItem);
    }

}
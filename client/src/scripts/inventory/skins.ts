import $ from "jquery";
import type { ReferenceTo } from "@common/utils/objectDefinitions";
import { Skins, type SkinDefinition } from "@common/definitions/skins";
import { getTranslatedString } from "../../translations";
import type { TranslationKeys } from "../../typings/translations";

import { SurvivAssetBalances, updateSplashCustomize } from ".";
import { Account } from "../account";
import { GAME_CONSOLE } from "../..";
import { AssetTier, SurvivAssets } from "@common/blockchain";

// handler select and save skin
function selectSkin(idString: ReferenceTo<SkinDefinition>): void {
    // remove previous selected
    $(".skins-list-item-container").removeClass("selected");

    // wait for dom
    setTimeout(() => $(`#skin-${idString}`).addClass("selected"), 0);

    GAME_CONSOLE.setBuiltInCVar("cv_loadout_skin", idString);
    updateSplashCustomize(idString);

    const localName = GAME_CONSOLE.getBuiltInCVar("cv_player_name");
    $(".create-team-player-name").each(function () {
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

    const skinList = $<HTMLDivElement>("#skins-list");
    const currentSkin = GAME_CONSOLE.getBuiltInCVar("cv_loadout_skin");

    // Collect all owned skins from all tiers
    const userSkinBalance: [string, number][] = [];
    for (const tier of Object.values(AssetTier).filter(val => typeof val === 'number') as AssetTier[]) {
        const skinsInTier = Object.entries(SurvivAssetBalances[SurvivAssets.Skins][tier]);
        userSkinBalance.push(...skinsInTier);
    }
    const userSkins = userSkinBalance
        .filter(([_, balance]) => balance > 0)
        .map(([id]) => id);

    // Skins list
    const allSkins = Skins.definitions;

    // Inactive skins (not owned by the user)
    const inactiveSkins = allSkins
        .map(s => s.idString)
        .filter(id => !userSkins.includes(id));

    // Sort skins: owned first, then inactive
    const sortedSkinIds = [
        ...userSkins,
        ...inactiveSkins
    ];

    // Reset items before rendering new
    skinList.empty();

    // Map tiers to background images
    const tierBackgrounds: Record<AssetTier, string> = {
        [AssetTier.Silver]: "./img/game/shared/patterns/silver.svg",
        [AssetTier.Gold]: "./img/game/shared/patterns/gold.svg",
        [AssetTier.Divine]: "./img/game/shared/patterns/divine.svg"
    };

    for (const idString of sortedSkinIds) {
        const skinDef = allSkins.find(s => s.idString === idString);
        if (!skinDef) continue;

        const isActive = userSkins.includes(idString);
        const isSelected = idString === currentSkin;

        // Determine the tier of the skin
        let tier: AssetTier | undefined;
        for (const t of Object.values(AssetTier).filter(val => typeof val === 'number') as AssetTier[]) {
            if (Object.keys(SurvivAssetBalances[SurvivAssets.Skins][t]).includes(idString)) {
                tier = t;
                break;
            }
        }

        // Default to Silver if tier not found (e.g., for inactive skins)
        const backgroundImage = tier !== undefined ? tierBackgrounds[tier] : tierBackgrounds[AssetTier.Silver];

        const skinItem = $<HTMLDivElement>(`
          <div id="skin-${idString}" class="skins-list-item-container${isSelected ? " selected" : ""}">
          <div class="skin-tier-background" style="background-image: url('${backgroundImage}')">       
          <div class="skin${isActive ? " active" : " inactive"}">
            <div class="skin-base" style="background-image: url('./img/game/shared/skins/${idString}_base.svg')"></div>
            <div class="skin-left-fist" style="background-image: url('./img/game/shared/skins/${idString}_fist.svg')"></div>
            <div class="skin-right-fist" style="background-image: url('./img/game/shared/skins/${idString}_fist.svg')"></div>
          </div>
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
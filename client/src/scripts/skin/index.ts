import $ from "jquery";
import type { ReferenceTo } from "@common/utils/objectDefinitions";
import type { Game } from "../game";
import { freeSkin, Skins, type SkinDefinition } from "@common/definitions/skins";
import { getTranslatedString } from "../../translations";
import type { TranslationKeys } from "../../typings/translations";
import { SurvivAssets } from "../account";

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

    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
    let SilverSkins = await game.account.getBalances(SurvivAssets.SilverSkins).catch(err => {
        console.log(`Get SilverSkins error: ${err}`);
    });
    let GoldSkins = await game.account.getBalances(SurvivAssets.GoldSkins).catch(err => {
        console.log(`Get SilverSkins error: ${err}`);
    });
    let DivineSkins = await game.account.getBalances(SurvivAssets.DivineSkins).catch(err => {
        console.log(`Get SilverSkins error: ${err}`);
    });
    const UserSkins = { ...SilverSkins, ...GoldSkins, ...DivineSkins };
    const mySkins = Object.entries(UserSkins).map(([key, _]) => key);

    /* */
    // Skins list
    const allSkins = Skins.definitions.filter(argument =>
        !(argument.hideFromLoadout || !(argument.rolesRequired ?? [role]).includes(role))
    );

    // freeSkin is always at start of the list
    const freeSkinIds = [...freeSkin];

    // push after freeSkin
    let rewardSkinIds: string[] = [];
    if (newUnlockedSkinId && !freeSkinIds.includes(newUnlockedSkinId)) {
        rewardSkinIds = [newUnlockedSkinId];
    }

    // another skins (not contain freeSkin and rewardSkin)
    const otherActiveSkins = mySkins.filter(
        id => !freeSkinIds.includes(id) && id !== newUnlockedSkinId
    );
    // inactive skins
    const inactiveSkins = allSkins
        .map(s => s.idString)
        .filter(id => ![...freeSkinIds, ...rewardSkinIds, ...otherActiveSkins].includes(id));

    // sort skins
    const sortedSkinIds = [
        ...freeSkinIds,
        ...rewardSkinIds,
        ...otherActiveSkins,
        ...inactiveSkins
    ];

    // reset items before render new
    skinList.empty();

    for (const idString of sortedSkinIds) {
        const skinDef = allSkins.find(s => s.idString === idString);
        if (!skinDef) continue;

        const isActive = [...freeSkin, ...(mySkins || [])].includes(idString);
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
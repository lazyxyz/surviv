import $ from "jquery";
import type { ReferenceTo } from "@common/utils/objectDefinitions";
import type { Game } from "../game";
import { freeSkin, Skins, type SkinDefinition } from "@common/definitions/skins";
import { getTranslatedString } from "../../translations";
import type { TranslationKeys } from "../../typings/translations";
import { defaultClientCVars } from "../utils/console/defaultClientCVars";

// handler display change preview
const updateSplashCustomize = (skinID: string): void => {
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
export async function visibleSkin(game: Game) {
    if (!game?.account?.address) return;

    const role = game.console.getBuiltInCVar("dv_role");
    const skinList = $<HTMLDivElement>("#skins-list");
    const currentSkin = game.console.getBuiltInCVar("cv_loadout_skin");

    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
    const mySkins = await new Promise<string[]>(async(resolve, reject) => {
        try {
            const request: {
                data: { items: Array<{ name: string }> }
            } = await $.ajax({
                url: "https://test-api.openmark.io/market/api/nft",
                type: "POST",
                data: {
                    nftContract: "0x3b1cbe9791eb789e081006df913bbb10166f171a",
                    owner: game.account.address,
                    size: 100
                }
            });

            resolve(
                request.data.items.map(meta => {
                    // should be ['Monad', '#20']
                    const separate = meta.name.split(" ");

                    return separate[0].toLowerCase();
                })
            );
        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            reject(error);
        }
    });

    const SkinsIntance = Skins.definitions.filter(argument =>
        [...freeSkin, ...(mySkins || [])].some(
            argument_child => argument_child === argument.idString
        )
    );

    // should be set or reset skin
    {
        const avaliableSkin = SkinsIntance.find(
            meta =>
                meta.idString === game.console.getBuiltInCVar("cv_loadout_skin")
        );

        if (avaliableSkin) {
            updateSplashCustomize(avaliableSkin.idString);
        }

        if (!avaliableSkin) {
            // selectSkin(freeSkin[0]);
            selectSkin(defaultClientCVars.cv_loadout_skin as string, game);
        }
    }

    // reset items before render new
    skinList.empty();

    // display to preview and select
    for (const { idString, hideFromLoadout, rolesRequired } of SkinsIntance) {
        if (hideFromLoadout || !(rolesRequired ?? [role]).includes(role)) {
            continue;
        }

        const skinItem = $<HTMLDivElement>(`
          <div id="skin-${idString}" class="skins-list-item-container${idString === currentSkin ? " selected" : ""}">
            <div class="skin">
              <div class="skin-base" style="background-image: url('./img/game/shared/skins/${idString}_base.svg')"></div>
              <div class="skin-left-fist" style="background-image: url('./img/game/shared/skins/${idString}_fist.svg')"></div>
              <div class="skin-right-fist" style="background-image: url('./img/game/shared/skins/${idString}_fist.svg')"></div>
            </div>

            <span class="skin-name">${getTranslatedString(idString as TranslationKeys)}</span>
          </div>
        `);

        skinItem.on("click", () => selectSkin(idString, game));

        skinList.append(skinItem);
    }
}

import type { Game } from "../game";
import { getTranslatedString } from "../../translations";
import $ from "jquery";
import { html } from "../utils/misc";
import { InventoryCache } from ".";
import { GAME_CONSOLE } from "../..";

export function getBadgeImage(badgeId: string) {
    return "";
}

// handler select and save badge
function selectBadge(idString: string, game: Game): void {
    // remove previous selected
    $(".badges-list-item-container").removeClass("selected");

    // wait for dom
    setTimeout(() => $(`#badge-${idString}`).addClass("selected"), 0);

    GAME_CONSOLE.setBuiltInCVar("cv_loadout_badge", idString);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function showBadges(game: Game) {
    if (InventoryCache.weaponsLoaded) return;
    InventoryCache.weaponsLoaded = true;

    const badgeList = $<HTMLDivElement>("#badges-list");

    // clear list
    badgeList.empty();

    // custom no item (meaning click to reset badge)
    {
        const noBadgeItem = $<HTMLDivElement>(
            html`<div id="badge-" class="badges-list-item-container">\
              <div class="badges-list-item"> </div>\
              <span class="badge-name">${getTranslatedString("none")}</span>\
          </div>`
        );

        noBadgeItem.on("click", () => selectBadge("", game));

        badgeList.append(noBadgeItem);
    }
}

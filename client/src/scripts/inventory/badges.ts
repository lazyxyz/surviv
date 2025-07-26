import type { Game } from "../game";
import { getTranslatedString } from "../../translations";
import $ from "jquery";
import { html } from "../utils/misc";
import { InventoryCache } from ".";
import { SurvivAssets } from "../account";
import { Badges, type BadgeDefinition } from "@common/definitions/badges"; // Assuming a Badges module exists
import type { TranslationKeys } from "../../typings/translations";

export function getBadgeImage(badgeId: string): string {
    if (!badgeId) return "";
    return `./img/game/shared/badges/${badgeId}.svg`;
}

// handler select and save badge
function selectBadge(idString: string, game: Game): void {
    // remove previous selected
    $(".badges-list-item-container").removeClass("selected");

    // wait for dom
    setTimeout(() => $(`#badge-${idString}`).addClass("selected"), 0);

    game.console.setBuiltInCVar("cv_loadout_badge", idString);
}

export async function showBadges(game: Game) {
    if (!game?.account?.address) {
        return;
    }

    if (InventoryCache.badgesLoaded) {
        return;
    }
    InventoryCache.badgesLoaded = true;

    const badgeList = $<HTMLDivElement>("#badges-list");
    const currentBadge = game.console.getBuiltInCVar("cv_loadout_badge");

    const userBadgeBalance = [
        ...Object.entries(await game.account.getBalances(SurvivAssets.SurvivCards)),
    ];
    const userBadges = userBadgeBalance.map(s => s[0]);

    // Badges list
    const allBadges = Badges.definitions;

    // inactive badges
    const inactiveBadges = allBadges
        .map(b => b.idString)
        .filter(id => ![, ...userBadges].includes(id));

    // sort badges
    const sortedBadgeIds = [...userBadges, ...inactiveBadges];

    // // clear list
    // badgeList.empty();

    // custom no item (meaning click to reset badge)
    {
        const noBadgeItem = $<HTMLDivElement>(
            html`<div id="badge-" class="badges-list-item-container${currentBadge === "" ? " selected" : ""}">
                <div class="badges-list-item"></div>
                <span class="badge-name">${getTranslatedString("none")}</span>
            </div>`
        );

        noBadgeItem.on("click", () => {
            selectBadge("", game);
        });
        badgeList.append(noBadgeItem);
    }

    // render badges
    for (const idString of sortedBadgeIds) {
        const badgeDef = allBadges.find(b => b.idString === idString);
        if (!badgeDef) {
            console.log("Badge definition not found for ID:", idString);
            continue;
        }

        const isActive = userBadges.includes(idString);
        const inactiveStyle = isActive ? "" : " style=\"opacity: 0.5; filter: saturate(0.15); \"";
        const isSelected = idString === currentBadge;
        console.log(`Badge ${idString}: isActive=${isActive}, isSelected=${isSelected}`);

        const badgeItem = $<HTMLDivElement>(
            html`<div id="badge-${idString}" class="badges-list-item-container${isSelected ? " selected" : ""}">
                <div class="badges-list-item badge${isActive ? " active" : " inactive"}" ${inactiveStyle}>
                    <div class="badge-image" style="background-image: url('./img/misc/card.gif'); border-radius: 12px"></div>
                </div>
                <span class="badge-name">${"Surviv Card"}</span>
            </div>`
        );

        if (isActive) {
            badgeItem.on("click", () => {
                selectBadge(idString, game);
            });
        }

        badgeList.append(badgeItem);
    }
}
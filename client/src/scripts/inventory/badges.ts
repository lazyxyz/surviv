import { getTranslatedString } from "../../translations";
import $ from "jquery";
import { html } from "../utils/misc";
import { Account, SurvivItems } from "../account";
import { Badges } from "@common/definitions/badges";
import { GAME_CONSOLE } from "../..";

export function getBadgeImage(badgeId: string): string {
    if (!badgeId) return "";
    return `./img/game/shared/badges/${badgeId}.svg`;
}

// handler select and save badge
function selectBadge(idString: string): void {
    // remove previous selected
    $(".badges-list-item-container").removeClass("selected");

    // wait for dom
    setTimeout(() => $(`#badge-${idString}`).addClass("selected"), 0);

    GAME_CONSOLE.setBuiltInCVar("cv_loadout_badge", idString);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function showBadges(account: Account) {
    const badgeList = $<HTMLDivElement>("#badges-list");
    badgeList.empty(); // Clear previous items
    const currentBadge = GAME_CONSOLE.getBuiltInCVar("cv_loadout_badge");

    const userBadgeBalance = [
        ...Object.entries((await account.getItemBalances(SurvivItems.SurvivBadges))),
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

    // custom no item (meaning click to reset badge)
    {
        const noBadgeItem = $<HTMLDivElement>(
            html`<div id="badge-" class="badges-list-item-container${currentBadge === "" ? " selected" : ""}">
                <div class="badges-list-item"><i class="fa-solid fa-ban" style="opacity: 0.65"></i></div>
                <span class="badge-name">${getTranslatedString("none")}</span>
            </div>`
        );

        noBadgeItem.on("click", () => selectBadge(""));
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

        const badgeItem = $<HTMLDivElement>(
            html`<div id="badge-${idString}" class="badges-list-item-container${isSelected ? " selected" : ""}">
                <div class="badges-list-item badge${isActive ? " active" : " inactive"}" ${inactiveStyle}>
                    <div class="badge-image" style="background-image: url('${getBadgeImage(idString)}')"></div>
                </div>
                <span class="badge-name">${badgeDef.name}</span>
            </div>`
        );

        if (isActive) {
            badgeItem.on("click", () => {
                selectBadge(idString);
            });
        }

        badgeList.append(badgeItem);
    }
}
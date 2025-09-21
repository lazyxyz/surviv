import { getTranslatedString } from "../../translations";
import $ from "jquery";
import { html } from "../utils/misc";
import { Account, SurvivItems } from "../account";
import { Badges } from "@common/definitions/badges";
import { GAME_CONSOLE } from "../..";
import { SurvivBadgesMapping } from "@common/mappings";

export function getBadgeImage(badgeId: string): string {
    if (!badgeId) return "";
    return `./img/game/shared/badges/${badgeId}.svg`;
}

// Handler to select and save badge
function selectBadge(idString: string): void {
    // Remove previous selected
    $(".badges-list-item-container").removeClass("selected");

    // Wait for DOM update
    setTimeout(() => $(`#badge-${idString}`).addClass("selected"), 0);

    GAME_CONSOLE.setBuiltInCVar("cv_loadout_badge", idString);
}

export async function showBadges(account: Account) {
    const badgeList = $<HTMLDivElement>("#badges-list");
    badgeList.css("position", "relative"); // Ensure badgeList is a positioned ancestor
    badgeList.empty(); // Clear previous items
    const currentBadge = GAME_CONSOLE.getBuiltInCVar("cv_loadout_badge");

    // Get user badge balances
    const userBadgeBalance = [
        ...Object.entries((await account.getItemBalances(SurvivItems.SurvivBadges))),
    ];

    // Calculate total boost
    let totalBoost = 0;
    userBadgeBalance.forEach(([badgeId, amount]) => {
        const index = SurvivBadgesMapping.assets.indexOf(badgeId);
        if (index !== -1) {
            totalBoost += SurvivBadgesMapping.boosts[index] * Number(amount);
        }
    });
    if (totalBoost >= 300) {
        totalBoost = 300; // Cap at 300%
    }

    // Display total boost
    const boostDisplay = $<HTMLDivElement>(
        html`<div 
        class="badges-boost-display" 
        style="
            position: fixed;
            top: 20px;
            left: 55%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.6);
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 12px;
            color: #fff;
            z-index: 9999;
        "
    >
        Total Reward Boost: ${totalBoost === 300 ? "Max (300%)" : `${totalBoost}%`}
    </div>`
    );

    badgeList.append(boostDisplay);

    // Badges list
    const allBadges = Badges.definitions;

    // Inactive badges
    const inactiveBadges = allBadges
        .map(b => b.idString)
        .filter(id => !userBadgeBalance.map(([id]) => id).includes(id));

    // Sort badges
    const sortedBadgeIds = [...userBadgeBalance.map(([id]) => id), ...inactiveBadges];

    // Render badges
    for (const idString of sortedBadgeIds) {
        const badgeDef = allBadges.find(b => b.idString === idString);
        if (!badgeDef) {
            console.log("Badge definition not found for ID:", idString);
            continue;
        }

        const isActive = userBadgeBalance.map(([id]) => id).includes(idString);
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
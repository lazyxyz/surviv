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
    const userBadgeBalances = await account.getItemBalances(SurvivItems.SurvivBadges);
    const userOwnedBadges = new Map(Object.entries(userBadgeBalances).map(([id, balance]) => [id, Number(balance)]));

    // Calculate total boost
    let totalBoost = 0;
    Object.entries(userBadgeBalances).forEach(([badgeId, amount]) => {
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
        html`<div class="badges-boost-display">
        Total Reward Boost: <span>${totalBoost === 300 ? "Max (300%)" : `${totalBoost}%`}</span>
    </div>`
    );

    badgeList.append(boostDisplay);

    // Badges list
    const allBadges = Badges.definitions;

    // Inactive badges
    const inactiveBadges = allBadges
        .map(b => b.idString)
        .filter(id => !userOwnedBadges.has(id));

    // Sort badges
    const sortedBadgeIds = [...userOwnedBadges.keys(), ...inactiveBadges];

    // Render badges
    for (const idString of sortedBadgeIds) {
        const badgeDef = allBadges.find(b => b.idString === idString);
        if (!badgeDef) {
            console.log("Badge definition not found for ID:", idString);
            continue;
        }

        const balance = userOwnedBadges.get(idString) ?? 0;
        const isActive = balance > 0;
        const inactiveStyle = isActive ? "" : ' style="opacity: 0.5; filter: saturate(0.15);"';
        const isSelected = idString === currentBadge;

        const badgeItem = $<HTMLDivElement>(
            html`<div id="badge-${idString}" class="badges-list-item-container${isSelected ? " selected" : ""}">
                ${isActive ? `<div class="badge-balance">x${balance}</div>` : ''}
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
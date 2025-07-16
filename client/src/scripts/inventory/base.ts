import $ from "jquery";
import type { Game } from "../game";
import { successAlert, errorAlert, warningAlert } from "../modal";
import { getTokenBalances, type MintResult } from "../utils/onchain";

import {
    SilverSkinsMapping,
    GoldSkinsMapping,
    DivineSkinsMapping,
    SilverArmsMapping,
    GoldArmsMapping,
    DivineArmsMapping,
    DivineGunsMapping,
    SurvivMemesMapping,
    SurvivKeysMapping,
    SurvivCratesMapping
} from "@common/mappings";

function renderCrates(userCrateBalances: number, keyBalances: number): void {
    const crateImages = new Array(userCrateBalances).fill({ image: "./img/misc/crate.png" });

    $("#total-crates").text(`You have: ${userCrateBalances || 0} crates - ${keyBalances} keys`);
    $(".my-crates-customize").empty();
    crateImages.forEach(item => {
        $(".my-crates-customize").append(`
            <div class="my-crates-child">
                <img src="${item.image}" alt="Crate">
            </div>
        `);
    });
}

function setupCrateOpening(game: Game, crates: NodeListOf<Element>, totalSelected: Element | null, openNowButton: HTMLButtonElement | null, keyBalances: number): void {
    let selectedCount = 0;
    let isOpening = false;
    let localCrateBalance = crates.length;
    let localKeyBalance = keyBalances;
    const crateList = Array.from(crates);
    $(".select-all").prop("checked", false);

    // Default state
    if (totalSelected) {
        totalSelected.textContent = "0 selected";
    }
    if (openNowButton) {
        openNowButton.classList.remove("active");
        openNowButton.disabled = true;
    }

    // Remove any existing click handlers to prevent duplicates
    $(document).off("click", ".my-crates-child .open-now .claim-items");

    crates.forEach(crate => {
        crate.addEventListener("click", () => {
            if (isOpening) return;
            const isActive = crate.classList.contains("active");
            if (isActive) {
                crate.classList.remove("active");
                selectedCount--;
                $(".select-all").prop("checked", false);
            } else if (selectedCount < localKeyBalance) {
                crate.classList.add("active");
                selectedCount++;
            } else {
                warningAlert("Insufficient keys!");
            }

            if (selectedCount === localKeyBalance && localKeyBalance > 0) {
                $(".select-all").prop("checked", true);
            } else {
                $(".select-all").prop("checked", false);
            }

            if (openNowButton) {
                openNowButton.disabled = selectedCount === 0;
                openNowButton.classList.toggle("active", selectedCount > 0);
            }
            if (totalSelected) {
                totalSelected.textContent = `${selectedCount} selected`;
            }
        });
    });

    $(".select-all").off("change").on("change", () => {
        const checkActive = $(".select-all").is(":checked");
        if (checkActive) {
            crates.forEach(crate => crate.classList.remove("active"));
            selectedCount = 0;

            const maxSelectable = Math.min(localCrateBalance, localKeyBalance);
            const items = crateList.slice(0, maxSelectable);
            items.forEach(crate => crate.classList.add("active"));
            selectedCount = items.length;
        } else {
            crates.forEach(crate => crate.classList.remove("active"));
            selectedCount = 0;
        }

        if (totalSelected) {
            totalSelected.textContent = `${selectedCount} selected`;
        }

        if (openNowButton) {
            openNowButton.disabled = selectedCount === 0;
            openNowButton.classList.toggle("active", selectedCount > 0);
        }
    });

    if (openNowButton) {
        $(openNowButton).off("click").on("click", async () => {
            if (isOpening) return;
            isOpening = true;
            openNowButton.disabled = true;
            try {
                if (selectedCount > 0) {
                    // Perform contract interaction
                    await game.account.requestOpenCrates(selectedCount);
                    // Update local balances
                    localCrateBalance -= selectedCount;
                    localKeyBalance -= selectedCount;
                    // Update UI
                    await updateBalancesUI(localCrateBalance, localKeyBalance, totalSelected, openNowButton);
                    setTimeout(() => renderClaimButton(game), 2000);
                    successAlert("Crates opened successfully!");
                }
            } catch (err) {
                console.error(`Failed to open crates: ${err}`);
                errorAlert("Failed to open crates. Please try again!");
            } finally {
                isOpening = false;
                openNowButton.disabled = selectedCount === 0;
            }
        });
    }
}

async function updateBalancesUI(
    localCrateBalance: number,
    localKeyBalance: number,
    totalSelected: Element | null,
    openNowButton: HTMLButtonElement | null
): Promise<void> {
    // Remove opened crates
    document.querySelectorAll(".my-crates-child.active").forEach(crate => crate.remove());
    // Update total crates and keys display
    $("#total-crates").text(`You have: ${localCrateBalance} crates - ${localKeyBalance} keys`);
    // Reset selection
    if (totalSelected) {
        totalSelected.textContent = "0 selected";
    }
    if (openNowButton) {
        openNowButton.classList.remove("active");
        openNowButton.disabled = true;
    }
    $(".select-all").prop("checked", false);
}

async function renderClaimButton(game: Game): Promise<HTMLButtonElement | null> {
    const claimButton = document.querySelector<HTMLButtonElement>(".claim-items");
    if (!claimButton) return claimButton;

    const hasCommits = (await game.account.getCommits().catch(err => {
        console.error(`Failed to query commits: ${err}`);
        return [];
    })).length > 0;

    claimButton.disabled = !hasCommits;
    claimButton.classList.toggle("active", hasCommits);
    return claimButton;
}

function showMintedItemsPopup(mintedItems: MintResult[], explorerLink: string): void {
    const collectionMappings: { [key: string]: { address: string; assets: string[] } } = {
        SilverSkins: SilverSkinsMapping,
        GoldSkins: GoldSkinsMapping,
        DivineSkins: DivineSkinsMapping,
        SilverArms: SilverArmsMapping,
        GoldArms: GoldArmsMapping,
        DivineArms: DivineArmsMapping,
        DivineGuns: DivineGunsMapping,
        SurvivMemes: SurvivMemesMapping
    };

    const getImagePath = (collection: string, assetName: string) => {
        if (['SilverSkins', 'GoldSkins', 'DivineSkins'].some(pattern => collection.includes(pattern))) {
            return `./img/game/shared/skins/${assetName}_base.svg`;
        }
        if (['SilverArms', 'GoldArms', 'DivineArms'].some(pattern => collection.includes(pattern))) {
            return `./img/game/shared/weapons/${assetName}.svg`;
        }
        if (collection.includes('DivineGuns')) {
            return `./img/game/shared/weapons/${assetName}_world.svg`;
        }
        if (collection.includes('SurvivMemes')) {
            return `./img/game/shared/emotes/${assetName}.svg`;
        }
        return `./img/game/shared/skins/${assetName}_base.svg`; // Default fallback
    };

    const alertDiv = document.createElement('div');
    alertDiv.className = "minted-items-alert";

    const idRandom = Math.floor(Math.random() * 10000000);
    const totalItems = mintedItems.flatMap(item => item.values).length;
    const maxDisplay = 11; // 2 rows x 6 items
    const popupContent = mintedItems.length > 0
        ? mintedItems.flatMap(item => {
            const mapping = Object.values(collectionMappings).find(m => m.address.toLowerCase() === item.address.toLowerCase());
            return item.values.map(([tokenId, value]) => {
                const assetName = mapping && mapping.assets[tokenId] ? mapping.assets[tokenId] : `unknown_${tokenId}`;
                const imageUrl = getImagePath(item.collection, assetName);
                return `
                    <div class="minted-item">
                        <img src="${imageUrl}" alt="${assetName}" data-balance="${value}">
                        <span class="balance">x${value}</span>
                    </div>
                `;
            });
        }).slice(0, maxDisplay).join("") + (totalItems > maxDisplay ? '<div class="more-items">More</div>' : '')
        : "<div class='no-items'>No items minted.</div>";

    const alertChild = $(`
        <div class="minted-items-modal" id="${idRandom}">
            <div class="minted-items-header">Items claimed successfully!</div>
            <div class="minted-items-body">
                <div class="minted-items-grid">${popupContent}</div>
            </div>
            <div class="minted-items-footer">
                <a href="${explorerLink}" target="_blank" class="view-on-explorer">View on Explorer</a>
            </div>
            <span class="minted-items-close fa-solid fa-xmark close-popup" id="close-customize"></span>
        </div>
    `);

    alertDiv.append(alertChild[0]);
    document.body.appendChild(alertDiv);

    // Close popup
    $(".close-popup").on("click", (event) => {
        event.target.parentElement?.remove();
        if (!alertDiv.children.length) {
            alertDiv.remove();
        }
    });
}

async function updateClaimButton(game: Game): Promise<void> {
    const claimButton = await renderClaimButton(game);

    if (!claimButton) return;
    let isProcessing = false;

    $(claimButton).off("click").on("click", async () => {
        if (isProcessing) return;
        isProcessing = true;
        try {
            const result = await game.account.claimItems();

            if (result.error) {
                errorAlert(result.error);
            } else {
                // successAlert("Items claimed successfully!");
                if (result.hash) {
                    const explorerLink = `https://shannon-explorer.somnia.network/tx/${result.hash}?tab=index"`;

                    if (result.balances) {
                        showMintedItemsPopup(result.balances, explorerLink);
                    } else {
                        showMintedItemsPopup([], explorerLink);
                    }
                }

                claimButton.classList.remove("active");
                claimButton.disabled = true;
            }
        } catch (err) {
            console.error(`Failed to claim items: ${err}`);
            errorAlert("Failed to claim items. Please try again!");
        } finally {
            isProcessing = false;
        }
    });
}

async function loadCrates(game: Game): Promise<void> {
    if (!game.account.address) {
        warningAlert("Please connect your wallet to continue!")
        return;
    }

    let keyBalances = await getTokenBalances([game.account.address], [SurvivKeysMapping.address]);
    const userKeyBalances = keyBalances.balances.length > 0 ? keyBalances.balances[0].balance : 0;

    let crateBalances = await getTokenBalances([game.account.address], [SurvivCratesMapping.address]);
    const userCrateBalances = crateBalances.balances.length > 0 ? crateBalances.balances[0].balance : 0;

    renderCrates(userCrateBalances, userKeyBalances);

    const crates = document.querySelectorAll(".my-crates-child");
    const totalSelected = document.querySelector(".total-selected");
    const openNowButton = document.querySelector<HTMLButtonElement>(".open-now");
    setupCrateOpening(game, crates, totalSelected, openNowButton, userKeyBalances);
}

export async function loadBase(game: Game): Promise<void> {
    await Promise.all([loadCrates(game), updateClaimButton(game)]);
}
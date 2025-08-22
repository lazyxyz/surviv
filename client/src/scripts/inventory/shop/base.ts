import $ from "jquery";
import { successAlert, errorAlert, warningAlert } from "../../modal";

import {
    SurvivAssetRanges,
    SurvivAssets,
    SurvivAssetsMapping,
} from "@common/mappings";
import { ShopCache } from ".";
import { Account, SurvivItems, type MintResult } from "../../account";

const MAX_RENDER_CRATES = 1000;

function renderCrates(userCrateBalances: number, keyBalances: number): void {
    const maxCratesToRender = Math.min(userCrateBalances, MAX_RENDER_CRATES);
    const crateImages = new Array(maxCratesToRender).fill({ image: "./img/misc/surviv_kit_crate.png" });

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

function setupCrateOpening(account: Account, crates: NodeListOf<Element>, totalSelected: Element | null, openNowButton: HTMLButtonElement | null, keyBalances: number): void {
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
                    await account.requestOpenCrates(selectedCount);
                    // Update local balances
                    ShopCache.assetsBalance.key -= selectedCount;
                    ShopCache.assetsBalance.crate -= selectedCount;
                    // Update UI
                    await updateBalancesUI(totalSelected, openNowButton);
                    setTimeout(() => renderClaimButton(account), 2000);
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
    totalSelected: Element | null,
    openNowButton: HTMLButtonElement | null
): Promise<void> {
    // Remove opened crates
    document.querySelectorAll(".my-crates-child.active").forEach(crate => crate.remove());
    // Update total crates and keys display
    $("#total-crates").text(`You have: ${ShopCache.assetsBalance.crate} crates - ${ShopCache.assetsBalance.key} keys`);
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

async function renderClaimButton(account: Account): Promise<HTMLButtonElement | null> {
    const claimButton = document.querySelector<HTMLButtonElement>(".claim-items");
    if (!claimButton) return claimButton;

    const hasCommits = (await account.getCommits().catch(err => {
        console.error(`Failed to query commits: ${err}`);
        return [];
    })).length > 0;

    claimButton.disabled = !hasCommits;
    claimButton.classList.toggle("active", hasCommits);
    return claimButton;
}

/**
 * Displays a popup with minted items from SurvivAssets.
 * @param mintedItems - Array of minted items with contract address and token ID/balance pairs.
 * @param explorerLink - Link to the blockchain explorer for transaction details.
 */
function showMintedItemsPopup(mintedItems: MintResult[], explorerLink: string): void {
    const collectionMappings: { [key: string]: { address: string; assets: string[][] } } = {
        SurvivAssets: SurvivAssetsMapping
    };

    const getImagePath = (address: string, tokenId: number, assetName: string): string => {
        if (address.toLowerCase() === SurvivAssetsMapping.address.toLowerCase()) {
            for (const [category, { mappingIndices }] of Object.entries(SurvivAssetRanges)) {
                for (const index of mappingIndices) {
                    const startId = index * 1000;
                    const subArray = (SurvivAssetsMapping.assets[index] || []) as string[];
                    if (tokenId >= startId && tokenId < startId + subArray.length) {
                        switch (Number(category)) {
                            case SurvivAssets.Skins:
                                return `./img/game/shared/skins/${assetName}_base.svg`;
                            case SurvivAssets.Emotes:
                                return `./img/game/shared/emotes/${assetName}.svg`;
                            case SurvivAssets.Arms:
                                return `./img/game/shared/weapons/${assetName}.svg`;
                            case SurvivAssets.Guns:
                                return `./img/game/shared/weapons/${assetName}.svg`;
                            default:
                                break;
                        }
                    }
                }
            }
        }
        return `./img/game/shared/skins/${assetName}_base.svg`; // Default fallback
    };

    const isSkinItem = (address: string, tokenId: number): boolean => {
        if (address.toLowerCase() === SurvivAssetsMapping.address.toLowerCase()) {
            const skinIndices = SurvivAssetRanges[SurvivAssets.Skins].mappingIndices;
            for (const index of skinIndices) {
                const startId = index * 1000;
                const subArray = SurvivAssetsMapping.assets[index] || [];
                if (tokenId >= startId && tokenId < startId + subArray.length) {
                    return true;
                }
            }
        }
        return false;
    };

    const alertDiv = document.createElement('div');
    alertDiv.className = 'minted-items-alert';

    const idRandom = Math.floor(Math.random() * 10000000);
    const popupContent = mintedItems.length > 0
        ? mintedItems.flatMap(item => {
            const mapping = Object.values(collectionMappings).find(
                m => m.address.toLowerCase() === item.address.toLowerCase()
            );
            if (!mapping) return [];
            return item.values.map(([tokenId, value]) => {
                let assetName: string = `unknown_${tokenId}`;
                if (mapping === SurvivAssetsMapping) {
                    let found = false;
                    for (const index of Object.values(SurvivAssetRanges).flatMap(r => r.mappingIndices)) {
                        const startId = index * 1000;
                        const subArray = mapping.assets[index] || [];
                        if (tokenId >= startId && tokenId < startId + subArray.length) {
                            assetName = subArray[tokenId - startId];
                            found = true;
                            break;
                        }
                    }
                }

                const imageUrl = getImagePath(item.address, tokenId, assetName);
                const rotationClass = isSkinItem(item.address, tokenId) ? ' rotated' : '';
                return `
            <div class="minted-item">
              <img src="${imageUrl}" alt="${assetName}" data-balance="${value}" class="minted-item-image${rotationClass}">
              <span class="balance">x${value}</span>
            </div>
          `;
            });
        }).join('')
        : "<div class='no-items'>Items not found. Check explorer instead.</div>";

    const alertChild = $(`
    <div class="minted-items-modal" id="${idRandom}">
      <div class="minted-items-header" style="font-family: Survivant">claimed successfully!</div>
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
    $('.close-popup').on('click', (event) => {
        event.target.parentElement?.remove();
        if (!alertDiv.children.length) {
            alertDiv.remove();
        }
    });
}

async function updateClaimButton(account: Account): Promise<void> {
    const claimButton = await renderClaimButton(account);

    if (!claimButton) return;
    let isProcessing = false;

    $(claimButton).off("click").on("click", async () => {
        if (isProcessing) return;
        isProcessing = true;
        try {
            const result = await account.claimItems();

            if (result.error) {
                errorAlert(result.error);
            } else {
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

async function loadCrates(account: Account, keyBalance: number, crateBalance: number): Promise<void> {
    renderCrates(crateBalance, keyBalance);

    const crates = document.querySelectorAll(".my-crates-child");
    const totalSelected = document.querySelector(".total-selected");
    const openNowButton = document.querySelector<HTMLButtonElement>(".open-now");
    setupCrateOpening(account, crates, totalSelected, openNowButton, keyBalance);
}

export async function loadBase(account: Account): Promise<void> {
    if (!account.address) {
        return;
    }

    if (!ShopCache.baseLoaded) {
        const kitsBalance = await account.getItemBalances(SurvivItems.SurvivKits);

        ShopCache.assetsBalance.key = Number(kitsBalance["key"]) || 0;
        ShopCache.assetsBalance.crate = Number(kitsBalance["crate"]) || 0;
    };

    await Promise.all(
        [
            loadCrates(account, ShopCache.assetsBalance.key, ShopCache.assetsBalance.crate),
            updateClaimButton(account)
        ]
    );
    ShopCache.baseLoaded = true;
}
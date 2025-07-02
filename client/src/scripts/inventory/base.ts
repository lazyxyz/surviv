import $ from "jquery";
import { SurvivAssets } from "../account";
import type { Game } from "../game";
import { successAlert, errorAlert, warningAlert } from "../modal";

function renderCrates(userCrateBalances: any, keyBalances: number): void {
    const crateImages = userCrateBalances?.crates
        ? new Array(Number(userCrateBalances.crates)).fill({ image: "./img/misc/crate.png" })
        : [];
    $("#total-crates").text(`You have: ${userCrateBalances?.crates || 0} crates - ${keyBalances} keys`);
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

    $(document).off("click", ".my-crates-child .open-now .claim-items");

    crates.forEach(crate => {
        crate.addEventListener("click", () => {
            if (isOpening) return;
            const isActive = crate.classList.contains("active");
            if (isActive) {
                crate.classList.remove("active");
                selectedCount--;
            } else if (selectedCount < localKeyBalance) {
                crate.classList.add("active");
                selectedCount++;
                console.log(crate.classList);

            } else {
                warningAlert("Insufficient keys!");
            }

            if (totalSelected) {
                totalSelected.textContent = `${selectedCount} selected`;
            }

            if (openNowButton) {
                openNowButton.disabled = selectedCount === 0;
                openNowButton.classList.toggle("active", selectedCount > 0);
            }
        });

    });

    $(".crates-info").on("click", (item: any, selectedCrates: any) => {
        crates.forEach(crate => crate.classList.remove("active"));
        selectedCount === 0

        if (localCrateBalance > keyBalances) {
            const item = crateList.slice(0, localKeyBalance);
            item.forEach(crate => crate.classList.add("active"));
            const selectedItems = item.map(crate => crate.textContent);
            selectedCount += selectedItems.length;

            if (totalSelected) {
                totalSelected.textContent = `${selectedCount} selected`;
            }
        }
    });


    if (openNowButton) {
        $(openNowButton).on("click", async () => {
            if (isOpening) return;
            isOpening = true;
            openNowButton.disabled = true;
            try {
                if (selectedCount > 0) {
                    await game.account.requestOpenCrates(selectedCount);
                    document.querySelectorAll(".my-crates-child.active").forEach(crate => crate.remove());
                    localCrateBalance -= selectedCount;
                    localKeyBalance -= selectedCount;
                    $("#total-crates").text(`You have: ${localCrateBalance} crates - ${localKeyBalance} keys`);
                    if (totalSelected) {
                        totalSelected.textContent = "0 selected";
                    }
                    openNowButton.classList.remove("active");
                    selectedCount = 0;
                    successAlert("Crates opened successfully!");
                }
            } catch (err) {
                console.error(`Failed to open crates: ${err}`);
                errorAlert("Failed to open crates. Please try again!");

            } finally {
                isOpening = false;
                await loadCrates(game);
                await updateClaimButton(game);
            }
        });
    }
}

async function updateClaimButton(game: Game): Promise<void> {
    const claimButton = document.querySelector<HTMLButtonElement>(".claim-items");
    if (!claimButton) return;

    let isProcessing = false;
    const hasCommits = (await game.account.getCommits().catch(err => {
        console.error(`Failed to query commits: ${err}`);
        return [];
    })).length > 0;

    claimButton.disabled = !hasCommits;
    claimButton.classList.toggle("active", hasCommits);

    $(claimButton).off("click").on("click", async () => {
        if (isProcessing) return;
        isProcessing = true;
        try {
            await game.account.claimItems();
            successAlert("Items claimed successfully!");
            claimButton.classList.remove("active");
            claimButton.disabled = true;
        } catch (err) {
            console.error(`Failed to claim items: ${err}`);
            errorAlert("Failed to claim items. Please try again!");
        } finally {
            isProcessing = false;
            await updateClaimButton(game);
        }
    });
}

async function loadCrates(game: Game): Promise<void> {
    const userKeyBalances = await game.account.getBalances(SurvivAssets.SurvivKeys).catch(err => {
        console.error(`Failed to load key balance: ${err}`);
        return { keys: 0 };
    });
    const userCrateBalances = await game.account.getBalances(SurvivAssets.SurvivCrates).catch(err => {
        console.error(`Failed to load crate balance: ${err}`);
        return { crates: 0 };
    });

    renderCrates(userCrateBalances, userKeyBalances?.keys || 0);

    const crates = document.querySelectorAll(".my-crates-child");
    const selectAll = document.querySelectorAll(".crates-info");
    const totalSelected = document.querySelector(".total-selected");
    const openNowButton = document.querySelector<HTMLButtonElement>(".open-now");
    setupCrateOpening(game, crates, totalSelected, openNowButton, userKeyBalances?.keys || 0);
}

export async function loadBase(game: Game): Promise<void> {
    await Promise.all([loadCrates(game), updateClaimButton(game)]);
}
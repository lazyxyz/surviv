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
    $(".select-all").prop("checked", false);

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
                    await updateUIAfterOpen(game, localCrateBalance, localKeyBalance, totalSelected, openNowButton);
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

async function updateUIAfterOpen(
    game: Game,
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
    // Re-fetch balances to ensure UI consistency
    const userKeyBalances = await game.account.getBalances(SurvivAssets.SurvivKeys).catch(err => {
        console.error(`Failed to load key balance: ${err}`);
        return { keys: localKeyBalance };
    });
    const userCrateBalances = await game.account.getBalances(SurvivAssets.SurvivCrates).catch(err => {
        console.error(`Failed to load crate balance: ${err}`);
        return { crates: localCrateBalance };
    });
    // Update UI if balances differ
    if (
        userCrateBalances.crates !== localCrateBalance ||
        userKeyBalances.keys !== localKeyBalance
    ) {
        renderCrates(userCrateBalances, userKeyBalances?.keys || 0);
        // Reinitialize crate selection with new balances
        const crates = document.querySelectorAll(".my-crates-child");
        setupCrateOpening(game, crates, totalSelected, openNowButton, userKeyBalances?.keys || 0);
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
    const totalSelected = document.querySelector(".total-selected");
    const openNowButton = document.querySelector<HTMLButtonElement>(".open-now");
    setupCrateOpening(game, crates, totalSelected, openNowButton, userKeyBalances?.keys || 0);
}

export async function loadBase(game: Game): Promise<void> {
    await Promise.all([loadCrates(game), updateClaimButton(game)]);
}
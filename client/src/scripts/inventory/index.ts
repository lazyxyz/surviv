import $ from "jquery";
import { formatEther } from "ethers";
import { PaymentTokens, SaleItems, SurvivAssets } from "../account";
import type { Game } from "../game";

interface CrateItem {
    balance: number;
    name: string;
    image: string;
    price: string;
}

interface RewardItem {
    image: string;
    amount: number;
    time: string;
}

async function fetchBalances(game: Game, asset: SurvivAssets) {
    try {
        return await game.account.getBalances(asset);
    } catch (err) {
        console.error(`Failed to read ${asset} balances: ${err}`);
        return null;
    }
}

async function fetchPrice(game: Game, item: string, token: PaymentTokens) {
    try {
        const price = await game.account.queryPrice(item, token);
        return price || 0;
    } catch (err) {
        console.error(`Failed to query ${item} price: ${err}`);
        return 0;
    }
}

function setupTabs(tabButtons: NodeListOf<HTMLButtonElement>, tabContents: NodeListOf<HTMLElement>) {
    $(document).off("click", ".crates-tab-child");
    tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            const tabId = button.getAttribute("data-tab");
            if (!tabId) return;

            tabButtons.forEach(btn => btn.classList.remove("active"));
            tabContents.forEach(content => content.style.display = "none");

            const targetTab = document.getElementById(tabId);
            if (targetTab) {
                targetTab.style.display = "flex";
                button.classList.add("active");
            }
        });
    });
}

function renderCrates(crateLists: CrateItem[]) {
    $("#buy-customize-items").empty();
    crateLists.forEach(item => {
        $("#buy-customize-items").append(`
            <div class="crates-card">
                <p>You have ${item.balance}</p>
                <img src="${item.image}" class="crates-image" alt="${item.name}">
                <div class="crates-information">
                    <p>${item.name}</p>
                    <h3>${item.price}</h3>
                </div>
                <div class="crates-supply">
                    <button class="crates-remove" disabled>-</button>
                    <p class="crates-input">0</p>
                    <button class="crates-add">+</button>
                </div>
                <button class="btn btn-alert btn-darken buy-now-btn" disabled>Buy now</button>
            </div>
        `);
    });
}

function setupBuyButtons(game: Game, mySupply: NodeListOf<Element>, addBtn: NodeListOf<Element>, removeBtn: NodeListOf<Element>, buyNow: NodeListOf<Element>) {
    $(document).off("click", ".crates-add .crates-remove .buy-now-btn");
    for (let i = 0; i < mySupply.length; i++) {
        let buyAmount = 0;
        addBtn[i].addEventListener("click", () => {
            buyAmount++;
            mySupply[i].textContent = buyAmount.toString();
            removeBtn[i].disabled = false;
            removeBtn[i].classList.add("active");
            buyNow[i].disabled = false;
            buyNow[i].classList.add("active");
        });

        removeBtn[i].addEventListener("click", () => {
            if (buyAmount > 0) {
                buyAmount--;
                mySupply[i].textContent = buyAmount.toString();
                if (buyAmount === 0) {
                    removeBtn[i].disabled = true;
                    removeBtn[i].classList.remove("active");
                    buyNow[i].disabled = true;
                    buyNow[i].classList.remove("active");
                }
            }
        });

        $(buyNow[i]).on("click", async () => {
            try {
                const itemType = i === 0 ? SaleItems.Keys : SaleItems.Crates;
                await game.account.buyItems(itemType, buyAmount, PaymentTokens.NativeToken);
                alert("Purchase successful!");
                buyAmount = 0;
                mySupply[i].textContent = "0";
                buyNow[i].disabled = true;
                buyNow[i].classList.remove("active");
                removeBtn[i].disabled = true;
                removeBtn[i].classList.remove("active");
                await loadInventory(game); // Refresh inventory
            } catch (err) {
                console.error(`Failed to buy items: ${err}`);
                alert("Purchase failed. Please try again.");
            }
        });
    }
}
function renderMyCrates(userCrateBalances: any, keyBalances: number) {
    const crateImages = userCrateBalances?.crates
        ? new Array(Number(userCrateBalances.crates)).fill({ image: `./img/misc/crate.png` })
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

function setupCrateOpening(game: Game, crateOpen: NodeListOf<Element>, totalSelected: Element | null, openNow: HTMLButtonElement | null, claimItem: HTMLButtonElement | null, keyBalances: number) {
    let count = 0;
    let isOpening = false; // Prevent multiple openings
    let localCrateBalance = crateOpen.length; // Track local crate balance
    let localKeyBalance = keyBalances; // Track local key balance
    $(document).off("click", ".my-crates-child .open-now .claim-items");

    crateOpen.forEach(crate => {
        crate.addEventListener("click", () => {
            if (isOpening) return; // Prevent interaction during opening
            const isActive = crate.classList.contains("active");
            if (isActive) {
                crate.classList.remove("active");
                count--;
            } else if (count < localKeyBalance) {
                crate.classList.add("active");
                count++;
            } else {
                alert("Insufficient keys!");
            }

            if (totalSelected) {
                totalSelected.textContent = `${count} selected`;
            }

            if (openNow) {
                openNow.disabled = count === 0;
                openNow.classList.toggle("active", count > 0);
            }
        });
    });

    if (openNow) {
        $(openNow).on("click", async () => {
            if (isOpening) return; // Prevent multiple clicks
            isOpening = true;
            openNow.disabled = true; // Disable button during operation
            try {
                await game.account.requestOpenCrates(count);
                if (claimItem) {
                    claimItem.classList.add("active");
                    claimItem.disabled = false;
                }
                // Remove opened crates from UI
                const activeCrates = document.querySelectorAll(".my-crates-child.active");
                activeCrates.forEach(crate => crate.remove());
                // Update local balances
                localCrateBalance -= count;
                localKeyBalance -= count;
                // Update UI
                $("#total-crates").text(`You have: ${localCrateBalance} crates - ${localKeyBalance} keys`);
                if (totalSelected) {
                    totalSelected.textContent = "0 selected";
                }
                openNow.classList.remove("active");
                count = 0;
                alert("Crates opened successfully!");
            } catch (err) {
                console.error(`Failed to open crates: ${err}`);
                alert("Failed to open crates. Please try again.");
            } finally {
                isOpening = false;
                openNow.disabled = count === 0;
            }
        });
    }

    if (claimItem) {
        $(claimItem).on("click", async () => {
            if (isOpening) return;
            isOpening = true;
            try {
                await game.account.claimItems();
                alert("Items claimed successfully!");
                claimItem.disabled = true;
            } catch (err) {
                console.error(`Failed to claim items: ${err}`);
                alert("Failed to claim items. Please try again.");
            } finally {
                isOpening = false;
            }
        });
    }
}

function renderRewards(game: Game, userRewards: any) {
    const now = Math.floor(Date.now() / 1000);
    const rewardLists: RewardItem[] = userRewards?.validCrates?.map((item: any) => {
        const secondsLeft = item.expiry - now;
        const daysLeft = Math.max(Math.floor(secondsLeft / (60 * 60 * 24)), 0);
        return {
            image: "./img/misc/crate.png",
            amount: item.amount,
            time: `Expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
        };
    }) || [];

    $("#total-reward").text(`You have ${rewardLists.reduce((sum, item) => sum + item.amount, 0)} crates to claim`);
    $(".rewards-grid-group").empty();
    rewardLists.forEach(item => {
        $(".rewards-grid-group").append(`
            <div class="reward-child">
                <img src="${item.image}" alt="Crates">
                <h3>Amount: ${item.amount}</h3>
                <h3>${item.time}</h3>
            </div>
        `);
    });

    const claimBtn = $("#claim-btn");

    claimBtn.on("click", async () => {
        try {
            await game.account.claimRewards();
            alert("Rewards claimed successfully!");
            await loadInventory(game); // Refresh inventory
        } catch (err) {
            alert(`${err}`);
        }
    });
}

export async function loadInventory(game: Game) {
    // Fetch balances and prices
    const userKeyBalances = await fetchBalances(game, SurvivAssets.SurvivKeys);
    const userCrateBalances = await fetchBalances(game, SurvivAssets.SurvivCrates);
    const keyPrice = await fetchPrice(game, SaleItems.Keys, PaymentTokens.NativeToken);
    const cratePrice = await fetchPrice(game, SaleItems.Crates, PaymentTokens.NativeToken);

    // Prepare crate lists
    const crateLists: CrateItem[] = [
        {
            balance: userKeyBalances?.keys || 0,
            name: "Surviv Keys",
            image: "./img/misc/Keys.png",
            price: `${formatEther(keyPrice)} STT`
        },
        {
            balance: userCrateBalances?.crates || 0,
            name: "Surviv Crates",
            image: "./img/misc/crate.png",
            price: `${formatEther(cratePrice)} STT`
        }
    ];

    // Setup tabs
    const tabButtons = document.querySelectorAll<HTMLButtonElement>(".crates-tab-child");
    const tabContents = document.querySelectorAll<HTMLElement>(".crates-customize-child");
    setupTabs(tabButtons, tabContents);

    // Render crates
    renderCrates(crateLists);

    // Setup buy buttons
    const mySupply = document.querySelectorAll(".crates-input");
    const addBtn = document.querySelectorAll(".crates-add");
    const removeBtn = document.querySelectorAll(".crates-remove");
    const buyNow = document.querySelectorAll(".buy-now-btn");
    setupBuyButtons(game, mySupply, addBtn, removeBtn, buyNow);

    // Render my crates
    renderMyCrates(userCrateBalances, userKeyBalances?.keys || 0);

    // Setup crate opening
    const crateOpen = document.querySelectorAll(".my-crates-child");
    const totalSelected = document.querySelector(".total-selected");
    const openNow = document.querySelector<HTMLButtonElement>(".open-now");
    const claimItem = document.querySelector<HTMLButtonElement>(".claim-items");
    setupCrateOpening(game, crateOpen, totalSelected, openNow, claimItem, userKeyBalances?.keys || 0);

    // Render rewards
    let userRewards = await game.account.getValidRewards().catch(err => {
        console.log(`Failed to get valid rewards: ${err}`);
    });
    renderRewards(game, userRewards);
}
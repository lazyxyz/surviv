import $ from "jquery";
import { formatEther } from "ethers";
import { type PaymentTokenType, type SaleItemType } from "../../account";
import type { Game } from "../../game";
import { successAlert, errorAlert, warningAlert } from "../../modal";
import { SurvivKeysMapping, SurvivCratesMapping, SurvivCardsMapping } from "@common/mappings";
import { getTokenBalances } from "../../utils/onchain/sequence";
import { ShopCache } from "../shop";

interface StoreItem {
    balance: number;
    name: string;
    image: string;
    price: string;
    itemType: SaleItemType;
}

// Cache for storing fetched prices to avoid redundant queries
const priceCache: Partial<Record<SaleItemType, string>> = {};

async function fetchPrice(
    game: Game,
    itemType: SaleItemType,
    paymentToken: PaymentTokenType = "NativeToken"
): Promise<string> {
    // Return cached price if available
    if (priceCache[itemType]) {
        return priceCache[itemType]!;
    }

    try {
        const price = await game.account.queryPrice(itemType, paymentToken);
        const formattedPrice = `${formatEther(price)} STT`;
        priceCache[itemType] = formattedPrice; // Cache the formatted price
        return formattedPrice;
    } catch (err) {
        console.error(`Failed to fetch price for ${itemType}: ${err}`);
        return "N/A"; // Fallback price
    }
}

function renderStoreItems(game: Game, storeItems: StoreItem[]): void {
    const $storeContainer = $("#buy-customize-items");
    $storeContainer.empty();
    storeItems.forEach((item, index) => {
        // Use placeholder price initially
        const $card = $(`
      <div class="crates-card" data-item-type="${item.itemType}">
        <p>You have ${item.balance}</p>
        <img src="${item.image}" class="crates-image" alt="${item.name}">
        <div class="crates-information">
          <p>${item.name}</p>
          <h3 class="price-placeholder">Loading...</h3>
          <h3 class="total-purchase"></h3>
        </div>
        <div class="crates-supply">
          <button class="crates-remove" disabled>-</button>
          <input class="crates-input" value="0" min="0"></input>
          <button class="crates-add">+</button>
        </div>
        <button class="btn btn-alert btn-darken buy-now-btn" disabled>Buy now</button>
      </div>
    `);
        $storeContainer.append($card);

        // Fetch price asynchronously and update the UI
        fetchPrice(game, item.itemType).then(price => {
            $card.find(".price-placeholder").text(price);
        });
    });
}

// Update total purchase amount based on user input
function updateTotalPurchase($card: JQuery<HTMLElement>, amount: number) {
    const priceText = $card.find(".price-placeholder").text();
    const priceValue = parseFloat(priceText);
    const $buyButton = $card.find(".buy-now-btn");
    if (!isNaN(priceValue) && amount > 0) {
        $buyButton.text(`Buy ${(priceValue * amount).toFixed(1)} STT`);
    } else {
        $buyButton.text("Buy now");
        $buyButton.prop("disabled", true).removeClass("active");

    }
}

function setupPurchaseInteractions(game: Game, storeItems: StoreItem[]): void {
    const $cards = $(".crates-card");
    $(document).off("click", ".crates-add, .crates-remove, .buy-now-btn");

    $cards.each((index, card) => {
        const $card = $(card);
        const itemType = $card.data("item-type") as SaleItemType;
        const $purchaseAmount = $card.find(".crates-input");
        const $addButton = $card.find(".crates-add");
        const $removeButton = $card.find(".crates-remove");
        const $buyButton = $card.find(".buy-now-btn");
        let amount = 0;
        let isProcessing = false;

        // Default value = 0
        $purchaseAmount.val("0");

        // Hide value when focused
        $purchaseAmount.on("focus", function () {
            $(this).val("");
            amount = 0;
            updateTotalPurchase($card, amount);
        });
        $purchaseAmount.on("blur", function () {
            let val = parseInt($(this).val() as string, 10);
            if (isNaN(val) || val < 0) {
                $(this).val("0");
                amount = 0;
            }
        });

        // Allow only numbers
        $purchaseAmount.on("input", function () {
            let val = parseInt($(this).val() as string, 10);
            if (isNaN(val) || val < 0) val = 0;
            amount = val;
            $(this).val(amount.toString());
            if (amount === 0) {
                $removeButton.prop("disabled", true).removeClass("active");
                $buyButton.prop("disabled", true).removeClass("active");
            } else {
                $removeButton.prop("disabled", false).addClass("active");
                $buyButton.prop("disabled", false).addClass("active");
            }
            updateTotalPurchase($card, amount);
        });

        $addButton.on("click", () => {
            if (isProcessing) return;
            amount++;
            $purchaseAmount.val(amount.toString());
            $removeButton.prop("disabled", false).addClass("active");
            $buyButton.prop("disabled", false).addClass("active");
            updateTotalPurchase($card, amount);
        });

        $removeButton.on("click", () => {
            if (isProcessing || amount <= 0) return;
            amount--;
            $purchaseAmount.val(amount.toString());
            if (amount === 0) {
                $removeButton.prop("disabled", true).removeClass("active");
                $buyButton.prop("disabled", true).removeClass("active");
            }
            updateTotalPurchase($card, amount);
        });

        $buyButton.on("click", async () => {
            if (isProcessing || amount <= 0) return;
            isProcessing = true;
            $buyButton.prop("disabled", true);
            try {
                await game.account.buyItems(itemType, amount, "NativeToken");
                // Update balance locally
                const item = storeItems.find(item => item.itemType === itemType);
                if (item) {
                    item.balance = Math.max(0, item.balance + amount); // Subtract purchased amount, ensure non-negative
                }
                amount = 0;
                $purchaseAmount.val("0");
                $buyButton.prop("disabled", true).removeClass("active");
                $removeButton.prop("disabled", true).removeClass("active");
                updateTotalPurchase($card, amount);

                // Re-render store items with updated balances
                renderStoreItems(game, storeItems);
                setupPurchaseInteractions(game, storeItems);
                successAlert("Purchase successful!");
            } catch (err: any) {
                errorAlert(err.message);
            } finally {
                isProcessing = false;
                $buyButton.prop("disabled", amount === 0);
            }
        });

        // Button state when value is 0
        $removeButton.prop("disabled", true).removeClass("active");
        $buyButton.prop("disabled", true).removeClass("active");
    });
}

export async function loadStore(game: Game): Promise<void> {
    if (!game.account.address) {
        warningAlert("Please connect your wallet to continue!");
        return;
    }

    if(ShopCache.storeLoaded) return;
    ShopCache.storeLoaded = true;

    const [keyBalances, crateBalances, cardBalances] = await Promise.all([
        getTokenBalances([game.account.address], [SurvivKeysMapping.address]).catch(err => {
            console.error(`Failed to fetch key balances: ${err}`);
            return { success: false, balances: [] };
        }),
        getTokenBalances([game.account.address], [SurvivCratesMapping.address]).catch(err => {
            console.error(`Failed to fetch crate balances: ${err}`);
            return { success: false, balances: [] };
        }),
        getTokenBalances([game.account.address], [SurvivCardsMapping.address]).catch(err => {
            console.error(`Failed to fetch card balances: ${err}`);
            return { success: false, balances: [] };
        }),
    ]);

    const userKeyBalances = keyBalances.balances.length > 0 ? keyBalances.balances[0].balance : 0;
    const userCrateBalances = crateBalances.balances.length > 0 ? crateBalances.balances[0].balance : 0;
    const userCardBalances = cardBalances.balances.length > 0 ? cardBalances.balances[0].balance : 0;

    const storeItems: StoreItem[] = [
        {
            balance: userKeyBalances,
            name: "Surviv Keys",
            image: "./img/misc/Keys.png",
            price: "Loading...", // Placeholder, actual price fetched in renderStoreItems
            itemType: "Keys",
        },
        {
            balance: userCrateBalances,
            name: "Surviv Crates",
            image: "./img/misc/crate.png",
            price: "Loading...",
            itemType: "Crates",
        },
        {
            balance: userCardBalances,
            name: "Surviv Cards",
            image: "./img/misc/card.gif",
            price: "Loading...",
            itemType: "Cards",
        },
    ];

    renderStoreItems(game, storeItems);
    setupPurchaseInteractions(game, storeItems);
}
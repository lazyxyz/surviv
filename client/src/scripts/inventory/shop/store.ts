import $ from "jquery";
import { ethers, formatEther } from "ethers";
import { Account, type SaleCollections, type SaleItems } from "../../account";
import { successAlert, errorAlert, warningAlert } from "../../modal";
import { ShopCache } from ".";
import { GAME_CONSOLE } from "../../..";

const DISCOUNT = 20; // DISCOUNT 20%
const MAX_BADGES_CAP = 1000;

interface StoreItem {
    // balance: number;
    name: string;
    image: string;
    price: string;
    itemType: SaleItems;
    collection: SaleCollections;
}

async function fetchPrice(
    account: Account,
    collection: SaleCollections,
    itemType: SaleItems,
    paymentToken: string = ethers.ZeroAddress
): Promise<string> {
    // Return cached price if available
    if (ShopCache.assetsPrice[itemType]) {
        return ShopCache.assetsPrice[itemType]!;
    }

    try {
        let price = "";
        price = await account.queryPrice(collection, itemType, paymentToken);
        ShopCache.assetsPrice[itemType] = price; // Cache the formatted price
        return price;
    } catch (err) {
        console.error(`Failed to fetch price for ${itemType}: ${err}`);
        return "N/A"; // Fallback price
    }
}

async function fetchBalances(account: Account): Promise<number[]> {
    if (!ShopCache.storeLoaded) {
        let kitsBalance: Record<string, number> = {};
        let badgesBalance: Record<string, number> = {};
        try {
            kitsBalance = await account.getItemBalances("SurvivKits") || {};
            badgesBalance = await account.getItemBalances("SurvivBadges") || {};
        } catch (err) {
            // fall back to empty objects on error
            kitsBalance = {};
            badgesBalance = {};
        }

        ShopCache.storeLoaded = true;
        ShopCache.assetsBalance["key"] = kitsBalance["key"] || 0;
        ShopCache.assetsBalance["crate"] = kitsBalance["crate"] || 0;
        ShopCache.assetsBalance["surviv_pass"] = badgesBalance["surviv_pass"] || 0;
        ShopCache.assetsBalance["surviv_card"] = badgesBalance["surviv_card"] || 0;
        return [
            ShopCache.assetsBalance["key"],
            ShopCache.assetsBalance["crate"],
            ShopCache.assetsBalance["surviv_pass"],
            ShopCache.assetsBalance["surviv_card"]
        ]
    }
    return [];
}

function renderStoreItems(account: Account, storeItems: StoreItem[]): void {
    const $storeContainer = $("#buy-customize-items");
    $storeContainer.empty();
    storeItems.forEach(async (item, index) => {
        // Use placeholder price initially
        const $card = $(`
      <div class="crates-card" data-item-type="${item.itemType}" data-collection="${item.collection}">
        <img src="${item.image}" class="crates-image" alt="${item.name}">
        <div class="crates-information">
        <div class="balance-placeholder"></div>
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

        // if the item is a badge or pass, add total supply element with visual horizontal pile/progress
        if (item.collection == "SurvivBadges") {
            try {
                const currentSupply = await account.getBadgeSupply(item.itemType);
                const percentage = (currentSupply / MAX_BADGES_CAP) * 100;
                const textColor = percentage >= 30 ? "black" : "white";

                // Check if total-supply already exists to prevent duplicates
                if ($card.find(".total-supply").length === 0) {
                    const $totalSupply = $(`
                        <div class="total-supply">
                            <div class="pile-container">
                                <div class="pile-bar" style="width: ${percentage}%"></div>
                                <div class="pile-text" style="color: ${textColor};">Items minted:&nbsp;<span>${currentSupply}/${MAX_BADGES_CAP}</span></div>
                            </div>
                        </div>`);
                    $card.prepend($totalSupply);
                }
            } catch (error) {
                console.error(`Failed to fetch badge supply for ${item.itemType}:`, error);
            }
        }

        fetchPrice(account, item.collection, item.itemType).then(price => {
            const rawPrice = Number(formatEther(price));
            let effectivePrice = rawPrice;

            let formatted;
            if (rawPrice >= 1) {
                // >= 1 → always 2 decimals, no scientific notation
                formatted = rawPrice.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                    useGrouping: false // optional: remove commas
                });
            } else {
                // < 1 → show up to 2 significant digits, no scientific notation
                const precise = rawPrice.toPrecision(2);
                // Convert from scientific (e.g., 5.1e-7) to normal string
                formatted = Number(precise).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 15,
                    useGrouping: false
                });
            }

            $card.find(".price-placeholder").text(`${formatted} ${account.chainConfig.nativeCurrency.symbol}`);
            $card.data("effective-price", effectivePrice);
        });


        // Fetch balances asynchronously and update the UI
        fetchBalances(account).then(balances => {
            // Map itemType to the correct index in the balances array
            const balanceIndexMap: Record<SaleItems, number> = {
                "key": 0, // "key"
                "crate": 1, // "crate"
                "surviv_pass": 2, // "surviv_pass"
                "surviv_card": 3, // "surviv_card"
            };
            const balance = balances.length > 0 ? balances[balanceIndexMap[item.itemType]] : ShopCache.assetsBalance[item.itemType] ?? 0;
            $card.find(".balance-placeholder").html(`You have: <b>${balance}</b>`);
        });
    });

    // Append learn more link after all store items
    const $learnMoreLink = $('<a class="learn-more" href="/earn/" target="_blank">Learn more > </a>');
    $storeContainer.append($learnMoreLink);
}

// Update total purchase amount based on user input
function updateTotalPurchase($card: JQuery<HTMLElement>, amount: number) {
    const effectivePrice = $card.data("effective-price");
    const $buyButton = $card.find(".buy-now-btn");
    if (effectivePrice !== undefined && amount > 0) {
        const total = (effectivePrice * amount).toFixed(1);
        // $buyButton.text(`Buy ${total} ${account.chainConfig.nativeCurrency.symbol}`);
        $buyButton.text(`Buy ${total}`);
    } else {
        $buyButton.text("Buy now");
        $buyButton.prop("disabled", true).removeClass("active");
    }
}

function setupPurchaseInteractions(account: Account, storeItems: StoreItem[]): void {
    const $cards = $(".crates-card");
    $(document).off("click", ".crates-add, .crates-remove, .buy-now-btn");

    $cards.each((index, card) => {
        const $card = $(card);
        const itemType = $card.data("item-type") as SaleItems;
        const collection = $card.data("collection") as SaleCollections;
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
            if (!account.address) {
                warningAlert("Please connect your wallet to continue!");
                return;
            }

            if (isProcessing || amount <= 0) return;
            isProcessing = true;
            $buyButton.prop("disabled", true);
            try {
                const originalPriceWei = BigInt(ShopCache.assetsPrice[itemType]);
                const value = originalPriceWei * BigInt(amount);

                await account.buyItems(collection, itemType, amount, value);

                // Update balance locally
                const item = storeItems.find(item => item.itemType === itemType);
                if (item) {
                    ShopCache.assetsBalance[item.itemType] += amount;
                }
                amount = 0;
                $purchaseAmount.val("0");
                $buyButton.prop("disabled", true).removeClass("active");
                $removeButton.prop("disabled", true).removeClass("active");
                updateTotalPurchase($card, amount);

                // Re-render store items with updated balances
                renderStoreItems(account, storeItems);
                setupPurchaseInteractions(account, storeItems);
                successAlert("Purchase successful!");

                if (item?.itemType == "surviv_card") {
                    GAME_CONSOLE.setBuiltInCVar("cv_loadout_badge", "surviv_card"); // Set card as badge after purchased
                }
            } catch (err: any) {
                console.log("error: ", err);
                errorAlert("Transaction Failed: Please check your wallet balance or try again.", 3000);
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

export async function loadStore(account: Account): Promise<void> {
    const storeItems: StoreItem[] = [
        {
            name: "Surviv Keys",
            image: "./img/assets/surviv_kit_key.webp",
            price: "Loading...",
            itemType: "key",
            collection: "SurvivKits",
        },
        {
            name: "Surviv Crates",
            image: "./img/assets/surviv_kit_crate.webp",
            price: "Loading...",
            itemType: "crate",
            collection: "SurvivKits",
        },
        {
            name: "Survivor's Pass",
            image: "./img/game/shared/badges/surviv_pass.svg",
            price: "Loading...",
            itemType: "surviv_pass",
            collection: "SurvivBadges",
        },
        {
            name: "Genesis Survivor's Card",
            image: "./img/game/shared/badges/surviv_card.svg",
            price: "Loading...",
            itemType: "surviv_card",
            collection: "SurvivBadges",
        },
    ];

    renderStoreItems(account, storeItems);
    setupPurchaseInteractions(account, storeItems);
}
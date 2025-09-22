import $ from "jquery";
import { formatEther } from "ethers";
import { Account, SurvivBadges, SurvivItems, SurvivKits, type PaymentTokenType, type SaleItems } from "../../account";
import { successAlert, errorAlert, warningAlert } from "../../modal";
import { ShopCache } from ".";
import { GAME_CONSOLE } from "../../..";
import { ChainConfig } from "../../../config";
import { SURVIV_SHOP_VERSION } from "@common/mappings";

const DISCOUNT = 20; // DISCOUNT 20%

interface StoreItem {
    // balance: number;
    name: string;
    image: string;
    price: string;
    itemType: SaleItems;
}

async function fetchPrice(
    account: Account,
    itemType: SaleItems,
    paymentToken: PaymentTokenType = "NativeToken"
): Promise<string> {
    // Return cached price if available
    if (ShopCache.assetsPrice[itemType]) {
        return ShopCache.assetsPrice[itemType]!;
    }

    try {
        let price = "";
        if (SURVIV_SHOP_VERSION == 2) {
            let actualPrice = await account.queryPriceV2(itemType);
            price = actualPrice.toString();
        } else {
            price = await account.queryPrice(itemType, paymentToken);
        }
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
            kitsBalance = await account.getItemBalances(SurvivItems.SurvivKits) || {};
            badgesBalance = await account.getItemBalances(SurvivItems.SurvivBadges) || {};
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
    storeItems.forEach((item, index) => {
        // Use placeholder price initially
        const $card = $(`
      <div class="crates-card" data-item-type="${item.itemType}">
        <p class="balance-placeholder">Loading...</p>
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

        fetchPrice(account, item.itemType).then(price => {
            const rawPrice = Number(formatEther(price));
            let effectivePrice = rawPrice;
            if (ShopCache.discountEligible) {
                effectivePrice = rawPrice - (rawPrice * DISCOUNT / 100);
                const formatted = rawPrice.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                });
                const formattedDiscount = effectivePrice.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                });
                $card.find(".price-placeholder").html(
                    `<span style="font-size:70%; text-decoration:line-through; opacity:0.7; margin-right:4px;">${formatted}</span> ${formattedDiscount} ${ChainConfig.nativeCurrency.symbol}`
                );
            } else {
                const formatted = rawPrice.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                });
                $card.find(".price-placeholder").text(`${formatted} ${ChainConfig.nativeCurrency.symbol}`);
            }
            $card.data("effective-price", effectivePrice);
        });
        // Fetch balances asynchronously and update the UI
        fetchBalances(account).then(balances => {
            // Map itemType to the correct index in the balances array
            const balanceIndexMap: Record<SaleItems, number> = {
                [SurvivKits.Keys]: 0, // "key"
                [SurvivKits.Crates]: 1, // "crate"
                [SurvivBadges.Pass]: 2, // "surviv_pass"
                [SurvivBadges.Cards]: 3, // "surviv_card"
            };
            const balance = balances.length > 0 ? balances[balanceIndexMap[item.itemType]] : ShopCache.assetsBalance[item.itemType] ?? 0;
            $card.find(".balance-placeholder").text(`You have ${balance}`);
        });
    });
}

// Update total purchase amount based on user input
function updateTotalPurchase($card: JQuery<HTMLElement>, amount: number) {
    const effectivePrice = $card.data("effective-price");
    const $buyButton = $card.find(".buy-now-btn");
    if (effectivePrice !== undefined && amount > 0) {
        const total = (effectivePrice * amount).toFixed(1);
        $buyButton.text(`Buy ${total} ${ChainConfig.nativeCurrency.symbol}`);
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
                let pricePerItemWei = originalPriceWei;
                if (ShopCache.discountEligible) {
                    pricePerItemWei = (originalPriceWei * BigInt(100 - DISCOUNT)) / BigInt(100);
                }
                const value = pricePerItemWei * BigInt(amount);

                if (SURVIV_SHOP_VERSION == 2) {
                    await account.buyItemsV2(itemType, amount, value);
                } else {
                    await account.buyItems(itemType, amount, "NativeToken", value);
                }
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

                if (item?.itemType == SurvivBadges.Cards) {
                    GAME_CONSOLE.setBuiltInCVar("cv_loadout_badge", "surviv_card"); // Set card as badge after purchased
                }
            } catch (err: any) {
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
            itemType: SurvivKits.Keys,
        },
        {
            name: "Surviv Crates",
            image: "./img/assets/surviv_kit_crate.webp",
            price: "Loading...",
            itemType: SurvivKits.Crates,
        },
        {
            name: "Surviv Pass",
            image: "./img/game/shared/badges/surviv_pass.svg",
            price: "Loading...",
            itemType: SurvivBadges.Pass,
        },
        {
            name: "Surviv Cards",
            image: "./img/game/shared/badges/surviv_card.svg",
            price: "Loading...",
            itemType: SurvivBadges.Cards,
        },
    ];

    await account.isDiscountEligible().then(isEligible => {
        ShopCache.discountEligible = isEligible;
    }).catch(err => { })

    renderStoreItems(account, storeItems);
    setupPurchaseInteractions(account, storeItems);
}
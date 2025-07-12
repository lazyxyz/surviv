import $ from "jquery";
import { formatEther } from "ethers";
import { PaymentTokens, SaleItems, SurvivAssets } from "../account";
import type { Game } from "../game";
import { successAlert, errorAlert } from "../modal";

interface StoreItem {
    balance: number;
    name: string;
    image: string;
    price: string;
    itemType: (typeof SaleItems)[keyof typeof SaleItems];
}

function renderStoreItems(storeItems: StoreItem[]): void {
    const $storeContainer = $("#buy-customize-items");
    $storeContainer.empty();
    storeItems.forEach((item, index) => {
        $storeContainer.append(`
            <div class="crates-card" data-item-type="${item.itemType}">
                <p>You have ${item.balance}</p>
                <img src="${item.image}" class="crates-image" alt="${item.name}">
                <div class="crates-information">
                    <p>${item.name}</p>
                    <h3>${item.price}</h3>
                </div>
                <div class="crates-supply">
                    <button class="crates-remove" disabled>-</button>
                    <input class="crates-input" value="0" min="0"></input>
                    <button class="crates-add">+</button>
                </div>
                <button class="btn btn-alert btn-darken buy-now-btn" disabled>Buy now</button>
            </div>
        `);
    });
}

function setupPurchaseInteractions(game: Game, storeItems: StoreItem[]): void {
    const $cards = $(".crates-card");
    $(document).off("click", ".crates-add, .crates-remove, .buy-now-btn");

    // $cards.each((index, card) => {
    //     const $card = $(card);
    //     const itemType = $card.data("item-type") as SaleItems;
    //     const $purchaseAmount = $card.find(".crates-input");
    //     const $addButton = $card.find(".crates-add");
    //     const $removeButton = $card.find(".crates-remove");
    //     const $buyButton = $card.find(".buy-now-btn");
    //     let amount = 0;
    //     let isProcessing = false;

    //     $addButton.on("click", () => {
    //         if (isProcessing) return;
    //         amount++;
    //         $purchaseAmount.text(amount.toString());
    //         $removeButton.prop("disabled", false).addClass("active");
    //         $buyButton.prop("disabled", false).addClass("active");
    //     });

    //     $removeButton.on("click", () => {
    //         if (isProcessing || amount <= 0) return;
    //         amount--;
    //         $purchaseAmount.text(amount.toString());
    //         if (amount === 0) {
    //             $removeButton.prop("disabled", true).removeClass("active");
    //             $buyButton.prop("disabled", true).removeClass("active");
    //         }
    //     });

    //     $buyButton.on("click", async () => {
    //         if (isProcessing || amount <= 0) return;
    //         isProcessing = true;
    //         $buyButton.prop("disabled", true);
    //         try {
    //             await game.account.buyItems(itemType, amount, PaymentTokens.NativeToken);
    //             successAlert("Purchase successful!");
    //             amount = 0;
    //             $purchaseAmount.text("0");
    //             $buyButton.prop("disabled", true).removeClass("active");
    //             $removeButton.prop("disabled", true).removeClass("active");
    //             await loadStore(game);
    //         } catch (err) {
    //             console.error(`Failed to buy ${itemType}: ${err}`);
    //             errorAlert("Purchase failed. Please try again!");
    //             await loadStore(game);
    //         } finally {
    //             isProcessing = false;
    //             $buyButton.prop("disabled", amount === 0);
    //         }
    //     });
    // });

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

        // hide value when focused
        $purchaseAmount.on("focus", function () {
            $(this).val("");
            amount = 0;
        });
        $purchaseAmount.on("blur", function () {
            let val = parseInt($(this).val() as string, 10);
            if (isNaN(val) || val < 0) {
                $(this).val("0");
                amount = 0;
            }
        });

        // allowed of typing only numbers
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
        });

        $addButton.on("click", () => {
            if (isProcessing) return;
            amount++;
            $purchaseAmount.val(amount.toString());
            $removeButton.prop("disabled", false).addClass("active");
            $buyButton.prop("disabled", false).addClass("active");
        });

        $removeButton.on("click", () => {
            if (isProcessing || amount <= 0) return;
            amount--;
            $purchaseAmount.val(amount.toString());
            if (amount === 0) {
                $removeButton.prop("disabled", true).removeClass("active");
                $buyButton.prop("disabled", true).removeClass("active");
            }
        });

        $buyButton.on("click", async () => {
            if (isProcessing || amount <= 0) return;
            isProcessing = true;
            $buyButton.prop("disabled", true);
            try {
                await game.account.buyItems(itemType, amount, PaymentTokens.NativeToken);
                successAlert("Purchase successful!");
                amount = 0;
                $purchaseAmount.val("0");
                $buyButton.prop("disabled", true).removeClass("active");
                $removeButton.prop("disabled", true).removeClass("active");
                await loadStore(game);
            } catch (err) {
                console.error(`Failed to buy ${itemType}: ${err}`);
                errorAlert("Purchase failed. Please try again!");
                await loadStore(game);
            } finally {
                isProcessing = false;
                $buyButton.prop("disabled", amount === 0);
            }
        });

        // button state when value is 0
        $removeButton.prop("disabled", true).removeClass("active");
        $buyButton.prop("disabled", true).removeClass("active");
    });
}

export async function loadStore(game: Game): Promise<void> {
    const [keyBalances, crateBalances, cardBalances, keyPrice, cratePrice, cardPrice] = await Promise.all([
        game.account.getBalances(SurvivAssets.SurvivKeys).catch(err => {
            console.error(`Failed to load key balance: ${err}`);
            return { keys: 0 };
        }),
        game.account.getBalances(SurvivAssets.SurvivCrates).catch(err => {
            console.error(`Failed to load crate balance: ${err}`);
            return { crates: 0 };
        }),
        game.account.getBalances(SurvivAssets.SurvivCards).catch(err => {
            console.error(`Failed to load crate balance: ${err}`);
            return { cards: 0 };
        }),
        game.account.queryPrice(SaleItems.Keys, PaymentTokens.NativeToken).catch(err => {
            console.error(`Failed to fetch key price: ${err}`);
            return 0;
        }),
        game.account.queryPrice(SaleItems.Crates, PaymentTokens.NativeToken).catch(err => {
            console.error(`Failed to fetch crate price: ${err}`);
            return 0;
        }),
        game.account.queryPrice(SaleItems.Cards, PaymentTokens.NativeToken).catch(err => {
            console.error(`Failed to fetch crate price: ${err}`);
            return 0;
        }),
    ]);

    const storeItems: StoreItem[] = [
        {
            balance: keyBalances?.keys || 0,
            name: "Surviv Keys",
            image: "./img/misc/Keys.png",
            price: `${formatEther(keyPrice)} STT`,
            itemType: SaleItems.Keys,
        },
        {
            balance: crateBalances?.crates || 0,
            name: "Surviv Crates",
            image: "./img/misc/crate.png",
            price: `${formatEther(cratePrice)} STT`,
            itemType: SaleItems.Crates,
        },
        {
            balance: cardBalances?.cards || 0,
            name: "Surviv Cards",
            image: "./img/misc/card.gif",
            price: `${formatEther(cardPrice)} STT`,
            itemType: SaleItems.Cards,
        },
    ];

    renderStoreItems(storeItems);
    setupPurchaseInteractions(game, storeItems);
}
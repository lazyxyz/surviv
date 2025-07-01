import $ from "jquery";
import { formatEther } from "ethers";
import { PaymentTokens, SaleItems, SurvivAssets } from "../account";
import type { Game } from "../game";

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
                    <p class="crates-input">0</p>
                    <button class="crates-add">+</button>
                </div>
                <button class="btn btn-alert btn-darken buy-now-btn" disabled>Buy now</button>
            </div>
        `);
    });
}

function showTimedAlert(message, duration = 3000) {
    // Create alert element
    const alertDiv = document.createElement('div');
    alertDiv.innerHTML =
        `
    <h1 id="done-messages">${message}</h1>
    `;
    alertDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #5CB824;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      z-index: 9999;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;

    document.body.appendChild(alertDiv);

    // Auto-remove after specified duration
    setTimeout(() => {
        alertDiv.remove();
    }, duration);
}

function setupPurchaseInteractions(game: Game, storeItems: StoreItem[]): void {
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

        $addButton.on("click", () => {
            if (isProcessing) return;
            amount++;
            $purchaseAmount.text(amount.toString());
            $removeButton.prop("disabled", false).addClass("active");
            $buyButton.prop("disabled", false).addClass("active");
        });

        $removeButton.on("click", () => {
            if (isProcessing || amount <= 0) return;
            amount--;
            $purchaseAmount.text(amount.toString());
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
                // alert("Purchase successful!");
                showTimedAlert("Purchase successful!", 3000);
                amount = 0;
                $purchaseAmount.text("0");
                $buyButton.prop("disabled", true).removeClass("active");
                $removeButton.prop("disabled", true).removeClass("active");
                await loadStore(game);
            } catch (err) {
                console.error(`Failed to buy ${itemType}: ${err}`);
                alert("Purchase failed. Please try again.");
            } finally {
                isProcessing = false;
                $buyButton.prop("disabled", amount === 0);
            }
        });
    });
}

export async function loadStore(game: Game): Promise<void> {
    const [keyBalances, crateBalances, keyPrice, cratePrice] = await Promise.all([
        game.account.getBalances(SurvivAssets.SurvivKeys).catch(err => {
            console.error(`Failed to load key balance: ${err}`);
            return { keys: 0 };
        }),
        game.account.getBalances(SurvivAssets.SurvivCrates).catch(err => {
            console.error(`Failed to load crate balance: ${err}`);
            return { crates: 0 };
        }),
        game.account.queryPrice(SaleItems.Keys, PaymentTokens.NativeToken).catch(err => {
            console.error(`Failed to fetch key price: ${err}`);
            return 0;
        }),
        game.account.queryPrice(SaleItems.Crates, PaymentTokens.NativeToken).catch(err => {
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
    ];

    renderStoreItems(storeItems);
    setupPurchaseInteractions(game, storeItems);
}
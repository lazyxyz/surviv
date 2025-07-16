import $ from "jquery";
import type { Game } from "../game";
import { InventoryCache } from ".";
import { loadStore } from "./shop/store";
import { loadBase } from "./shop/base";
import { loadRewards } from "./shop/rewards";


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

export let ShopCache: {
    storeLoaded: boolean,
    baseLoaded: boolean,
    rewardsLoaded: boolean,
}

export async function showShop(game: Game) {
    if (InventoryCache.shopLoaded) return;
    InventoryCache.shopLoaded = true;

    ShopCache = {
        storeLoaded: false,
        baseLoaded: false,
        rewardsLoaded: false,
    }

    // Setup tabs
    const tabButtons = document.querySelectorAll<HTMLButtonElement>(".crates-tab-child");
    const tabContents = document.querySelectorAll<HTMLElement>(".crates-customize-child");
    setupTabs(tabButtons, tabContents);

    $("#store-tab").on('click', () => {
        loadStore(game);
    })

    $("#my-crates-tab").on('click', () => {
        loadBase(game);
    })

    $("#rewards-tab").on('click', () => {
        loadRewards(game);
    })

    // Trigger store tab click by default
    $("#store-tab").trigger('click');
}
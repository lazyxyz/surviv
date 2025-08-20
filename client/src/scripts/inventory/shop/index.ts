import $ from "jquery";
import { InventoryCache } from "..";
import { loadStore } from "./store";
import { loadBase } from "./base";
import { loadRewards } from "./rewards";
import type { Account, SaleItems, SurvivItems } from "../../account";


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
    assetsBalance: Record<SaleItems, number>;
    assetsPrice: Record<SaleItems, string>;
}

export async function showShop(account: Account) {
    if (InventoryCache.shopLoaded) return;
    InventoryCache.shopLoaded = true;

    ShopCache = {
        storeLoaded: false,
        baseLoaded: false,
        assetsBalance: {
            crate: 0,
            card: 0,
            key: 0
        },
        assetsPrice: {
            crate: "",
            card: "",
            key: ""
        }
    }

    // Setup tabs
    const tabButtons = document.querySelectorAll<HTMLButtonElement>(".crates-tab-child");
    const tabContents = document.querySelectorAll<HTMLElement>(".crates-customize-child");
    setupTabs(tabButtons, tabContents);

    $("#store-tab").on('click', () => {
        loadStore(account);
    })

    $("#my-crates-tab").on('click', () => {
        loadBase(account);
    })

    $("#rewards-tab").on('click', () => {
        loadRewards(account);
    })

    // Trigger store tab click by default
    $("#store-tab").trigger('click');
}
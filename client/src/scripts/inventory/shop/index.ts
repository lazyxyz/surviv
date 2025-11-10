import $ from "jquery";
import { loadStore } from "./store";
import { loadBase } from "./base";
import { loadRewards } from "./rewards";
import type { Account, SaleCollections, ValidRewards } from "../../account";


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
    assetsBalance: {
        crate: number;
        key: number;
        surviv_card: number;
        surviv_pass: number;
    };
    assetsPrice: {
        crate: string;
        key: string;
        surviv_card: string;
        surviv_pass: string;
    };
    PlayerValidRewards: ValidRewards | undefined;
}

export async function updateRewardsTab(rewards: number) {
    // Update rewards tab text
    const rewardsTab = document.querySelector("#rewards-tab") as HTMLButtonElement;
    if (rewards) {
        rewardsTab.textContent = `Rewards(${rewards})`;
    } else {
        rewardsTab.textContent = "Rewards";
    }
}

export async function showShop(account: Account) {
    ShopCache = {
        storeLoaded: false,
        baseLoaded: false,
        assetsBalance: {
            crate: 0,
            key: 0,
            surviv_card: 0,
            surviv_pass: 0,
        },
        assetsPrice: {
            crate: "",
            key: "",
            surviv_card: "",
            surviv_pass: "",
        },
        PlayerValidRewards: undefined,
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
    account.getValidRewards().then(validRewards => {
        ShopCache.PlayerValidRewards = validRewards;
        updateRewardsTab(validRewards.validCrates.length)
    }).catch(err => { })
}
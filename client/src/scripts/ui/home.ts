import { GameConstants } from "@common/constants";
import { html } from "../utils/misc";
import { TRANSLATIONS, getTranslatedString } from "../../translations";
import { Config, type ServerInfo } from "../../config";
import { createDropdown } from "../uiHelpers";
import type { TranslationKeys } from "../../typings/translations";
import { errorAlert, successAlert, warningAlert } from "../modal";
import { SurvivBadges, type Account } from "../account";
import { GAME_CONSOLE } from "../..";
import $ from "jquery";
import { SURVIV_SHOP_VERSION } from "@common/mappings";
import { ethers } from "ethers";

export interface RegionInfo {
    readonly name: string;
    readonly mainAddress: string;
    readonly apiAddress: string;
    readonly gameAddress: string;
    readonly teamAddress: string;
    readonly playerCount?: number;
    readonly maxTeamSize?: number;
    readonly nextSwitchTime?: number;
    readonly ping?: number;
}

export let selectedRegion: RegionInfo | undefined;
const regionInfo: Record<string, RegionInfo> = Config.regions;
export let teamID: string | undefined | null;
let buttonsLocked = true;
let lastDisconnectTime: number | undefined;

export function lockPlayButtons(): void { buttonsLocked = true; }
export function unlockPlayButtons(): void { buttonsLocked = false; }
export function updateDisconnectTime(): void { lastDisconnectTime = Date.now(); }

export function resetPlayButtons(): void {
    if (buttonsLocked) return;
    $("#splash-options").removeClass("loading");
    $("#loading-text").text(getTranslatedString("loading_connecting"));
    $("#btn-cancel-finding-game").css("display", "none");
}

async function handleBuyCard(account: Account): Promise<void> {
    // Function to fetch and format price
    async function updateButtonPrice() {
        try {
            let price: number;
            if (SURVIV_SHOP_VERSION == 2) {
                price = await account.queryPriceV2(SurvivBadges.Cards);
            } else {
                price = await account.queryPrice(SurvivBadges.Cards, "NativeToken");
            }

            // Convert price from Wei to Ether
            const priceInEther = ethers.formatEther(price);
            // Round up to the nearest integer
            const formattedPrice = Math.ceil(parseFloat(priceInEther));

            // Update button text
            $(".home-buy-card-button").text(`Claim for ${formattedPrice} $SOMI →`);
        } catch (err) {
            console.error("Error fetching price:", err);
            $(".home-buy-card-button").text("Claim →"); // Fallback text on error
        }
    }

    updateButtonPrice();

    // Handle button click
    $(".home-buy-card-button").on("click", async () => {
        try {
            if (!account.address) {
                warningAlert("Please connect your wallet to continue.");
                return;
            }

            if (SURVIV_SHOP_VERSION == 2) {
                const price = await account.queryPriceV2(SurvivBadges.Cards);
                await account.buyItemsV2(SurvivBadges.Cards, 1, price);
            } else {
                const price = await account.queryPrice(SurvivBadges.Cards, "NativeToken");
                await account.buyItems(SurvivBadges.Cards, 1, "NativeToken", price);
            }

            GAME_CONSOLE.setBuiltInCVar("cv_loadout_badge", "surviv_card");
            successAlert("Purchase successful!");
            // Optionally update price again after purchase
            await updateButtonPrice();
        } catch (err) {
            console.error("Purchase error:", err);
            errorAlert("Something went wrong, please try again.");
        }
    });
}

function setupLanguageSelector(): void {
    const languageFieldset = $("#languages-selector");
    for (const [language, languageInfo] of Object.entries(TRANSLATIONS.translations)) {
        const isSelected = GAME_CONSOLE.getBuiltInCVar("cv_language") === language;
        languageFieldset.append(html`
            <a id="language-${language}" ${isSelected ? 'class="selected"' : ""}>
                ${languageInfo.flag} <strong>${languageInfo.name}</strong> [${!isSelected ? TRANSLATIONS.translations[language].percentage : languageInfo.percentage}]
            </a>
        `);
        $(`#language-${language}`).on("click", () => {
            GAME_CONSOLE.setBuiltInCVar("cv_language", language);
        });
    }
    GAME_CONSOLE.variables.addChangeListener("cv_language", () => location.reload());
}

async function loadServerList(): Promise<void> {
    const serverList = $<HTMLUListElement>("#server-list");
    const regionUICache: Record<string, JQuery<HTMLLIElement>> = {};

    for (const [regionID] of Object.entries(regionInfo)) {
        serverList.append(
            regionUICache[regionID] = $<HTMLLIElement>(`
                <li class="server-list-item" data-region="${regionID}">
                    <span class="server-name">${getTranslatedString(`region_${regionID}` as TranslationKeys)}</span>
                    <span style="margin-left: auto">
                        <img src="./img/misc/player_icon.svg" width="16" height="16" alt="Player count">
                        <span class="server-player-count">-</span>
                    </span>
                </li>
            `)
        );
    }

    $<HTMLDivElement>("#loading-text").text(getTranslatedString("loading_fetching_data"));
    await Promise.all(Object.entries(regionInfo).map(async ([regionID, region]) => {
        const listItem = regionUICache[regionID];
        const pingStartTime = Date.now();
        let serverInfo: ServerInfo | undefined;

        for (let attempts = 0; attempts < 3; attempts++) {
            try {
                serverInfo = await (await fetch(`${region.mainAddress}/api/serverInfo`, { signal: AbortSignal.timeout(10000) })).json() as ServerInfo;
                if (serverInfo) break;
            } catch (e) {
                console.error(`Error loading server info for region ${regionID}. Details:`, e);
            }
        }

        if (!serverInfo) {
            console.error(`Unable to load server info for region ${regionID} after 3 attempts`);
            return;
        }

        if (serverInfo.protocolVersion !== GameConstants.protocolVersion) {
            console.error(`Protocol version mismatch for region ${regionID}. Expected ${GameConstants.protocolVersion}, got ${serverInfo.protocolVersion}`);
            return;
        }

        regionInfo[regionID] = { ...region, ...serverInfo, ping: Date.now() - pingStartTime };
        listItem.find(".server-player-count").text(serverInfo.playerCount ?? "-");
    }));
}

function setupServerSelector(account: Account): void {
    const serverList = $<HTMLUListElement>("#server-list");
    const serverSelect = $<HTMLSelectElement>("#server-select");

    serverList.children("li.server-list-item").on("click", function () {
        const region = this.getAttribute("data-region");
        if (!region || !regionInfo[region]) return;

        resetPlayButtons();
        selectedRegion = regionInfo[region];
        GAME_CONSOLE.setBuiltInCVar("cv_region", region);
        updateServerSelectors();
    });

    serverSelect.on("change", () => {
        const value = serverSelect.val() as string | undefined;
        if (value !== undefined) {
            GAME_CONSOLE.setBuiltInCVar("cv_region", value);
            selectedRegion = regionInfo[value];
            updateServerSelectors();
        }
    });

    selectedRegion = regionInfo[GAME_CONSOLE.getBuiltInCVar("cv_region") ?? Config.defaultRegion];
    account.setApi(selectedRegion?.apiAddress ?? regionInfo[Config.defaultRegion].apiAddress);
    updateServerSelectors();
}

function updateServerSelectors(): void {
    if (!selectedRegion) {
        selectedRegion = regionInfo[Config.defaultRegion];
        GAME_CONSOLE.setBuiltInCVar("cv_region", "");
    }
    const region = getTranslatedString(`region_${GAME_CONSOLE.getBuiltInCVar("cv_region")}` as TranslationKeys);
    $("#server-name").text(region === "region_" ? selectedRegion.name : region);
    $("#server-player-count").text(selectedRegion.playerCount ?? "-");
    resetPlayButtons();
}



function handleQueryParams(account: Account): void {
    const params = new URLSearchParams(window.location.search);
    if (params.has("region")) {
        const region = params.get("region");
        params.delete("region");
        if (region && Object.hasOwn(Config.regions, region)) {
            GAME_CONSOLE.setBuiltInCVar("cv_region", region);
        }
    }
    if (params.get("nameColor")) GAME_CONSOLE.setBuiltInCVar("dv_name_color", params.get("nameColor")!);
    if (params.get("lobbyClearing")) GAME_CONSOLE.setBuiltInCVar("dv_lobby_clearing", params.get("lobbyClearing") === "true");
    if (window.location.hash) {
        teamID = window.location.hash.slice(1);
        $("#btn-join-team").trigger("click");
    }
}

function setupUsernameInput(): void {
    const usernameField = $<HTMLInputElement>("#username-input");
    usernameField.val(GAME_CONSOLE.getBuiltInCVar("cv_player_name"));
    usernameField.on("input", function () {
        GAME_CONSOLE.setBuiltInCVar("cv_player_name", this.value = this.value
            .replace(/[\u201c\u201d\u201f]/g, '"')
            .replace(/[\u2018\u2019\u201b]/g, "'")
            .replace(/[\u2013\u2014]/g, "-")
            .replace(/[^\x20-\x7E]/g, ""));
    });
}

function setupUIInteractions(): void {
    $(".btn-social").on("click", e => {
        if (lastDisconnectTime && Date.now() - lastDisconnectTime < 1500) {
            e.preventDefault();
        }
    });
}

export async function setupHome(account: Account): Promise<void> {
    createDropdown("#language-dropdown");
    createDropdown("#server-select");
    await handleBuyCard(account);
    setupLanguageSelector();
    await loadServerList();
    setupServerSelector(account);
    handleQueryParams(account);
    setupUsernameInput();
    unlockPlayButtons();
    resetPlayButtons();
    setupUIInteractions();
}

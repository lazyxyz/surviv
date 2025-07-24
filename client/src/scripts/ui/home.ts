import { EMOTE_SLOTS, GameConstants, TeamSize } from "@common/constants";
import { Loots } from "@common/definitions/loots";
import { html, requestFullscreen } from "../utils/misc";
import { Color } from "pixi.js";
import { TRANSLATIONS, getTranslatedString } from "../../translations";
import { Config, type ServerInfo } from "../../config";
import type { Game } from "../game";
import { createDropdown } from "../uiHelpers";
import { defaultClientCVars } from "../utils/console/defaultClientCVars";
import type { TranslationKeys } from "../../typings/translations";
import { parseJWT, UI_DEBUG_MODE } from "../utils/constants";
import { errorAlert, successAlert, warningAlert } from "../modal";
import type { Account } from "../account";
import { GAME_CONSOLE } from "../..";
import $ from "jquery";
import { CustomTeamMessages, type CustomTeamMessage, type CustomTeamPlayerInfo, type GetGameResponse } from "@common/typings";
import { Emotes } from "@common/definitions/emotes";

export interface RegionInfo {
    readonly name: string
    readonly mainAddress: string
    readonly apiAddress: string
    readonly gameAddress: string
    readonly teamAddress: string
    readonly playerCount?: number
    readonly maxTeamSize?: number
    readonly nextSwitchTime?: number
    readonly ping?: number
}

let selectedRegion: RegionInfo | undefined;

const regionInfo: Record<string, RegionInfo> = Config.regions;

export let teamSocket: WebSocket | undefined;
let teamID: string | undefined | null;
let joinedTeam = false;
let autoFill = false;

export let autoPickup = true;

let buttonsLocked = true;
export function lockPlayButtons(): void { buttonsLocked = true; }
export function unlockPlayButtons(): void { buttonsLocked = false; }

let lastDisconnectTime: number | undefined;
export function updateDisconnectTime(): void { lastDisconnectTime = Date.now(); }

export function resetPlayButtons(): void {
    if (buttonsLocked) return;

    $("#splash-options").removeClass("loading");
    $("#loading-text").text(getTranslatedString("loading_connecting"));
    $("#btn-cancel-finding-game").css("display", "none");
}

export async function setupHome(game: Game, account: Account): Promise<void> {
    const { uiManager: { ui } } = game;

    const playButtons = [$("#btn-play-solo"), $("#btn-play-squad")];
    for (let buttonIndex = 0; buttonIndex < playButtons.length; buttonIndex++) {
        const button = playButtons[buttonIndex];

        button.addClass(`play-button`);

        // Mode Logo
        const translationString = `play_${["solo", "squad"][buttonIndex]}`;
        let logoSrc = buttonIndex == 0 ? "./img/misc/user.svg" : "./img/misc/user-group.svg";

        button.html(`
                    <img class="btn-icon" width="26" height="26" src=${logoSrc}>
                    <span style="margin-left: ${(buttonIndex > 0 ? "20px;" : "0")}" translation="${translationString}">${getTranslatedString(translationString as TranslationKeys)}</span>
                `);
    }

    // Buy Card directly in Home
    $(".home-buy-card-button").on("click", async () => {
        try {
            // Check if wallet is connected
            if (!account?.address) {
                warningAlert("Please connect your wallet to continue.");
                return;
            }

            const price = await account.queryPrice("Cards", "NativeToken");
            await account.buyItems("Cards", 1, "NativeToken", price);

            successAlert("Purchase successful!");
        } catch (err) {
            console.error("Purchase error:", err);
            errorAlert("Something went wrong, please try again.");
        }
    });

    if (UI_DEBUG_MODE) {
        // Kill message
        ui.killMsgHeader.text("Kills: 7");
        ui.killMsgContainer.text("Player  with Mosin-Nagant (streak: 255)");
        ui.killMsgModal.show();

        // Spectating message
        ui.spectatingMsgPlayer.html("Player");
        ui.spectatingContainer.show();

        // Gas message
        ui.gasMsgInfo
            .text("Toxic gas is advancing! Move to the safe zone")
            .css("color", "cyan");
        ui.gasMsg.show();

        ui.ammoCounterContainer.show();

        // Kill feed messages
        const killFeed = ui.killFeed;
        for (let i = 0; i < 5; i++) {
            const killFeedItem = $<HTMLDivElement>("<div>");
            killFeedItem.addClass("kill-feed-item");
            killFeedItem.html(
                '<img class="kill-icon" src="./img/misc/skull_icon.svg" alt="Skull"> Player killed Player with Mosin-Nagant'
            );
            killFeed.prepend(killFeedItem);
        }
    }

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

    const params = new URLSearchParams(window.location.search);

    // Switch regions with the ?region="name" Search Parameter
    if (params.has("region")) {
        (() => {
            const region = params.get("region");
            params.delete("region");
            if (region === null) return;
            if (!Object.hasOwn(Config.regions, region)) return;
            GAME_CONSOLE.setBuiltInCVar("cv_region", region);
        })();
    }

    createDropdown("#language-dropdown");

    ui.lockedInfo.on("click", () => ui.lockedTooltip.fadeToggle(250));

    const pad = (n: number): string | number => n < 10 ? `0${n}` : n;
    const updateSwitchTime = (): void => {
        if (!selectedRegion?.nextSwitchTime) {
            ui.lockedTime.text("--:--:--");
            return;
        }
        const millis = selectedRegion.nextSwitchTime - Date.now();
        if (millis < 0) {
            location.reload();
            return;
        }
        const hours = Math.floor(millis / 3600000) % 24;
        const minutes = Math.floor(millis / 60000) % 60;
        const seconds = Math.floor(millis / 1000) % 60;
        ui.lockedTime.text(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };
    setInterval(updateSwitchTime, 1000);

    const regionMap = Object.entries(regionInfo);
    const serverList = $<HTMLUListElement>("#server-list");

    // Load server list
    const regionUICache: Record<string, JQuery<HTMLLIElement>> = {};

    for (const [regionID] of regionMap) {
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

    ui.loadingText.text(getTranslatedString("loading_fetching_data"));
    const regionPromises = Object.entries(regionMap).map(async ([_, [regionID, region]]) => {
        const listItem = regionUICache[regionID];

        const pingStartTime = Date.now();

        let serverInfo: ServerInfo | undefined;

        for (let attempts = 0; attempts < 3; attempts++) {
            console.log(`Loading server info for region ${regionID}: ${region.mainAddress} (attempt ${attempts + 1} of 3)`);
            try {
                if (
                    serverInfo = await (
                        await fetch(`${region.mainAddress}/api/serverInfo`, { signal: AbortSignal.timeout(10000) })
                    )?.json() as ServerInfo
                ) break;
            } catch (e) {
                console.error(`Error loading server info for region ${regionID}. Details:`, e);
            }
        }

        if (!serverInfo) {
            console.error(`Unable to load server info for region ${regionID} after 3 attempts`);
            return;
        }

        if (serverInfo.protocolVersion !== GameConstants.protocolVersion) {
            console.error(`Protocol version mismatch for region ${regionID}. Expected ${GameConstants.protocolVersion} (ours), got ${serverInfo.protocolVersion} (theirs)`);
            return;
        }

        regionInfo[regionID] = {
            ...region,
            ...serverInfo,
            ping: Date.now() - pingStartTime
        };

        listItem.find(".server-player-count").text(serverInfo.playerCount ?? "-");
    });
    await Promise.all(regionPromises);

    const serverName = $<HTMLSpanElement>("#server-name");
    const playerCount = $<HTMLSpanElement>("#server-player-count");
    const updateServerSelectors = (): void => {
        if (!selectedRegion) { // Handle invalid region
            selectedRegion = regionInfo[Config.defaultRegion];
            GAME_CONSOLE.setBuiltInCVar("cv_region", "");
        }
        const region = getTranslatedString(`region_${GAME_CONSOLE.getBuiltInCVar("cv_region")}` as TranslationKeys);
        if (region === "region_") {
            serverName.text(selectedRegion.name); // this for now until we find a way to selectedRegion.id
        } else {
            serverName.text(region);
        }
        playerCount.text(selectedRegion.playerCount ?? "-");
        updateSwitchTime();
        resetPlayButtons();
    };

    selectedRegion = regionInfo[GAME_CONSOLE.getBuiltInCVar("cv_region") ?? Config.defaultRegion];
    if (selectedRegion) {
        account.setApi(selectedRegion.apiAddress);
    } else {
        account.setApi(regionInfo[Config.defaultRegion].apiAddress);
    }

    updateServerSelectors();

    serverList.children("li.server-list-item").on("click", function (this: HTMLLIElement) {
        const region = this.getAttribute("data-region");

        if (region === null) return;

        const info = regionInfo[region];
        if (info === undefined) return;

        resetPlayButtons();

        selectedRegion = info;

        GAME_CONSOLE.setBuiltInCVar("cv_region", region);

        updateServerSelectors();
    });

    const readyConnect = async (data: GetGameResponse, gameAddress: string) => {
        if (data.success) {
            ui.splashOptions.addClass("loading");
            ui.loadingText.text(getTranslatedString('msg_loading'));

            const params = new URLSearchParams();

            if (teamID) params.set("teamID", teamID);
            if (autoFill) params.set("autoFill", String(autoFill));

            {
                const name = GAME_CONSOLE.getBuiltInCVar("cv_player_name");
                if (name) params.set("name", name);

                if (account.address) params.set("address", account.address)

                let skin: typeof defaultClientCVars["cv_loadout_skin"];
                const playerSkin = Loots.fromStringSafe(
                    GAME_CONSOLE.getBuiltInCVar("cv_loadout_skin")
                ) ?? Loots.fromString(
                    typeof (skin = defaultClientCVars.cv_loadout_skin) === "object"
                        ? skin.value
                        : skin
                );

                if (playerSkin) params.set("skin", playerSkin.idString);

                const badge = GAME_CONSOLE.getBuiltInCVar("cv_loadout_badge");
                if (badge) params.set("badge", badge);

                const weaponPreset = GAME_CONSOLE.getBuiltInCVar("dv_weapon_preset");
                if (weaponPreset) {
                    if (JSON.parse(weaponPreset).melee) params.set("melee", JSON.parse(weaponPreset).melee);
                    if (JSON.parse(weaponPreset).gun) params.set("gun", JSON.parse(weaponPreset).gun);
                }

                const lobbyClearing = GAME_CONSOLE.getBuiltInCVar("dv_lobby_clearing");
                if (lobbyClearing) params.set("lobbyClearing", "true");

                const nameColor = GAME_CONSOLE.getBuiltInCVar("dv_name_color");
                if (nameColor) {
                    try {
                        params.set("nameColor", new Color(nameColor).toNumber().toString());
                    } catch (e) {
                        GAME_CONSOLE.setBuiltInCVar("dv_name_color", "");
                        console.error(e);
                    }
                }

                const emoteIds = EMOTE_SLOTS.map(
                    slot => Emotes.fromStringSafe(GAME_CONSOLE.getBuiltInCVar(`cv_loadout_${slot}_emote`))?.idString
                );

                if (emoteIds.length > 0) {
                    const emotes = emoteIds.join(',');
                    try {
                        params.set("emotes", emotes);
                    } catch (e) {
                        console.error(e);
                    }
                }
            }

            const websocketURL = `${gameAddress.replace("<ID>", (data.gameID).toString())}/play?${params.toString()}`;
            await game.connect(websocketURL, account, "fall");
            ui.splashOptions.addClass("loading");
            ui.loadingText.text("Verifying Game Assets");
            ui.splashMsg.hide();

            if (createTeamMenu.css("display") !== "none") createTeamMenu.hide();
        } else {
            if (data.message !== undefined) {
                const reportID = data.reportID || "No report ID provided.";
                const message = getTranslatedString(`msg_punishment_${data.message}_reason`, { reason: data.reason ?? getTranslatedString("msg_no_reason") });

                ui.warningTitle.text(getTranslatedString(`msg_punishment_${data.message}`));
                ui.warningText.html(`${data.message !== "vpn" ? `<span class="case-id">Case ID: ${reportID}</span><br><br><br>` : ""}${message}`);
                ui.warningAgreeOpts.toggle(data.message === "warn");
                ui.warningAgreeCheckbox.prop("checked", false);
                ui.warningModal.show();
                ui.splashOptions.addClass("loading");
            } else {
                ui.splashMsgText.html(html`
                    ${getTranslatedString("msg_err_joining")}
                    <br>
                    ${getTranslatedString("msg_try_again")}
                `);
                ui.splashMsg.show();
            }

            resetPlayButtons();
        }
    };

    const joinGame = (teamSize: number): void => {
        ui.splashOptions.addClass("loading");
        ui.loadingText.text(getTranslatedString("loading_finding_game"));
        if (selectedRegion === undefined || !account.token?.length) return;

        {
            const { exp } = parseJWT(account.token);

            if (new Date().getTime() >= (exp * 1000)) {
                return account.sessionExpired();
            }
        }

        const target = selectedRegion;

        void $.get(
            `${target.mainAddress}/api/getGame?teamSize=${teamSize || 1}${teamID ? `&teamID=${teamID}` : ""}`,
            (data: GetGameResponse) => {
                return readyConnect(data, target.gameAddress);
            }
        ).fail(() => {
            ui.splashMsgText.html(html`
                ${getTranslatedString("msg_err_finding")}
                <br>
                ${getTranslatedString("msg_try_again")}
            `);
            ui.splashMsg.show();
            resetPlayButtons();
        });
    };

    let lastPlayButtonClickTime = 0;

    $("#btn-play-solo").on("click", _ => {
        if (!account.address) {
            warningAlert("Please connect your wallet to continue!");
            return;
        }
        const now = Date.now();
        if (now - lastPlayButtonClickTime < 1500) return;
        lastPlayButtonClickTime = now;

        joinGame(TeamSize.Solo);
    });

    $("#btn-play-squad").on("click", event => {
        if (!account.address) {
            warningAlert("Please connect your wallet to continue!");
            return;
        }
        const now = Date.now();
        if (now - lastPlayButtonClickTime < 1500) return;
        lastPlayButtonClickTime = now;
        joinGame(TeamSize.Squad);
    });

    const createTeamMenu = $("#create-team-menu");
    $<HTMLButtonElement>("#btn-create-team, #btn-join-team").on("click", function () {
        const now = Date.now();

        if (now - lastPlayButtonClickTime < 1500 || teamSocket || selectedRegion === undefined || !account.token?.length) return;

        {
            const { exp } = parseJWT(account.token);

            if (new Date().getTime() >= (exp * 1000)) {
                return account.sessionExpired();
            }
        }

        lastPlayButtonClickTime = now;

        ui.splashOptions.addClass("loading");
        ui.loadingText.text(getTranslatedString("loading_connecting"));

        const params = new URLSearchParams();

        if (this.id === "btn-join-team") {
            while (!teamID) {
                teamID = prompt(getTranslatedString("msg_enter_team_code"));
                if (!teamID) {
                    resetPlayButtons();
                    return;
                }

                if (teamID.includes("#")) {
                    teamID = teamID.split("#")[1];
                }

                if (/^[a-zA-Z0-9]{4}$/.test(teamID)) {
                    break;
                }

                alert("Invalid team code.");
            }

            params.set("teamID", teamID);
        }

        params.set("name", GAME_CONSOLE.getBuiltInCVar("cv_player_name"));
        params.set("skin", GAME_CONSOLE.getBuiltInCVar("cv_loadout_skin"));

        const badge = GAME_CONSOLE.getBuiltInCVar("cv_loadout_badge");
        if (badge) params.set("badge", badge);

        const role = GAME_CONSOLE.getBuiltInCVar("dv_role");
        if (role) params.set("role", role);

        const nameColor = GAME_CONSOLE.getBuiltInCVar("dv_name_color");
        if (nameColor) {
            try {
                params.set("nameColor", new Color(nameColor).toNumber().toString());
            } catch (e) {
                GAME_CONSOLE.setBuiltInCVar("dv_name_color", "");
                console.error(e);
            }
        }

        const teamURL = `${selectedRegion.teamAddress}/team?${params.toString()}`;

        teamSocket = new WebSocket(teamURL);

        teamSocket.onmessage = (message: MessageEvent<string>): void => {
            const data = JSON.parse(message.data) as CustomTeamMessage;
            switch (data.type) {
                case CustomTeamMessages.Join: {
                    joinedTeam = true;
                    teamID = data.teamID;
                    window.location.hash = `#${teamID}`;
                    ui.createTeamUrl.val(`${window.location.origin}/?region=${GAME_CONSOLE.getBuiltInCVar("cv_region") || Config.defaultRegion}#${teamID}`);
                    ui.createTeamAutoFill.prop("checked", data.autoFill);
                    ui.createTeamLock.prop("checked", data.locked);
                    break;
                }
                case CustomTeamMessages.Update: {
                    const { players, isLeader, ready } = data;
                    ui.createTeamPlayers.html(
                        players.map(
                            ({
                                isLeader,
                                ready,
                                name,
                                skin,
                                badge,
                                nameColor
                            }: CustomTeamPlayerInfo): string => `
                                <div class="create-team-player-container">
                                    <i class="fa-solid fa-crown"${isLeader ? "" : ' style="display: none"'}></i>
                                    <i class="fa-regular fa-circle-check"${ready ? "" : ' style="display: none"'}></i>
                                    <div class="skin">
                                        <div class="skin-base" style="background-image: url('./img/game/shared/skins/${skin}_base.svg')"></div>
                                        <div class="skin-left-fist" style="background-image: url('./img/game/shared/skins/${skin}_fist.svg')"></div>
                                        <div class="skin-right-fist" style="background-image: url('./img/game/shared/skins/${skin}_fist.svg')"></div>
                                    </div>
                                    <div class="create-team-player-name-container">
                                        <span class="create-team-player-name"${nameColor ? ` style="color: ${new Color(nameColor).toHex()}"` : ""};>${name}</span>
                                        ${badge?.length ? `<img class="create-team-player-badge" draggable="false" src="${""}" />` : ""}
                                    </div>
                                </div>
                                `
                        ).join("")
                    );
                    ui.createTeamToggles.toggleClass("disabled", !isLeader);
                    ui.btnStartGame
                        .toggleClass("btn-disabled", !isLeader && ready)
                        .text(getTranslatedString(isLeader ? "create_team_play" : ready ? "create_team_waiting" : "create_team_ready"));
                    break;
                }
                case CustomTeamMessages.Settings: {
                    ui.createTeamAutoFill.prop("checked", data.autoFill);
                    ui.createTeamLock.prop("checked", data.locked);
                    break;
                }
                case CustomTeamMessages.Started: {
                    createTeamMenu.hide();
                    joinGame(TeamSize.Squad);
                    break;
                }
            }
        };

        teamSocket.onerror = (): void => {
            ui.splashMsgText.html(getTranslatedString("msg_error_joining_team"));
            ui.splashMsg.show();
            resetPlayButtons();
            createTeamMenu.fadeOut(250);
            ui.splashUi.css({ filter: "", pointerEvents: "" });
        };

        teamSocket.onclose = (): void => {
            if (teamSocket) {
                ui.splashMsgText.html(
                    joinedTeam
                        ? getTranslatedString("msg_lost_team_connection")
                        : getTranslatedString("msg_error_joining_team")
                );
                ui.splashMsg.show();
            }
            resetPlayButtons();
            teamSocket = undefined;
            teamID = undefined;
            joinedTeam = false;
            window.location.hash = "";
            createTeamMenu.fadeOut(250);
            ui.splashUi.css({ filter: "", pointerEvents: "" });
        };

        createTeamMenu.fadeIn(250);
        ui.splashUi.css({
            filter: "brightness(0.6)",
            pointerEvents: "none"
        });
    });

    ui.closeCreateTeam.on("click", () => {
        const socket = teamSocket;
        teamSocket = undefined;
        socket?.close();
    });

    const copyUrl = $<HTMLButtonElement>("#btn-copy-team-url");
    const hideUrl = $<HTMLButtonElement>("#btn-hide-team-url");

    copyUrl.on("click", () => {
        const url = ui.createTeamUrl.val();
        if (!url) {
            alert("Unable to copy link to clipboard.");
            return;
        }
        void navigator.clipboard
            .writeText(url)
            .then(() => {
                copyUrl
                    .addClass("btn-success")
                    .css("pointer-events", "none")
                    .html(`
                        <i class="fa-solid fa-check" id="copy-team-btn-icon"></i>
                        ${getTranslatedString("copied")}`
                    );

                window.setTimeout(() => {
                    copyUrl
                        .removeClass("btn-success")
                        .css("pointer-events", "")
                        .html(`
                            <i class="fa-solid fa-clipboard" id="copy-team-btn-icon"></i>
                            ${getTranslatedString("copy")}`
                        );
                }, 2000);
            })
            .catch(() => {
                alert("Unable to copy link to clipboard.");
            });
    });

    const icon = hideUrl.children("i");

    hideUrl.on("click", () => {
        const urlField = ui.createTeamUrl;

        if (urlField.hasClass("hidden")) {
            icon.removeClass("fa-eye")
                .addClass("fa-eye-slash");

            urlField.removeClass("hidden")
                .css({
                    color: "",
                    textShadow: ""
                });

            return;
        }

        icon.removeClass("fa-eye-slash")
            .addClass("fa-eye");

        urlField.addClass("hidden")
            .css({
                color: "transparent",
                textShadow: "0 0 8px rgba(0, 0, 0, 0.5)"
            });
    });

    $<HTMLInputElement>("#create-team-toggle-auto-fill").on("click", function () {
        autoFill = this.checked;
        teamSocket?.send(JSON.stringify({
            type: CustomTeamMessages.Settings,
            autoFill
        }));
    });

    $<HTMLInputElement>("#create-team-toggle-lock").on("click", function () {
        teamSocket?.send(JSON.stringify({
            type: CustomTeamMessages.Settings,
            locked: this.checked
        }));
    });

    ui.btnStartGame.on("click", () => {
        $.get(`${selectedRegion?.mainAddress}/api/getGame?teamSize=${TeamSize.Squad}&teamID=${teamID}&token=${account.token}`,
            async (data: GetGameResponse) => {
                if (data.success) {
                    await readyConnect(data, String(selectedRegion?.gameAddress));
                } else {
                    teamSocket?.send(JSON.stringify({ type: CustomTeamMessages.Start }));
                }
            }
        );
    });

    const nameColor = params.get("nameColor");
    if (nameColor) {
        GAME_CONSOLE.setBuiltInCVar("dv_name_color", nameColor);
    }

    const lobbyClearing = params.get("lobbyClearing");
    if (lobbyClearing) {
        GAME_CONSOLE.setBuiltInCVar("dv_lobby_clearing", lobbyClearing === "true");
    }

    const devPassword = params.get("password");
    if (devPassword) {
        GAME_CONSOLE.setBuiltInCVar("dv_password", devPassword);
        location.search = "";
    }

    const roleParam = params.get("role");
    if (roleParam) {
        GAME_CONSOLE.setBuiltInCVar("dv_role", roleParam);
        location.search = "";
    }

    const usernameField = $<HTMLInputElement>("#username-input");

    const toggleRotateMessage = (): JQuery =>
        $("#splash-rotate-message").toggle(
            window.innerWidth < window.innerHeight
        );
    toggleRotateMessage();
    $(window).on("resize", toggleRotateMessage);

    usernameField.val(GAME_CONSOLE.getBuiltInCVar("cv_player_name"));

    usernameField.on("input", function () {
        GAME_CONSOLE.setBuiltInCVar(
            "cv_player_name",
            this.value = this.value
                .replace(/[\u201c\u201d\u201f]/g, '"')
                .replace(/[\u2018\u2019\u201b]/g, "'")
                .replace(/[\u2013\u2014]/g, "-")
                .replace(/[^\x20-\x7E]/g, "")
        );
    });

    createDropdown("#server-select");

    const serverSelect = $<HTMLSelectElement>("#server-select");

    serverSelect.on("change", () => {
        const value = serverSelect.val() as string | undefined;
        if (value !== undefined) {
            GAME_CONSOLE.setBuiltInCVar("cv_region", value);
        }
    });

    const soloButtons = $<HTMLButtonElement>("#warning-btn-play-solo, #btn-play-solo");
    $<HTMLInputElement>("#warning-modal-agree-checkbox").on("click", function () {
        soloButtons.toggleClass("btn-disabled", !this.checked);
    });

    const soloButton = $<HTMLButtonElement>("#btn-play-solo");
    $("#warning-btn-play-solo").on("click", () => {
        ui.warningModal.hide();
        soloButton.trigger("click");
    });

    const joinTeam = $("#btn-join-team");
    if (window.location.hash) {
        teamID = window.location.hash.slice(1);
        joinTeam.trigger("click");
    }

    $(".btn-social").on("click", e => {
        if (lastDisconnectTime && Date.now() - lastDisconnectTime < 1500) {
            e.preventDefault();
        }
    });


    unlockPlayButtons();
    resetPlayButtons();
}
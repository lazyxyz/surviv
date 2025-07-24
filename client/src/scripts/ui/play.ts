import $ from "jquery";
import { EMOTE_SLOTS, TeamSize } from "@common/constants";
import { CustomTeamMessages, type CustomTeamMessage, type CustomTeamPlayerInfo, type GetGameResponse } from "@common/typings";
import { getTranslatedString } from "../../translations";
import type { TranslationKeys } from "../../typings/translations";
import type { Account } from "../account";
import type { Game } from "../game";
import { warningAlert } from "../modal";
import { parseJWT } from "../utils/constants";
import {  resetPlayButtons, selectedRegion } from "./home";
import { Color } from "pixi.js";
import { GAME_CONSOLE } from "../..";
import { Config } from "../../config";
import { html } from "../utils/misc";
import { Loots } from "@common/definitions/loots";
import { defaultClientCVars } from "../utils/console/defaultClientCVars";
import { Emotes } from "@common/definitions/emotes";

export let teamSocket: WebSocket | undefined;
export let teamID: string | undefined | null;
let joinedTeam = false;
let autoFill = false;
let lastPlayButtonClickTime = 0;

function isClickAllowed(): boolean {
    const now = Date.now();
    if (now - lastPlayButtonClickTime < 1500) return false;
    lastPlayButtonClickTime = now;
    return true;
}

async function promptTeamID(): Promise<string | null> {
    let teamID: string | null = null;
    while (!teamID) {
        teamID = prompt(getTranslatedString("msg_enter_team_code"));
        if (!teamID) return null;
        if (teamID.includes("#")) teamID = teamID.split("#")[1];
        if (/^[a-zA-Z0-9]{4}$/.test(teamID)) return teamID;
        alert("Invalid team code.");
    }
    return teamID;
}


function setTeamParameters(params: URLSearchParams, account: Account): void {
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
}


async function initializePlayButtons(game: Game, account: Account): Promise<void> {
    const { ui } = game.uiManager;
    const playButtons = [$("#btn-play-solo"), $("#btn-play-squad")];

    playButtons.forEach((button, index) => {
        button.addClass("play-button");
        const translationString = `play_${["solo", "squad"][index]}` as TranslationKeys;
        const logoSrc = index === 0 ? "./img/misc/user.svg" : "./img/misc/user-group.svg";
        button.html(`
            <img class="btn-icon" width="26" height="26" src="${logoSrc}">
            <span style="margin-left: ${index > 0 ? "20px;" : "0"}" translation="${translationString}">
                ${getTranslatedString(translationString)}
            </span>
        `);
    });

    playButtons[0].on("click", async () => {
        if (!account.address) {
            warningAlert("Please connect your wallet to continue!");
            return;
        }
        if (!isClickAllowed()) return;
        await joinGame(TeamSize.Solo, game, account);
    });

    playButtons[1].on("click", async () => {
        if (!account.address) {
            warningAlert("Please connect your wallet to continue!");
            return;
        }
        if (!isClickAllowed()) return;
        await joinGame(TeamSize.Squad, game, account);
    });
}

function setupTeamMenu(game: Game, account: Account): void {
    const { ui } = game.uiManager;
    $<HTMLButtonElement>("#btn-create-team, #btn-join-team").on("click", async function () {
        if (!isClickAllowed() || teamSocket || !selectedRegion || !account.token?.length) return;
        if (new Date().getTime() >= (parseJWT(account.token).exp * 1000)) {
            return account.sessionExpired();
        }

        ui.splashOptions.addClass("loading");
        ui.loadingText.text(getTranslatedString("loading_connecting"));

        const params = new URLSearchParams();
        if (this.id === "btn-join-team") {
            teamID = await promptTeamID();
            if (!teamID) {
                resetPlayButtons();
                return;
            }
            params.set("teamID", teamID);
        }

        setTeamParameters(params, account);
        const teamURL = `${selectedRegion.teamAddress}/team?${params.toString()}`;
        teamSocket = new WebSocket(teamURL);
        setupTeamSocketHandlers(teamSocket, game, account);
        
        $("#create-team-menu").fadeIn(250);
        ui.splashUi.css({ filter: "brightness(0.6)", pointerEvents: "none" });
    });
}

function setupTeamMenuControls(game: Game, account: Account): void {
    const { ui } = game.uiManager;
    ui.closeCreateTeam.on("click", () => {
        const socket = teamSocket;
        teamSocket = undefined;
        socket?.close();
    });

    const copyUrl = $<HTMLButtonElement>("#btn-copy-team-url");
    copyUrl.on("click", async () => {
        const url = ui.createTeamUrl.val();
        if (!url) {
            alert("Unable to copy link to clipboard.");
            return;
        }
        try {
            await navigator.clipboard.writeText(url);
            copyUrl.addClass("btn-success").css("pointer-events", "none").html(`
                <i class="fa-solid fa-check" id="copy-team-btn-icon"></i>
                ${getTranslatedString("copied")}
            `);
            setTimeout(() => {
                copyUrl.removeClass("btn-success").css("pointer-events", "").html(`
                    <i class="fa-solid fa-clipboard" id="copy-team-btn-icon"></i>
                    ${getTranslatedString("copy")}
                `);
            }, 2000);
        } catch {
            alert("Unable to copy link to clipboard.");
        }
    });

    const hideUrl = $<HTMLButtonElement>("#btn-hide-team-url");
    hideUrl.on("click", () => {
        const urlField = ui.createTeamUrl;
        const icon = hideUrl.children("i");
        if (urlField.hasClass("hidden")) {
            icon.removeClass("fa-eye").addClass("fa-eye-slash");
            urlField.removeClass("hidden").css({ color: "", textShadow: "" });
        } else {
            icon.removeClass("fa-eye-slash").addClass("fa-eye");
            urlField.addClass("hidden").css({ color: "transparent", textShadow: "0 0 8px rgba(0, 0, 0, 0.5)" });
        }
    });

    $<HTMLInputElement>("#create-team-toggle-auto-fill").on("click", function () {
        autoFill = this.checked;
        teamSocket?.send(JSON.stringify({ type: CustomTeamMessages.Settings, autoFill }));
    });

    $<HTMLInputElement>("#create-team-toggle-lock").on("click", function () {
        teamSocket?.send(JSON.stringify({ type: CustomTeamMessages.Settings, locked: this.checked }));
    });

    ui.btnStartGame.on("click", async () => {
        try {
            const data: GetGameResponse = await $.get(`${selectedRegion?.mainAddress}/api/getGame?teamSize=${TeamSize.Squad}&teamID=${teamID}&token=${account.token}`);
            if (data.success) {
                await connectToGame(data, String(selectedRegion?.gameAddress), game, account);
            } else {
                teamSocket?.send(JSON.stringify({ type: CustomTeamMessages.Start }));
            }
        } catch {
            console.error("Failed to start game");
        }
    });
}

function setupTeamSocketHandlers(socket: WebSocket, game: Game, account: Account): void {
    const { ui } = game.uiManager;
    socket.onmessage = (message: MessageEvent<string>): void => {
        const data = JSON.parse(message.data) as CustomTeamMessage;
        switch (data.type) {
            case CustomTeamMessages.Join:
                handleTeamJoin(data, ui);
                break;
            case CustomTeamMessages.Update:
                handleTeamUpdate(data, ui);
                break;
            case CustomTeamMessages.Settings:
                ui.createTeamAutoFill.prop("checked", data.autoFill);
                ui.createTeamLock.prop("checked", data.locked);
                break;
            case CustomTeamMessages.Started:
                $("#create-team-menu").hide();
                joinGame(TeamSize.Squad, game, account);
                break;
        }
    };

    socket.onerror = (): void => {
        ui.splashMsgText.html(getTranslatedString("msg_error_joining_team"));
        ui.splashMsg.show();
        resetPlayButtons();
        $("#create-team-menu").fadeOut(250);
        ui.splashUi.css({ filter: "", pointerEvents: "" });
    };

    socket.onclose = (): void => {
        ui.splashMsgText.html(joinedTeam ? getTranslatedString("msg_lost_team_connection") : getTranslatedString("msg_error_joining_team"));
        ui.splashMsg.show();
        resetPlayButtons();
        teamSocket = undefined;
        teamID = undefined;
        joinedTeam = false;
        window.location.hash = "";
        $("#create-team-menu").fadeOut(250);
        ui.splashUi.css({ filter: "", pointerEvents: "" });
    };
}

function handleTeamJoin(data: CustomTeamMessage, ui: Game['uiManager']['ui']): void {
    joinedTeam = true;
    if(data.type != CustomTeamMessages.Join) throw Error("handleTeamJoin Failed");
    teamID = data.teamID;
    window.location.hash = `#${teamID}`;
    ui.createTeamUrl.val(`${window.location.origin}/?region=${GAME_CONSOLE.getBuiltInCVar("cv_region") || Config.defaultRegion}#${teamID}`);
    ui.createTeamAutoFill.prop("checked", data.autoFill);
    ui.createTeamLock.prop("checked", data.locked);
}

function handleTeamUpdate(data: CustomTeamMessage, ui: Game['uiManager']['ui']): void {
    if(data.type != CustomTeamMessages.Update) throw Error("handleTeamUpdate Failed");

    const { players, isLeader, ready } = data;
    ui.createTeamPlayers.html(players.map((player: CustomTeamPlayerInfo) => `
        <div class="create-team-player-container">
            <i class="fa-solid fa-crown"${player.isLeader ? "" : ' style="display: none"'}></i>
            <i class="fa-regular fa-circle-check"${player.ready ? "" : ' style="display: none"'}></i>
            <div class="skin">
                <div class="skin-base" style="background-image: url('./img/game/shared/skins/${player.skin}_base.svg')"></div>
                <div class="skin-left-fist" style="background-image: url('./img/game/shared/skins/${player.skin}_fist.svg')"></div>
                <div class="skin-right-fist" style="background-image: url('./img/game/shared/skins/${player.skin}_fist.svg')"></div>
            </div>
            <div class="create-team-player-name-container">
                <span class="create-team-player-name"${player.nameColor ? ` style="color: ${new Color(player.nameColor).toHex()}"` : ""}>${player.name}</span>
                ${player.badge?.length ? `<img class="create-team-player-badge" draggable="false" src="${""}" />` : ""}
            </div>
        </div>
    `).join(""));
    ui.createTeamToggles.toggleClass("disabled", !isLeader);
    ui.btnStartGame.toggleClass("btn-disabled", !isLeader && ready)
        .text(getTranslatedString(isLeader ? "create_team_play" : ready ? "create_team_waiting" : "create_team_ready"));
}

export async function joinGame(teamSize: number, game: Game, account: Account): Promise<void> {
    const { ui } = game.uiManager;

    if (!selectedRegion || !account.token?.length) return;
    if (new Date().getTime() >= (parseJWT(account.token).exp * 1000)) {
        return account.sessionExpired();
    }

    ui.splashOptions.addClass("loading");
    ui.loadingText.text(getTranslatedString("loading_finding_game"));

    try {
        const data: GetGameResponse = await $.get(`${selectedRegion.mainAddress}/api/getGame?teamSize=${teamSize}${teamID ? `&teamID=${teamID}` : ""}`);
        await connectToGame(data, selectedRegion.gameAddress, game, account);
    } catch {
        ui.splashMsgText.html(html`
            ${getTranslatedString("msg_err_finding")}
            <br>
            ${getTranslatedString("msg_try_again")}
        `);
        ui.splashMsg.show();
        resetPlayButtons();
    }
}


async function connectToGame(data: GetGameResponse, gameAddress: string, game: Game, account: Account): Promise<void> {
    const { ui } = game.uiManager;

    if (!data.success) {
        if (data.message) {
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
        return;
    }

    ui.splashOptions.addClass("loading");
    ui.loadingText.text(getTranslatedString("msg_loading"));
    const params = new URLSearchParams();
    if (teamID) params.set("teamID", teamID);
    if (autoFill) params.set("autoFill", String(autoFill));
    setGameParameters(params, account);
    const websocketURL = `${gameAddress.replace("<ID>", data.gameID.toString())}/play?${params.toString()}`;
    await game.connect(websocketURL, account);
    ui.loadingText.text("Verifying Game Assets");
    ui.splashMsg.hide();
    if ($("#create-team-menu").css("display") !== "none") $("#create-team-menu").hide();
}

function setGameParameters(params: URLSearchParams, account: Account): void {
    const name = GAME_CONSOLE.getBuiltInCVar("cv_player_name");
    if (name) params.set("name", name);
    if (account.address) params.set("address", account.address);

    const playerSkin = Loots.fromStringSafe(GAME_CONSOLE.getBuiltInCVar("cv_loadout_skin")) ?? 
        Loots.fromString(typeof defaultClientCVars.cv_loadout_skin === "object" 
            ? defaultClientCVars.cv_loadout_skin.value 
            : defaultClientCVars.cv_loadout_skin);
    if (playerSkin) params.set("skin", playerSkin.idString);

    const badge = GAME_CONSOLE.getBuiltInCVar("cv_loadout_badge");
    if (badge) params.set("badge", badge);

    const weaponPreset = GAME_CONSOLE.getBuiltInCVar("dv_weapon_preset");
    if (weaponPreset) {
        const preset = JSON.parse(weaponPreset);
        if (preset.melee) params.set("melee", preset.melee);
        if (preset.gun) params.set("gun", preset.gun);
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

    const emoteIds = EMOTE_SLOTS.map(slot => 
        Emotes.fromStringSafe(GAME_CONSOLE.getBuiltInCVar(`cv_loadout_${slot}_emote`))?.idString
    ).filter(Boolean);
    if (emoteIds.length > 0) params.set("emotes", emoteIds.join(","));
}


export async function setupPlay(game: Game, account: Account): Promise<void> {
    await initializePlayButtons(game, account);
    setupTeamMenu(game, account);
    setupTeamMenuControls(game, account);
}
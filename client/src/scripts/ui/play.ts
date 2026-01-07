import $ from "jquery";
import { EMOTE_SLOTS, MODE } from "@common/constants";
import { CustomTeamMessages, type CustomTeamMessage, type CustomTeamPlayerInfo, type GetGameResponse } from "@common/typings";
import { getTranslatedString } from "../../translations";
import type { TranslationKeys } from "../../typings/translations";
import type { Account } from "../account";
import type { Game } from "../game";
import { errorAlert, warningAlert } from "../modal";
import { parseJWT } from "../utils/constants";
import { resetPlayButtons, selectedRegion } from "./home";
import { Color } from "pixi.js";
import { GAME_CONSOLE } from "../..";
import { Config } from "../../config";
import { html } from "../utils/misc";
import { Loots } from "@common/definitions/loots";
import { defaultClientCVars } from "../utils/console/defaultClientCVars";
import { Emotes } from "@common/definitions/emotes";
import { DEFAULT_BADGE } from "@common/definitions/badges";

export let teamSocket: WebSocket | undefined;
export let teamID: string | undefined | null;
let joinedTeam = false;
let lastPlayButtonClickTime = 0;

function isClickAllowed(): boolean {
    const now = Date.now();
    if (now - lastPlayButtonClickTime < 1500) return false;
    lastPlayButtonClickTime = now;
    return true;
}

async function promptTeamID(): Promise<string | null> {
    let teamID: string | null = null;
    if (window.location.hash) teamID = window.location.hash.slice(1);;
    while (!teamID) {
        teamID = prompt(getTranslatedString("msg_enter_team_code"));
        if (!teamID) return null;
        if (teamID.includes("#")) teamID = teamID.split("#")[1];
        if (/^[a-zA-Z0-9]{4}$/.test(teamID)) return teamID;
        alert("Invalid team code.");
    }
    return teamID;
}


function setTeamParameters(params: URLSearchParams): void {
    params.set("name", GAME_CONSOLE.getBuiltInCVar("cv_player_name"));
    params.set("skin", GAME_CONSOLE.getBuiltInCVar("cv_loadout_skin"));

    const badge = GAME_CONSOLE.getBuiltInCVar("cv_loadout_badge");
    if (badge) params.set("badge", badge);

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
    const playConfigs:
        {
            selector: string;
            mode: MODE;
            key: string;
            icon: string;
            spanMargin?: string;
        }[] = [
            { selector: "#btn-play-solo", mode: MODE.Solo, key: "solo", icon: "./img/misc/user.svg", spanMargin: "0" },
            { selector: "#btn-play-squad", mode: MODE.Squad, key: "squad", icon: "./img/misc/user-group.svg", spanMargin: "20px" },
            { selector: "#btn-play-dungeon", mode: MODE.Dungeon, key: "dungeon", icon: "./img/misc/gate.svg", spanMargin: "20px" },
            { selector: "#btn-play-bloody", mode: MODE.Bloody, key: "bloody", icon: "./img/misc/gate.svg", spanMargin: "20px" }
        ];

    playConfigs.forEach(config => {
        const button = $(config.selector);
        button.addClass("play-button");
        const translationString = `play_${config.key}` as TranslationKeys;
        const margin = config.spanMargin ?? "0";
        button.html(`
            <img class="btn-icon" width="26" height="26" src="${config.icon}">
            <span style="margin-left: ${margin};" translation="${translationString}">
                ${getTranslatedString(translationString)}
            </span>
        `);

        button.on("click", async () => {
            if (!isClickAllowed()) return;
            await joinGame(config.mode, game, account);
        });
    });
}


function setupTeamMenu(game: Game, account: Account): void {
    const { ui } = game.uiManager;
    $<HTMLButtonElement>("#btn-create-team, #btn-join-team").on("click", async function () {
        if (!isClickAllowed() || teamSocket || !selectedRegion || !account.token?.length) return;
        if (new Date().getTime() >= (parseJWT(account.token).exp * 1000)) {
            return account.sessionExpired();
        }

        // Custom UI changes for both leader and member when clicking #btn-create-team
        $(".splash-earn-learn-more").hide();
        $("#splash-inventory").prepend($(".splash-earn-get-now").detach());
        $("#splash-earn").append($("#create-team-menu").detach().show());
        $("#option-btns-group").hide();

        const params = new URLSearchParams();
        if (this.id === "btn-join-team") {
            teamID = await promptTeamID();
            if (!teamID) {
                resetPlayButtons();
                return;
            }
            params.set("teamID", teamID);
        }

        setTeamParameters(params);
        const teamURL = `${selectedRegion.teamAddress}/team?${params.toString()}`;
        teamSocket = new WebSocket(teamURL);
        setupTeamSocketHandlers(teamSocket, game, account);
    });

}

$<HTMLButtonElement>("#btn-leave-game").on("click", function () {
    if (confirm(getTranslatedString("leave_team_confirm"))) {
        leaveTeam();
    }
});

function leaveTeam() {
    teamSocket?.close();
    teamSocket = undefined;
    teamID = undefined;
    joinedTeam = false;
    window.location.hash = "";
    resetPlayButtons();
    $("#create-team-menu").fadeOut(250);
    $(".splash-earn-learn-more").show();
    $("#splash-inventory").prepend($(".splash-earn-get-now").detach());
    $("#splash-earn").append($(".splash-earn-learn-more").detach().show());
    $("#splash-earn").prepend($(".splash-earn-get-now").detach().show());
    $("#splash-earn").append($("#create-team-menu").detach().hide());
    $(".splash-earn-get-now").show();
    $("#option-btns-group").show();
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
            `);
            setTimeout(() => {
                copyUrl.removeClass("btn-success").css("pointer-events", "").html(`
                    <i class="fa-solid fa-clipboard" id="copy-team-btn-icon"></i>
                `);
            }, 2000);
        } catch {
            alert("Unable to copy link to clipboard.");
        }
    });

    const hideUrl = $<HTMLButtonElement>("#btn-hide-team-url");
    const urlField = ui.createTeamUrl;
    hideUrl.on("click", () => {
        const icon = hideUrl.children("i");
        if (urlField.hasClass("hidden")) {
            icon.removeClass("fa-eye").addClass("fa-eye-slash");
            urlField.removeClass("hidden").css({ color: "", textShadow: "" });
        } else {
            icon.removeClass("fa-eye-slash").addClass("fa-eye");
            urlField.addClass("hidden").css({ color: "transparent", textShadow: "0 0 8px rgba(0, 0, 0, 0.5)" });
        }
    });

    ui.createTeamAutoFill.on("click", function () {
        teamSocket?.send(JSON.stringify({ type: CustomTeamMessages.Settings, autoFill: this.checked }));
    });

    ui.createTeamLock.on("click", function () {
        teamSocket?.send(JSON.stringify({ type: CustomTeamMessages.Settings, locked: this.checked }));
    });

    ui.createTeamRoomMode.on("click", function () {
        teamSocket?.send(JSON.stringify({ type: CustomTeamMessages.Settings, roomMode: this.checked }));
    });

    ui.createTeamMode.on("change", function (e) {
        const selectedValue = $(this).val() as keyof typeof MODE;
        const teamSize = MODE[selectedValue];

        // Ensure the value is valid
        if (teamSize !== undefined) {
            teamSocket?.send(JSON.stringify({
                type: CustomTeamMessages.Settings,
                teamSize: teamSize,
            }));
        } else {
            console.warn('Invalid team size selected:', selectedValue);
        }
    });

    ui.btnStartGame.on("click", async (e) => {
        try {
            const role = $(e.currentTarget).attr("data-role");
            if (role === "leader") {
                teamSocket?.send(JSON.stringify({ type: CustomTeamMessages.Start }));
            } else {
                teamSocket?.send(JSON.stringify({ type: CustomTeamMessages.Ready }));
            }
        } catch {
            console.error("Failed to start game");
        }
    });
}

function updateRoomOptions(ui: Game['uiManager']['ui'], enable: boolean, teamSize: number) {
    const dependents = $('.room-dependent');
    const displayStyle = enable ? 'flex' : 'none';
    dependents.each(function () {
        $(this).css('display', displayStyle);
    });

    const teamSizeKey = MODE[teamSize || 1];
    ui.createTeamMode.val(teamSizeKey);
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
                ui.createTeamRoomMode.prop("checked", data.roomMode);
                ui.createTeamLock.prop("checked", data.locked);
                updateRoomOptions(ui, data.roomMode ? true : false, data.teamSize ? data.teamSize : MODE.Squad);
                break;
            case CustomTeamMessages.Started:
                let teamSize = MODE.Solo;
                if (data.teamSize) teamSize = data.teamSize;
                joinGame(teamSize, game, account);
                break;
            case CustomTeamMessages.Kick:
                leaveTeam();
                break;
        }
    };

    socket.onerror = (): void => {
        errorAlert(getTranslatedString("msg_error_joining_team"), 3000);
        resetPlayButtons();
        $("#create-team-menu").fadeOut(250);
    };

    socket.onclose = (): void => {
        joinedTeam ? errorAlert(getTranslatedString("msg_lost_team_connection"), 3000) : errorAlert(getTranslatedString("msg_error_joining_team"), 3000);
        leaveTeam();
    };

}

function handleTeamJoin(data: CustomTeamMessage, ui: Game['uiManager']['ui']): void {
    joinedTeam = true;
    if (data.type != CustomTeamMessages.Join) throw Error("handleTeamJoin Failed");
    teamID = data.teamID;
    window.location.hash = `#${teamID}`;
    ui.createTeamUrl.val(`${window.location.origin}/?region=${GAME_CONSOLE.getBuiltInCVar("cv_region") || Config.defaultRegion}#${teamID}`);
    ui.createTeamAutoFill.prop("checked", data.autoFill);
    ui.createTeamLock.prop("checked", data.locked);
    ui.createTeamRoomMode.prop("checked", data.roomMode);

    updateRoomOptions(ui, data.roomMode, data.teamSize);
}

/**
 * Updates the start game button state based on team readiness
 * When all team members are ready, the button is enabled, otherwise disabled
 */
function updateStartGameButtonState(players: CustomTeamPlayerInfo[], isLeader: boolean, ui: Game['uiManager']['ui']): void {
    const allPlayersReady = players.every(player => player.ready || player.isLeader);

    if (isLeader) {
        // For team leader, enable button only when all members are ready, execept room mode
        ui.btnStartGame.prop("disabled", !allPlayersReady);

        if (allPlayersReady) {
            ui.btnStartGame.removeClass("btn-disabled");
        } else {
            ui.btnStartGame.addClass("btn-disabled");
        }
    }
}

function handleTeamUpdate(data: CustomTeamMessage, ui: Game['uiManager']['ui']): void {
    if (data.type != CustomTeamMessages.Update) throw Error("handleTeamUpdate Failed");

    const { players, isLeader, ready } = data;
    ui.createTeamPlayers.html(players.map((player: CustomTeamPlayerInfo, index: number) => {
        let skin = player.skin;
        const localName = GAME_CONSOLE.getBuiltInCVar("cv_player_name");
        if (player.name === localName) {
            skin = GAME_CONSOLE.getBuiltInCVar("cv_loadout_skin");
        }

        return `
        <div class="create-team-player-container">
            <i class="fa-solid fa-crown"${player.isLeader ? "" : ' style="display: none"'}></i>
            <i class="fa-regular fa-circle-check"${player.ready && !player.isLeader ? "" : ' style="display: none"'}></i>

            ${
            // Show kick icon only for leader and not for the leader's own player
            isLeader && !player.isLeader
                ? `<i class="fa-regular fa-circle-xmark kick-player" data-player-id="${index}"></i>`
                : ""
            }
            <div id="team-skin" class="skin">
                <div class="skin-base" style="background-image: url('./img/game/shared/skins/${skin}_base.svg')"></div>
                <div class="skin-left-fist" style="background-image: url('./img/game/shared/skins/${skin}_fist.svg')"></div>
                <div class="skin-right-fist" style="background-image: url('./img/game/shared/skins/${skin}_fist.svg')"></div>
            </div>
             <div class="create-team-player-name-container">
                <span class="create-team-player-name"${player.nameColor ? ` style="color: ${new Color(player.nameColor).toHex()}"` : ""}>${player.name}</span>
                ${player.badge?.length ? `<img class="create-team-player-badge" draggable="false" src="./img/game/shared/badges/${player.badge}.svg" />` : ""}
            </div>
        </div>
        `;
    }).join(""));

    // Update button text and icon based on role and ready status
    if (isLeader) {
        ui.btnStartGame
            .attr("data-role", "leader")
            .removeClass("btn-ready")
            .html(`<span translation="create_team_play">${getTranslatedString("create_team_play")}</span>`);

        $('#create-team-options').removeClass('disabled');
        $('#create-team-options input, #create-team-options select').prop('disabled', false);
    } else {
        // For team members, add appropriate icons
        const icon = ready
            ? '<i class="fa-solid fa-circle-check"></i>'
            : '<i class="fa-solid fa-circle-question"></i>';
        const text = ready ? "create_team_ready" : "create_team_ready";

        ui.btnStartGame
            .attr("data-role", "member")
            .toggleClass("btn-success", ready)
            .toggleClass("btn-alert", !ready)
            .html(`<span translation="${text}">${getTranslatedString(text)}</span> ${icon}`);

        $('#create-team-options').addClass('disabled');
        $('#create-team-options input, #create-team-options select').prop('disabled', true);
    }

    // Update start game button state based on team readiness
    updateStartGameButtonState(players, isLeader, ui);

    attachKickListeners(ui);
}

function attachKickListeners(ui: Game['uiManager']['ui']): void {
    const kickIcons = ui.createTeamPlayers.find(".kick-player");
    kickIcons.off("click");
    kickIcons.on("click", (event: JQuery.ClickEvent) => {
        const playerId = $(event.currentTarget).data("player-id");
        if (typeof playerId !== "undefined") {
            teamSocket?.send(
                JSON.stringify({
                    type: CustomTeamMessages.Kick,
                    playerId: playerId,
                })
            );
        } else {
            console.error("Player ID not found for kick action");
        }
    });
}

export async function joinGame(teamSize: number, game: Game, account?: Account): Promise<void> {
    const { ui } = game.uiManager;

    if (account) {
        if (new Date().getTime() >= (parseJWT(account.token).exp * 1000)) {
            return account.sessionExpired();
        }
    }

    if (!selectedRegion) {
        warningAlert("Please select a server to play!");
        return;
    }
    ui.splashOptions.addClass("loading");
    ui.loadingText.text(getTranslatedString("loading_finding_game"));

    if (window.location.pathname !== '/') {
        window.location.href = `${window.location.origin}/?${window.location.search.substring(1)}${window.location.hash}`;
        return;
    }

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


async function connectToGame(data: GetGameResponse, gameAddress: string, game: Game, account?: Account): Promise<void> {
    const { ui } = game.uiManager;

    if (!data.success) {
        ui.splashMsgText.html(html`
                ${getTranslatedString("msg_err_joining")}
                <br>
                ${getTranslatedString("msg_try_again")}
            `);
        ui.splashMsg.show();
        resetPlayButtons();
        return;
    }

    ui.splashOptions.addClass("loading");
    ui.loadingText.text(getTranslatedString("msg_loading"));
    const params = new URLSearchParams();

    if (teamID) params.set("teamID", teamID);
    const autoFill = ui.createTeamAutoFill.prop("checked");
    const roomMode = ui.createTeamRoomMode.prop("checked");

    if (autoFill) params.set("autoFill", String(autoFill));
    if (roomMode) params.set("roomMode", String(roomMode));
    const lobbyClearing = GAME_CONSOLE.getBuiltInCVar("dv_lobby_clearing");
    if (lobbyClearing) params.set("lobbyClearing", "true");

    const websocketURL = `${gameAddress.replace("<ID>", data.gameID.toString())}/play?${params.toString()}`;
    await game.connect(websocketURL, account);
    ui.splashMsg.hide();
}

export async function setupPlay(game: Game, account: Account): Promise<void> {
    await initializePlayButtons(game, account);
    setupTeamMenu(game, account);
    setupTeamMenuControls(game, account);
}
import { GameConstants, InputActions, ObjectCategory, SpectateActions, TeamSize } from "@common/constants";
import { Ammos, type AmmoDefinition } from "@common/definitions/ammos";
import { type ArmorDefinition } from "@common/definitions/armors";
import { HealType, HealingItems, type HealingItemDefinition } from "@common/definitions/healingItems";
import { PerkIds, Perks } from "@common/definitions/perks";
import { Scopes, type ScopeDefinition } from "@common/definitions/scopes";
import { SpectatePacket } from "@common/packets/spectatePacket";
import { CustomTeamMessages, type CustomTeamMessage, type CustomTeamPlayerInfo, type GetGameResponse } from "@common/typings";
import { ExtendedMap } from "@common/utils/misc";
import { Badges, freeBadges, type BadgeDefinition } from "@common/definitions/badges";
import { EmoteCategory, Emotes, freeEmotes, type EmoteDefinition } from "@common/definitions/emotes";
import { freeSkin, Skins, type SkinDefinition } from "@common/definitions/skins";
import { ItemType, type ObjectDefinition, type ReferenceTo } from "@common/utils/objectDefinitions";
import { Vec, type Vector } from "@common/utils/vector";
import { sound } from "@pixi/sound";
import $ from "jquery";
import { Color, isMobile, isWebGPUSupported } from "pixi.js";
import { TRANSLATIONS, getTranslatedString } from "../translations";

import { Config, type ServerInfo } from "./config";
import { type Game } from "./game";
import { news } from "./news/newsPosts";
import { body, createDropdown } from "./uiHelpers";
import { defaultClientCVars, type CVarTypeMapping } from "./utils/console/defaultClientCVars";

import { Crosshairs, getCrosshair } from "./utils/crosshairs";
import { html, requestFullscreen } from "./utils/misc";
import type { TranslationKeys } from "../typings/translations";
import { EMOTE_SLOTS, MODE, parseJWT, PIXI_SCALE, SELECTOR_WALLET, shorten, UI_DEBUG_MODE, WalletType } from "./utils/constants";
import { freeGuns, Guns } from "@common/definitions/guns";
import { Melees } from "@common/definitions/melees";
import { Throwables } from "@common/definitions/throwables";

/*
    eslint-disable

    @stylistic/indent
*/

/*
    `@stylistic/indent`: can eslint stop [expletive redacted] at indenting stuff
*/

export interface RegionInfo {
    readonly name: string
    readonly mainAddress: string
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

export function visibleConnectWallet(game: Game): void {
    // handler what conditions to open modal?
    if (!localStorage.getItem(SELECTOR_WALLET)?.length) {
        $(".connect-wallet-portal").css("display", "block");
    }

    // handler click to login...
    for (const elements of $(".connect-wallet-item")) {
      const paragraphElement = elements.children[1];
      const logoElement = elements.children[0];

      const isExisted = game.eip6963.providers?.find(
        argument => argument?.info?.name === paragraphElement?.textContent
      );

      if (isExisted) {
        elements.onclick = async() => {
            try {
                // hidden to show loading ICON
                $(logoElement).css("display", "none");

                // append loading ICON
                {
                    const newNode = document.createElement("div");

                    newNode.className = "loading-icon";
                    newNode.style.width = "36px";
                    newNode.style.height = "36px";
                    newNode.style.display = "flex";
                    newNode.style.alignItems = "center";
                    newNode.style.justifyContent = "center";
                    newNode.innerHTML = "<i class=\"fa-duotone fa-solid fa-spinner fa-spin-pulse fa-xl\"></i>";

                    logoElement.after(newNode);
                }

                return await game.account.connect(isExisted, game);
            } catch (error) {
                console.log(error);
            } finally {
                $(".loading-icon").css("display", "none");
                $(logoElement).css("display", "block");
            }
        };
      }

      if (!isExisted) {
        $(paragraphElement).css({ color: "#93C5FD" });

        paragraphElement.insertAdjacentText("afterbegin", "Install ");

        elements.onclick = () => {
          if (paragraphElement?.textContent?.includes(WalletType.METAMASK)) {
            return window.open("https://metamask.io/download/", "_blank");
          }

          if (paragraphElement?.textContent?.includes(WalletType.SUBWALLET)) {
            return window.open("https://www.subwallet.app/download", "_blank");
          }

          if (paragraphElement?.textContent?.includes(WalletType.COINBASEWALLET)) {
            return window.open(
              "https://www.coinbase.com/wallet/downloads",
              "_blank"
            );
          }

          if (paragraphElement?.textContent?.includes(WalletType.TRUSTWALLET)) {
            return window.open("https://trustwallet.com/download", "_blank");
          }
        };
      }
    }
}

export function visibleWallet(game: Game): void {
    if (game?.eip6963.provider?.provider && game.account.address?.length) {
        // handler first time you need visible container
        {
            $(".account-wallet-container").css("display", "block");
        }

        // handler placeholder for button
        {
            $(".account-wallet-placeholder").append(shorten(game.account.address));
        }
    }

    // handler append children to fieldSet
    {
        const ListFieldSet = [
            {
                key: "address",
                fieldName: "Copy Address",
                icon: "./img/line/copy.svg",
                onClick: () => {
                    // https://dev.to/0shuvo0/copy-text-to-clipboard-in-jstwo-ways-1pn1
                    if (navigator.clipboard) {
                        return navigator.clipboard.writeText(String(game.account.address));
                    }

                    const textArea = document.createElement("textarea");
                    textArea.value = String(game.account.address);

                    document.body.appendChild(textArea);

                    textArea.focus();
                    textArea.select();

                    // eslint-disable-next-line @typescript-eslint/no-deprecated
                    document.execCommand("copy");
                    document.body.removeChild(textArea);
                }
            },
            {
                key: "disconnect",
                fieldName: "Disconnect",
                icon: "./img/line/log-out.svg",
                onClick: () => game.account.disconnect()
            }
        ];

        for (const fields of ListFieldSet) {
            $("#account-wallet-fieldset").append(`
                <a id="account-wallet-btn-${fields.key}">
                    <img width="20px" height="20px" src=${fields.icon} />
                    ${fields.fieldName}
                </a>
            `);

            $(`#account-wallet-btn-${fields.key}`).on("click", () => {
                fields.onClick();
            });
        }
    }

    createDropdown(".account-wallet-container");
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function visibleSkin(game: Game) {
    if (!game?.account?.address) return;

    const role = game.console.getBuiltInCVar("dv_role");
    const skinList = $<HTMLDivElement>("#skins-list");
    const currentSkin = game.console.getBuiltInCVar("cv_loadout_skin");

    // handler display change preview
    const updateSplashCustomize = (skinID: string): void => {
      for (const key of ["fist", "base"]) {
        $(`.assets-${key}`).attr(
          "href",
          `./img/game/shared/skins/${skinID}_${key}.svg`
        );
      }

      $<HTMLDivElement>("#skin-base").css(
        "background-image",
        `url("./img/game/shared/skins/${skinID}_base.svg")`
      );

      $<HTMLDivElement>("#skin-left-fist, #skin-right-fist").css(
        "background-image",
        `url("./img/game/shared/skins/${skinID}_fist.svg")`
      );
    };

    function selectSkin(idString: ReferenceTo<SkinDefinition>): void {
      // remove previous selected
      $(".skins-list-item-container").removeClass("selected");

      // wait for dom and append new selected
      setTimeout(() => {
        $(`#skin-${idString}`).addClass("selected");
      }, 0);

      game.console.setBuiltInCVar("cv_loadout_skin", idString);
      updateSplashCustomize(idString);
    }

    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
    const mySkins = await new Promise<string[]>(async(resolve, reject) => {
      try {
        const request: {
          data: { items: Array<{ name: string }> }
        } = await $.ajax({
          url: "https://test-api.openmark.io/market/api/nft",
          type: "POST",
          data: {
            nftContract: "0x3b1cbe9791eb789e081006df913bbb10166f171a",
            owner: game.account.address
          }
        });

        resolve(
          request.data.items.map(meta => {
            // should be ['Monad', '#20']
            const separate = meta.name.split(" ");

            return separate[0].toLowerCase();
          })
        );
      } catch (error) {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject(error);
      }
    });

    const SkinsIntance = Skins.definitions.filter(argument =>
      [...freeSkin, ...(mySkins || [])].some(
        argument_child => argument_child === argument.idString
      )
    );

    // should be set or reset skin
    {
      const avaliableSkin = SkinsIntance.find(
        meta =>
          meta.idString === game.console.getBuiltInCVar("cv_loadout_skin")
      );

      if (avaliableSkin) {
        updateSplashCustomize(avaliableSkin.idString);
      }

      if (!avaliableSkin) {
        // selectSkin(freeSkin[0]);
        selectSkin(defaultClientCVars.cv_loadout_skin as string);
      }
    }

    // reset items before render new
    skinList.empty();

    // display to preview and select
    for (const { idString, hideFromLoadout, rolesRequired } of SkinsIntance) {
      if (hideFromLoadout || !(rolesRequired ?? [role]).includes(role)) {
        continue;
      }

      // noinspection CssUnknownTarget
      const skinItem = $<HTMLDivElement>(
        `<div id="skin-${idString}" class="skins-list-item-container${idString === currentSkin ? " selected" : ""}">
            <div class="skin">
                <div class="skin-base" style="background-image: url('./img/game/shared/skins/${idString}_base.svg')"></div>
                <div class="skin-left-fist" style="background-image: url('./img/game/shared/skins/${idString}_fist.svg')"></div>
                <div class="skin-right-fist" style="background-image: url('./img/game/shared/skins/${idString}_fist.svg')"></div>
            </div>
            <span class="skin-name">${getTranslatedString(idString as TranslationKeys)}</span>
        </div>`
      );

      skinItem.on("click", () => {
        selectSkin(idString);
      });

      skinList.append(skinItem);
    }
  }

export async function setUpUI(game: Game): Promise<void> {
    const { inputManager, uiManager: { ui } } = game;

    // Change the menu based on the mode.
    if (MODE.specialLogo) $("#splash-logo").children("img").attr("src", `./img/logos/suroi_beta_${MODE.idString}.svg`);
    if (MODE.specialPlayButtons) {
        const playButtons = [$("#btn-play-solo"), $("#btn-play-squad")];
        // const playButtons = [$("#btn-play-solo"), $("#btn-play-duo"), $("#btn-play-squad")];
        for (let buttonIndex = 0; buttonIndex < playButtons.length; buttonIndex++) {
            const button = playButtons[buttonIndex];

            button.addClass(`event-${MODE.idString}`);

            // Mode Logo
            if (MODE.modeLogoImage) {
                const translationString = `play_${["solo", "squad"][buttonIndex]}`;

                button.html(`
                    <img class="btn-icon" width="26" height="26" src=${MODE.modeLogoImage}>
                    <span style="margin-left: ${(buttonIndex > 0 ? "20px;" : "0")}" translation="${translationString}">${getTranslatedString(translationString as TranslationKeys)}</span>
                `);
            }
        }
    }

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
            // noinspection HtmlUnknownTarget
            killFeedItem.html(
                '<img class="kill-icon" src="./img/misc/skull_icon.svg" alt="Skull"> Player killed Player with Mosin-Nagant'
            );
            killFeed.prepend(killFeedItem);
        }
    }

    const languageFieldset = $("#languages-selector");
    for (const [language, languageInfo] of Object.entries(TRANSLATIONS.translations)) {
        const isSelected = game.console.getBuiltInCVar("cv_language") === language;
        languageFieldset.append(html`
           <a id="language-${language}" ${isSelected ? 'class="selected"' : ""}>
              ${languageInfo.flag} <strong>${languageInfo.name}</strong> [${!isSelected ? TRANSLATIONS.translations[language].percentage : languageInfo.percentage}]
           </a>
        `);

      $(`#language-${language}`).on("click", () => {
        game.console.setBuiltInCVar("cv_language", language);
    });
    }

    game.console.variables.addChangeListener("cv_language", () => location.reload());

    const params = new URLSearchParams(window.location.search);

    // Switch regions with the ?region="name" Search Parameter
    if (params.has("region")) {
        (() => {
            const region = params.get("region");
            params.delete("region");
            if (region === null) return;
            if (!Object.hasOwn(Config.regions, region)) return;
            game.console.setBuiltInCVar("cv_region", region);
        })();
    }

    // Load news
    let newsText = "";
    for (const newsPost of news.slice(0, 5)) {
        const date = new Date(newsPost.date).toLocaleDateString("default", {
            month: "long",
            day: "numeric",
            year: "numeric"
        });

        newsText += '<article class="splash-news-entry">';
        newsText += `<div class="news-date">${date}</div>`;
        newsText += `<div class="news-title">${newsPost.title}</div>`;
        newsText += `<p>${newsPost.content}<br><i>- ${newsPost.author}</i></p></article>`;
    }

    ui.newsPosts.html(newsText);

    // createDropdown("#splash-more");
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
    const regionPromises = Object.entries(regionMap).map(async([_, [regionID, region]]) => {
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

        console.log(`Loaded server info for region ${regionID}`);
    });
    await Promise.all(regionPromises);

    const serverName = $<HTMLSpanElement>("#server-name");
    const playerCount = $<HTMLSpanElement>("#server-player-count");
    const updateServerSelectors = (): void => {
        if (!selectedRegion) { // Handle invalid region
            selectedRegion = regionInfo[Config.defaultRegion];
            game.console.setBuiltInCVar("cv_region", "");
        }
        const region = getTranslatedString(`region_${game.console.getBuiltInCVar("cv_region")}` as TranslationKeys);
        if (region === "region_") {
            serverName.text(selectedRegion.name); // this for now until we find a way to selectedRegion.id
        } else {
            serverName.text(region);
        }
        playerCount.text(selectedRegion.playerCount ?? "-");
        // $("#server-ping").text(selectedRegion.ping && selectedRegion.ping > 0 ? selectedRegion.ping : "-");
        updateSwitchTime();
        resetPlayButtons();
    };

    selectedRegion = regionInfo[game.console.getBuiltInCVar("cv_region") ?? Config.defaultRegion];
    updateServerSelectors();

    // eslint-disable-next-line @typescript-eslint/no-deprecated
    serverList.children("li.server-list-item").on("click", function(this: HTMLLIElement) {
        const region = this.getAttribute("data-region");

        if (region === null) return;

        const info = regionInfo[region];
        if (info === undefined) return;

        resetPlayButtons();

        selectedRegion = info;

        game.console.setBuiltInCVar("cv_region", region);

        updateServerSelectors();
    });

    const joinGame = (teamSize: number): void => {
        ui.splashOptions.addClass("loading");
        ui.loadingText.text(getTranslatedString("loading_finding_game"));
        // ui.cancelFindingGame.css("display", "");
        // shouldn't happen
        if (selectedRegion === undefined || !game.account.token?.length) return;

        // token is expired
        {
            const { exp } = parseJWT(game.account.token);

            if (new Date().getTime() >= (exp * 1000)) {
                return game.account.sessionExpired();
            }
        }

        const target = selectedRegion;

        void $.get(
            `${target.mainAddress}/api/getGame?teamSize=${teamSize || 1}${teamID ? `&teamID=${teamID}` : ""}&token=${game.account.token}`,
            (data: GetGameResponse) => {
                if (data.success) {
                    const params = new URLSearchParams();

                    if (teamID) params.set("teamID", teamID);
                    if (autoFill) params.set("autoFill", String(autoFill));

                    // const devPass = game.console.getBuiltInCVar("dv_password");
                    // if (devPass) params.set("password", devPass);

                    // const role = game.console.getBuiltInCVar("dv_role");
                    // if (role) params.set("role", role);

                    const lobbyClearing = game.console.getBuiltInCVar("dv_lobby_clearing");
                    if (lobbyClearing) params.set("lobbyClearing", "true");

                    const weaponPreset = game.console.getBuiltInCVar("dv_weapon_preset");
                    if (weaponPreset) params.set("weaponPreset", weaponPreset);

                    const nameColor = game.console.getBuiltInCVar("dv_name_color");
                    if (nameColor) {
                        try {
                            params.set("nameColor", new Color(nameColor).toNumber().toString());
                        } catch (e) {
                            game.console.setBuiltInCVar("dv_name_color", "");
                            console.error(e);
                        }
                    }
                    game.connect(`${target.gameAddress.replace("<ID>", (data.gameID).toString())}/play?${params.toString()}`);
                    ui.splashMsg.hide();

                    // Check again because there is a small chance that the create-team-menu element won't hide.
                    if (createTeamMenu.css("display") !== "none") createTeamMenu.hide(); // what the if condition doin
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

    // Join server when play buttons are clicked
    $("#btn-play-solo, #btn-play-squad").on("click", event => {
        const now = Date.now();
        if (now - lastPlayButtonClickTime < 1500) return; // Play button rate limit
        lastPlayButtonClickTime = now;

        const teamSize = event.target.id === "btn-play-solo" ? TeamSize.Solo : TeamSize.Squad;
        joinGame(teamSize);
    });

    const createTeamMenu = $("#create-team-menu");
    $<HTMLButtonElement>("#btn-create-team, #btn-join-team").on("click", function() {
        const now = Date.now();

        if (now - lastPlayButtonClickTime < 1500 || teamSocket || selectedRegion === undefined || !game.account.token?.length) return;

        // token is expired
        {
            const { exp } = parseJWT(game.account.token);

            if (new Date().getTime() >= (exp * 1000)) {
                return game.account.sessionExpired();
            }
        }

        lastPlayButtonClickTime = now;

        ui.splashOptions.addClass("loading");
        ui.loadingText.text(getTranslatedString("loading_connecting"));

        const params = new URLSearchParams();

        if (this.id === "btn-join-team") {
            // also rejects the empty string, but like who cares
            while (!teamID) {
                teamID = prompt(getTranslatedString("msg_enter_team_code"));
                if (!teamID) {
                    resetPlayButtons();
                    return;
                }

                /*
                    Allows people to paste links into the text field and still have the game parse
                    them correctly (as opposed to simply doing `teamID = teamID.slice(1)`)
                */
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

        params.set("name", game.console.getBuiltInCVar("cv_player_name"));
        params.set("skin", game.console.getBuiltInCVar("cv_loadout_skin"));
        // params.set("weapon", game.console.getBuiltInCVar("cv_loadout_weapon"));

        const badge = game.console.getBuiltInCVar("cv_loadout_badge");
        if (badge) params.set("badge", badge);

        const devPass = game.console.getBuiltInCVar("dv_password");
        if (devPass) params.set("password", devPass);

        const role = game.console.getBuiltInCVar("dv_role");
        if (role) params.set("role", role);

        const nameColor = game.console.getBuiltInCVar("dv_name_color");
        if (nameColor) {
            try {
                params.set("nameColor", new Color(nameColor).toNumber().toString());
            } catch (e) {
                game.console.setBuiltInCVar("dv_name_color", "");
                console.error(e);
            }
        }

        params.set("token", game.account.token);

        const teamURL = `${selectedRegion.teamAddress}/team?${params.toString()}`;
        console.log("teamURL: ", teamURL);

        teamSocket = new WebSocket(teamURL);

        teamSocket.onmessage = (message: MessageEvent<string>): void => {
            const data = JSON.parse(message.data) as CustomTeamMessage;
            switch (data.type) {
                case CustomTeamMessages.Join: {
                    joinedTeam = true;
                    teamID = data.teamID;
                    window.location.hash = `#${teamID}`;

                    ui.createTeamUrl.val(`${window.location.origin}/?region=${game.console.getBuiltInCVar("cv_region")}#${teamID}`);

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
                                        ${![undefined, "bdg_"].includes(badge) ? `<img class="create-team-player-badge" draggable="false" src="./img/game/shared/badges/${badge}.svg" />` : ""}
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

            // Dimmed backdrop on team menu. (Probably not needed here)
            ui.splashUi.css({ filter: "", pointerEvents: "" });
        };

        teamSocket.onclose = (): void => {
            // The socket is set to undefined in the close button listener
            // If it's not undefined, the socket was closed by other means, so show an error message
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

            // Dimmed backdrop on team menu.
            ui.splashUi.css({ filter: "", pointerEvents: "" });
        };

        createTeamMenu.fadeIn(250);

        // Dimmed backdrop on team menu.
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

    // TODO
   /* ui.cancelFindingGame.on("click", () => {
        game.disconnect();
    }); */

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

                // After some seconds, reset the copy button's css
                window.setTimeout(() => {
                    copyUrl
                        .removeClass("btn-success")
                        .css("pointer-events", "")
                        .html(`
                            <i class="fa-solid fa-clipboard" id="copy-team-btn-icon"></i>
                            ${getTranslatedString("copy")}`
                        );
                }, 2000); // 2 sec
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

    $<HTMLInputElement>("#create-team-toggle-auto-fill").on("click", function() {
        autoFill = this.checked;
        teamSocket?.send(JSON.stringify({
            type: CustomTeamMessages.Settings,
            autoFill
        }));
    });

    $<HTMLInputElement>("#create-team-toggle-lock").on("click", function() {
        teamSocket?.send(JSON.stringify({
            type: CustomTeamMessages.Settings,
            locked: this.checked
        }));
    });

    ui.btnStartGame.on("click", () => {
        teamSocket?.send(JSON.stringify({ type: CustomTeamMessages.Start }));
    });

    const nameColor = params.get("nameColor");
    if (nameColor) {
        game.console.setBuiltInCVar("dv_name_color", nameColor);
    }

    const lobbyClearing = params.get("lobbyClearing");
    if (lobbyClearing) {
        game.console.setBuiltInCVar("dv_lobby_clearing", lobbyClearing === "true");
    }

    const devPassword = params.get("password");
    if (devPassword) {
        game.console.setBuiltInCVar("dv_password", devPassword);
        location.search = "";
    }

    const roleParam = params.get("role");
    if (roleParam) {
        game.console.setBuiltInCVar("dv_role", roleParam);
        location.search = "";
    }

    const usernameField = $<HTMLInputElement>("#username-input");

    const toggleRotateMessage = (): JQuery =>
        $("#splash-rotate-message").toggle(
            window.innerWidth < window.innerHeight
        );
    toggleRotateMessage();
    $(window).on("resize", toggleRotateMessage);

    game.console.variables.addChangeListener(
        "cv_console_open",
        (_, val) => game.console.isOpen = val
    );

    const gameMenu = ui.gameMenu;
    const settingsMenu = $("#settings-menu");

    usernameField.val(game.console.getBuiltInCVar("cv_player_name"));

    usernameField.on("input", function() {
        // Replace fancy quotes & dashes, so they don't get stripped out

        game.console.setBuiltInCVar(
            "cv_player_name",
            this.value = this.value
                .replace(/[\u201c\u201d\u201f]/g, '"')
                //         |  “  |  ”  |  ‟  |

                .replace(/[\u2018\u2019\u201b]/g, "'")
                //         |  ‘  |  ’  |  ‛  |

                .replace(/[\u2013\u2014]/g, "-")
                //         |  –  |  —  |

                // Strip out non-ASCII chars and
                // the C0/C1 control characters
                .replace(/[^\x20-\x7E]/g, "")
        );
    });

    createDropdown("#server-select");

    const serverSelect = $<HTMLSelectElement>("#server-select");

    // Select region
    serverSelect.on("change", () => {
        // const value = serverSelect.val() as string | undefined;

        /* if (value !== undefined) {
            game.console.setBuiltInCVar("cv_region", value);
        } */
    });

    const rulesBtn = $<HTMLButtonElement>("#btn-rules");

    // Highlight rules & tutorial button for new players
    if (!game.console.getBuiltInCVar("cv_rules_acknowledged")) {
        rulesBtn.removeClass("btn-secondary").addClass("highlighted");
    }

    // Event listener for rules button
    rulesBtn.on("click", () => {
        game.console.setBuiltInCVar("cv_rules_acknowledged", true);
        location.href = "./rules/";
    });

    $("#btn-quit-game, #btn-spectate-menu, #btn-menu").on("click", () => {
        void game.endGame();
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    $("#btn-play-again, #btn-spectate-replay").on("click", async() => {
        await game.endGame();
        if (teamSocket) teamSocket.send(JSON.stringify({ type: CustomTeamMessages.Start })); // TODO Check if player is team leader
        else joinGame(game.teamSize);
    });

    const sendSpectatePacket = (action: Exclude<SpectateActions, SpectateActions.SpectateSpecific>): void => {
        game.sendPacket(
            SpectatePacket.create({
                spectateAction: action
            })
        );
    };

    ui.btnSpectate.on("click", () => {
        sendSpectatePacket(SpectateActions.BeginSpectating);
        game.spectating = true;
        game.map.indicator.setFrame("player_indicator");
    });

    ui.spectatePrevious.on("click", () => {
        sendSpectatePacket(SpectateActions.SpectatePrevious);
    });

    ui.spectateKillLeader.on("click", () => {
        sendSpectatePacket(SpectateActions.SpectateKillLeader);
    });

    ui.btnReport.on("click", () => {
            sendSpectatePacket(SpectateActions.Report);
    });
    ui.spectateNext.on("click", () => {
        sendSpectatePacket(SpectateActions.SpectateNext);
    });

    $<HTMLButtonElement>("#btn-resume-game").on("click", () => gameMenu.hide());
    $<HTMLButtonElement>("#btn-fullscreen").on("click", () => {
        requestFullscreen();
        ui.gameMenu.hide();
    });

    body.on("keydown", (e: JQuery.KeyDownEvent) => {
        if (e.key === "Escape") {
            if (ui.canvas.hasClass("active") && !game.console.isOpen) {
                gameMenu.fadeToggle(250);
                settingsMenu.hide();
            }
            game.console.isOpen = false;
        }
    });

    $<HTMLButtonElement>("#btn-settings").on("click", () => {
        $(".dialog").hide();
        settingsMenu.fadeToggle(250);
        settingsMenu.removeClass("in-game");
    });

    $<HTMLButtonElement>("#btn-settings-game").on("click", () => {
        gameMenu.hide();
        settingsMenu.fadeToggle(250);
        settingsMenu.addClass("in-game");
    });

    $<HTMLButtonElement>("#close-settings").on("click", () => {
        settingsMenu.fadeOut(250);
    });

    const customizeMenu = $<HTMLButtonElement>("#customize-menu");
    $<HTMLButtonElement>("#btn-customize").on("click", () => {
        $(".dialog").hide();
        customizeMenu.fadeToggle(250);
    });
    $<HTMLButtonElement>("#close-customize").on("click", () => customizeMenu.fadeOut(250));

    $<HTMLButtonElement>("#close-report").on("click", () => ui.reportingModal.fadeOut(250));

    const role = game.console.getBuiltInCVar("dv_role");

    // Load emotes
    function handleEmote(slot: "win" | "death"): void { // eipi can you improve this so that it uses `emoteSlots` items with index >3
        const emote = $(`#emote-wheel-bottom .emote-${slot} .fa-xmark`);
        const cvar = `cv_loadout_${slot}_emote` as const;
        const emoteSlot = $(`#emote-wheel-container .emote-${slot}`);

        emote.on("click", () => {
            game.console.setBuiltInCVar(cvar, "");
            emoteSlot.css("background-image", "none");
            emote.hide();
        });

        if (game.console.getBuiltInCVar(`cv_loadout_${slot}_emote`) === "") emote.hide();
    }

    handleEmote("win");
    handleEmote("death");

    let selectedEmoteSlot: typeof EMOTE_SLOTS[number] | undefined;
    const emoteList = $<HTMLDivElement>("#emotes-list");

    const bottomEmoteUiCache: Partial<Record<typeof EMOTE_SLOTS[number], JQuery<HTMLSpanElement>>> = {};
    const emoteWheelUiCache: Partial<Record<typeof EMOTE_SLOTS[number], JQuery<HTMLDivElement>>> = {};

    function updateEmotesList(): void {
        emoteList.empty();

        const EmotesInstance = Emotes.definitions.filter(argument =>
            freeEmotes.some(argument_child => argument_child === argument.idString)
        );

        const emotes = EmotesInstance.sort((a, b) => {
            return a.category - b.category;
        });

        let lastCategory: EmoteCategory | undefined;

        for (const emote of emotes) {
            if (emote.category !== lastCategory) {
                emoteList.append(
                    $<HTMLDivElement>(
                        `<div class="emote-list-header">${
                            getTranslatedString(`emotes_category_${EmoteCategory[emote.category]}` as TranslationKeys)
                        }</div>`
                    )
                );
                lastCategory = emote.category;
            }

            const idString = emote.idString;
            // noinspection CssUnknownTarget
            const emoteItem = $<HTMLDivElement>(
                `<div id="emote-${idString}" class="emotes-list-item-container">
                    <div class="emotes-list-item" style="background-image: url(./img/game/shared/emotes/${idString}.svg)"></div>
                    <span class="emote-name">${getTranslatedString(`emote_${idString}` as TranslationKeys)}</span>
                </div>`
            );

            emoteItem.on("click", () => {
                if (selectedEmoteSlot === undefined) return;

                const cvarName = selectedEmoteSlot;
                (
                    bottomEmoteUiCache[cvarName] ??= $((`#emote-wheel-bottom .emote-${cvarName} .fa-xmark` as const))
                ).show();

                game.console.setBuiltInCVar(`cv_loadout_${cvarName}_emote`, emote.idString);

                emoteItem.addClass("selected")
                    .siblings()
                    .removeClass("selected");

                (
                    emoteWheelUiCache[cvarName] ??= $(`#emote-wheel-container .emote-${cvarName}`)
                ).css(
                    "background-image",
                    `url("./img/game/shared/emotes/${emote.idString}.svg")`
                );
            });

            emoteList.append(emoteItem);
        }
    }

    updateEmotesList();

    const customizeEmote = $<HTMLDivElement>("#emote-customize-wheel");
    const emoteListItemContainer = $<HTMLDivElement>(".emotes-list-item-container");

    function changeEmoteSlotImage(slot: typeof EMOTE_SLOTS[number], emote: ReferenceTo<EmoteDefinition>): JQuery<HTMLDivElement> {
        return (
            emoteWheelUiCache[slot] ??= $(`#emote-wheel-container .emote-${slot}`)
        ).css("background-image", emote ? `url("./img/game/shared/emotes/${emote}.svg")` : "none");
    }

    for (const slot of EMOTE_SLOTS) {
        const cvar = `cv_loadout_${slot}_emote` as const;
        const emote = game.console.getBuiltInCVar(cvar);

        game.console.variables.addChangeListener(
            cvar,
            (_, newEmote) => {
                changeEmoteSlotImage(slot, newEmote);
            }
        );

        changeEmoteSlotImage(slot, emote)
            .on("click", () => {
                if (selectedEmoteSlot === slot) return;

                if (selectedEmoteSlot !== undefined) {
                    (
                        emoteWheelUiCache[selectedEmoteSlot] ??= $(`#emote-wheel-container .emote-${selectedEmoteSlot}`)
                    ).removeClass("selected");
                }

                selectedEmoteSlot = slot;

                updateEmotesList();

                if (EMOTE_SLOTS.indexOf(slot) > 3) {
                    // win / death emote
                    customizeEmote.css(
                        "background-image",
                        "url('/img/misc/emote_wheel.svg')"
                    );

                    (
                        emoteWheelUiCache[slot] ??= $(`#emote-wheel-container .emote-${slot}`)
                    ).addClass("selected");
                } else {
                    customizeEmote.css(
                        "background-image",
                        `url("./img/misc/emote_wheel_highlight_${slot}.svg"), url("/img/misc/emote_wheel.svg")`
                    );
                }

                emoteListItemContainer
                    .removeClass("selected")
                    .css("cursor", "pointer");

                $(`#emote-${game.console.getBuiltInCVar(cvar) || "none"}`).addClass("selected");
            });

        (
            emoteWheelUiCache[slot] ??= $(`#emote-wheel-container .emote-${slot}`)
        ).children(".remove-emote-btn")
            .on("click", () => {
                game.console.setBuiltInCVar(cvar, "");
                (
                    emoteWheelUiCache[slot] ??= $(`#emote-wheel-container .emote-${slot}`)
                ).css("background-image", "none");
            });
    }

    const crosshairImage = $<HTMLDivElement>("#crosshair-image");
    const crosshairControls = $<HTMLDivElement>("#crosshair-controls");
    const crosshairTargets = $<HTMLDivElement>("#crosshair-preview, #game");

    // Darken canvas (halloween mode)
    if (MODE.darkShaders) {
        $("#game-canvas").css({
            "filter": "brightness(0.65) saturate(0.85)",
            "position": "relative",
            "z-index": "-1"
        });
    }

    // Load crosshairs
    function loadCrosshair(): void {
        const size = 20 * game.console.getBuiltInCVar("cv_crosshair_size");
        const crosshair = getCrosshair(
            game.console.getBuiltInCVar("cv_loadout_crosshair"),
            game.console.getBuiltInCVar("cv_crosshair_color"),
            size,
            game.console.getBuiltInCVar("cv_crosshair_stroke_color"),
            game.console.getBuiltInCVar("cv_crosshair_stroke_size")
        );
        const cursor = crosshair === "crosshair" ? crosshair : `url("${crosshair}") ${size / 2} ${size / 2}, crosshair`;

        crosshairImage.css({
            backgroundImage: `url("${crosshair}")`,
            width: size,
            height: size
        });

        crosshairControls.toggleClass("disabled", !Crosshairs[game.console.getBuiltInCVar("cv_loadout_crosshair")]);
        crosshairTargets.css({ cursor });
    }

    loadCrosshair();

    const crosshairCache: Array<JQuery<HTMLDivElement>> = [];

    game.console.variables.addChangeListener(
        "cv_loadout_crosshair",
        (_, value) => {
            (crosshairCache[value] ??= $(`#crosshair-${value}`))
                .addClass("selected")
                .siblings()
                .removeClass("selected");

            loadCrosshair();
        }
    );

    const crosshairSize = game.console.getBuiltInCVar("cv_crosshair_size");
    const currentCrosshair = game.console.getBuiltInCVar("cv_loadout_crosshair");

    $<HTMLDivElement>("#crosshairs-list").append(
        Crosshairs.map((_, crosshairIndex) => {
            const listItem = $<HTMLDivElement>("<div class=\"crosshairs-list-item\"></div>");
            const crosshairItem = $<HTMLDivElement>(
                `<div id="crosshair-${crosshairIndex}" class="crosshairs-list-item-container${currentCrosshair === crosshairIndex ? " selected" : ""}"></div>`
            );

            crosshairItem.append(listItem);

            listItem.css({
                "backgroundImage": `url("${getCrosshair(
                    crosshairIndex,
                    "#fff",
                    crosshairSize,
                    "#0",
                    0
                )}")`,
                "background-size": "contain",
                "background-repeat": "no-repeat"
            });

            crosshairItem.on("click", () => {
                game.console.setBuiltInCVar("cv_loadout_crosshair", crosshairIndex);
                loadCrosshair();
                crosshairItem.addClass("selected")
                    .siblings()
                    .removeClass("selected");
            });

            return crosshairItem;
        })
    );

    // Load special tab
    if (game.console.getBuiltInCVar("dv_role") !== "") {
        $("#tab-special").show();

        $<HTMLInputElement>("#role-name")
            .val(game.console.getBuiltInCVar("dv_role"))
            .on("input", e => {
                game.console.setBuiltInCVar("dv_role", e.target.value);
            });

        $<HTMLInputElement>("#role-password").on("input", e => {
            game.console.setBuiltInCVar("dv_password", e.target.value);
        });

        addCheckboxListener("#toggle-lobbyclearing", "dv_lobby_clearing");

        if (game.console.getBuiltInCVar("dv_name_color") === "") game.console.setBuiltInCVar("dv_name_color", "#FFFFFF");

        $<HTMLInputElement>("#namecolor-color-picker")
            .val(game.console.getBuiltInCVar("dv_name_color"))
            .on("input", e => {
                game.console.setBuiltInCVar("dv_name_color", e.target.value);
            });

        $<HTMLInputElement>("#weapon-preset")
            .val(game.console.getBuiltInCVar("dv_weapon_preset"))
            .on("input", e => {
                game.console.setBuiltInCVar("dv_weapon_preset", e.target.value);
            });
    }

    // Load badges
    const allowedBadges = Badges.definitions
    .filter(argument =>
        freeBadges.some(argument_child => argument_child === argument.idString)
    )
    .filter(({ roles }) => !roles?.length || roles.includes(role));

    $("#tab-badges").show();

    const noBadgeItem = $<HTMLDivElement>(
        html`<div id="badge-" class="badges-list-item-container">\
            <div class="badges-list-item"> </div>\
            <span class="badge-name">${getTranslatedString("none")}</span>\
        </div>`
    );

    noBadgeItem.on("click", () => {
        game.console.setBuiltInCVar("cv_loadout_badge", "");
        noBadgeItem.addClass("selected").siblings().removeClass("selected");
    });

    const activeBadge = game.console.getBuiltInCVar("cv_loadout_badge");

    const badgeUiCache: Record<ReferenceTo<BadgeDefinition>, JQuery<HTMLDivElement>> = { [""]: noBadgeItem };

    function selectBadge(idString: ReferenceTo<BadgeDefinition>): void {
        badgeUiCache[idString].addClass("selected")
            .siblings()
            .removeClass("selected");
    }

    $("#badges-list").append(
        noBadgeItem,
        ...allowedBadges.map(({ idString }) => {
            // noinspection CssUnknownTarget
            const badgeItem = badgeUiCache[idString] = $<HTMLDivElement>(
                `<div id="badge-${idString}" class="badges-list-item-container${idString === activeBadge ? " selected" : ""}">\
                    <div class="badges-list-item">\
                        <div style="background-image: url('./img/game/shared/badges/${idString}.svg')"></div>\
                    </div>\
                    <span class="badge-name">${getTranslatedString(`badge_${idString}` as TranslationKeys)}</span>\
                </div>`
            );

            badgeItem.on("click", () => {
                game.console.setBuiltInCVar("cv_loadout_badge", idString);
                selectBadge(idString);
            });

            return badgeItem;
        })
    );

    game.console.variables.addChangeListener(
        "cv_loadout_badge",
        (_, newBadge) => { selectBadge(newBadge); }
    );

    // load all weapons
    {
        $("#tab-weapons").show();

        const lastCategory: string[] = [];
        const currentSkin = game.console.getBuiltInCVar("cv_loadout_skin");

        const toggleSelect = (currentTarget: HTMLElement, className: string): void => {
            /*
                1. selected but users selecting same previous
                2. remove selected previous
                3. append new select
            */
            const activedElement = $(className).find(".selected");

            if (activedElement.text() === currentTarget.textContent) return;

            if (activedElement.length) activedElement.removeClass("selected");

            currentTarget.classList.toggle("selected");
        };

        const appendAsset = async(weaponName: string): Promise<void> => {
            const rootAssetsElement = $(".weapons-container-aside-assets");
            const rootListElement = $(".weapons-container-list");
            const loadingElement = document.createElement("div");

            // if existed you need empty (remove all nodes) and append new
            rootAssetsElement.empty();

            // prevent spamming call API
            rootListElement.css("pointer-events", "none");

            // append loading ICON
            {
                loadingElement.className = "loading-icon";
                loadingElement.style.gridColumn = "span 3";
                loadingElement.style.display = "flex";
                loadingElement.style.alignItems = "center";
                loadingElement.style.justifyContent = "center";
                loadingElement.innerHTML = "<i class=\"fa-duotone fa-solid fa-spinner fa-spin-pulse fa-xl\"></i>";

                rootAssetsElement.prepend(loadingElement);
            }

            // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
            const instanceAssets = await new Promise<ObjectDefinition[]>(async resolve => {
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                setTimeout(async() => {
                    const instanceAssets = [
                        {
                            idString: weaponName,
                            name: "Default"
                        },

                        ...(freeGuns.find(argument => argument.key === weaponName)?.children || [])
                    ];

                    return resolve(instanceAssets);
                }, 500);
            });

            for (const assetsField of instanceAssets) {
                rootAssetsElement.append(html`<div class="weapons-container-card" id="weapons-assets-${assetsField.idString}">
                    <img src="./img/game/shared/weapons/${assetsField.idString}.svg" alt=${assetsField.name} width="72px" height="72px" />

                    <p class="weapons-container-paragraph">${assetsField.name}</p>
                    </div>`
                );
            }

            // reset states
            {
                loadingElement.remove();
                rootListElement.css("pointer-events", "unset");

                // handler select default
                setTimeout(() => {
                    $(`#weapons-assets-${weaponName}`).trigger("click");
                }, 0);
            }
        };

        const appendPreview = (images: Array<{
            zIndex: number
            rotate?: number
            url: string
            class: string
            x: number
            y: number
        }>): JQuery<Partial<HTMLElement>> => {
            const asideElement = $(".weapons-container-aside-preview");

            // clear previous
            asideElement.empty();

            // append new
            images.sort((a, b) => a.zIndex - b.zIndex).map(argument => {
                const gVector = document.createElementNS("http://www.w3.org/2000/svg", "g");
                const iVector = document.createElementNS("http://www.w3.org/2000/svg", "image");

                $(gVector).css({
                    transformBox: "fill-box",
                    translate: `calc(${argument.x}px - 50%) calc(${argument.y}px - 50%)`,
                    transformOrigin: "center",
                    rotate: `${argument.rotate}deg`
                });

                $(iVector).attr({
                    class: argument.class,
                    href: argument.url
                });

                gVector.append(iVector);

                asideElement.append(gVector);
            });

            return asideElement;
        };

        // update guns
        {
            const GunsInstance = Guns.definitions.filter((argument, index, self) => {
                return !self.some((argument_child, i) =>
                    // ensures that only earlier elements in the self (argument_child) are checked against the current element (argument). This prevents checking duplicates twice
                    i < index
                    // not twice similar startsWith E.g: ['ak47', 'ak47-dragon', 'ak4-blue-ice]
                    && argument.idString.startsWith(argument_child.idString));
            });

            for (const gunField of GunsInstance) {
                const key = "Gun";
                const isExisted = lastCategory.some(category => category === key);

                $(".weapons-container-list").append(html`
                    ${!isExisted ? `<h2>${key}</h2>` : ""}
    
                    <div class="weapons-container-card" id="weapons-list-${gunField.idString}">
                        <img src="./img/game/shared/weapons/${gunField.idString}.svg" alt=${gunField.name} width="72px" height="72px" />
    
                        <p class="weapons-container-paragraph">${gunField.name}</p>
                    </div>
                `);

                if (!isExisted) lastCategory.push(key);

                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                $(`#weapons-list-${gunField.idString}`).on("click", async({ currentTarget }) => {
                    toggleSelect(currentTarget, ".weapons-container-list");

                    await appendAsset(gunField.idString);

                    $('.weapons-container-card[id*="weapons-assets-"]').on("click", ({ currentTarget }) => {
                        toggleSelect(currentTarget, ".weapons-container-aside-assets");

                        // handler preview
                        {
                            const getTargetSelect = String((currentTarget.id.split("weapons-assets-")).pop());

                            game.console.setBuiltInCVar("dv_weapon_preset", getTargetSelect);

                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            const getGun = GunsInstance.find(g => g.idString === gunField.idString)!;

                            const singleVariant = GunsInstance.find(g =>
                                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                // @ts-ignore
                                g.idString === getGun?.singleVariant
                            );

                            const image = [
                                {
                                    class: "assets-base",
                                    url: `./img/game/shared/skins/${currentSkin}_base.svg`,
                                    x: 0,
                                    y: 0,
                                    zIndex: 3
                                }
                            ];

                            if (singleVariant && !singleVariant?.isDual) {
                                // Left
                                {
                                    image.push({
                                        class: "assets-world",

                                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                        // @ts-ignore
                                        url: `./img/game/shared/weapons/${getTargetSelect.replace("dual_", "")}_world.svg`,

                                        x: singleVariant.image.position.x,

                                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                        // @ts-ignore
                                        y: getGun.leftRightOffset * -20,

                                        zIndex: 2
                                    });

                                    image.push({
                                        class: "assets-fist",

                                        url: `./img/game/shared/skins/${currentSkin}_fist.svg`,
                                        x: singleVariant.fists.left.x,

                                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                        // @ts-ignore
                                        y: getGun.leftRightOffset * -20,

                                        zIndex: singleVariant.fists.leftZIndex ?? 1
                                    });
                                }

                                // Right
                                {
                                    image.push({
                                        class: "assets-world",

                                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                        // @ts-ignore
                                        url: `./img/game/shared/weapons/${getTargetSelect.replace("dual_", "")}_world.svg`,

                                        x: singleVariant.image.position.x,

                                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                        // @ts-ignore
                                        y: getGun.leftRightOffset * 20,

                                        zIndex: 2
                                    });

                                    image.push({
                                        class: "assets-fist",

                                        url: `./img/game/shared/skins/${currentSkin}_fist.svg`,
                                        x: singleVariant.fists.right.x,

                                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                        // @ts-ignore
                                        y: getGun.leftRightOffset * 20,

                                        zIndex: singleVariant.fists.rightZIndex
                                    });
                                }
                            } else {
                                image.push({
                                    class: "assets-world",

                                    url: `./img/game/shared/weapons/${getTargetSelect}_world.svg`,
                                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                    // @ts-ignore
                                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                                    x: getGun.image.position.x,

                                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                                    // @ts-ignore
                                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                                    y: getGun.image.position.y,
                                    zIndex: 2
                                });

                                image.push({
                                    class: "assets-fist",
                                    url: `./img/game/shared/skins/${currentSkin}_fist.svg`,
                                    x: getGun.fists.right.x,
                                    y: getGun.fists.right.y,
                                    zIndex: getGun.fists.rightZIndex
                                });

                                image.push({
                                    class: "assets-fist",
                                    url: `./img/game/shared/skins/${currentSkin}_fist.svg`,
                                    x: getGun.fists.left.x,
                                    y: getGun.fists.left.y,
                                    zIndex: getGun.fists.leftZIndex
                                });
                            }

                            const getPreview = appendPreview(image);

                            getPreview.attr("viewBox", "-45 -45 250 90");
                        }
                    });
                });
            }
        }

        // update meless
        {
            const MelessInstance = Melees.definitions.filter((argument, index, self) => {
                return !self.some((argument_child, i) =>
                    // ensures that only earlier elements in the self (argument_child) are checked against the current element (argument). This prevents checking duplicates twice
                    i < index
                    // not twice similar startsWith E.g: ['ak47', 'ak47-dragon', 'ak4-blue-ice]
                    && argument.idString.startsWith(argument_child.idString));
            });

            for (const melessField of MelessInstance) {
                const key = "Meless";
                const isExisted = lastCategory.some(category => category === key);

                $(".weapons-container-list").append(html`
                    ${!isExisted ? `<h2>${key}</h2>` : ""}
    
                    <div class="weapons-container-card" id="weapons-list-${melessField.idString}">
                        <img src="./img/game/shared/weapons/${melessField.idString}.svg" alt=${melessField.name} width="72px" height="72px" />
    
                        <p class="weapons-container-paragraph">${melessField.name}</p>
                    </div>
                `);

                if (!isExisted) lastCategory.push(key);

                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                $(`#weapons-list-${melessField.idString}`).on("click", async({ currentTarget }) => {
                    toggleSelect(currentTarget, ".weapons-container-list");

                    await appendAsset(melessField.idString);

                    $('.weapons-container-card[id*="weapons-assets-"]').on("click", ({ currentTarget }) => {
                        toggleSelect(currentTarget, ".weapons-container-aside-assets");

                        // handler preview
                        {
                            const getTargetSelect = String((currentTarget.id.split("weapons-assets-")).pop());

                            game.console.setBuiltInCVar("dv_weapon_preset", getTargetSelect);

                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            const getMeless = MelessInstance.find(g => g.idString === melessField.idString)!;

                            const image = [
                                {
                                    class: "assets-base",
                                    url: `./img/game/shared/skins/${currentSkin}_base.svg`,
                                    x: 0,
                                    y: 0,
                                    zIndex: 2,
                                    rotate: 0
                                },
                                {
                                    class: "assets-world",
                                    url: `./img/game/shared/weapons/${getTargetSelect}.svg`,
                                    x: getMeless.image?.position.x ?? 0,
                                    y: getMeless.image?.position.y ?? 0,
                                    rotate: getMeless.image?.angle ?? 0,
                                    zIndex: 1
                                },
                                {
                                    class: "assets-fist",
                                    url: `./img/game/shared/skins/${currentSkin}_fist.svg`,
                                    x: getMeless.fists.right.x,
                                    y: getMeless.fists.right.y,
                                    zIndex: 4,
                                    rotate: 0
                                },
                                {
                                    class: "assets-fist",
                                    url: `./img/game/shared/skins/${currentSkin}_fist.svg`,
                                    x: getMeless.fists.left.x,
                                    y: getMeless.fists.left.y,
                                    zIndex: 3,
                                    rotate: 0
                                }
                            ];

                            const getPreview = appendPreview(image);

                            getPreview.attr("viewBox", "-100 -120 300 300");
                        }
                    });
                });
            }
        }

        // update throwable
        {
            const ThrowableInstance = Throwables.definitions.filter((argument, index, self) => {
                return !self.some((argument_child, i) =>
                    // ensures that only earlier elements in the self (argument_child) are checked against the current element (argument). This prevents checking duplicates twice
                    i < index
                    // not twice similar startsWith E.g: ['ak47', 'ak47-dragon', 'ak4-blue-ice]
                    && argument.idString.startsWith(argument_child.idString));
            });

            for (const throwableField of ThrowableInstance) {
                const key = "Throwables";
                const isExisted = lastCategory.some(category => category === key);

                $(".weapons-container-list").append(html`
                    ${!isExisted ? `<h2>${key}</h2>` : ""}
                    
                    <div class="weapons-container-card" id="weapons-list-${throwableField.idString}">
                        <img src="./img/game/shared/weapons/${throwableField.idString}.svg" alt=${throwableField.name} width="72px" height="72px" />
    
                        <p class="weapons-container-paragraph">${throwableField.name}</p>
                    </div>
                `);

                if (!isExisted) lastCategory.push(key);

                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                $(`#weapons-list-${throwableField.idString}`).on("click", async({ currentTarget }) => {
                    toggleSelect(currentTarget, ".weapons-container-list");

                    await appendAsset(throwableField.idString);

                    $('.weapons-container-card[id*="weapons-assets-"]').on("click", ({ currentTarget }) => {
                        toggleSelect(currentTarget, ".weapons-container-aside-assets");

                        // handler preview
                        {
                            const getTargetSelect = String((currentTarget.id.split("weapons-assets-")).pop());

                            game.console.setBuiltInCVar("dv_weapon_preset", getTargetSelect);

                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            const getThrowable = ThrowableInstance.find(g => g.idString === throwableField.idString)!;

                            const image = [
                                {
                                    class: "assets-base",
                                    url: `./img/game/shared/skins/${currentSkin}_base.svg`,
                                    x: 0,
                                    y: 0,
                                    zIndex: 2,
                                    rotate: 0
                                },
                                {
                                    class: "assets-world",
                                    url: `./img/game/shared/weapons/${getTargetSelect}.svg`,
                                    x: getThrowable.image?.position.x ?? 0,
                                    y: getThrowable.image?.position.y ?? 0,
                                    rotate: getThrowable.image?.angle ?? 0,
                                    zIndex: 5
                                },
                                {
                                    class: "assets-fist",
                                    url: `./img/game/shared/skins/${currentSkin}_fist.svg`,
                                    x: 38,
                                    y: -35,
                                    zIndex: 4,
                                    rotate: 0
                                },
                                {
                                    class: "assets-fist",
                                    url: `./img/game/shared/skins/${currentSkin}_fist.svg`,
                                    x: 38,
                                    y: 35,
                                    zIndex: 3,
                                    rotate: 0
                                }
                            ];

                            const getPreview = appendPreview(image);

                            getPreview.attr("viewBox", "-45 -45 250 90");
                        }
                    });
                });
            }
        }
    }

    function addSliderListener(
        elementId: string,
        settingName: keyof CVarTypeMapping,
        callback?: (value: number) => void
    ): void {
        const element = $<HTMLInputElement>(elementId)[0] as HTMLInputElement | undefined;
        if (!element) {
            console.error("Invalid element id");
            return;
        }

        let ignore = false;

        element.addEventListener("input", () => {
            if (ignore) return;

            const value = +element.value;
            ignore = true;
            game.console.setBuiltInCVar(settingName, value);
            ignore = false;
            callback?.(value);
        });

        game.console.variables.addChangeListener(settingName, (game, newValue) => {
            if (ignore) return;

            const casted = +newValue;

            callback?.(casted);

            ignore = true;
            element.value = `${casted}`;
            element.dispatchEvent(new InputEvent("input"));
            ignore = false;
        });

        const value = game.console.getBuiltInCVar(settingName) as number;
        callback?.(value);
        element.value = value.toString();
    }

    function addCheckboxListener(
        elementId: string,
        settingName: keyof CVarTypeMapping,
        callback?: (value: boolean) => void
    ): void {
        const element = $<HTMLInputElement>(elementId)[0] as HTMLInputElement | undefined;
        if (!element) {
            console.error("Invalid element id");
            return;
        }

        element.addEventListener("input", () => {
            const value = element.checked;
            game.console.setBuiltInCVar(settingName, value);
            callback?.(value);
        });

        game.console.variables.addChangeListener(settingName, (game, newValue) => {
            const casted = !!newValue;

            callback?.(casted);
            element.checked = casted;
        });

        element.checked = game.console.getBuiltInCVar(settingName) as boolean;
    }

    addSliderListener(
        "#slider-crosshair-size",
        "cv_crosshair_size",
        loadCrosshair
    );
    addSliderListener(
        "#slider-crosshair-stroke-size",
        "cv_crosshair_stroke_size",
        loadCrosshair
    );

    const toggleClass = (elem: JQuery, className: string, bool: boolean): void => {
        if (bool) {
            elem.addClass(className);
        } else elem.removeClass(className);
    };

    const crosshairColor = $<HTMLInputElement>("#crosshair-color-picker");

    crosshairColor.on("input", function() {
        game.console.setBuiltInCVar("cv_crosshair_color", this.value);
        loadCrosshair();
    });

    game.console.variables.addChangeListener(
        "cv_crosshair_color",
        (game, value) => {
            crosshairColor.val(value);
        }
    );

    const crosshairStrokeColor = $<HTMLInputElement>("#crosshair-stroke-picker");

    crosshairStrokeColor.on("input", function() {
        game.console.setBuiltInCVar("cv_crosshair_stroke_color", this.value);
        loadCrosshair();
    });

    game.console.variables.addChangeListener(
        "cv_crosshair_stroke_color",
        (game, value) => {
            crosshairStrokeColor.val(value);
        }
    );

    // Disable context menu
    ui.game.on("contextmenu", e => { e.preventDefault(); });

    // Scope looping toggle
    addCheckboxListener(
        "#toggle-scope-looping",
        "cv_loop_scope_selection"
    );

    // Toggle auto pickup
    addCheckboxListener(
        "#toggle-autopickup",
        "cv_autopickup"
    );
    $("#toggle-autopickup").parent().parent().toggle(inputManager.isMobile);

    // Autopickup a dual gun
    addCheckboxListener(
        "#toggle-autopickup-dual-guns",
        "cv_autopickup_dual_guns"
    );
    $("#toggle-autopickup-dual-guns").parent().parent().toggle(inputManager.isMobile);

    // Anonymous player names toggle
    addCheckboxListener(
        "#toggle-anonymous-player",
        "cv_anonymize_player_names"
    );

    addCheckboxListener("#toggle-hide-emote", "cv_hide_emotes");

    // Music volume
    addSliderListener(
        "#slider-music-volume",
        "cv_music_volume",
        value => {
            game.music.volume = value;
        }
    );

    // SFX volume
    addSliderListener(
        "#slider-sfx-volume",
        "cv_sfx_volume",
        value => {
            game.soundManager.sfxVolume = value;
        }
    );

    // Ambience volume
    addSliderListener(
        "#slider-ambience-volume",
        "cv_ambience_volume",
        value => {
            game.soundManager.ambienceVolume = value;
        }
    );

    // Master volume
    addSliderListener(
        "#slider-master-volume",
        "cv_master_volume",
        value => {
            sound.volumeAll = value;
        }
    );

    // Old menu music
    addCheckboxListener("#toggle-old-music", "cv_use_old_menu_music");

    // Camera shake
    addCheckboxListener("#toggle-camera-shake", "cv_camera_shake_fx");

    // FPS, ping, and coordinates toggles
    for (const prop of ["fps", "ping", "pos"] as const) {
        const debugReadout = game.uiManager.debugReadouts[prop];

        // toggleClass is sadly depreciated.
        toggleClass(debugReadout, "hidden-prop", !game.console.getBuiltInCVar(`pf_show_${prop}`));

        addCheckboxListener(
            `#toggle-${prop}`,
            `pf_show_${prop}`,
            value => toggleClass(debugReadout, "hidden-prop", !value)
        );
    }

    // lmao one day, we'll have dropdown menus

    // Text killfeed toggle
    {
        const element = $<HTMLInputElement>("#toggle-text-kill-feed")[0];

        element.addEventListener("input", () => {
            game.console.setBuiltInCVar("cv_killfeed_style", element.checked ? "text" : "icon");
        });

        game.console.variables.addChangeListener("cv_killfeed_style", (game, value) => {
            element.checked = value === "text";
            game.uiManager.updateWeaponSlots();
        });

        element.checked = game.console.getBuiltInCVar("cv_killfeed_style") === "text";
    }

    // Weapon slot style toggle
    {
        const element = $<HTMLInputElement>("#toggle-colored-slots")[0];

        element.addEventListener("input", () => {
            game.console.setBuiltInCVar("cv_weapon_slot_style", element.checked ? "colored" : "simple");
            game.uiManager.updateWeaponSlots();
        });

        game.console.variables.addChangeListener("cv_weapon_slot_style", (game, value) => {
            console.trace();
            element.checked = value === "colored";
            game.uiManager.updateWeaponSlots();
        });

        element.checked = game.console.getBuiltInCVar("cv_weapon_slot_style") === "colored";
    }

    // render mode select menu
    const renderSelect = $<HTMLSelectElement>("#render-mode-select")[0];
    renderSelect.addEventListener("input", () => {
        game.console.setBuiltInCVar("cv_renderer", renderSelect.value as unknown as "webgl1" | "webgl2" | "webgpu");
    });
    renderSelect.value = game.console.getBuiltInCVar("cv_renderer");

    void (async() => {
        $("#webgpu-option").toggle(await isWebGPUSupported());
    })();

    // render resolution select menu
    const renderResSelect = $<HTMLSelectElement>("#render-res-select")[0];
    renderResSelect.addEventListener("input", () => {
        game.console.setBuiltInCVar("cv_renderer_res", renderResSelect.value as unknown as "auto" | "0.5" | "1" | "2" | "3");
    });
    renderResSelect.value = game.console.getBuiltInCVar("cv_renderer_res");

    // High resolution toggle
    $("#toggle-high-res").parent().parent().toggle(!inputManager.isMobile);
    addCheckboxListener("#toggle-high-res", "cv_high_res_textures");
    addCheckboxListener("#toggle-cooler-graphics", "cv_cooler_graphics");

    game.console.variables.addChangeListener(
        "cv_cooler_graphics",
        (_, newVal, oldVal) => {
            if (newVal !== oldVal && !newVal) {
                for (const player of game.objects.getCategory(ObjectCategory.Player)) {
                    const { images: { blood: { children } }, bloodDecals } = player;

                    for (const child of children) {
                        child.destroy();
                    }

                    children.length = 0;

                    for (const decal of bloodDecals) {
                        decal.kill();
                    }
                }
            }
        }
    );
    addCheckboxListener("#toggle-ambient-particles", "cv_ambient_particles");

    const { gameUi } = game.uiManager.ui;

    game.console.variables.addChangeListener(
        "cv_draw_hud",
        (_, newVal) => {
            gameUi.toggle(newVal);
            game.map.visible = !game.console.getBuiltInCVar("cv_minimap_minimized") && newVal;
        }
    );
    addCheckboxListener("#toggle-draw-hud", "cv_draw_hud");

    // Anti-aliasing toggle
    addCheckboxListener("#toggle-antialias", "cv_antialias");

    // Movement smoothing toggle
    addCheckboxListener("#toggle-movement-smoothing", "cv_movement_smoothing");

    // Responsive rotation toggle
    addCheckboxListener("#toggle-responsive-rotation", "cv_responsive_rotation");

    // Mobile controls stuff
    addCheckboxListener("#toggle-mobile-controls", "mb_controls_enabled");
    addSliderListener("#slider-joystick-size", "mb_joystick_size");
    addSliderListener("#slider-joystick-transparency", "mb_joystick_transparency");
    addSliderListener("#slider-gyro-angle", "mb_gyro_angle");
    addCheckboxListener("#toggle-haptics", "mb_haptics");
    addCheckboxListener("#toggle-high-res-mobile", "mb_high_res_textures");

    function updateUiScale(): void {
        const scale = game.console.getBuiltInCVar("cv_ui_scale");

        gameUi.width(window.innerWidth / scale);
        gameUi.height(window.innerHeight / scale);
        gameUi.css("transform", `scale(${scale})`);
    }
    updateUiScale();
    window.addEventListener("resize", () => updateUiScale());

    addSliderListener(
        "#slider-ui-scale",
        "cv_ui_scale",
        () => {
            updateUiScale();
            game.map.resize();
        }
    );

    // TODO: fix joysticks on mobile when UI scale is not 1
    if (inputManager.isMobile) {
        $("#ui-scale-container").hide();
        game.console.setBuiltInCVar("cv_ui_scale", 1);
    }

    // Minimap stuff
    addSliderListener(
        "#slider-minimap-transparency",
        "cv_minimap_transparency",
        () => {
            game.map.updateTransparency();
        }
    );
    addSliderListener(
        "#slider-big-map-transparency",
        "cv_map_transparency",
        () => {
            game.map.updateTransparency();
        }
    );
    addCheckboxListener(
        "#toggle-hide-minimap",
        "cv_minimap_minimized",
        value => {
            game.map.visible = !value;
        }
    );

    game.console.variables.addChangeListener(
        "cv_map_expanded",
        (_, newValue) => {
            game.map.expanded = newValue;
        }
    );

    // Leave warning
    addCheckboxListener("#toggle-leave-warning", "cv_leave_warning");

    const splashUi = $<HTMLInputElement>("#splash-ui");
    // Blur splash screen
    addCheckboxListener(
        "#toggle-blur-splash",
        "cv_blur_splash",
        value => {
            splashUi.toggleClass("blur", value);
        }
    );
    splashUi.toggleClass("blur", game.console.getBuiltInCVar("cv_blur_splash"));

    const button = $<HTMLButtonElement>("#btn-rules, #rules-close-btn");
    // Hide rules button
    addCheckboxListener(
        "#toggle-hide-rules",
        "cv_hide_rules_button",
        value => {
            button.toggle(!value);
        }
    );
    button.toggle(!game.console.getBuiltInCVar("cv_hide_rules_button"));

    // Hide option to hide rules if rules haven't been acknowledged
    $(".checkbox-setting").has("#toggle-hide-rules").toggle(game.console.getBuiltInCVar("cv_rules_acknowledged"));

    const rules = $<HTMLButtonElement>("#btn-rules, #rules-close-btn");
    const toggleHideRules = $<HTMLInputElement>("#toggle-hide-rules");

    $("#rules-close-btn").on("click", () => {
        rules.hide();
        game.console.setBuiltInCVar("cv_hide_rules_button", true);
        toggleHideRules.prop("checked", true);
    }).toggle(game.console.getBuiltInCVar("cv_rules_acknowledged") && !game.console.getBuiltInCVar("cv_hide_rules_button"));

    // Import settings
    $("#import-settings-btn").on("click", () => {
        if (!confirm("This option will overwrite all settings and reload the page. Continue?")) return;
        const error = (): void => { alert("Invalid config."); };

        try {
            const input = prompt("Enter a config:");
            if (!input) {
                error();
                return;
            }

            const config: unknown = JSON.parse(input);
            if (typeof config !== "object" || config === null || !("variables" in config)) {
                error();
                return;
            }

            localStorage.setItem("suroi_config", input);
            alert("Settings loaded successfully.");
            window.location.reload();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_) {
            error();
        }
    });

    // Copy settings to clipboard
    $("#export-settings-btn").on("click", () => {
        const exportedSettings = localStorage.getItem("suroi_config");
        const error = (): void => {
            alert(
                "Unable to copy settings. To export settings manually, open the dev tools with Ctrl+Shift+I (Cmd+Opt+I on Mac) "
                + "and, after typing in the following, copy the result manually: localStorage.getItem(\"suroi_config\")"
            );
        };
        if (exportedSettings === null) {
            error();
            return;
        }
        navigator.clipboard
            .writeText(exportedSettings)
            .then(() => {
                alert("Settings copied to clipboard.");
            })
            .catch(error);
    });

    // Reset settings
    $("#reset-settings-btn").on("click", () => {
        if (!confirm("This option will reset all settings and reload the page. Continue?")) return;
        if (!confirm("Are you sure? This action cannot be undone.")) return;
        localStorage.removeItem("suroi_config");
        window.location.reload();
    });

    // Switch weapon slots by clicking
    const step = 1; // Define the step for cycling
    const inventorySlotTypings = GameConstants.player.inventorySlotTypings;

    const slotListener = (element: JQuery<HTMLDivElement>, listener: (button: number) => void): void => {
        element[0].addEventListener("pointerdown", (e: PointerEvent): void => {
            listener(e.button);
            e.stopPropagation();
        });
    };

    let dropTimer: number | undefined;

    function mobileDropItem(button: number, condition: boolean, item?: AmmoDefinition | ArmorDefinition | ScopeDefinition | HealingItemDefinition, slot?: number): void {
        if (!inputManager.isMobile) return;
        dropTimer = window.setTimeout(() => {
            if (button === 0 && condition) {
                if (slot !== undefined) {
                    inputManager.addAction({
                        type: InputActions.DropWeapon,
                        slot
                    });
                } else if (item !== undefined) {
                    inputManager.addAction({
                        type: InputActions.DropItem,
                        item
                    });
                }
                autoPickup = false;
                window.setTimeout(() => {
                    autoPickup = true;
                }, 600);
            }
        }, 600);
    }

    // Generate the UI for scopes, healing items, weapons, and ammos
    $<HTMLDivElement>("#weapons-container").append(
        ...Array.from(
            { length: GameConstants.player.maxWeapons },
            (_, slot) => {
                const ele = $<HTMLDivElement>(
                    `<div class="inventory-slot" id="weapon-slot-${slot + 1}">\
                        <div class="main-container">\
                            <span class="slot-number">${slot + 1}</span>\
                            <span class="item-ammo"></span>\
                            <img class="item-image" draggable="false" />\
                            <span class="item-name"></span>\
                        </div>\
                        <img class="lock-icon" src="./img/misc/lock.svg"></span>\
                    </div>`
                );

                const isGrenadeSlot = inventorySlotTypings[slot] === ItemType.Throwable;
                const element = ele[0];

                element.addEventListener("pointerup", () => clearTimeout(dropTimer));

                element.addEventListener("pointerdown", e => {
                    if (!ele.hasClass("has-item")) return;

                    e.stopImmediatePropagation();

                    inputManager.addAction({
                        type: e.button === 2 ? InputActions.DropWeapon : InputActions.EquipItem,
                        slot
                    });

                    // We cycle the throwables after the drop item call, otherwise the wrong grenade will be dropped.
                    if (
                        isGrenadeSlot
                        && game.activePlayer?.activeItem.itemType === ItemType.Throwable
                        && e.button !== 2 // it can be anything but the right click, because right click drops stuff
                    ) {
                        inputManager.cycleThrowable(step);
                    }

                    mobileDropItem(e.button, true, undefined, slot);
                });
                return ele;
            }
        )
    );

    $<HTMLDivElement>("#scopes-container").append(
        Scopes.definitions.map(scope => {
            const ele = $<HTMLDivElement>(
                `<div class="inventory-slot item-slot" id="${scope.idString}-slot" style="display: none;">
                    <img class="item-image" src="./img/game/shared/loot/${scope.idString}.svg" draggable="false">
                    <div class="item-tooltip">${scope.name.split(" ")[0]}</div>
                </div>`
            );

            ele[0].addEventListener("pointerup", () => clearTimeout(dropTimer));

            slotListener(ele, button => {
                const isPrimary = button === 0;
                const isSecondary = button === 2;
                const isTeamMode = game.teamMode;

                if (isPrimary) {
                    inputManager.addAction({
                        type: InputActions.UseItem,
                        item: scope
                    });

                    mobileDropItem(button, isTeamMode, scope);
                }

                if (isSecondary && isTeamMode) {
                    inputManager.addAction({
                        type: InputActions.DropItem,
                        item: scope
                    });
                }
            });

            if (UI_DEBUG_MODE) ele.show();

            return ele;
        })
    );

    $<HTMLDivElement>("#healing-items-container").append(
        HealingItems.definitions.map(item => {
            const ele = $<HTMLDivElement>(
                html`<div class="inventory-slot item-slot active" id="${item.idString}-slot">
                    <img class="item-image" src="./img/game/shared/loot/${item.idString}.svg" draggable="false">
                    <span class="item-count" id="${item.idString}-count">0</span>
                    <div class="item-tooltip">
                        ${getTranslatedString("tt_restores", {
                            item: `<b>${getTranslatedString(item.idString as TranslationKeys)}</b><br>`,
                            amount: item.restoreAmount.toString(),
                            type: item.healType === HealType.Adrenaline
                                ? getTranslatedString("adrenaline")
                                : getTranslatedString("health")
                        })}
                    </div>
                </div>`
            );

            ele[0].addEventListener("pointerup", () => clearTimeout(dropTimer));

            slotListener(ele, button => {
                const isPrimary = button === 0;
                const isSecondary = button === 2;
                const isTeamMode = game.teamMode;

                if (isPrimary) {
                    if (inputManager.pingWheelActive) {
                        inputManager.addAction({
                            type: InputActions.Emote,
                            emote: HealingItems.fromString(item.idString)
                        });
                    } else {
                        inputManager.addAction({
                            type: InputActions.UseItem,
                            item
                        });
                    }

                    mobileDropItem(button, isTeamMode, item);
                }

                if (isSecondary && isTeamMode) {
                    inputManager.addAction({
                        type: InputActions.DropItem,
                        item
                    });
                }
            });

            return ele;
        })
    );

    const ammoContainers = {
        true: $<HTMLDivElement>("#special-ammo-container"),
        false: $<HTMLDivElement>("#ammo-container")
    } as const;

    for (const ammo of Ammos) {
        if (ammo.ephemeral) continue;

        const ele = $<HTMLDivElement>(
            `<div class="inventory-slot item-slot ammo-slot active" id="${ammo.idString}-slot">
                <img class="item-image" src="./img/game/shared/loot/${ammo.idString}.svg" draggable="false">
                <span class="item-count" id="${ammo.idString}-count">0</span>
            </div>`
        );

        ammoContainers[`${ammo.hideUnlessPresent}`].append(ele);

        ele[0].addEventListener("pointerup", (): void => {
            clearTimeout(dropTimer);
        });

        slotListener(ele, button => {
            const isPrimary = button === 0;
            const isSecondary = button === 2;
            const isTeamMode = game.teamMode;

            if (isPrimary) {
                if (inputManager.pingWheelActive) {
                    inputManager.addAction({
                        type: InputActions.Emote,
                        emote: Ammos.fromString(ammo.idString)
                    });
                }

                mobileDropItem(button, isTeamMode, ammo);
            }

            if (isSecondary && isTeamMode) {
                inputManager.addAction({
                    type: InputActions.DropItem,
                    item: ammo
                });
            }
        });
    }

    slotListener($<HTMLDivElement>("#c4-detonate-btn"), button => {
        const isPrimary = button === 0;

        if (isPrimary) {
            inputManager.addAction({
                type: InputActions.ExplodeC4
            });
        }
    });

    for (
        const [ele, type] of [
            [$<HTMLDivElement>("#helmet-slot"), "helmet"],
            [$<HTMLDivElement>("#vest-slot"), "vest"]
        ] as const
    ) {
        ele[0].addEventListener("pointerup", () => clearTimeout(dropTimer));

        slotListener(ele, button => {
            const isSecondary = button === 2;
            const shouldDrop = game.activePlayer && game.teamMode;

            if (isSecondary && shouldDrop) {
                const item = game.activePlayer.getEquipment(type);
                if (item) {
                    inputManager.addAction({
                        type: InputActions.DropItem,
                        item
                    });
                }
            }

            if (shouldDrop !== undefined) {
                mobileDropItem(button, shouldDrop, game.activePlayer?.getEquipment(type));
            }
        });
    }

    for (const perkSlot of ["#perk-slot-0", "#perk-slot-1", "#perk-slot-2"]) {
        $(perkSlot)[0].addEventListener("pointerdown", function(e: PointerEvent): void {
            e.stopImmediatePropagation();
            if (e.button !== 2) return;

            const perkIDString = $(this).attr("data-idString");
            if (!perkIDString) return;

            game.inputManager.addAction({
                type: InputActions.DropItem,
                item: Perks.fromString(perkIDString as PerkIds)
            });
        });
    }

    // Alright so in mobile we have a completely different spectating container.
    if (inputManager.isMobile) {
        ui.spectatingContainer.addClass("mobile-mode");
        ui.spectatingContainer.css({
            width: "150px",
            position: "fixed",
            top: "15%",
            left: "5rem"
        });

        ui.btnReport.html("<i class=\"fa-solid fa-flag\"></i>");
        ui.btnPlayAgainSpectating.html("<i class=\"fa-solid fa-rotate-right\"></i>");

        // Spectate Kill Leader button
        ui.spectateKillLeader.html("<i class=\"fa-solid fa-crown\"></i>");
        ui.spectateKillLeader.addClass("btn-spectate-kill-leader");

        ui.btnSpectateMenu.html("<i class=\"fa-solid fa-bars\"></i>");
        ui.btnSpectateMenu.addClass("btn-success");
    }

    const optionsIcon = $("#btn-spectate-options-icon");
    $<HTMLButtonElement>("#btn-spectate-options").on("click", () => {
        ui.spectatingContainer.toggle();

        if (game.inputManager.isMobile) ui.spectatingContainer.toggleClass("mobile-visible");

        const visible = ui.spectatingContainer.is(":visible");
        optionsIcon
            .toggleClass("fa-eye", !visible)
            .toggleClass("fa-eye-slash", visible);
    });

    // Hide mobile settings on desktop
    $("#tab-mobile").toggle(isMobile.any);

    // Mobile event listeners
    if (inputManager.isMobile) {
        // Interact message
        ui.interactMsg.on("click", () => {
            inputManager.addAction(game.uiManager.action.active ? InputActions.Cancel : InputActions.Interact);
        });
        // noinspection HtmlUnknownTarget
        ui.interactKey.html('<img src="./img/misc/tap-icon.svg" alt="Tap">');

        // Active weapon ammo button reloads
        ui.activeAmmo.on("click", () => game.console.handleQuery("reload", "never"));

        // Emote button & wheel
        ui.emoteWheel
            .css("top", "50%")
            .css("left", "50%");

        const createEmoteWheelListener = (slot: typeof EMOTE_SLOTS[number], emoteSlot: number): void => {
            $(`#emote-wheel .emote-${slot}`).on("click", () => {
                ui.emoteWheel.hide();
                let clicked = true;

                if (inputManager.pingWheelActive) {
                    const ping = game.uiManager.mapPings[emoteSlot];

                    setTimeout(() => {
                        let gameMousePosition: Vector;

                        if (game.map.expanded) {
                            ui.game.one("click", () => {
                                gameMousePosition = inputManager.pingWheelPosition;

                                if (ping && inputManager.pingWheelActive && clicked) {
                                    inputManager.addAction({
                                        type: InputActions.MapPing,
                                        ping,
                                        position: gameMousePosition
                                    });

                                    clicked = false;
                                }
                            });
                        } else {
                            ui.game.one("click", e => {
                                const globalPos = Vec.create(e.clientX, e.clientY);
                                const pixiPos = game.camera.container.toLocal(globalPos);
                                gameMousePosition = Vec.scale(pixiPos, 1 / PIXI_SCALE);

                                if (ping && inputManager.pingWheelActive && clicked) {
                                    inputManager.addAction({
                                        type: InputActions.MapPing,
                                        ping,
                                        position: gameMousePosition
                                    });

                                    clicked = false;
                                }
                            });
                        }
                    }, 100); // 0.1 second (to wait for the emote wheel)
                } else {
                    const emote = game.uiManager.emotes[emoteSlot];
                    if (emote) {
                        inputManager.addAction({
                            type: InputActions.Emote,
                            emote
                        });
                    }
                }
            });
        };

        createEmoteWheelListener("top", 0);
        createEmoteWheelListener("right", 1);
        createEmoteWheelListener("bottom", 2);
        createEmoteWheelListener("left", 3);

        $("#mobile-options").show();

        ui.menuButton.on("click", () => ui.gameMenu.toggle());
        ui.emoteButton.on("click", () => ui.emoteWheel.show());

        ui.pingToggle.on("click", () => {
            inputManager.pingWheelActive = !inputManager.pingWheelActive;
            const { pingWheelActive } = inputManager;
            ui.pingToggle
                .toggleClass("btn-danger", pingWheelActive)
                .toggleClass("btn-primary", !pingWheelActive);

            game.uiManager.updateEmoteWheel();
        });
    }

    // Prompt when trying to close the tab while playing
    window.addEventListener("beforeunload", (e: Event) => {
        if (ui.canvas.hasClass("active") && game.console.getBuiltInCVar("cv_leave_warning") && !game.gameOver) {
            e.preventDefault();
        }
    });

    const wrapperCache = new ExtendedMap<HTMLElement, JQuery>();

    // Hack to style range inputs background and add a label with the value :)
    function updateRangeInput(element: HTMLInputElement): void {
        const value = +element.value;
        const min = +element.min;
        const max = +element.max;
        const x = ((value - min) / (max - min)) * 100;

        wrapperCache.getAndGetDefaultIfAbsent(element, () => $(element))
            .css(
                "--background",
                `linear-gradient(to right, #ff7500 0%, #ff7500 ${x}%, #f8f9fa ${x}%, #f8f9fa 100%)`
            )
            .siblings(".range-input-value")
            .text(
                element.id !== "slider-joystick-size" && element.id !== "slider-gyro-angle"
                    ? `${Math.round(value * 100)}%`
                    : value
            );
    }

    $<HTMLInputElement>("input[type=range]")
        .on("input", ({ target }) => {
            updateRangeInput(target);
        })
        .each((_, element) => {
            updateRangeInput(element);
        });

    $(".tab").on("click", ({ target }) => {
        const tab = wrapperCache.getAndGetDefaultIfAbsent(target, () => $(target));

        tab.addClass("active");
        tab.siblings().removeClass("active");

        const tabContent = $(`#${target.id}-content`);

        tabContent.siblings().removeClass("active");
        tabContent.siblings().hide();

        tabContent.addClass("active");
        tabContent.show();
    });

    const soloButtons = $<HTMLButtonElement>("#warning-btn-play-solo, #btn-play-solo");
    $<HTMLInputElement>("#warning-modal-agree-checkbox").on("click", function() {
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

    // Makes social buttons unclickable for 1.5 seconds after disconnecting, to prevent accidental clicks
    $(".btn-social").on("click", e => {
        if (lastDisconnectTime && Date.now() - lastDisconnectTime < 1500) {
            e.preventDefault();
        }
    });
}

//  ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣠⣤⣤⣤⣤⣤⣤⣤⣤⣤⣤⣄⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣤⣶⣾⣿⣿⡿⠟⠛⠛⠛⠛⠛⠻⠿⣿⣿⣿⣿⣿⣷⣶⣤⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣤⣶⣿⣿⣿⣿⠟⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠛⢿⣿⣿⣿⣿⣿⣿⣶⣤⣄⠀⠀⠀⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠀⣠⣶⣿⣿⣿⣿⣿⠟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⣿⣿⣿⣿⣿⣿⣿⣿⣷⡄⠀⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⣼⡿⣿⣿⣿⣿⣿⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣆⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⢻⣿⡟⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹⣿⣿⣿⣿⣿⣿⣿⣿⡟⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠘⢿⣼⡟⢻⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⠳⠆⠀⠀⠀⠹⣿⣿⣿⣿⣿⣿⡟⠁⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠀⢈⣻⣷⣾⣿⡇⠀⠀⠀⢀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣀⣀⠀⠀⠀⢻⣿⣿⣿⡿⢋⡀⠀⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠀⣿⠉⠙⢿⣿⡇⠀⠀⠀⠈⢻⣿⣷⣶⣄⣠⠀⠀⠀⣀⣠⣾⣿⣿⡯⠉⠁⠀⠀⠀⢻⣿⣿⡿⠛⢿⡆⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠀⣟⠀⠘⢾⡿⠀⠀⠀⢀⣠⣤⣶⣿⣿⣿⠟⠀⠀⣿⣿⣿⣿⣿⣷⣦⣄⡀⠀⠀⠀⢸⣿⣯⠀⣶⡆⣿⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠀⣿⠈⠀⣼⠃⠀⠀⠘⠋⠁⣈⣹⣿⣿⠏⠀⠀⠀⣿⣿⣏⠀⣈⣁⣈⡝⠻⠿⡆⠀⠰⣿⣏⠈⣿⢷⡟⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠀⣿⠀⠰⡇⠀⠀⠀⠀⠀⠀⠁⠀⠀⠀⠀⠀⠀⠀⢸⣽⣿⣆⠀⠀⠀⠀⠀⠀⠁⠀⢸⣿⣿⡆⣏⣿⠀⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠀⣿⠀⠀⢱⡀⠀⠀⠀⠀⠀⠀⠀⠀⣀⠀⠀⠀⠀⠀⠀⢿⣿⡄⠀⠀⠀⠀⠀⠀⠀⢸⣿⡟⣿⣿⡇⠀⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠀⠙⣄⠀⠀⣸⡄⠀⠀⠀⠀⠀⢀⡞⠁⣤⣤⣀⣠⣤⣀⣄⣸⣿⣦⡀⠀⠀⠀⠀⠀⢸⣿⣄⠟⣼⠀⠀⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⠷⠶⠻⡇⠀⠀⠀⠀⠀⠟⠀⠀⠀⠀⠉⠙⠿⠿⣿⠉⢀⡿⣷⡀⢸⣇⢰⠀⠸⣿⣡⡾⠃⠀⠀⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⡇⠀⠀⠀⠀⠀⣀⠀⠀⠀⠀⠐⠛⠀⠀⠁⠀⠀⢰⡟⢷⢸⣿⢀⠀⠀⣿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⡇⠀⠀⠀⠀⣼⡿⠓⠶⠒⠛⠛⠉⠙⠛⠻⠻⠿⣿⡇⠀⢸⡟⠀⠀⣠⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢘⡇⠒⠀⠀⠀⠈⠀⠀⠀⠀⠀⣶⠶⠶⠶⠶⠀⢀⣿⠁⢠⡾⠁⠀⣰⣿⠉⢇⠀⠀⠀⠀⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢈⡷⠶⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠁⠀⠿⠃⢀⣴⡟⢹⡄⠘⣧⠀⠀⠀⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⠞⢁⡆⠀⠐⢢⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠀⠒⠀⠀⣠⣴⣿⡟⣰⡿⣡⡄⠈⢣⡀⠀⠀⠀⠀⠀⠀
//  ⠀⠀⠀⠀⠀⣀⣠⡤⠖⠒⠋⠁⠀⠘⣷⠀⠀⠀⠙⠦⣄⣀⣀⣀⣀⣀⣤⣶⣿⣦⣤⣴⣶⣿⡿⢋⣼⠟⢁⣿⠁⣠⣤⡉⠀⠀⠀⠀⠀⠀
//  ⣠⠤⠔⠒⠚⠉⠁⠀⠀⠀⠀⠀⠀⠀⢹⡆⠀⠀⠀⠀⠉⠻⣿⣿⣿⣯⣥⣤⣤⣶⣿⣿⡿⠋⣠⡿⠁⠀⠀⠁⠲⢈⣿⣿⣷⣤⣄⠀⠀⠀
//  ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⢦⡀⠤⡄⠀⠀⠀⠀⠉⡻⢿⣧⣿⣿⡟⢋⣤⡾⠋⠀⠀⠀⠀⠘⠛⢺⣿⣿⣿⣿⣿⣷⣤⣤
//  ⡀⠀⣀⣀⣀⣀⣀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠙⢦⣈⣳⣦⣤⣤⣿⣿⣿⠟⢋⣡⣶⣿⠋⢀⠀⠀⠀⡀⠀⠀⢀⡌⠘⣿⣿⣿⣿⣿⣿⣿
//

import { GameConstants, InputActions, ObjectCategory, SpectateActions, TeamSize } from "@common/constants";
import { Ammos, type AmmoDefinition } from "@common/definitions/ammos";
import { type ArmorDefinition } from "@common/definitions/armors";
import { HealType, HealingItems, type HealingItemDefinition } from "@common/definitions/healingItems";
import { PerkIds, Perks } from "@common/definitions/perks";
import { Scopes, type ScopeDefinition } from "@common/definitions/scopes";
import { SpectatePacket } from "@common/packets/spectatePacket";
import { isMobile, isWebGPUSupported } from "pixi.js";
import { sound } from "@pixi/sound";
import { body } from "../uiHelpers";
import { Crosshairs, getCrosshair } from "../utils/crosshairs";
import { EMOTE_SLOTS, PIXI_SCALE, UI_DEBUG_MODE } from "../utils/constants";
import { Modes } from "@common/definitions/modes";
import { GAME_CONSOLE } from "../../";
import $ from "jquery";
import type { Game } from "../game";
import { getTranslatedString } from "../../translations";
import { Vec, type Vector } from "@common/utils/vector";
import { ItemType } from "@common/utils/objectDefinitions";
import { CustomTeamMessages } from "@common/typings";
import type { CVarTypeMapping } from "../utils/console/defaultClientCVars";
import { html, requestFullscreen } from "../utils/misc";
import type { TranslationKeys } from "../../typings/translations";
import { errorAlert } from "../modal";
import { joinGame, teamSocket } from "./play";
import { setUpCommands } from "../utils/console/commands";

export let autoPickup = true;

export function updateUsersBadge(badgeId: string | undefined): void {
    const aliveUsersContainer = document.getElementById("badges-container");
    if (!aliveUsersContainer) return;

    // Clear existing badge content
    aliveUsersContainer.innerHTML = "";

    if (badgeId) {
        const badgeImage = document.createElement("img");
        badgeImage.src = `./img/game/shared/badges/${badgeId}.svg`;
        badgeImage.alt = "Card Badge";
        badgeImage.className = "badge-image";
        badgeImage.draggable = false;

        aliveUsersContainer.appendChild(badgeImage);
    }
}

function setupMenuButtons(game: Game): void {
    const { ui } = game.uiManager;
    const gameMenu = ui.gameMenu;
    const settingsMenu = $("#settings-menu");

    $("#btn-quit-game, #btn-spectate-menu, #btn-menu").on("click", () => {
        void game.endGame();
    });

    $("#btn-play-again, #btn-spectate-replay").on("click", async () => {
        await game.endGame();
        if (teamSocket) {
            teamSocket.send(JSON.stringify({ type: CustomTeamMessages.Start }))
        } else {
            if (game.account) {
                joinGame(game.teamSize, game, game.account)
            } else {
                errorAlert("Please connect your wallet to continue!")
            }
        }
    });

    $<HTMLButtonElement>("#btn-resume-game").on("click", () => gameMenu.hide());
    $<HTMLButtonElement>("#btn-fullscreen").on("click", () => {
        requestFullscreen();
        ui.gameMenu.hide();
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
    $<HTMLButtonElement>("#btn-inventory").on("click", () => {
        customizeMenu.css("z-index", "9999");
        customizeMenu.fadeToggle(250);
    });
    $<HTMLButtonElement>("#close-customize").on("click", () => customizeMenu.fadeOut(250));
}

function setupSpectateControls(game: Game): void {
    const { ui } = game.uiManager;

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

    ui.spectateNext.on("click", () => {
        sendSpectatePacket(SpectateActions.SpectateNext);
    });
}

function setupKeyboardControls(game: Game): void {
    const { ui } = game.uiManager;
    const gameMenu = ui.gameMenu;
    const settingsMenu = $("#settings-menu");

    body.on("keydown", (e: JQuery.KeyDownEvent) => {
        if (e.key === "Escape") {
            if (ui.canvas.hasClass("active") && !GAME_CONSOLE.isOpen) {
                gameMenu.fadeToggle(250);
                settingsMenu.hide();
            }
            GAME_CONSOLE.isOpen = false;
        }
    });
}

function setupCrosshair(game: Game): void {
    const { ui } = game.uiManager;
    const crosshairImage = $<HTMLDivElement>("#crosshair-image");
    const crosshairControls = $<HTMLDivElement>("#crosshair-controls");
    const crosshairTargets = $<HTMLDivElement>("#crosshair-preview, #game");

    function loadCrosshair(): void {
        const size = 20 * GAME_CONSOLE.getBuiltInCVar("cv_crosshair_size");
        const crosshair = getCrosshair(
            GAME_CONSOLE.getBuiltInCVar("cv_loadout_crosshair"),
            GAME_CONSOLE.getBuiltInCVar("cv_crosshair_color"),
            size,
            GAME_CONSOLE.getBuiltInCVar("cv_crosshair_stroke_color"),
            GAME_CONSOLE.getBuiltInCVar("cv_crosshair_stroke_size")
        );
        const cursor = crosshair === "crosshair" ? crosshair : `url("${crosshair}") ${size / 2} ${size / 2}, crosshair`;

        crosshairImage.css({
            backgroundImage: `url("${crosshair}")`,
            width: size,
            height: size
        });

        crosshairControls.toggleClass("disabled", !Crosshairs[GAME_CONSOLE.getBuiltInCVar("cv_loadout_crosshair")]);
        crosshairTargets.css({ cursor });
    }

    loadCrosshair();

    const crosshairCache: Array<JQuery<HTMLDivElement>> = [];

    GAME_CONSOLE.variables.addChangeListener(
        "cv_loadout_crosshair",
        (_, value) => {
            (crosshairCache[value] ??= $(`#crosshair-${value}`))
                .addClass("selected")
                .siblings()
                .removeClass("selected");

            loadCrosshair();
        }
    );

    const crosshairSize = GAME_CONSOLE.getBuiltInCVar("cv_crosshair_size");
    const currentCrosshair = GAME_CONSOLE.getBuiltInCVar("cv_loadout_crosshair");

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
                GAME_CONSOLE.setBuiltInCVar("cv_loadout_crosshair", crosshairIndex);
                loadCrosshair();
                crosshairItem.addClass("selected")
                    .siblings()
                    .removeClass("selected");
            });

            return crosshairItem;
        })
    );

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

    const crosshairColor = $<HTMLInputElement>("#crosshair-color-picker");
    crosshairColor.on("input", function () {
        GAME_CONSOLE.setBuiltInCVar("cv_crosshair_color", this.value);
        loadCrosshair();
    });

    GAME_CONSOLE.variables.addChangeListener(
        "cv_crosshair_color",
        (game, value) => {
            crosshairColor.val(value);
        }
    );

    const crosshairStrokeColor = $<HTMLInputElement>("#crosshair-stroke-picker");
    crosshairStrokeColor.on("input", function () {
        GAME_CONSOLE.setBuiltInCVar("cv_crosshair_stroke_color", this.value);
        loadCrosshair();
    });

    GAME_CONSOLE.variables.addChangeListener(
        "cv_crosshair_stroke_color",
        (game, value) => {
            crosshairStrokeColor.val(value);
        }
    );
}

function setupGameModeStyles(game: Game): void {
    if (Modes[game.gameMode].darkShaders) {
        $("#game-canvas").css({
            "filter": "brightness(0.65) saturate(0.85)",
            "position": "relative",
            "z-index": "-1"
        });
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
        GAME_CONSOLE.setBuiltInCVar(settingName, value);
        ignore = false;
        callback?.(value);
    });

    GAME_CONSOLE.variables.addChangeListener(settingName, (game, newValue) => {
        if (ignore) return;

        const casted = +newValue;

        callback?.(casted);

        ignore = true;
        element.value = `${casted}`;
        element.dispatchEvent(new InputEvent("input"));
        ignore = false;
    });

    const value = GAME_CONSOLE.getBuiltInCVar(settingName) as number;
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
        GAME_CONSOLE.setBuiltInCVar(settingName, value);
        callback?.(value);
    });

    GAME_CONSOLE.variables.addChangeListener(settingName, (game, newValue) => {
        const casted = !!newValue;

        callback?.(casted);
        element.checked = casted;
    });

    element.checked = GAME_CONSOLE.getBuiltInCVar(settingName) as boolean;
}

function setupAudioControls(game: Game): void {
    addSliderListener(
        "#slider-music-volume",
        "cv_music_volume",
        value => {
            game.music.volume = value;
        }
    );

    addSliderListener(
        "#slider-sfx-volume",
        "cv_sfx_volume",
        value => {
            game.soundManager.sfxVolume = value;
        }
    );

    addSliderListener(
        "#slider-ambience-volume",
        "cv_ambience_volume",
        value => {
            game.soundManager.ambienceVolume = value;
        }
    );

    addSliderListener(
        "#slider-master-volume",
        "cv_master_volume",
        value => {
            sound.volumeAll = value;
        }
    );

    addCheckboxListener("#toggle-old-music", "cv_use_old_menu_music");
}

function setupDebugReadouts(game: Game): void {
    for (const prop of ["fps", "ping", "pos"] as const) {
        const debugReadout = game.uiManager.debugReadouts[prop];

        toggleClass(debugReadout, "hidden-prop", !GAME_CONSOLE.getBuiltInCVar(`pf_show_${prop}`));

        addCheckboxListener(
            `#toggle-${prop}`,
            `pf_show_${prop}`,
            value => toggleClass(debugReadout, "hidden-prop", !value)
        );
    }
}

function toggleClass(elem: JQuery, className: string, bool: boolean): void {
    if (bool) {
        elem.addClass(className);
    } else elem.removeClass(className);
}

function setupKillFeedAndWeaponSlots(game: Game): void {
    const killFeedToggle = $<HTMLInputElement>("#toggle-text-kill-feed")[0];
    killFeedToggle.addEventListener("input", () => {
        GAME_CONSOLE.setBuiltInCVar("cv_killfeed_style", killFeedToggle.checked ? "text" : "icon");
    });

    GAME_CONSOLE.variables.addChangeListener("cv_killfeed_style", (game, value) => {
        killFeedToggle.checked = value === "text";
        game.uiManager.updateWeaponSlots();
    });

    killFeedToggle.checked = GAME_CONSOLE.getBuiltInCVar("cv_killfeed_style") === "text";

    const weaponSlotToggle = $<HTMLInputElement>("#toggle-colored-slots")[0];
    weaponSlotToggle.addEventListener("input", () => {
        GAME_CONSOLE.setBuiltInCVar("cv_weapon_slot_style", weaponSlotToggle.checked ? "colored" : "simple");
        game.uiManager.updateWeaponSlots();
    });

    GAME_CONSOLE.variables.addChangeListener("cv_weapon_slot_style", (game, value) => {
        weaponSlotToggle.checked = value === "colored";
        game.uiManager.updateWeaponSlots();
    });

    weaponSlotToggle.checked = GAME_CONSOLE.getBuiltInCVar("cv_weapon_slot_style") === "colored";
}

function setupRenderSettings(game: Game): void {
    const renderSelect = $<HTMLSelectElement>("#render-mode-select")[0];
    renderSelect.addEventListener("input", () => {
        GAME_CONSOLE.setBuiltInCVar("cv_renderer", renderSelect.value as unknown as "webgl1" | "webgl2" | "webgpu");
    });
    renderSelect.value = GAME_CONSOLE.getBuiltInCVar("cv_renderer");

    void (async () => {
        $("#webgpu-option").toggle(await isWebGPUSupported());
    })();

    const renderResSelect = $<HTMLSelectElement>("#render-res-select")[0];
    renderResSelect.addEventListener("input", () => {
        GAME_CONSOLE.setBuiltInCVar("cv_renderer_res", renderResSelect.value as unknown as "auto" | "0.5" | "1" | "2" | "3");
    });
    renderResSelect.value = GAME_CONSOLE.getBuiltInCVar("cv_renderer_res");

    $("#toggle-high-res").parent().parent().toggle(!game.inputManager.isMobile);
    addCheckboxListener("#toggle-high-res", "cv_high_res_textures");
    addCheckboxListener("#toggle-cooler-graphics", "cv_cooler_graphics");

    GAME_CONSOLE.variables.addChangeListener(
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
}

function setupUIScale(game: Game): void {
    const { ui } = game.uiManager;

    function updateUiScale(): void {
        const scale = GAME_CONSOLE.getBuiltInCVar("cv_ui_scale");
        ui.gameUi.width(window.innerWidth / scale);
        ui.gameUi.height(window.innerHeight / scale);
        ui.gameUi.css("transform", `scale(${scale})`);
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

    if (game.inputManager.isMobile) {
        $("#ui-scale-container").hide();
        GAME_CONSOLE.setBuiltInCVar("cv_ui_scale", 1);
    }
}

function setupMapSettings(game: Game): void {
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

    GAME_CONSOLE.variables.addChangeListener(
        "cv_map_expanded",
        (_, newValue) => {
            game.map.expanded = newValue;
        }
    );
}

function setupGeneralSettings(game: Game): void {
    const { ui } = game.uiManager;

    addCheckboxListener("#toggle-scope-looping", "cv_loop_scope_selection");
    addCheckboxListener("#toggle-autopickup", "cv_autopickup");
    $("#toggle-autopickup").parent().parent().toggle(game.inputManager.isMobile);
    addCheckboxListener("#toggle-autopickup-dual-guns", "cv_autopickup_dual_guns");
    $("#toggle-autopickup-dual-guns").parent().parent().toggle(game.inputManager.isMobile);
    addCheckboxListener("#toggle-anonymous-player", "cv_anonymize_player_names");
    addCheckboxListener("#toggle-hide-emote", "cv_hide_emotes");
    addCheckboxListener("#toggle-camera-shake", "cv_camera_shake_fx");
    addCheckboxListener("#toggle-antialias", "cv_antialias");
    addCheckboxListener("#toggle-movement-smoothing", "cv_movement_smoothing");
    addCheckboxListener("#toggle-responsive-rotation", "cv_responsive_rotation");

    addCheckboxListener("#toggle-leave-warning", "cv_leave_warning");

    const splashUi = $<HTMLInputElement>("#splash-ui");
    addCheckboxListener(
        "#toggle-blur-splash",
        "cv_blur_splash",
        value => {
            splashUi.toggleClass("blur", value);
        }
    );
    splashUi.toggleClass("blur", GAME_CONSOLE.getBuiltInCVar("cv_blur_splash"));

    const button = $<HTMLButtonElement>("#btn-rules, #rules-close-btn");
    addCheckboxListener(
        "#toggle-hide-rules",
        "cv_hide_rules_button",
        value => {
            button.toggle(!value);
        }
    );
    button.toggle(!GAME_CONSOLE.getBuiltInCVar("cv_hide_rules_button"));

    $(".checkbox-setting").has("#toggle-hide-rules").toggle(GAME_CONSOLE.getBuiltInCVar("cv_rules_acknowledged"));

    $("#rules-close-btn").on("click", () => {
        button.hide();
        GAME_CONSOLE.setBuiltInCVar("cv_hide_rules_button", true);
        $<HTMLInputElement>("#toggle-hide-rules").prop("checked", true);
    }).toggle(GAME_CONSOLE.getBuiltInCVar("cv_rules_acknowledged") && !GAME_CONSOLE.getBuiltInCVar("cv_hide_rules_button"));
}

function setupMobileControls(game: Game): void {
    const { uiManager: { ui }, inputManager } = game;

    if (inputManager.isMobile) {
        addCheckboxListener("#toggle-mobile-controls", "mb_controls_enabled");
        addSliderListener("#slider-joystick-size", "mb_joystick_size");
        addSliderListener("#slider-joystick-transparency", "mb_joystick_transparency");
        addSliderListener("#slider-gyro-angle", "mb_gyro_angle");
        addCheckboxListener("#toggle-haptics", "mb_haptics");
        addCheckboxListener("#toggle-high-res-mobile", "mb_high_res_textures");

        ui.spectatingContainer.addClass("mobile-mode");
        ui.spectatingContainer.css({
            width: "150px",
            position: "fixed",
            top: "15%",
            left: "5rem"
        });

        ui.btnPlayAgainSpectating.html("<i class=\"fa-solid fa-rotate-right\"></i>");
        ui.spectateKillLeader.html("<i class=\"fa-solid fa-crown\"></i>");
        ui.spectateKillLeader.addClass("btn-spectate-kill-leader");
        ui.btnSpectateMenu.html("<i class=\"fa-solid fa-bars\"></i>");
        ui.btnSpectateMenu.addClass("btn-success");

        ui.interactMsg.on("click", () => {
            inputManager.addAction(game.uiManager.action.active ? InputActions.Cancel : InputActions.Interact);
        });
        ui.interactKey.html('<img src="./img/misc/tap-icon.svg" alt="Tap">');
        ui.activeAmmo.on("click", () => GAME_CONSOLE.handleQuery("reload", "never"));
        ui.emoteWheel.css("top", "50%").css("left", "50%");
        ui.menuButton.on("click", () => ui.gameMenu.fadeToggle(250));

        // handle emote-wheel for mobile
        ui.emoteButton.on("click", (event) => {
            event.stopPropagation();
            ui.emoteWheel.toggle(150);
        
            $(document).one("click", (event) => {
                // 1. click outside wheel
                if (!$(event.target).closest(ui.emoteWheel).length) {
                    ui.emoteWheel.hide();                            
                }

                // 2. click button X
                if ($(event.target).closest(".button-center").length) {
                    ui.emoteWheel.hide();                            
                }
            })
        });
    }

    $("#tab-mobile").toggle(isMobile.any);
}

function setupEmoteWheel(game: Game): void {
    const { uiManager: { ui }, inputManager } = game;

    const createEmoteWheelListener = (slot: typeof EMOTE_SLOTS[number], emoteSlot: number): void => {
        $(`#emote-wheel .emote-${slot}`).on("click", () => {
            // alert(emoteSlot)
            ui.emoteWheel.hide();

            if (inputManager.pingWheelActive) {
                const ping = game.uiManager.mapPings[emoteSlot];
                
                if (game.map.expanded && ping && inputManager.pingWheelActive) {
                    inputManager.addAction({
                        type: InputActions.MapPing,
                        ping,
                        position: inputManager.pingWheelPosition
                    });
                }
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
}

function setupInventorySlots(game: Game): void {
    const { inputManager } = game;
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

    const slotListener = (element: JQuery<HTMLDivElement>, listener: (button: number) => void): void => {
        element[0].addEventListener("pointerdown", (e: PointerEvent): void => {
            listener(e.button);
            e.stopPropagation();
        });
    };


    // render scopes
    {
        const listenerEvent = (ele: JQuery<HTMLDivElement>, scope: ScopeDefinition) => {
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
        }

        for (const scope of Scopes.definitions) {
            if (game.inputManager.isMobile) {
                const ele = $<HTMLDivElement>(
                    `<div class="card-scopes" id="${scope.idString}-slot" style="display: none;">
                        ${scope.name.split(" ")[0]}
                    </div>`
                );
                
                $<HTMLDivElement>("#scopes-container-mobile").append(ele);
                
                listenerEvent(ele, scope);
            } else {
                const ele = $<HTMLDivElement>(
                    `<div class="inventory-slot item-slot" id="${scope.idString}-slot" style="display: none;">
                        <img class="item-image" src="./img/game/shared/loot/${scope.idString}.svg" draggable="false">
                        <div class="item-tooltip">${scope.name.split(" ")[0]}</div>
                    </div>`
                );

                $<HTMLDivElement>("#scopes-container").append(ele);

                listenerEvent(ele, scope);
            }
        }
    }

    // render ui-inventory
    {
        // medicals
        $<HTMLDivElement>("#medicals-container").append(
            HealingItems.definitions.map(item => {
                const ele = $<HTMLDivElement>(
                    html`<div class="inventory-items-card inventory-items-medicals-card" id="${item.idString}-slot">
                        <img class="item-image" src="./img/game/shared/loot/${item.idString}.svg" draggable="false">
                        <span class="item-count" id="${item.idString}-count">0</span>
                         <div class="item-tooltip">
                            ${getTranslatedString(
                            'tt_restores',
                            {
                                item: `<b>${getTranslatedString(item.idString as TranslationKeys)}</b><br>`,
                                amount: item.restoreAmount.toString(),
                                type: item.healType === HealType.Adrenaline
                                    ? getTranslatedString("adrenaline")
                                    : getTranslatedString("health"),
                                desc: getTranslatedString(`${item.idString}_desc` as TranslationKeys)
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
        
        // ammos
        for (const ammo of Ammos) {
            if (ammo.ephemeral) continue;
    
            const ele = $<HTMLDivElement>(
                `<div class="inventory-items-card inventory-items-ammos-card" id="${ammo.idString}-slot">
                    <img class="item-image" src="./img/game/shared/loot/${ammo.idString}.svg" draggable="false">
                    <span class="item-count" id="${ammo.idString}-count">0</span>
                </div>`
            );
    
            if(ammo.hideUnlessPresent){
                $<HTMLDivElement>("#special-ammo-container").append(ele);
            }

            if(!ammo.hideUnlessPresent){
                $<HTMLDivElement>("#ammo-container").append(ele);
            }
    
            ele[0].addEventListener("pointerup", () => {
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

        // weapons
        $<HTMLDivElement>("#weapons-container").append(
            ...Array.from(
                { length: GameConstants.player.maxWeapons },
                (_, slot) => {
                    const ele = $<HTMLDivElement>(
                        `<div class="inventory-items-weapons-container" id="weapon-slot-${slot + 1}">
                            <img class="item-image" draggable="false" />

                            <div class="inventory-items-weapons-container-slot">
                                <div class="inventory-items-weapons-container-slot-container">
                                    <img class="item-ammo" />
                                    <span class="slot-number">${slot + 1}</span>
                                </div>
                                <span class="item-name"></span>
                            </div>
                        </div>`
                    );

                    const isGrenadeSlot = GameConstants.player.inventorySlotTypings[slot] === ItemType.Throwable;
                    const element = ele[0];

                    element.addEventListener("pointerup", () => clearTimeout(dropTimer));

                    element.addEventListener("pointerdown", e => {
                        if (!ele.hasClass("has-item")) return;

                        e.stopImmediatePropagation();

                        inputManager.addAction({
                            type: e.button === 2 ? InputActions.DropWeapon : InputActions.EquipItem,
                            slot
                        });

                        if (
                            isGrenadeSlot
                            && game.activePlayer?.activeItem.itemType === ItemType.Throwable
                            && e.button !== 2
                        ) {
                            inputManager.cycleThrowable(1);
                        }

                        mobileDropItem(e.button, true, undefined, slot);
                    });
                    return ele;
                }
            )
        );
    }

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
        $(perkSlot)[0].addEventListener("pointerdown", function (e: PointerEvent): void {
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
}

function setupSpectateOptions(game: Game): void {
    const { ui } = game.uiManager;
    const optionsIcon = $("#btn-spectate-options-icon");
    $<HTMLButtonElement>("#btn-spectate-options").on("click", () => {
        ui.spectatingContainer.toggle();

        if (game.inputManager.isMobile) ui.spectatingContainer.toggleClass("mobile-visible");

        const visible = ui.spectatingContainer.is(":visible");
        optionsIcon
            .toggleClass("fa-eye", !visible)
            .toggleClass("fa-eye-slash", visible);
    });
}

function setupGameInteraction(game: Game): void {
    const { ui } = game.uiManager;
    ui.game.on("contextmenu", e => { e.preventDefault(); });

    window.addEventListener("beforeunload", (e: Event) => {
        if (ui.canvas.hasClass("active") && GAME_CONSOLE.getBuiltInCVar("cv_leave_warning") && !game.gameOver) {
            e.preventDefault();
        }
    });

    GAME_CONSOLE.variables.addChangeListener(
        "cv_draw_hud",
        (_, newVal) => {
            ui.gameUi.toggle(newVal);
            game.map.visible = !GAME_CONSOLE.getBuiltInCVar("cv_minimap_minimized") && newVal;
        }
    );
    addCheckboxListener("#toggle-draw-hud", "cv_draw_hud");
}


export async function setupGame(game: Game): Promise<void> {
    setupMenuButtons(game);
    setupSpectateControls(game);
    setupKeyboardControls(game);
    setupGameModeStyles(game);
    setupCrosshair(game);
    setupAudioControls(game);
    setupDebugReadouts(game);
    setupKillFeedAndWeaponSlots(game);
    setupRenderSettings(game);
    setupUIScale(game);
    setupMapSettings(game);
    setupGeneralSettings(game);
    setupMobileControls(game);
    setupEmoteWheel(game);
    setupInventorySlots(game);
    setupSpectateOptions(game);
    setupGameInteraction(game);

    // Setup outside
    setUpCommands(game);
}
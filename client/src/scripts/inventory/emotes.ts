import $ from 'jquery';
import { EMOTE_SLOTS } from "@common/constants";
import { EmoteCategory, Emotes, type EmoteDefinition } from "@common/definitions/emotes";
import { getTranslatedString } from "../../translations";
import type { ReferenceTo } from "@common/utils/objectDefinitions";
import type { TranslationKeys } from "../../typings/translations";
import { Account } from '../account';
import { GAME_CONSOLE } from '../..';
import { SurvivAssets } from '@common/blockchain';
import { SurvivAssetBalances } from '.';

export async function showEmotes(account: Account) {
    if (!account.address) {
        return;
    }

    const userEmoteBalance = Object.entries(SurvivAssetBalances[SurvivAssets.Emotes]);
    const userEmotes = Object.keys(userEmoteBalance.find(([index, _]) => index === "0")?.[1] || {});

    // Cache jQuery selectors for performance
    const emoteList = $("#emotes-list");
    const customizeEmote = $("#emote-customize-wheel");
    const bottomEmoteUiCache: Partial<Record<typeof EMOTE_SLOTS[number], JQuery<HTMLSpanElement>>> = {};
    const emoteWheelUiCache: Partial<Record<typeof EMOTE_SLOTS[number], JQuery<HTMLDivElement>>> = {};

    // Handle emote slot clearing
    function handleEmote(slot: "win" | "death"): void {
        const cvar = `cv_loadout_${slot}_emote` as const;
        const emoteSlot = $(`#emote-wheel-container .emote-${slot}`);
        const emote = $(`#emote-wheel-bottom .emote-${slot} .fa-xmark`);

        emote.on("click", () => {
            GAME_CONSOLE.setBuiltInCVar(cvar, "");
            emoteSlot.css("background-image", "none");
            emote.hide();
        });

        if (!GAME_CONSOLE.getBuiltInCVar(cvar)) emote.hide();
    }

    handleEmote("win");
    handleEmote("death");

    let selectedEmoteSlot: typeof EMOTE_SLOTS[number] | undefined;

    function updateEmotesList(): void {
        emoteList.empty();

        // Add category header
        emoteList.append(
            $<HTMLDivElement>(
                `<div class="emote-list-header">Emotes</div>`
            )
        );

        const emotes = Emotes.definitions;

        // Group emotes by category
        const categoryMap = new Map<EmoteCategory, EmoteDefinition[]>();
        for (const emote of emotes) {
            if (!categoryMap.has(emote.category)) {
                categoryMap.set(emote.category, []);
            }
            categoryMap.get(emote.category)!.push(emote);
        }

        // Loop through each category
        for (const [category, emoteDefs] of categoryMap.entries()) {

            // None emote
            const nonEmoteItem = $<HTMLDivElement>(
                `<div id="emote-none" class="emotes-list-item-container">
                    <div id="none-emote" class="emotes-list-item"style="opacity: 0.5"><i class="fa-solid fa-ban"></i></div>
                    <span class="emote-name">None</span>
                </div>`
            );

            // Add click handler for the none-emote
            nonEmoteItem.on("click", () => {
                if (selectedEmoteSlot === undefined) return;

                // Clear only the selected emote slot
                $(".emotes-list-item-container").removeClass("selected");
                nonEmoteItem.addClass("selected");

                // Clear the console variable for the selected slot
                GAME_CONSOLE.setBuiltInCVar(`cv_loadout_${selectedEmoteSlot}_emote`, "");

                // Update only the selected emote slot UI
                const wheelElement = emoteWheelUiCache[selectedEmoteSlot];
                const bottomElement = bottomEmoteUiCache[selectedEmoteSlot];

                if (wheelElement) {
                    wheelElement.css("background-image", "none");
                }
                if (bottomElement) {
                    bottomElement.hide();
                }
            });

            emoteList.append(nonEmoteItem);


            // Sort: owned first, then unowned
            const sortedEmotes = [...emoteDefs].sort((a, b) => {
                const aOwned = userEmotes.includes(a.idString);
                const bOwned = userEmotes.includes(b.idString);
                return Number(bOwned) - Number(aOwned); // owned = true -> 1
            });

            for (const emote of sortedEmotes) {
                const idString = emote.idString;
                const isOwned = userEmotes.includes(idString);

                const emoteItem = $<HTMLDivElement>(
                    `<div id="emote-${idString}" class="emotes-list-item-container${isOwned ? '' : ' unowned'}">
                    <div class="emotes-list-item" style="background-image: url(./img/game/shared/emotes/${idString}.svg)${isOwned ? '' : '; opacity: 0.5; filter: grayscale(100%)'}"></div>
                    <span class="emote-name">${getTranslatedString(`emote_${idString}` as TranslationKeys)}</span>
                </div>`
                );

                if (isOwned) {
                    emoteItem.on("click", () => {
                        if (selectedEmoteSlot === undefined) return;

                        const cvarName = selectedEmoteSlot;
                        (
                            bottomEmoteUiCache[cvarName] ??= $((`#emote-wheel-bottom .emote-${cvarName} .fa-xmark` as const))
                        ).show();

                        GAME_CONSOLE.setBuiltInCVar(`cv_loadout_${cvarName}_emote`, emote.idString);

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
                } else {
                    emoteItem.css("cursor", "not-allowed");
                }

                emoteList.append(emoteItem);
            }
        }
    }

    updateEmotesList();

    function changeEmoteSlotImage(slot: typeof EMOTE_SLOTS[number], emote: ReferenceTo<EmoteDefinition>): JQuery<HTMLDivElement> {
        return (emoteWheelUiCache[slot] ??= $(`#emote-wheel-container .emote-${slot}`)).css(
            "background-image",
            emote ? `url("./img/game/shared/emotes/${emote}.svg")` : "none"
        );
    }

    for (const slot of EMOTE_SLOTS) {
        const cvar = `cv_loadout_${slot}_emote` as const;
        const emote = GAME_CONSOLE.getBuiltInCVar(cvar);

        GAME_CONSOLE.variables.addChangeListener(cvar, (_, newEmote) => {
            changeEmoteSlotImage(slot, newEmote);
        });

        changeEmoteSlotImage(slot, emote).on("click", () => {
            if (selectedEmoteSlot === slot) return;

            if (selectedEmoteSlot) {
                (emoteWheelUiCache[selectedEmoteSlot] ??= $(`#emote-wheel-container .emote-${selectedEmoteSlot}`)).removeClass("selected");
            }

            selectedEmoteSlot = slot;
            updateEmotesList();

            customizeEmote.css(
                "background-image",
                EMOTE_SLOTS.indexOf(slot) > 3
                    ? "url('/img/misc/emote_wheel.svg')"
                    : `url("./img/misc/emote_wheel_highlight_${slot}.svg"), url("/img/misc/emote_wheel.svg")`
            );

            (emoteWheelUiCache[slot] ??= $(`#emote-wheel-container .emote-${slot}`)).addClass("selected");
            $(`.emotes-list-item-container`).removeClass("selected");

            // Handle selection state for current emote or none option
            const currentEmote = GAME_CONSOLE.getBuiltInCVar(cvar);
            if (currentEmote) {
                $(`#emote-${currentEmote}`).addClass("selected");
            } else {
                $("#emote-none").addClass("selected");
            }
        });

        (emoteWheelUiCache[slot] ??= $(`#emote-wheel-container .emote-${slot}`)).children(".remove-emote-btn").on("click", () => {
            GAME_CONSOLE.setBuiltInCVar(cvar, "");
            (emoteWheelUiCache[slot] ??= $(`#emote-wheel-container .emote-${slot}`)).css("background-image", "none");
        });
    }
}



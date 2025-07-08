import $ from 'jquery';
import { EMOTE_SLOTS } from "@common/constants";
import type { Game } from "../game";
import { EmoteCategory, Emotes, freeEmotes, type EmoteDefinition } from "@common/definitions/emotes";
import { TRANSLATIONS, getTranslatedString } from "../../translations";
import type { ReferenceTo } from "@common/utils/objectDefinitions";
import type { TranslationKeys } from "../../typings/translations";

export function showEmotes(game: Game) {

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
                        `<div class="emote-list-header">${getTranslatedString(`emotes_category_${EmoteCategory[emote.category]}` as TranslationKeys)
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
}

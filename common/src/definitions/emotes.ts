import { createTemplate, ObjectDefinitions, type ObjectDefinition } from "../utils/objectDefinitions";

export enum EmoteCategory {
    Memes,
}

export interface EmoteDefinition extends ObjectDefinition {
    readonly category: EmoteCategory
    readonly isTeamEmote?: boolean
    readonly isWeaponEmote?: boolean
}

const emote = createTemplate<EmoteDefinition>()((name: string, category: EmoteCategory) => ({
    idString: name.toLowerCase().replace(/ /g, "_"),
    name,
    category
}));

export const freeEmotes: string[] = [
    ""
];

export const Emotes = ObjectDefinitions.create<EmoteDefinition>("Emotes", [
    ...[
        "Suroi Logo",
        "AEGIS Logo",
        "Flint Logo",
        "Duel",
        "Chicken Dinner",
        "Trophy"
    ].map(name => emote([name, EmoteCategory.Memes]))
]);

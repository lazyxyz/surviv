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

export const Emotes = ObjectDefinitions.create<EmoteDefinition>("Emotes", [
    ...[
        "Abuse",
        "Bang",
        "Forever Alone",
        "Fuuuu",
        "Gangnam Style",
        "Giggle Meme",
        "Laughing",
        "Meow Meme",
        "Noice",
        "Nood",
        "Oh No",
        "Orange Smile",
        "Really",
        "Rip",
        "Sad",
        "Sick",
        "So Small",
        "Boykisser",
        "Stare Dad",
        "The Pain",
        "Thumbs Down",
        "Thumbs Up",
        "Chicken Dinner",
        "Clown",
        "Dog Thumb Down",
        "Dont Care",
        "Somdudu Anger",
        "Somdudu Lol",
        "Somnia Different",
        "Somnia Glance",
        "Somnia Good",
        "Somnia Laugh",
        "Somnia Speed",
        "Somnia Troll",
    ].map(name => emote([name, EmoteCategory.Memes]))
]);

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
        "Fire",
        "Forever Alone",
        "Froog",
        "Fuuuu",
        "Gangnam Style",
        "Giggle Meme",
        "Headshot",
        "Laughing",
        "Leosmug",
        "Meow Meme",
        "Bleh",
        "Noice",
        "Nood",
        "Oh No",
        "Orange Smile",
        "Pog",
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
        "Clueless",
        "Dog Thumb Down",
        "Dont Care",
        "Fart",
        "Somdudu Anger",
        "Somdudu Lol",
        "Somnia Angry",
        "Somnia Different",
        "Somnia Glance",
        "Somnia Good",
        "Somnia Laugh",
        "Somnia Mad",
        "Somnia Speed",
        "Somnia Troll",
        "Somnia Wink",
        "Somnia Worry"
    ].map(name => emote([name, EmoteCategory.Memes]))
]);

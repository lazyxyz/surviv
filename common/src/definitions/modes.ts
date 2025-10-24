import { type ReferenceTo } from "../utils/objectDefinitions";
import { type ScopeDefinition } from "./scopes";

export type ColorKeys = "grass" | "water" | "border" | "beach" | "riverBank" | "trail" | "gas" | "void";

export interface ModeDefinition {
    readonly idString: string
    readonly colors: Record<ColorKeys, string>
    readonly inheritTexturesFrom?: MAP | MAP[]
    readonly specialMenuMusic?: boolean
    readonly ambience?: string
    readonly specialSounds?: string[]
    readonly defaultScope?: ReferenceTo<ScopeDefinition>
    readonly reskin?: string
    readonly darkShaders?: boolean
    // will be multiplied by the bullet trail color
    readonly bulletTrailAdjust?: string
    readonly particleEffects?: {
        readonly frames: string | string[]
        readonly delay: number
        readonly tint?: number
        readonly gravity?: boolean
    }
    readonly specialPlayButtons?: boolean
    // icons for the mode
    readonly modeLogoImage?: string | { solo: string, squads: string }
}

export type MAP = "normal" | "fall" | "winter" | "desert" | "cursedIsland";

export const ModeToNumber: Record<MAP, number> = {
    normal: 0,
    fall: 1,
    winter: 2,
    desert: 3,
    cursedIsland: 4,
};

export const NumberToMode: Record<number, MAP> = {
    0: "normal",
    1: "fall",
    2: "winter",
    3: "desert",
    4: "cursedIsland"
};

export function getRandomMode(): MAP {
    const modes: MAP[] = ["normal", "fall", "winter", "desert", "cursedIsland"];
    return modes[Math.floor(Math.random() * modes.length)];
}

export const Maps: Record<MAP, ModeDefinition> = {
    normal: {
        idString: "normal",
        colors: {
            grass: "hsl(95, 41%, 38%)",
            water: "hsl(211, 63%, 42%)",
            border: "hsl(211, 63%, 30%)",
            beach: "hsl(40, 39%, 55%)",
            riverBank: "hsl(34, 41%, 32%)",
            trail: "hsl(35, 50%, 40%)",
            gas: "hsla(17, 100%, 50%, 0.55)",
            void: "hsl(25, 80%, 6%)"
        },
        reskin: "normal"
    },
    fall: {
        idString: "fall",
        colors: {
            grass: "hsl(62, 42%, 32%)",
            water: "hsl(211, 63%, 42%)",
            border: "hsl(211, 63%, 30%)",
            beach: "hsl(40, 39%, 55%)",
            riverBank: "hsl(33, 50%, 30%)",
            trail: "hsl(35, 50%, 40%)",
            gas: "hsla(17, 100%, 50%, 0.55)",
            void: "hsl(25, 80%, 6%)"
        },
        ambience: "wind_ambience",
        defaultScope: "2x_scope",
        reskin: "fall",
        particleEffects: {
            frames: ["leaf_particle_1", "leaf_particle_2", "leaf_particle_3"],
            delay: 1000
        },
        specialPlayButtons: true,
        // Icons
        modeLogoImage: {
            solo: "./img/misc/user.svg",
            squads: "./img/misc/user-group.svg"
        },
    },
    winter: {
        idString: "winter",
        colors: {
            grass: "hsl(210, 18%, 82%)",
            water: "hsl(211, 63%, 42%)",
            border: "hsl(208, 94%, 45%)",
            beach: "hsl(210, 18%, 75%)",
            riverBank: "hsl(210, 18%, 70%)",
            trail: "hsl(35, 50%, 40%)",
            gas: "hsla(17, 100%, 50%, 0.55)",
            void: "hsl(25, 80%, 6%)"
        },
        specialMenuMusic: true,
        specialSounds: [
            "airdrop_plane"
        ],
        reskin: "winter",
        ambience: "snowstorm",
        inheritTexturesFrom: "normal",
        bulletTrailAdjust: "hsl(0, 50%, 80%)",
        particleEffects: {
            frames: ["snow_particle"],
            delay: 800,
            gravity: true
        },
        specialPlayButtons: true,
        modeLogoImage: "./img/game/winter/obstacles/red_gift.svg"
    },
    desert: {
        idString: "fall",
        colors: {
            grass: "hsl(42.94, 87.93%, 77.25%)",
            water: "hsl(211, 63%, 42%)",
            border: "hsl(211, 63%, 30%)",
            beach: "hsl(40, 39%, 55%)",
            riverBank: "hsl(33, 50%, 30%)",
            trail: "hsl(35, 50%, 40%)",
            gas: "hsla(17, 100%, 50%, 0.55)",
            void: "hsl(25, 80%, 6%)"
        },
        ambience: "wind_ambience",
        inheritTexturesFrom: "fall",
        defaultScope: "2x_scope",
        reskin: "fall",
        particleEffects: {
            frames: ["weed_1", "weed_2"],
            delay: 1000,
        },
        specialPlayButtons: true,
        // Icons
        modeLogoImage: {
            solo: "./img/misc/user.svg",
            squads: "./img/misc/user-group.svg"
        },
    },
   
    cursedIsland: {
        idString: "fall",
        colors: {
            grass: "hsl(42.94, 87.93%, 77.25%)",
            water: "hsl(211, 63%, 42%)",
            border: "hsl(211, 63%, 30%)",
            beach: "hsl(40, 39%, 55%)",
            riverBank: "hsl(33, 50%, 30%)",
            trail: "hsl(35, 50%, 40%)",
            gas: "hsla(17, 100%, 50%, 0.55)",
            void: "hsl(25, 80%, 6%)"
        },
        ambience: "wind_ambience",
        inheritTexturesFrom: "desert",
        reskin: "desert",
        particleEffects: {
            frames: ["weed_1", "weed_2"],
            delay: 1000,
        },
        specialPlayButtons: true,
        // Icons
        modeLogoImage: {
            solo: "./img/misc/user.svg",
            squads: "./img/misc/user-group.svg"
        },
    },
};
export const ObstacleModeVariations: Partial<Record<MAP, string>> = {
    winter: "_winter"
};
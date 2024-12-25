import { GameConstants, Layer } from "@common/constants";
import { Modes, type ColorKeys } from "@common/definitions/modes";
import { Color } from "pixi.js";

export const FORCE_MOBILE = false;
export const UI_DEBUG_MODE = false;
export const HITBOX_DEBUG_MODE = false;
export const DIFF_LAYER_HITBOX_OPACITY = 0;
export const FOOTSTEP_HITBOX_LAYER = Layer.Ground;

export const LAYER_TRANSITION_DELAY = 200;
export const SOUND_FILTER_FOR_LAYERS = true; // TODO: test this, unsure if it glitches the sound manager. From testing in test server most of the times the sound would cut off and glitch.

export const HITBOX_COLORS = {
    obstacle: new Color("red"),
    obstacleNoCollision: new Color("yellow"),
    stair: new Color("white"),
    spawnHitbox: new Color("orange"),
    buildingZoomCeiling: new Color("purple"),
    buildingScopeCeiling: new Color("cyan"),
    buildingVisOverride: new Color("teal"),
    bulletMask: new Color("fuchsia"),
    landHitbox: new Color("orangered"),
    loot: new Color("magenta"),
    player: new Color("blue"),
    playerWeapon: new Color("lime")
};

export const MODE = Modes[GameConstants.modeName];

// Converts the strings in the mode definition to Color objects
export const COLORS = (Object.keys(MODE.colors) as ColorKeys[])
    .reduce(
        (result, key) => {
            result[key] = new Color(MODE.colors[key]);
            return result;
        },
        {} as Record<ColorKeys, Color>
    );

export const GHILLIE_TINT = COLORS.grass.multiply(new Color("hsl(0, 0%, 99%)"));

export const TEAMMATE_COLORS = [
    new Color("#00ffff"),
    new Color("#ff00ff"),
    new Color("#ffff00"),
    new Color("#ff8000")
];

export const PIXI_SCALE = 20;

export const WALL_STROKE_WIDTH = 8;

export const EMOTE_SLOTS = ["top", "right", "bottom", "left", "win", "death"] as const;

export const SHOCKWAVE_EXPLOSION_MULTIPLIERS = Object.freeze({
    time: 5,
    amplitude: 1,
    wavelength: 1,
    speed: 100
});

export const BULLET_WHIZ_SCALE = 5;

export const SELECTOR_WALLET = "SELECTOR_WALLET";
export const PUBLIC_KEY = "PUBLIC_KEY";

export enum WalletType {
    METAMASK = "MetaMask",
    TRUSTWALLET = "Trust Wallet",
    COINBASEWALLET = "Coinbase Wallet",
    SUBWALLET = "SubWallet"
}

/**
  @function shorten(hash: string, length: number)
    - Ex: hash = 6 (123n to 6)
          length = 2

    - summary:
      get length of input (hash)
      slice hash point start 0 that number will reviced 12 by input (hash)
      identifying where middle it needs "..." string now we've 12...
      step end slice at point last with recipe "123456".slice(-length) result should to be 56,
      right now, compound we will have result equal 12..56
*/
export const shorten = (hash: string, length = 6): string => {
    const prefix = hash.slice(0, length);
    const middle = "...";
    const suffixed = hash.slice(-length);

    return prefix + middle + suffixed;
};

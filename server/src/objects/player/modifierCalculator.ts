import { type PlayerModifiers, defaultModifiers, ItemType, type EventModifiers, type ExtendedWearerAttributes, type WearerAttributes } from "@common/utils/objectDefinitions";
import { Numeric } from "@common/utils/math";
import { GameConstants } from "@common/constants";
import { PerkIds } from "@common/definitions/perks";
import { type Player } from "../player";  // Adjust import
import { MeleeItem } from "../../inventory/meleeItem";

export class ModifierCalculator {
    constructor(private player: Player) {}

    private _calculateModifiers(): PlayerModifiers {
        const newModifiers = defaultModifiers();
        const eventMods: EventModifiers = {
            kill: [],
            damageDealt: []
        };

        const maxWeapons = GameConstants.player.maxWeapons;
        for (let i = 0; i < maxWeapons; i++) {
            const weapon = this.player.inventory.getWeapon(i);

            if (weapon === undefined) continue;

            const modifiers = weapon.modifiers;

            newModifiers.maxAdrenaline *= modifiers.maxAdrenaline;
            newModifiers.maxHealth *= modifiers.maxHealth;
            newModifiers.baseSpeed *= modifiers.baseSpeed;
            newModifiers.size *= modifiers.size;
            newModifiers.adrenDrain *= modifiers.adrenDrain;

            newModifiers.minAdrenaline += modifiers.minAdrenaline;
            newModifiers.hpRegen += modifiers.hpRegen;
        }

        const applyModifiers = (modifiers: WearerAttributes): void => {
            newModifiers.maxHealth *= modifiers.maxHealth ?? 1;
            newModifiers.maxAdrenaline *= modifiers.maxAdrenaline ?? 1;
            newModifiers.baseSpeed *= modifiers.speedBoost ?? 1;
            newModifiers.size *= modifiers.sizeMod ?? 1;
            newModifiers.adrenDrain *= modifiers.adrenDrain ?? 1;

            newModifiers.minAdrenaline += modifiers.minAdrenaline ?? 0;
            newModifiers.hpRegen += modifiers.hpRegen ?? 0;
        };

        for (
            const [modifiers, count] of [
                [eventMods.kill, this.player._kills],
                [eventMods.damageDealt, this.player.damageDone]
            ] as const
        ) {
            for (const entry of modifiers) {
                const limit = Numeric.min(entry.limit ?? Infinity, count);

                for (let i = 0; i < limit; i++) {
                    applyModifiers(entry);
                }
            }
        }

        return newModifiers;
    }

    updateAndApplyModifiers(): void {
        const {
            maxHealth,
            maxAdrenaline,
            minAdrenaline,
            size
        } = this.player._modifiers = this._calculateModifiers();

        this.player.maxHealth = GameConstants.player.defaultHealth * maxHealth;
        this.player.maxAdrenaline = GameConstants.player.maxAdrenaline * maxAdrenaline;
        this.player.minAdrenaline = minAdrenaline;
        this.player.sizeMod = size;
    }
}
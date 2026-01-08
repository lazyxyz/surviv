// werewolf.ts
import { Layer, GameConstants, MODE } from "@common/constants";
import { Vector } from "@common/utils/vector";
import { Game } from "../../game";
import { Team } from "../../team";
import { ActorContainer } from "../player";
import { BehaviorType, Bot } from "./bot"; // Adjust path as needed
import { APS_LEVEL_MULT, calculateLevelStat, SPEED_LEVEL_MULT } from "./common";
import { MeleeItem } from "../../inventory/meleeItem";
import { DamageParams } from "../gameObject";

/**
 * Werewolf Class
 * Inherits from Bot with ProximityAttack behavior and enraged mode.
 * Each death in Bloody mode: level++, updates speedMult/apsMult/healthMax (speed increases!).
 */
export class Werewolf extends Bot {
    static NAMES = ["Werewolf", "Lycan", "Wolfman", "Beast", "Fang", "Howler", "Alpha", "Lupine"];
    static SKIN_ID = "werewolf";

    protected level: number = 1;
    protected baseMaxHealth: number = 0;  // Werewolf base (playerMax * 0.5)
    private default_weapon;

    constructor(game: Game, userData: ActorContainer, position: Vector, behaviorType = BehaviorType.ProximityAttack, layer?: Layer, team?: Team, level: number = 1) {
        super(game, userData, position, behaviorType, Werewolf.NAMES, Werewolf.SKIN_ID, layer, team);

        this.level = level;
        this.baseMaxHealth = this.maxHealth * 0.5;  // Scale down from player base
        this.baseChaseSpeed = GameConstants.player.baseSpeed * 0.5;
        this.wanderSpeed = GameConstants.player.baseSpeed * 0.3;
        this.baseAps = 2;
        this.enragedMultiplier = 1.5;
        this.enragedHealthThreshold = 0.5;

        this.updateLevelStats();
        this.health = this.maxHealth;  // Full health on spawn
        this.currentMoveDuration = this.getRandomMoveDuration();
        this.default_weapon = new MeleeItem("feral_claws", this);
        this.inventory.weapons[2] = this.default_weapon;
    }

    /**
     * Recalculates stats based on current level (called on init & level-up).
     * Increases: speedMult, apsMult, maxHealth (speed boost via speedMult!).
     */
    protected updateLevelStats(): void {
        const healthMult = calculateLevelStat(1, 0.05, this.level);
        this.speedMult = calculateLevelStat(1, SPEED_LEVEL_MULT, this.level);
        this.apsMult = calculateLevelStat(1, APS_LEVEL_MULT, this.level);

        this.maxHealth = this.baseMaxHealth * healthMult;
    }

    protected checkEnraged(): boolean {
        return this.health < this.maxHealth * this.enragedHealthThreshold;
    }

    override die(params: Omit<DamageParams, "amount">): void {
        super.die(params);  // Handles dead=true, onDie(), etc.

        if (this.game.gameMode === MODE.Bloody) {
            this.level += 2;
            this.updateLevelStats();  // Speed increased! (via speedMult)

            this.game.addTimeout(() => {
                this.damageHandler.resurrect({
                    meleeWeapon: this.default_weapon
                });  // Revives at NEW maxHealth/position?
            }, 7000);
        }
    }
}
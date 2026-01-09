// ninja.ts
import { Layer, GameConstants, MODE } from "@common/constants";
import { Vector } from "@common/utils/vector";
import { Game } from "../../game";
import { MeleeItem } from "../../inventory/meleeItem";
import { Team } from "../../team";
import { ActorContainer } from "../player";
import { BehaviorType, Bot } from "./bot"; // Adjust path as needed
import { APS_LEVEL_MULT, calculateLevelStat, SPEED_LEVEL_MULT } from "./common";
import { DamageParams } from "../gameObject";

/**
 * Ninja Class
 * Inherits from Bot with HideAndAttack behavior.
 * Each death in Bloody mode: level++, updates speedMult/apsMult/healthMax (speed increases!).
 */
export class Ninja extends Bot {
    protected behaviorType = BehaviorType.HideAndAttack;
    static NAMES = ["Shinobi", "Kage", "Ronin", "Shuriken", "Sai", "Katana", "Nighthawk", "Mist"];
    static SKIN_ID = "ninja";

    protected level: number = 1;
    protected baseMaxHealth: number = 0;  // Ninja base (playerMax * 0.7)
    private default_weapon;

    constructor(game: Game, userData: ActorContainer, position: Vector, behaviorType = BehaviorType.HideAndAttack, layer?: Layer, team?: Team, level: number = 1) {
        super(game, userData, position, behaviorType, Ninja.NAMES, Ninja.SKIN_ID, layer, team);

        this.level = level;
        this.baseMaxHealth = this.maxHealth * 0.7;  // Scale down from player base
        this.useAttackCooldown = false; // Ninjas attack constantly when chasing
        this.baseChaseSpeed = GameConstants.player.baseSpeed * 0.4;
        this.chaseDistance = 30;
        this.centerProximity = 100;
        this.minMoveDuration = 5;
        this.maxMoveDuration = 15;
        this.minDistanceToGas = 30;
        this.safeDistanceHideSpot = 0.5;
        this.radiusIncrement = 0.05;
        this.speedIncrement = 0.05;

        this.updateLevelStats();
        this.health = this.maxHealth;  // Full health on spawn
        this.default_weapon =  new MeleeItem("steelfang", this);
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


    override die(params: Omit<DamageParams, "amount">): void {
        super.die(params);  // Handles dead=true, onDie(), etc.

        if (this.game.gameMode === MODE.Bloody) {
            // LEVEL UP: +1 level → higher speedMult/apsMult/maxHealth
            this.level += 1;
            this.updateLevelStats();  // Speed increased! (via speedMult)

            this.game.addTimeout(() => {
                this.damageHandler.resurrect({
                    meleeWeapon: this.default_weapon
                });  // Revives at NEW maxHealth/position?
            }, 10000);
        }
    }
}
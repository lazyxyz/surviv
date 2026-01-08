// butcher.ts
import { Layer, GameConstants, MODE } from "@common/constants";
import { Vector } from "@common/utils/vector";
import { Game } from "../../game";
import { MeleeItem } from "../../inventory/meleeItem";
import { Team } from "../../team";
import { ActorContainer } from "../player";
import { BehaviorType, Bot } from "./bot";
import { APS_LEVEL_MULT, calculateLevelStat, SPEED_LEVEL_MULT } from "./common";
import { DamageParams } from "../gameObject";

/**
 * Butcher Class
 * Inherits from Bot with ChaseRandom behavior.
 * Each death in Bloody mode: level++, updates speedMult/apsMult/healthMax (speed increases!).
 */
export class Butcher extends Bot {
    static NAMES = ["Butcher", "Slaughterer", "Cleaver", "Reaper", "Hack", "Gore", "Mangler", "Carver"];
    static SKIN_ID = "skeleton";

    protected level: number = 1;
    protected baseMaxHealth: number = 0;  // Butcher base (playerMax * 0.8)
    private default_weapon;

    constructor(game: Game, userData: ActorContainer, position: Vector, behaviorType = BehaviorType.ChaseRandom,
        layer?: Layer, team?: Team, level: number = 1) {
        super(game, userData, position, behaviorType, Butcher.NAMES, Butcher.SKIN_ID, layer, team);

        this.level = level;
        this.baseMaxHealth = this.maxHealth * 0.8;  // Scale down from player base
        this.baseChaseSpeed = GameConstants.player.baseSpeed * 0.5;
        this.chaseDistance = 40;
        this.attackDistance = 40;
        this.target = this.pickNewTarget();

        this.updateLevelStats();
        this.health = this.maxHealth;  // Full health on spawn
        this.default_weapon = new MeleeItem("chainsaw", this);
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
            this.level += 2;
            this.updateLevelStats();  // Speed increased! (via speedMult)

            this.game.addTimeout(() => {
                this.damageHandler.resurrect({
                    meleeWeapon: this.default_weapon,
                });  // Revives at NEW maxHealth/position?
            }, 10000);
        }
    }
}
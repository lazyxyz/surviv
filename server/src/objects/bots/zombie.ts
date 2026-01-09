import { Layer, GameConstants, MODE } from "@common/constants";
import { Vector } from "@common/utils/vector";
import { Game } from "../../game";
import { Team } from "../../team";
import { ActorContainer } from "../player";
import { BehaviorType, Bot } from "./bot";
import { APS_LEVEL_MULT, calculateLevelStat, SPEED_LEVEL_MULT } from "./common";
import { randomFloat } from "@common/utils/random";
import { DamageParams } from "../gameObject";

/**
 * Zombie Class
 * Inherits from Bot with ProximityAttack behavior.
 * Each death in Bloody mode: level++, updates speedMult/apsMult/healthMax (speed increases!).
 */
export class Zombie extends Bot {
    static NAMES = ["Ghoul", "Walker", "Rotter", "Shambler", "Undead", "Zed", "Lurker", "Crawler"];
    static SKIN_ID = "zombie";

    protected level: number = 1;
    protected baseMaxHealth: number = 0;  // Zombie base (playerMax * 0.5)

    constructor(game: Game, userData: ActorContainer, position: Vector, behaviorType = BehaviorType.ProximityAttack, layer?: Layer, team?: Team, level: number = 1) {
        super(game, userData, position, behaviorType, Zombie.NAMES, Zombie.SKIN_ID, layer, team);

        this.level = level;
        this.baseMaxHealth = this.maxHealth * 0.5;  // Scale down from player base (e.g., 100 -> 50)
        this.baseChaseSpeed = GameConstants.player.baseSpeed * 0.3;
        this.wanderSpeed = GameConstants.player.baseSpeed * 0.3;
        this.baseAps = 1;

        this.updateLevelStats();
        this.health = this.maxHealth;  // Full health on spawn
        this.currentMoveDuration = this.getRandomMoveDuration();
    }

    /* *
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
        super.die(params);

        if (this.game.gameMode === MODE.Bloody) {
            this.level += 1;
            this.updateLevelStats();

            this.game.addTimeout(() => {
                this.damageHandler.resurrect();  // Revives at NEW maxHealth/position?
            }, 5000);
        }
    }
}
import { BehaviorType, Bot } from "./bot"; // Adjust path as needed
import { Explosions } from "@common/definitions/explosions";
import { Explosion } from "../explosion";
import { Layer, GameConstants } from "@common/constants";
import { randomFloat } from "@common/utils/random";
import { Vector } from "@common/utils/vector";
import { Game } from "../../game";
import { Team } from "../../team";
import { ActorContainer } from "../player";
import { APS_LEVEL_MULT, calculateLevelStat, SPEED_LEVEL_MULT } from "./common";

/**
 * Boomer Class
 * Inherits from Bot with ChaseRandom behavior and explosion on death.
 */
export class Boomer extends Bot {
    static NAMES = ["Boomer", "Exploder", "Detonator", "Burster", "Blast", "Kaboom", "Fuser", "Volatile"];
    static SKIN_ID = "zone"; // Assuming a boomer skin exists, adjust as needed

    private explosionDamageMod: number;

    constructor(game: Game, userData: ActorContainer, position: Vector, behaviorType = BehaviorType.ChaseRandom,
        layer?: Layer, team?: Team, level: number = 1) {
        super(game, userData, position, behaviorType, Boomer.NAMES, Boomer.SKIN_ID, layer, team);

        const healthMultiplier = calculateLevelStat(1, 0.05, level);
        this.speedMult = calculateLevelStat(1, SPEED_LEVEL_MULT, level);
        this.apsMult = calculateLevelStat(1, APS_LEVEL_MULT, level);

        this.health *= 0.8;
        this.health *= healthMultiplier;
        this.baseChaseSpeed = GameConstants.player.baseSpeed * 0.4;
        this.baseAps = 0.8;
        this.chaseDistance = 40;
        this.attackDistance = 40;
        this.explosionDamageMod = 0.5 * (1 + 0.1 * (level - 1));
        this.target = this.pickNewTarget();
    }

    protected onDie(): void {
        // Set dead first to prevent self-damage recursion in explosion
        this.dead = true;
        this.setDirty();

        this.game.totalBots--;
        this.dropLoot();
        const explosion = new Explosion(
            this.game,
            Explosions.fromString('barrel_explosion'),
            this.position,
            this,
            this.layer,
            undefined,
            this.explosionDamageMod
        );

        explosion.explode();

        this.dead = false;
    }
}
import { BehaviorType, Bot } from "./bot"; // Adjust path as needed
import { Explosions } from "@common/definitions/explosions";
import { Explosion } from "../explosion";
import { Layer, GameConstants } from "@common/constants";
import { randomFloat } from "@common/utils/random";
import { Vector } from "@common/utils/vector";
import { Game } from "../../game";
import { Team } from "../../team";
import { ActorContainer } from "../player";

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
        this.health *= 0.8;
        const healthMultiplier = 1 + 0.1 * (level - 1);
        this.health *= healthMultiplier;
        this.baseChaseSpeed = GameConstants.player.baseSpeed * 0.5;
        this.speedMult = 1 + 0.01 * (level - 1);
        this.baseAps = 0.8;
        this.apsMult = 1 + 0.02 * (level - 1);
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

    private dropLoot(): void {
        if (Math.random() < 0.05) {
            const amount = Math.floor(randomFloat(100, 200));
            this.game.addLoot('9mm', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.05) {
            const amount = Math.floor(randomFloat(40, 100));
            this.game.addLoot('12g', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.05) {
            const amount = Math.floor(randomFloat(80, 160));
            this.game.addLoot('556mm', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.05) {
            const amount = Math.floor(randomFloat(80, 160));
            this.game.addLoot('762mm', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.05) {
            const amount = Math.floor(randomFloat(40, 100));
            this.game.addLoot('50cal', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.05) {
            const amount = Math.floor(randomFloat(40, 100));
            this.game.addLoot('338lap', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.01) {
            this.game.addLoot('curadell', this.position, this.layer, { count: 1 });
        }
    }
}
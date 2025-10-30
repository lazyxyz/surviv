import { Layer, GameConstants } from "@common/constants";
import { randomFloat } from "@common/utils/random";
import { Vector } from "@common/utils/vector";
import { Game } from "../../game";
import { Team } from "../../team";
import { ActorContainer } from "../player";
import { BehaviorType, Bot } from "./bot"; // Adjust path as needed

/**
 * Werewolf Class
 * Inherits from Bot with ProximityAttack behavior and enraged mode.
 */
export class Werewolf extends Bot {
    static NAMES = ["Werewolf", "Lycan", "Wolfman", "Beast", "Fang", "Howler", "Alpha", "Lupine"];
    static SKIN_ID = "werewolf";

    constructor(game: Game, userData: ActorContainer, position: Vector, behaviorType = BehaviorType.ProximityAttack, layer?: Layer, team?: Team, level: number = 1) {
        super(game, userData, position, behaviorType, Werewolf.NAMES, Werewolf.SKIN_ID, layer, team);
        this.health *= 0.6;
        const healthMultiplier = 1 + 0.05 * (level - 1);
        this.health *= healthMultiplier;
        this.maxHealth = this.health;
        this.baseChaseSpeed = GameConstants.player.baseSpeed * 0.8;
        this.wanderSpeed = GameConstants.player.baseSpeed * 0.3;
        this.speedMult = 1 + 0.02 * (level - 1);
        this.baseAps = 1;
        this.apsMult = 1 + 0.03 * (level - 1);
        this.enragedMultiplier = 1.5;
        this.enragedHealthThreshold = 0.5;
        const randomCola = Math.random() < 0.3 ? 1 : 0;
        this.inventory.items.setItem('cola', randomCola);
        this.currentMoveDuration = this.getRandomMoveDuration();
    }

    protected checkEnraged(): boolean {
        return this.health < this.maxHealth * this.enragedHealthThreshold;
    }

    protected onDie(): void {
        this.game.totalBots--;
    }

    private dropLoot(): void {
        if (Math.random() < 0.01) {
            const amount = Math.floor(randomFloat(50, 100));
            this.game.addLoot('9mm', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.01) {
            const amount = Math.floor(randomFloat(20, 50));
            this.game.addLoot('12g', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.01) {
            const amount = Math.floor(randomFloat(40, 80));
            this.game.addLoot('556mm', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.01) {
            const amount = Math.floor(randomFloat(40, 80));
            this.game.addLoot('762mm', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.01) {
            const amount = Math.floor(randomFloat(20, 50));
            this.game.addLoot('50cal', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.01) {
            const amount = Math.floor(randomFloat(20, 50));
            this.game.addLoot('338lap', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.0005) {
            this.game.addLoot('curadell', this.position, this.layer, { count: 1 });
        }
    }
}

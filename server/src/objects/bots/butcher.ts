import { Layer, GameConstants } from "@common/constants";
import { randomFloat } from "@common/utils/random";
import { Vector } from "@common/utils/vector";
import { Game } from "../../game";
import { MeleeItem } from "../../inventory/meleeItem";
import { Team } from "../../team";
import { ActorContainer } from "../player";
import { BehaviorType, Bot } from "./bot";

/**
 * Butcher Class
 * Inherits from Bot with ChaseRandom behavior.
 */
export class Butcher extends Bot {
    static NAMES = ["Butcher", "Slaughterer", "Cleaver", "Reaper", "Hack", "Gore", "Mangler", "Carver"];
    static SKIN_ID = "skeleton";

    constructor(game: Game, userData: ActorContainer, position: Vector, behaviorType = BehaviorType.ChaseRandom,
        layer?: Layer, team?: Team, level: number = 1) {
        super(game, userData, position, behaviorType, Butcher.NAMES, Butcher.SKIN_ID, layer, team);
        this.health *= 0.4;
        const healthMultiplier = 1 + 0.05 * (level - 1);
        this.health *= healthMultiplier;
        this.baseChaseSpeed = GameConstants.player.baseSpeed * 0.6;
        this.speedMult = 1 + 0.02 * (level - 1);
        this.baseAps = 1.5;
        this.apsMult = 1 + 0.03 * (level - 1);
        this.chaseDistance = 40;
        this.attackDistance = 40;
        this.target = this.pickNewTarget();
        this.inventory.weapons[2] = new MeleeItem("chainsaw", this);
    }

    protected onDie(): void {
        this.game.totalBots--;
        this.dropLoot();
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
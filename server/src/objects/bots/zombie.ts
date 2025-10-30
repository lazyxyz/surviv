import { Layer, GameConstants } from "@common/constants";
import { Vector } from "@common/utils/vector";
import { Game } from "../../game";
import { Team } from "../../team";
import { ActorContainer } from "../player";
import { BehaviorType, Bot } from "./bot"; // Adjust path as needed

/**
 * Zombie Class
 * Inherits from Bot with ProximityAttack behavior.
 */
export class Zombie extends Bot {
    static NAMES = ["Ghoul", "Walker", "Rotter", "Shambler", "Undead", "Zed", "Lurker", "Crawler"];
    static SKIN_ID = "zombie";

    constructor(game: Game, userData: ActorContainer, position: Vector, behaviorType = BehaviorType.ProximityAttack, layer?: Layer, team?: Team, level: number = 1) {
        super(game, userData, position, behaviorType, Zombie.NAMES, Zombie.SKIN_ID, layer, team);
        this.health *= 0.5;
        const healthMultiplier = 1 + 0.05 * (level - 1);
        this.health *= healthMultiplier;
        this.baseChaseSpeed = GameConstants.player.baseSpeed * 0.5;
        this.wanderSpeed = GameConstants.player.baseSpeed * 0.3;
        this.speedMult = 1 + 0.02 * (level - 1);
        this.baseAps = 1;
        this.apsMult = 1 + 0.03 * (level - 1);
        this.currentMoveDuration = this.getRandomMoveDuration();
    }
}
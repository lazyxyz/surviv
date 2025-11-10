import { Layer, GameConstants } from "@common/constants";
import { randomFloat } from "@common/utils/random";
import { Vector } from "@common/utils/vector";
import { Game } from "../../game";
import { MeleeItem } from "../../inventory/meleeItem";
import { Team } from "../../team";
import { ActorContainer } from "../player";
import { BehaviorType, Bot } from "./bot";
import { APS_LEVEL_MULT, calculateLevelStat, SPEED_LEVEL_MULT } from "./common";

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

        const healthMultiplier = calculateLevelStat(1, 0.05, level);
        this.speedMult = calculateLevelStat(1, SPEED_LEVEL_MULT, level);
        this.apsMult = calculateLevelStat(1, APS_LEVEL_MULT, level);

        this.health *= 0.8;
        this.health *= healthMultiplier;
        this.baseChaseSpeed = GameConstants.player.baseSpeed * 0.5;
        this.chaseDistance = 40;
        this.attackDistance = 40;
        this.target = this.pickNewTarget();
        this.inventory.weapons[2] = new MeleeItem("chainsaw", this);
    }
}
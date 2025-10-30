import { Layer, GameConstants } from "@common/constants";
import { Vector } from "@common/utils/vector";
import { Game } from "../../game";
import { MeleeItem } from "../../inventory/meleeItem";
import { Team } from "../../team";
import { ActorContainer } from "../player";
import { BehaviorType, Bot } from "./bot"; // Adjust path as needed

/**
 * Ninja Class
 * Inherits from Bot with HideAndAttack behavior.
 */
export class Ninja extends Bot {
    protected behaviorType = BehaviorType.HideAndAttack;
    static NAMES = ["Shinobi", "Kage", "Ronin", "Shuriken", "Sai", "Katana", "Nighthawk", "Mist"];
    static SKIN_ID = "ninja";

    constructor(game: Game, userData: ActorContainer, position: Vector, behaviorType = BehaviorType.HideAndAttack, layer?: Layer, team?: Team, level: number = 1) {
        super(game, userData, position, behaviorType, Ninja.NAMES, Ninja.SKIN_ID, layer, team);
        this.health *= 0.7;
        const healthMultiplier = 1 + 0.05 * (level - 1);
        this.health *= healthMultiplier;
        this.useAttackCooldown = false; // Ninjas attack constantly when chasing
        this.baseChaseSpeed = GameConstants.player.baseSpeed * 0.6;
        this.speedMult = 1 + 0.02 * (level - 1);
        this.chaseDistance = 30;
        this.centerProximity = 100;
        this.minMoveDuration = 5;
        this.maxMoveDuration = 15;
        this.minDistanceToGas = 30;
        this.safeDistanceHideSpot = 0.5;
        this.radiusIncrement = 0.05;
        this.speedIncrement = 0.05;
        const roll = Math.random();
        if (roll < 0.2) {
            this.inventory.weapons[2] = new MeleeItem("steelfang", this);
        } else if (roll < 0.6) {
            this.inventory.weapons[2] = new MeleeItem("feral_claws", this);
        } else {
            this.inventory.weapons[2] = new MeleeItem("sickle", this);
        }
    }
}
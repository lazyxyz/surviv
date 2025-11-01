import { Layer, GameConstants } from "@common/constants";
import { CircleHitbox } from "@common/utils/hitbox";
import { adjacentOrEqualLayer } from "@common/utils/layer";
import { Vector } from "@common/utils/vector";
import { Game } from "../../game";
import { Team } from "../../team";
import { ActorContainer } from "../player";
import { BehaviorType, Bot } from "./bot"; // Adjust path as needed
import { Skins } from "@common/definitions/skins";
import { calculateLevelStat } from "./common";

/**
 * Ghost Class
 * Inherits from Bot with ChaseRandom behavior.
 */
export class Ghost extends Bot {
    static NAMES = ["Wraith", "Specter", "Phantom", "Shade", "Apparition", "Spirit", "Banshee", "Poltergeist"];
    static SKIN_ID = "ghost";

    constructor(game: Game, userData: ActorContainer, position: Vector, behaviorType = BehaviorType.ChaseRandom, layer?: Layer, team?: Team, level: number = 1) {
        super(game, userData, position, behaviorType, Ghost.NAMES, Ghost.SKIN_ID, layer, team);

        const healthMultiplier = calculateLevelStat(1, 0.05, level);
        this.speedMult = calculateLevelStat(1, 0.1, level);
        this.apsMult = calculateLevelStat(1, 0.1, level);

        this.health *= 0.3;
        this.health *= healthMultiplier;
        this.baseChaseSpeed = GameConstants.player.baseSpeed * 0.5;
        this.speedMult = 1 + 0.02 * (level - 1);
        this.baseAps = 2;
        this.apsMult = 1 + 0.03 * (level - 1);
        this.target = this.pickNewTarget();
        this.loadout.skin = Skins.fromString('ghost');

        // Special ability of ghost
        this._hitbox = new CircleHitbox(0, this.position);
    }

    protected handleSpecialEffects(): void {
        for (const object of this.nearObjects) {
            if (
                object.isSyncedParticle &&
                adjacentOrEqualLayer(object.layer, this.layer) &&
                object.hitbox?.isPointInside(this.position)
            ) {
                this.health = 0;
                this.die({});
                return;
            }
        }
    }
}

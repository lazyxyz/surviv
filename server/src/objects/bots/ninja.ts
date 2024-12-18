import { GameConstants, Layer } from "@common/constants";
import { type Vector, Vec } from "@common/utils/vector";
import { Game } from "../../game";
import { Team } from "../../team";
import { Player, ActorContainer } from "../player";
import { PlayerInputData } from "@common/packets/inputPacket";
import { Skins } from "@common/definitions/skins";
import { Badges } from "@common/definitions/badges";
import { Emotes } from "@common/definitions/emotes";
import { Gamer } from "../gamer";
import { MeleeItem } from "../../inventory/meleeItem";
import { Obstacle } from "../obstacle";
import { Scopes } from "@common/definitions/scopes";
import { Armors } from "@common/definitions/armors";

/**
 * Ninja Class
 * Represents a specialized player character with unique traits and behaviors.
 */
export class Ninja extends Player {
    private static readonly CHASE_RADIUS: number = 30; // Distance within which the Ninja will chase players
    private static readonly ROTATION_RATE: number = 0.35; // Maximum rotation speed per update
    private static readonly SAFE_DISTANCE_PLAYER: number = 5; // Minimum distance to maintain from players
    private static readonly SAFE_DISTANCE_HIDE_SPOT: number = 0.5; // Minimum distance to maintain from hiding spots
    private static readonly ATTACK_SPEED: number = GameConstants.player.baseSpeed * 0.7; // Attack speed 70% of base speed

    constructor(game: Game, userData: ActorContainer, position: Vector, layer?: Layer, team?: Team) {
        super(game, userData, position, layer, team);

        this.isMobile = true;
        this.name = "Ninja";

        this.initializeLoadout();
        this.initializeInventory();
    }

    /** 
     * Setup the initial loadout for the Ninja. 
     */
    private initializeLoadout(): void {
        this.loadout.skin = Skins.fromString("gold_tie_event");
        this.loadout.badge = Badges.fromString("bdg_bleh");
        this.loadout.emotes = [Emotes.fromString("happy_face")];
    }

    /** 
     * Setup the Ninja's inventory. 
     */
    private initializeInventory(): void {
        this.inventory.weapons[2] = new MeleeItem("seax", this);
        this.inventory.scope = Scopes.definitions[1];
        this.inventory.vest = Armors.fromString('basic_vest');
        this.inventory.helmet = Armors.fromString('basic_helmet');

        const randomCola = Math.floor(Math.random() * 2) + 1;
        this.inventory.items.setItem('cola', randomCola);
    }

    update(): void {
        super.update();

        if (this.chasePlayer()) return;

        if (this.game.gas.isInGas(this.position)) {
            this.moveToSafePosition();
            return;
        }

        this.hideInSafeSpot();
    }

    /** 
     * Chase the nearest visible player if within range. 
     */
    private chasePlayer(): boolean {
        for (const obj of this.visibleObjects) {
            if (obj instanceof Gamer && !obj.dead) {
                const distance = Vec.length(Vec.sub(obj.position, this.position));
                if (distance < Ninja.CHASE_RADIUS) {
                    this.attackNearestPlayer();
                    return true;
                }
            }
        }
        return false;
    }

    private attackNearestPlayer(): void {
        const nearestPlayer = this.findNearestObject<Gamer>(Gamer);

        if (nearestPlayer) {
            this.baseSpeed = Ninja.ATTACK_SPEED;
            this.moveToTarget(nearestPlayer.position, Ninja.SAFE_DISTANCE_PLAYER, true);
        }
    }

    private hideInSafeSpot(): void {
        const nearestHideSpot = this.findNearestObject<Obstacle>(Obstacle, (obj) => 
            ["bush", "tree"].includes(obj.definition.material) && !obj.dead && !this.game.gas.isInGas(obj.position)
        );

        if (nearestHideSpot) {
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.moveToTarget(nearestHideSpot.position, Ninja.SAFE_DISTANCE_HIDE_SPOT, false);
        }
    }

    private moveToSafePosition(): void {
        const moveSpot = this.game.gas.newPosition;
        this.moveToTarget(moveSpot, Ninja.SAFE_DISTANCE_HIDE_SPOT, false);
    }

    /** 
     * Generic function to move towards a target position while rotating appropriately. 
     */
    private moveToTarget(targetPosition: Vector, safeDistance: number, isAttacking: boolean): void {
        const directionToTarget = Vec.normalize(Vec.sub(targetPosition, this.position));
        const distanceToTarget = Vec.length(Vec.sub(targetPosition, this.position));

        const desiredRotation = Math.atan2(directionToTarget.y, directionToTarget.x);
        const rotationDifference = desiredRotation - this.rotation;
        const adjustedRotation = this.rotation + Math.min(Math.abs(rotationDifference), Ninja.ROTATION_RATE) * Math.sign(rotationDifference);

        const packet: PlayerInputData = {
            movement: { up: false, down: false, left: false, right: false },
            attacking: isAttacking ? !this.attacking : false,
            actions: [],
            isMobile: true,
            turning: true,
            mobile: {
                moving: distanceToTarget > safeDistance,
                angle: adjustedRotation,
            },
            rotation: adjustedRotation,
            distanceToMouse: undefined,
        };

        this.processInputs(packet);
    }

    /** 
     * Find the nearest object of a specific type. 
     */
    private findNearestObject<T>(type: new (...args: any[]) => T, filter?: (obj: T) => boolean): T | null {
        let nearestObject: T | null = null;
        let nearestDistance = Infinity;

        for (const obj of this.visibleObjects) {
            if (obj instanceof type && (!filter || filter(obj))) {
                const distance = Vec.length(Vec.sub(obj.position, this.position));
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestObject = obj;
                }
            }
        }

        return nearestObject;
    }
}

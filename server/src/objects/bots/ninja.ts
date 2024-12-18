import { Layer } from "@common/constants";
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

// Constants for Ninja behavior
const CHASE_RADIUS = 30; // Distance within which the Ninja will chase players
const ROTATION_RATE = 0.35; // Maximum rotation speed per update
const SAFE_DISTANCE_FROM_PLAYER = 5; // Minimum distance to maintain from players
const SAFE_DISTANCE_FROM_HIDE_SPOT = 0.5; // Minimum distance to maintain from hiding spots

/**
 * Ninja Class
 * Represents a specialized player character with unique traits and behaviors.
 */
export class Ninja extends Player {
    constructor(game: Game, userData: ActorContainer, position: Vector, layer?: Layer, team?: Team) {
        super(game, userData, position, layer, team);

        this.baseSpeed *= 0.7; // Reduced movement speed
        this.health *= 0.5; // Reduced health
        this.isMobile = true; // Indicates the Ninja is a mobile character
        this.name = "Ninja"; // Character name

        this.loadout.skin = Skins.fromString("gold_tie_event");
        this.loadout.badge = Badges.fromString("bdg_bleh");
        this.loadout.emotes = [Emotes.fromString("happy_face")];
        this.inventory.weapons[2] = new MeleeItem("seax", this);
        this.inventory.scope = Scopes.definitions[1];
        this.inventory.vest = Armors.fromString('basic_vest');
        this.inventory.helmet = Armors.fromString('basic_helmet');

        const randomCola = Math.floor(Math.random() * 2) + 1;
        this.inventory.items.setItem('cola', randomCola);
    }

    update() {
        super.update();

        // Check if any visible player is within chase radius
        for (const obj of this.visibleObjects) {
            if (obj instanceof Gamer && !obj.dead) {
                if (Vec.length(Vec.sub(obj.position, this.position)) < CHASE_RADIUS) {
                    this.attackNearestPlayer();
                    return;
                }
            }
        }

        // Default to hiding if no players to chase
        this.hide();
    }

    /**
     * Attacks the nearest visible player.
     */
    attackNearestPlayer() {
        let nearestPlayer: Gamer | null = null;
        let nearestDistance = Infinity;

        // Find the nearest player
        for (const obj of this.visibleObjects) {
            if (obj instanceof Gamer) {
                const distance = Vec.length(Vec.sub(obj.position, this.position));
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestPlayer = obj;
                }
            }
        }

        if (nearestPlayer) {
            // Determine direction and distance to the player
            const directionToPlayer = Vec.normalize(Vec.sub(nearestPlayer.position, this.position));
            const distanceToPlayer = Vec.length(Vec.sub(nearestPlayer.position, this.position));

            // Adjust rotation to face the player
            const desiredRotation = Math.atan2(directionToPlayer.y, directionToPlayer.x);
            const rotationDifference = desiredRotation - this.rotation;
            const adjustedRotation = this.rotation + Math.min(Math.abs(rotationDifference), ROTATION_RATE) * Math.sign(rotationDifference);

            // Prepare input packet for attack movement
            const packet: PlayerInputData = {
                movement: { up: false, down: false, left: false, right: false },
                attacking: !this.attacking, // Toggle attacking state
                actions: [],
                isMobile: true,
                turning: true,
                mobile: {
                    moving: distanceToPlayer > SAFE_DISTANCE_FROM_PLAYER,
                    angle: adjustedRotation,
                },
                rotation: adjustedRotation,
                distanceToMouse: undefined,
            };

            this.processInputs(packet);
        }
    }

    /**
     * Moves the Ninja towards the nearest hiding spot (e.g., bush or tree).
     */
    hide() {
        let nearestHideSpot: Obstacle | null = null;
        let nearestDistance = Infinity;

        // Find the nearest suitable hiding spot
        for (const obj of this.visibleObjects) {
            if (obj instanceof Obstacle && !obj.dead && ["bush", "tree"].includes(obj.definition.material)) {
                const distance = Vec.length(Vec.sub(obj.position, this.position));
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestHideSpot = obj;
                }
            }
        }

        if (nearestHideSpot) {
            // Determine direction and distance to the hiding spot
            const directionToHideSpot = Vec.normalize(Vec.sub(nearestHideSpot.position, this.position));
            const distanceToHideSpot = Vec.length(Vec.sub(nearestHideSpot.position, this.position));

            // Adjust rotation to face the hiding spot
            const desiredRotation = Math.atan2(directionToHideSpot.y, directionToHideSpot.x);
            const rotationDifference = desiredRotation - this.rotation;
            const adjustedRotation = this.rotation + Math.min(Math.abs(rotationDifference), ROTATION_RATE) * Math.sign(rotationDifference);

            const packet: PlayerInputData = {
                movement: { up: false, down: false, left: false, right: false },
                attacking: false,
                actions: [],
                isMobile: true,
                turning: true,
                mobile: {
                    moving: distanceToHideSpot > SAFE_DISTANCE_FROM_HIDE_SPOT,
                    angle: adjustedRotation,
                },
                rotation: adjustedRotation,
                distanceToMouse: undefined,
            };

            this.processInputs(packet);
        }
    }
}

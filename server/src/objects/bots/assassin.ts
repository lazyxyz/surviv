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
import { Obstacle } from "../obstacle";
import { Scopes } from "@common/definitions/scopes";
import { GunItem } from "../../inventory/gunItem";
import { Loots } from "@common/definitions/loots";

// Constants for Assassin behavior
const ROTATION_RATE = 0.02; // Maximum rotation speed per update
const SAFE_DISTANCE_FROM_HIDE_SPOT = 0.5; // Minimum distance to maintain from hiding spots

/**
 * Assassin Class
 * Represents a specialized player character with unique traits and behaviors.
 */
export class Assassin extends Player {
    constructor(game: Game, userData: ActorContainer, position: Vector, layer?: Layer, team?: Team) {
        super(game, userData, position, layer, team);

        this.baseSpeed *= 0.7; // Reduced movement speed
        this.health *= 0.5; // Reduced health
        this.isMobile = true; // Indicates the Assassin is a mobile character
        this.name = "Assassin"; // Character name

        this.loadout.skin = Skins.fromString("gold_tie_event");
        this.loadout.badge = Badges.fromString("bdg_bleh");
        this.loadout.emotes = [Emotes.fromString("happy_face")];


        const randomChance = Math.random() * 100; // Random number from 0 to 100

        if (randomChance < 1) {
            // 1% chance
            this.inventory.weapons[0] = new GunItem("l115a1", this);
            this.inventory.items.setItem('338lap', 12);
        } else if (randomChance < 6) {
            // 5% chance
            this.inventory.weapons[0] = new GunItem("vks", this);
            this.inventory.items.setItem('50cal', 30);
        } else if (randomChance < 16) {
            // 10% chance
            this.inventory.weapons[0] = new GunItem("tango_51", this);
            this.inventory.items.setItem('762mm', 90);
        } else if (randomChance < 26) {
            // 10% chance
            this.inventory.weapons[0] = new GunItem("mosin_nagant", this);
            this.inventory.items.setItem('762mm', 90);
        }  else if (randomChance < 56) {
            // 30 chance
            this.inventory.weapons[0] = new GunItem("sks", this);
            this.inventory.items.setItem('762mm', 90);
        } else {
            // Remaining 44
            this.inventory.weapons[0] = new GunItem("vss", this);
            this.inventory.items.setItem('9mm', 120);
        }

        this.inventory.scope = Scopes.definitions[2];
        this.inventory.backpack = Loots.fromString("basic_pack");;
        this.inventory.setActiveWeaponIndex(0);
    }

    update() {
        super.update();

        // Check if any visible player is within chase radius
        for (const obj of this.visibleObjects) {
            if (obj instanceof Gamer && !obj.dead) {
                if (Vec.length(Vec.sub(obj.position, this.position))) {
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

            // Adjust rotation to face the player
            const desiredRotation = Math.atan2(directionToPlayer.y, directionToPlayer.x);
            const rotationDifference = desiredRotation - this.rotation;
            const adjustedRotation = this.rotation + Math.min(Math.abs(rotationDifference), ROTATION_RATE) * Math.sign(rotationDifference);

            const randomRotation = (Math.random() * 0.14) - 0.07; // 7%
            // Prepare input packet for attack movement
            const packet: PlayerInputData = {
                movement: { up: false, down: false, left: false, right: false },
                attacking: true, // Toggle attacking state
                actions: [],
                isMobile: true,
                turning: true,
                mobile: {
                    moving: false,
                    angle: adjustedRotation + (adjustedRotation * randomRotation), // Add randomness to aim
                },
                rotation: adjustedRotation + (adjustedRotation * randomRotation),
                distanceToMouse: undefined,
            };

            this.processInputs(packet);
        }
    }

    /**
     * Moves the Assassin towards the nearest hiding spot (e.g., bush or tree).
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

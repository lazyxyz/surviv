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
import { Obstacle } from "../obstacle";
import { Scopes } from "@common/definitions/scopes";
import { GunItem } from "../../inventory/gunItem";
import { Loots } from "@common/definitions/loots";
import { MeleeItem } from "../../inventory/meleeItem";
import { GunDefinition } from "@common/definitions/guns";



/**
 * Assassin Class
 * Represents a specialized player character with unique traits and behaviors.
 */
export class Assassin extends Player {
    constructor(game: Game, userData: ActorContainer, position: Vector, layer?: Layer, team?: Team) {
        super(game, userData, position, layer, team);
        this.isMobile = true; // Indicates the Assassin is a mobile character
        this.name = "Assassin"; // Character name

        this.inventory.scope = Scopes.definitions[1];
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
        } else if (randomChance < 56) {
            // 30 chance
            this.inventory.weapons[0] = new GunItem("sks", this);
            this.inventory.items.setItem('762mm', 90);
        } else {
            // Remaining 44
            this.inventory.weapons[0] = new GunItem("vss", this);
            this.inventory.items.setItem('9mm', 120);
        }

        this.inventory.backpack = Loots.fromString("basic_pack");;
        this.inventory.setActiveWeaponIndex(0);

        this.inventory.weapons[2] = new MeleeItem("kbar", this);
        this.inventory.scope = Scopes.definitions[2];
    }

    attackRotationRate = 0.35; // Maximum rotation speed per update
    shotRotationRate = 0.2; // Maximum rotation speed per update
    safeDistanceHideSpot = 0.5; // Minimum distance to maintain from hiding spots
    safeDistancePlayer = 5; // Minimum distance to maintain from players
    attackDistance = 20; // Use mele attack when gamer too close
    shotDistance = 100;
    shotNerf = 0.07; // 7%
    speedNerf = 0.7;
    attackSpeed = GameConstants.player.baseSpeed * 0.7; // Neff 30%

    update() {
        super.update();

        // Check if any visible player is within chase radius
        for (const obj of this.visibleObjects) {
            if (obj instanceof Gamer && !obj.dead) {
                if (Vec.length(Vec.sub(obj.position, this.position)) < this.attackDistance) {
                    this.inventory.setActiveWeaponIndex(2);
                    this.attackNearestPlayer();
                    return;
                }
                else if (Vec.length(Vec.sub(obj.position, this.position)) < this.shotDistance) {
                    this.inventory.setActiveWeaponIndex(0);
                    if (this.inventory.items.hasItem((this.activeItemDefinition as GunDefinition).ammoType)) {
                        this.shotNearestPlayer();
                    } else {
                        this.inventory.setActiveWeaponIndex(2);
                        this.attackDistance = 30;
                        this.shotDistance = this.attackDistance;
                    }
                    return;
                }
            }
        }

        if (this.game.gas.isInGas(this.position)) {
            this.moving();
            return;
        }

        // Default to hiding if no players to chase
        this.hide();
    }

    /**
     * Attacks the nearest visible player.
     */
    shotNearestPlayer() {
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
            const adjustedRotation = this.rotation + Math.min(Math.abs(rotationDifference), this.shotRotationRate) * Math.sign(rotationDifference);

            const randomRotation = (Math.random() * (this.shotNerf * 2)) - this.shotNerf;
            // Prepare input packet for attack movement
            const packet: PlayerInputData = {
                movement: { up: false, down: false, left: false, right: false },
                attacking: !this.attacking, // Toggle attacking state
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
        this.baseSpeed = GameConstants.player.baseSpeed;

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
            const adjustedRotation = this.rotation + Math.min(Math.abs(rotationDifference), this.attackRotationRate) * Math.sign(rotationDifference);

            const packet: PlayerInputData = {
                movement: { up: false, down: false, left: false, right: false },
                attacking: false,
                actions: [],
                isMobile: true,
                turning: true,
                mobile: {
                    moving: distanceToHideSpot > this.safeDistanceHideSpot,
                    angle: adjustedRotation,
                },
                rotation: adjustedRotation,
                distanceToMouse: undefined,
            };

            this.processInputs(packet);
        }
    }

    /**
   * Attacks the nearest visible player.
   */
    attackNearestPlayer() {
        this.baseSpeed = this.attackSpeed;
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
            const adjustedRotation = this.rotation + Math.min(Math.abs(rotationDifference), this.shotRotationRate) * Math.sign(rotationDifference);

            // Prepare input packet for attack movement
            const packet: PlayerInputData = {
                movement: { up: false, down: false, left: false, right: false },
                attacking: !this.attacking, // Toggle attacking state
                actions: [],
                isMobile: true,
                turning: true,
                mobile: {
                    moving: distanceToPlayer > this.safeDistancePlayer,
                    angle: adjustedRotation,
                },
                rotation: adjustedRotation,
                distanceToMouse: undefined,
            };

            this.processInputs(packet);
        }
    }

    moving() {
        this.baseSpeed = GameConstants.player.baseSpeed;
        this.inventory.setActiveWeaponIndex(2);
        const moveSpot = this.game.gas.newPosition;

        // Determine direction and distance to the hiding spot
        const directionToHideSpot = Vec.normalize(Vec.sub(moveSpot, this.position));
        const distanceToHideSpot = Vec.length(Vec.sub(moveSpot, this.position));

        // Adjust rotation to face the hiding spot
        const desiredRotation = Math.atan2(directionToHideSpot.y, directionToHideSpot.x);
        const rotationDifference = desiredRotation - this.rotation;
        const adjustedRotation = this.rotation + Math.min(Math.abs(rotationDifference), this.attackRotationRate) * Math.sign(rotationDifference);

        const packet: PlayerInputData = {
            movement: { up: false, down: false, left: false, right: false },
            attacking: !this.attacking,
            actions: [],
            isMobile: true,
            turning: true,
            mobile: {
                moving: distanceToHideSpot > this.safeDistanceHideSpot,
                angle: adjustedRotation,
            },
            rotation: adjustedRotation,
            distanceToMouse: undefined,
        };

        this.processInputs(packet);
    }
}

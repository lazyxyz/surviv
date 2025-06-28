import { GameConstants, Layer } from "@common/constants";
import { type Vector, Vec } from "@common/utils/vector";
import { Game } from "../../game";
import { Team } from "../../team";
import { Player, ActorContainer } from "../player";
import { PlayerInputData } from "@common/packets/inputPacket";
import { Skins } from "@common/definitions/skins";
import { Gamer } from "../gamer";
import { MeleeItem } from "../../inventory/meleeItem";
import { Obstacle } from "../obstacle";
import { Config } from "../../config";

/**
 * Ninja Class
 * Represents a specialized player character with unique traits and behaviors.
 */
export class Ninja extends Player {
    private static readonly BASE_CHASE_RADIUS: number = 30; // Distance within which the Ninja will chase players
    private static readonly ROTATION_RATE: number = 0.35; // Maximum rotation speed per update
    private static readonly SAFE_DISTANCE_PLAYER: number = 5; // Minimum distance to maintain from players
    private static readonly SAFE_DISTANCE_HIDE_SPOT: number = 0.5; // Minimum distance to maintain from hiding spots
    private static readonly BASE_ATTACK_SPEED: number = GameConstants.player.baseSpeed * 0.7; // Attack speed 70% of base speed
    private static readonly RADIUS_INCREMENT: number = 0.05; // Increase chase radius per gas stage
    private static readonly SPEED_INCREMENT: number = 0.05; // Increase attack speed per gas stage
    private static readonly MIN_HIDE_DURATION = 10; // Minimum seconds to stay in a hiding spot
    private static readonly MAX_HIDE_DURATION = 20; // Maximum seconds to stay in a hiding spot
    private static readonly MIN_DISTANCE_TO_GAS = 30; // Minimum distance closer to gas safe zone
    private static readonly CENTER_PROXIMITY = 40; // Distance to consider bot "at" the gas safe zone
    private static readonly NAMES = ["Shinobi", "Kage", "Ronin", "Shuriken", "Sai", "Katana", "Nighthawk", "Mist"]; // Thematic names for Ninja

    private hideTimer: number = 0; // Tracks time spent in current hiding spot
    private lastHideSpot: Vector | null = null; // Tracks the current hiding spot position
    private currentHideDuration: number = this.getRandomHideDuration(); // Current random hide duration

    constructor(game: Game, userData: ActorContainer, position: Vector, layer?: Layer, team?: Team) {
        super(game, userData, position, layer, team);

        this.isMobile = true;
        this.name = this.getRandomName(); // Assign random name

        this.initializeLoadout();
        this.initializeInventory();
    }

    /**
     * Generate a random name from the NAMES list.
     */
    private getRandomName(): string {
        const index = Math.floor(Math.random() * Ninja.NAMES.length);
        return Ninja.NAMES[index];
    }

    /**
     * Generate a random hide duration or 0 if outside gas radius.
     */
    private getRandomHideDuration(): number {
        let duration = Math.random() * (Ninja.MAX_HIDE_DURATION - Ninja.MIN_HIDE_DURATION) + Ninja.MIN_HIDE_DURATION;
        const distanceToGasCenter = Vec.length(Vec.sub(this.game.gas.newPosition, this.position));
        // If outside gas newRadius, cut half time
        if (distanceToGasCenter > this.game.gas.newRadius) {
            duration /= 2;
        }
        // Generate random duration between MIN_HIDE_DURATION and MAX_HIDE_DURATION
        return duration;
    }

    /**
     * Generate a random position on the gas newRadius circle.
     */
    private getRandomRadiusPosition(): Vector {
        // Generate random angle for a point on the gas radius circle
        const randomAngle = Math.random() * 2 * Math.PI;
        return Vec.add(this.game.gas.newPosition, {
            x: Math.cos(randomAngle) * this.game.gas.newRadius,
            y: Math.sin(randomAngle) * this.game.gas.newRadius
        });
    }

    /**
     * Setup the initial loadout for the Ninja.
     */
    private initializeLoadout(): void {
        this.loadout.skin = Skins.fromString("ninja");
    }

    /**
     * Setup the Ninja's inventory.
     */
    private initializeInventory(): void {
        this.inventory.weapons[2] = new MeleeItem("steelfang", this);

        const randomCola = Math.floor(Math.random() * 2) + 1;
        this.inventory.items.setItem('cola', randomCola);
    }

    update(): void {
        super.update();
        if (this.chasePlayer()) {
            // Chasing player
            return;
        }

        if (this.game.gas.isInGas(this.position)) {
            // Move to safe position if in gas
            this.moveToSafePosition();
            return;
        }

        // Hide in a safe spot
        this.hideInSafeSpot();
    }

    /**
     * Calculate chase radius based on gas stage.
     */
    private get chaseRadius(): number {
        const stageMultiplier = 1 + Ninja.RADIUS_INCREMENT * this.game.gas.stage;
        return Ninja.BASE_CHASE_RADIUS * stageMultiplier;
    }

    /**
     * Calculate attack speed based on gas stage.
     */
    private get attackSpeed(): number {
        const stageMultiplier = 1 + Ninja.SPEED_INCREMENT * this.game.gas.stage;
        return Ninja.BASE_ATTACK_SPEED * stageMultiplier;
    }

    /**
     * Chase the nearest visible player if within range.
     */
    private chasePlayer(): boolean {
        for (const obj of this.visibleObjects) {
            if (obj instanceof Gamer && !obj.dead) {
                const distance = Vec.length(Vec.sub(obj.position, this.position));
                if (distance < this.chaseRadius) {
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
            // Attack nearest player with melee
            this.baseSpeed = this.attackSpeed;
            this.moveToTarget(nearestPlayer.position, Ninja.SAFE_DISTANCE_PLAYER, !this.attacking);
        }
    }

    private hideInSafeSpot(): void {
        this.hideTimer += 1 / Config.tps; // Assuming 60 FPS

        const currentDistanceToGas = Vec.length(Vec.sub(this.game.gas.newPosition, this.position));

        // If bot is within safe zone proximity, stay put
        if (currentDistanceToGas <= Ninja.CENTER_PROXIMITY) {
            this.hideTimer = 0;
            this.lastHideSpot = Vec.clone(this.position);
            return;
        }

        // Check if it's time to move to a new hiding spot
        if (this.hideTimer >= this.currentHideDuration || !this.lastHideSpot) {
            const nearestHideSpot = this.findNearestObject<Obstacle>(Obstacle, (obj) =>
                ["bush", "tree"].includes(obj.definition.material) &&
                !obj.dead &&
                !this.game.gas.isInGas(obj.position) &&
                Vec.length(Vec.sub(this.game.gas.newPosition, obj.position)) <= currentDistanceToGas - Ninja.MIN_DISTANCE_TO_GAS &&
                (!this.lastHideSpot || Vec.length(Vec.sub(obj.position, this.lastHideSpot)) > 2 * Ninja.SAFE_DISTANCE_HIDE_SPOT)
            );

            if (nearestHideSpot) {
                // Move to new hiding spot
                this.lastHideSpot = Vec.clone(nearestHideSpot.position);
                this.hideTimer = 0;
                this.currentHideDuration = this.getRandomHideDuration();
                this.baseSpeed = GameConstants.player.baseSpeed;
                this.moveToTarget(nearestHideSpot.position, Ninja.SAFE_DISTANCE_HIDE_SPOT, false);
            } else {
                // Move to random point on gas radius
                this.lastHideSpot = null;
                this.hideTimer = 0;
                this.currentHideDuration = 0;
                this.baseSpeed = GameConstants.player.baseSpeed;
                const radiusTarget = this.getRandomRadiusPosition();
                this.moveToTarget(radiusTarget, 0, false);
            }
        } else {
            // Stay at or move to current hiding spot
            if (this.lastHideSpot) {
                this.baseSpeed = GameConstants.player.baseSpeed;
                this.moveToTarget(this.lastHideSpot, Ninja.SAFE_DISTANCE_HIDE_SPOT, false);
            } else {
                const nearestHideSpot = this.findNearestObject<Obstacle>(Obstacle, (obj) =>
                    ["bush", "tree"].includes(obj.definition.material) &&
                    !obj.dead &&
                    !this.game.gas.isInGas(obj.position)
                );

                if (nearestHideSpot) {
                    // Move to initial hiding spot
                    this.lastHideSpot = Vec.clone(nearestHideSpot.position);
                    this.hideTimer = 0;
                    this.currentHideDuration = this.getRandomHideDuration();
                    this.baseSpeed = GameConstants.player.baseSpeed;
                    this.moveToTarget(nearestHideSpot.position, Ninja.SAFE_DISTANCE_HIDE_SPOT, false);
                } else {
                    // Move to random point on gas radius
                    this.lastHideSpot = null;
                    this.hideTimer = 0;
                    this.currentHideDuration = 0;
                    this.baseSpeed = GameConstants.player.baseSpeed;
                    const radiusTarget = this.getRandomRadiusPosition();
                    this.moveToTarget(radiusTarget, 0, false);
                }
            }
        }
    }

    private moveToSafePosition(): void {
        const currentDistanceToGas = Vec.length(Vec.sub(this.game.gas.newPosition, this.position));

        // Find a nearby hiding spot closer to the gas center
        const nearestHideSpot = this.findNearestObject<Obstacle>(Obstacle, (obj) =>
            ["bush", "tree"].includes(obj.definition.material) &&
            !obj.dead &&
            !this.game.gas.isInGas(obj.position) &&
            Vec.length(Vec.sub(this.game.gas.newPosition, obj.position)) < currentDistanceToGas
        );

        if (nearestHideSpot) {
            // Move to hiding spot
            this.lastHideSpot = Vec.clone(nearestHideSpot.position);
            this.hideTimer = 0;
            this.currentHideDuration = this.getRandomHideDuration();
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.moveToTarget(nearestHideSpot.position, Ninja.SAFE_DISTANCE_HIDE_SPOT, !this.attacking);
        } else {
            // Move to random point on gas radius
            this.lastHideSpot = null;
            this.hideTimer = 0;
            this.currentHideDuration = this.getRandomHideDuration();
            this.baseSpeed = GameConstants.player.baseSpeed;
            const radiusTarget = this.getRandomRadiusPosition();
            this.moveToTarget(radiusTarget, 0, !this.attacking);
        }
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

        // Move if not within safe distance
        const shouldMove = distanceToTarget > safeDistance;

        const packet: PlayerInputData = {
            movement: { up: false, down: false, left: false, right: false },
            attacking: isAttacking,
            actions: [],
            isMobile: true,
            turning: true,
            mobile: {
                moving: shouldMove,
                angle: adjustedRotation,
            },
            rotation: adjustedRotation,
            distanceToMouse: undefined,
        };

        // Process movement input
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
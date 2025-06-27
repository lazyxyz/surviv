import { GameConstants, Layer } from "@common/constants";
import { type Vector, Vec } from "@common/utils/vector";
import { Game } from "../../game";
import { Team } from "../../team";
import { Player, ActorContainer } from "../player";
import { PlayerInputData } from "@common/packets/inputPacket";
import { Skins } from "@common/definitions/skins";
import { Gamer } from "../gamer";
import { Scopes } from "@common/definitions/scopes";
import { Config } from "../../config";

/**
 * Zombie Class
 * Represents a specialized player character with unique traits and behaviors.
 */
export class Zombie extends Player {
    private static readonly CHASE_DISTANCE = 40; // Distance to chase players
    private static readonly ROTATION_RATE = 0.35; // Maximum rotation speed per update
    private static readonly IDLE_ROTATION_SPEED = 0.1; // Rotation speed when idling
    private static readonly SAFE_DISTANCE_FROM_PLAYER = 5; // Minimum distance from players
    private static readonly BASE_SPEED = GameConstants.player.baseSpeed * 0.8; // Base speed for chasing
    private static readonly WANDER_SPEED = GameConstants.player.baseSpeed * 0.3; // Slower speed for wandering
    private static readonly MIN_MOVE_DURATION = 1; // Minimum seconds before picking new wander target
    private static readonly MAX_MOVE_DURATION = 5; // Maximum seconds before picking new wander target
    private static readonly CENTER_PROXIMITY = 40; // Distance to consider bot "at" the gas safe zone
    private static readonly NAMES = ["Ghoul", "Walker", "Rotter", "Shambler", "Undead", "Zed", "Lurker", "Crawler"]; // Thematic names for Zombie

    private rotationDirection: number = 1; // Direction for idle rotation (1 or -1)
    private moveTimer: number = 0; // Tracks time since last wander target change
    private currentMoveDuration: number = this.getRandomMoveDuration(); // Current random wander duration
    private wanderTarget: Vector | null = null; // Current wander target position

    constructor(game: Game, userData: ActorContainer, position: Vector, layer?: Layer, team?: Team) {
        super(game, userData, position, layer, team);
        this.health = this.health * 0.5; // Reduce health by 50%
        this.isMobile = true;
        this.name = this.getRandomName(); // Assign random name
        this.loadout.skin = Skins.fromString("zombie");
        this.inventory.scope = Scopes.definitions[0];
        // this.inventory.scope.noDrop = true;

        // Set initial inventory with 30% chance for cola
        const randomCola = Math.random() < 0.3 ? 1 : 0;
        this.inventory.items.setItem('cola', randomCola);
    }

    /**
     * Generate a random name from the NAMES list.
     */
    private getRandomName(): string {
        const index = Math.floor(Math.random() * Zombie.NAMES.length);
        return Zombie.NAMES[index];
    }

    /**
     * Generate a random move duration or 0 if outside gas radius.
     */
    private getRandomMoveDuration(): number {
        const distanceToGasCenter = Vec.length(Vec.sub(this.game.gas.newPosition, this.position));
        // If outside gas newRadius, move immediately
        if (distanceToGasCenter > this.game.gas.newRadius) {
            return 0;
        }
        // Generate random duration between MIN_MOVE_DURATION and MAX_MOVE_DURATION
        return Math.random() * (Zombie.MAX_MOVE_DURATION - Zombie.MIN_MOVE_DURATION) + Zombie.MIN_MOVE_DURATION;
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

    update(): void {
        super.update();
        for (const obj of this.visibleObjects) {
            if (obj instanceof Gamer && !obj.dead) {
                if (Vec.length(Vec.sub(obj.position, this.position)) < Zombie.CHASE_DISTANCE) {
                    // Chase nearest player
                    this.attackNearestPlayer();
                    return;
                }
            }
        }

        // Wander toward safe zone or idle
        this.wanderOrIdle();
    }

    private attackNearestPlayer(): void {
        const nearestPlayer = this.findNearestObject<Gamer>(Gamer);

        if (nearestPlayer) {
            // Attack nearest player with melee
            this.baseSpeed = Zombie.BASE_SPEED;
            this.moveToTarget2(nearestPlayer.position, Zombie.SAFE_DISTANCE_FROM_PLAYER, !this.attacking);
        }
    }

    /**
     * Move toward a random point on the gas radius or idle.
     */
    private wanderOrIdle(): void {
        this.moveTimer += 1 / Config.tps; // Assuming 60 FPS

        const currentDistanceToGas = Vec.length(Vec.sub(this.game.gas.newPosition, this.position));

        // If within safe zone proximity, idle
        if (currentDistanceToGas <= Zombie.CENTER_PROXIMITY) {
            this.moveTimer = 0;
            this.wanderTarget = null;
            this.idle();
            return;
        }

        // Check if it's time to pick a new wander target
        if (this.moveTimer >= this.currentMoveDuration || !this.wanderTarget) {
            // Pick new random point on gas radius
            this.wanderTarget = this.getRandomRadiusPosition();
            this.moveTimer = 0;
            this.currentMoveDuration = this.getRandomMoveDuration();
            this.baseSpeed = Zombie.WANDER_SPEED;
            this.moveToTarget2(this.wanderTarget, 0, false);
        } else {
            // Continue moving to current wander target
            if (this.wanderTarget) {
                this.baseSpeed = Zombie.WANDER_SPEED;
                this.moveToTarget2(this.wanderTarget, 0, false);
            } else {
                // Fallback to idling if no target
                this.idle();
            }
        }
    }

    /**
     * Idle behavior with random rotation.
     */
    private idle(): void {
        // 1% chance to reverse rotation direction
        const shouldReverse = Math.random() < 0.01;
        if (shouldReverse) {
            this.rotationDirection *= -1;
        }

        this.rotation += Zombie.IDLE_ROTATION_SPEED * this.rotationDirection;
        const packet: PlayerInputData = {
            movement: { up: false, down: false, left: false, right: false },
            attacking: false,
            actions: [],
            isMobile: true,
            turning: true,
            mobile: {
                angle: this.rotation,
                moving: false,
            },
            rotation: this.rotation,
            distanceToMouse: undefined,
        };

        // Process idle input
        this.processInputs(packet);
    }

    /**
     * Generic function to move towards a target position while rotating appropriately.
     */
    private moveToTarget2(targetPosition: Vector, safeDistance: number, isAttacking: boolean): void {
        const directionToTarget = Vec.normalize(Vec.sub(targetPosition, this.position));
        const distanceToTarget = Vec.length(Vec.sub(targetPosition, this.position));

        const desiredRotation = Math.atan2(directionToTarget.y, directionToTarget.x);
        let rotationDifference = desiredRotation - this.rotation;

        // Normalize rotationDifference to the range [-π, π]
        rotationDifference = Math.atan2(Math.sin(rotationDifference), Math.cos(rotationDifference));

        // Only adjust rotation if the difference exceeds a threshold to prevent jitter
        const rotationThreshold = 0.05;
        if (Math.abs(rotationDifference) > rotationThreshold) {
            this.rotation += Math.min(Math.abs(rotationDifference), Zombie.ROTATION_RATE) * Math.sign(rotationDifference);
        }

        const packet: PlayerInputData = {
            movement: { up: false, down: false, left: false, right: false },
            attacking: isAttacking,
            actions: [],
            isMobile: true,
            turning: true,
            mobile: {
                moving: distanceToTarget > safeDistance,
                angle: this.rotation,
            },
            rotation: this.rotation,
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
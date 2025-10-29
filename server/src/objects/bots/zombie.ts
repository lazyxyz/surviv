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
import { DamageParams } from "../gameObject";

/**
 * Zombie Class
 * Represents a specialized player character with unique traits and behaviors.
 */
export class Zombie extends Player {
    private static readonly CHASE_DISTANCE = 40; // Distance to chase players
    private static readonly ROTATION_RATE = 0.35; // Maximum rotation speed per update
    private static readonly IDLE_ROTATION_SPEED = 0.1; // Rotation speed when idling
    private static readonly SAFE_DISTANCE_FROM_PLAYER = 5; // Minimum distance from players
    private static readonly BASE_SPEED = GameConstants.player.baseSpeed * 0.5; // Base speed for chasing
    private static readonly WANDER_SPEED = GameConstants.player.baseSpeed * 0.3; // Slower speed for wandering
    private static readonly BASE_APS = 1; // Base attacks per second (1 attack per second)
    private static readonly HEALTH_MULTIPLIER_PER_LEVEL = 0.05; // 5% health increase per level
    private static readonly SPEED_MULTIPLIER_PER_LEVEL = 0.02; // 2% speed increase per level
    private static readonly APS_MULTIPLIER_PER_LEVEL = 0.03; // 3% attack speed increase per level
    private static readonly MIN_MOVE_DURATION = 1; // Minimum seconds before picking new wander target
    private static readonly MAX_MOVE_DURATION = 5; // Maximum seconds before picking new wander target
    private static readonly CENTER_PROXIMITY = 150; // Distance to consider bot "at" the gas safe zone
    private static readonly NAMES = ["Ghoul", "Walker", "Rotter", "Shambler", "Undead", "Zed", "Lurker", "Crawler"]; // Thematic names for Zombie

    private rotationDirection: number = 1; // Direction for idle rotation (1 or -1)
    private moveTimer: number = 0; // Tracks time since last wander target change
    private currentMoveDuration: number = this.getRandomMoveDuration(); // Current random wander duration
    private wanderTarget: Vector | null = null; // Current wander target position
    private speedMult: number; // Level-based speed multiplier
    private attackCooldown: number = 0; // Cooldown timer for attacks (in ticks)
    private readonly attackInterval: number; // Interval between attacks (in ticks)

    constructor(game: Game, userData: ActorContainer, position: Vector, layer?: Layer, team?: Team, level: number = 1) {
        super(game, userData, position, layer, team);
        this.health = this.health * 0.5; // Reduce health by 50%

        // Apply level-based multipliers
        const healthMultiplier = 1 + Zombie.HEALTH_MULTIPLIER_PER_LEVEL * (level - 1);
        this.health *= healthMultiplier;

        this.speedMult = 1 + Zombie.SPEED_MULTIPLIER_PER_LEVEL * (level - 1);

        const aps = Zombie.BASE_APS * (1 + Zombie.APS_MULTIPLIER_PER_LEVEL * (level - 1));
        this.attackInterval = Math.floor(Config.tps / aps);

        this.isMobile = true;
        this.name = this.getRandomName(); // Assign random name
        this.loadout.skin = Skins.fromString("zombie");
        this.inventory.scope = Scopes.definitions[0];

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

        // Decrement attack cooldown every update
        this.attackCooldown = Math.max(0, this.attackCooldown - 1);

        // Find the nearest living player within chase distance
        let target: Gamer | null = null;
        let minDist = Infinity;
        for (const obj of this.visibleObjects) {
            if (obj instanceof Gamer && !obj.dead && !obj.downed) {
                const dist = Vec.length(Vec.sub(obj.position, this.position));
                if (dist < Zombie.CHASE_DISTANCE && dist < minDist) {
                    minDist = dist;
                    target = obj;
                }
            }
        }

        if (target) {
            // Chase and attack logic
            this.baseSpeed = Zombie.BASE_SPEED * this.speedMult;
            let isAttacking = false;
            if (this.attackCooldown <= 0) {
                isAttacking = true;
                this.attackCooldown = this.attackInterval; // Reset cooldown
            }
            this.moveToTarget(target.position, Zombie.SAFE_DISTANCE_FROM_PLAYER, isAttacking);
            return;
        }

        // Wander toward safe zone or idle
        this.wanderOrIdle();
    }

    /**
     * Move toward a random point on the gas radius or idle.
     */
    private wanderOrIdle(): void {
        this.moveTimer += 1 / Config.tps; // Assuming update per tick

        const currentDistanceToGas = Vec.length(Vec.sub(this.game.gas.newPosition, this.position));

        // If within safe zone proximity, idle
        if (currentDistanceToGas <= Zombie.CENTER_PROXIMITY || !this.game.isStarted()) {
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
            this.baseSpeed = Zombie.WANDER_SPEED * this.speedMult;
            this.moveToTarget(this.wanderTarget, 0, false);
        } else {
            // Continue moving to current wander target
            if (this.wanderTarget) {
                this.baseSpeed = Zombie.WANDER_SPEED * this.speedMult;
                this.moveToTarget(this.wanderTarget, 0, false);
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
            distanceToMouse: 0,
        };

        // Process idle input
        this.processInputs(packet);
    }

    /**
     * Generic function to move towards a target position while rotating appropriately.
     */
    private moveToTarget(targetPosition: Vector, safeDistance: number, isAttacking: boolean): void {
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
            distanceToMouse: 0,
        };

        // Process movement input
        this.processInputs(packet);
    }

     override isBot(): boolean {
        return true;
    }
}
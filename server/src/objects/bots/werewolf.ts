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
import { randomFloat } from "@common/utils/random";
import { SAFE_DISTANCE_FROM_PLAYER } from "./common";

/**
 * Werewolf Class
 * Represents a specialized player character with unique traits and behaviors.
 * Moves like a Zombie: wanders toward safe zone, chases nearest player if in range.
 * Enraged ability: 50% faster movement and attack speed when health < `ENRAGED_HEALTH_THRESHOLD`% of max.
 */
export class Werewolf extends Player {
    private static readonly CHASE_DISTANCE = 40; // Distance to chase players
    private static readonly ROTATION_RATE = 0.35; // Maximum rotation speed per update
    private static readonly IDLE_ROTATION_SPEED = 0.1; // Rotation speed when idling
    private static readonly BASE_SPEED = GameConstants.player.baseSpeed * 0.8; // Base speed for chasing
    private static readonly WANDER_SPEED = GameConstants.player.baseSpeed * 0.3; // Slower speed for wandering
    private static readonly BASE_APS = 1; // Base attacks per second (1 attack per second)
    private static readonly ENRAGED_MULTIPLIER = 1.5; // 50% faster move and attack when low health
    private static readonly ENRAGED_HEALTH_THRESHOLD = 0.5; // Under 50% health
    private static readonly HEALTH_MULTIPLIER_PER_LEVEL = 0.05; // 5% health increase per level
    private static readonly SPEED_MULTIPLIER_PER_LEVEL = 0.02; // 2% speed increase per level
    private static readonly APS_MULTIPLIER_PER_LEVEL = 0.03; // 3% attack speed increase per level
    private static readonly MIN_MOVE_DURATION = 1; // Minimum seconds before picking new wander target
    private static readonly MAX_MOVE_DURATION = 5; // Maximum seconds before picking new wander target
    private static readonly CENTER_PROXIMITY = 150; // Distance to consider bot "at" the gas safe zone
    private static readonly NAMES = ["Werewolf", "Lycan", "Wolfman", "Beast", "Fang", "Howler", "Alpha", "Lupine"]; // Thematic names for Werewolf

    private rotationDirection: number = 1; // Direction for idle rotation (1 or -1)
    private moveTimer: number = 0; // Tracks time since last wander target change
    private currentMoveDuration: number = this.getRandomMoveDuration(); // Current random wander duration
    private wanderTarget: Vector | null = null; // Current wander target position
    private speedMult: number; // Level-based speed multiplier
    private baseAps: number; // Level-adjusted base attacks per second
    private attackCooldown: number = 0; // Cooldown timer for attacks (in ticks)

    constructor(game: Game, userData: ActorContainer, position: Vector, layer?: Layer, team?: Team, level: number = 1) {
        super(game, userData, position, layer, team);
        this.health = this.health * 0.6; // Base health adjustment for Werewolf

        // Apply level-based multipliers
        const healthMultiplier = 1 + Werewolf.HEALTH_MULTIPLIER_PER_LEVEL * (level - 1);
        this.health *= healthMultiplier;
        this.maxHealth = this.health;

        this.speedMult = 1 + Werewolf.SPEED_MULTIPLIER_PER_LEVEL * (level - 1);

        this.baseAps = Werewolf.BASE_APS * (1 + Werewolf.APS_MULTIPLIER_PER_LEVEL * (level - 1));

        this.isMobile = true;
        this.name = this.getRandomName(); // Assign random name
        this.loadout.skin = Skins.fromString("werewolf");
        this.inventory.scope = Scopes.definitions[0];

        // Set initial inventory with 30% chance for cola
        const randomCola = Math.random() < 0.3 ? 1 : 0;
        this.inventory.items.setItem('cola', randomCola);
    }

    /**
     * Generate a random name from the NAMES list.
     */
    private getRandomName(): string {
        const index = Math.floor(Math.random() * Werewolf.NAMES.length);
        return Werewolf.NAMES[index];
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
        return Math.random() * (Werewolf.MAX_MOVE_DURATION - Werewolf.MIN_MOVE_DURATION) + Werewolf.MIN_MOVE_DURATION;
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

    die(params: Omit<DamageParams, "amount">) {
        this.game.totalBots--;
        this.dropLoot();
        super.die(params);
    }

    /**
     * Drop loot based on probabilities when the werewolf dies.
     */
    private dropLoot(): void {
        // 1% chance for each ammo type with random amount in range
        if (Math.random() < 0.01) {
            const amount = Math.floor(randomFloat(50, 100));
            this.game.addLoot('9mm', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.01) {
            const amount = Math.floor(randomFloat(20, 50));
            this.game.addLoot('12g', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.01) {
            const amount = Math.floor(randomFloat(40, 80));
            this.game.addLoot('556mm', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.01) {
            const amount = Math.floor(randomFloat(40, 80));
            this.game.addLoot('762mm', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.01) {
            const amount = Math.floor(randomFloat(20, 50));
            this.game.addLoot('50cal', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.01) {
            const amount = Math.floor(randomFloat(20, 50));
            this.game.addLoot('338lap', this.position, this.layer, { count: amount });
        }

        // 0.05% chance for curadell (1 amount)
        if (Math.random() < 0.0005) {
            this.game.addLoot('curadell', this.position, this.layer, { count: 1 });
        }
    }

    update(): void {
        super.update();

        // Decrement attack cooldown every update
        this.attackCooldown = Math.max(0, this.attackCooldown - 1);

        // Check enraged state
        const enraged = this.health < this.maxHealth * Werewolf.ENRAGED_HEALTH_THRESHOLD;

        // Find the nearest living player within chase distance
        let target: Gamer | null = null;
        let minDist = Infinity;
        for (const obj of this.visibleObjects) {
            if (obj instanceof Gamer && !obj.dead && !obj.downed) {
                const dist = Vec.length(Vec.sub(obj.position, this.position));
                if (dist < Werewolf.CHASE_DISTANCE && dist < minDist) {
                    minDist = dist;
                    target = obj;
                }
            }
        }

        if (target) {
            // Chase and attack logic
            const enragedSpeedMult = enraged ? Werewolf.ENRAGED_MULTIPLIER : 1;
            this.baseSpeed = Werewolf.BASE_SPEED * this.speedMult * enragedSpeedMult;
            let isAttacking = false;
            if (this.attackCooldown <= 0) {
                isAttacking = true;
                const currentAps = this.baseAps * (enraged ? Werewolf.ENRAGED_MULTIPLIER : 1);
                this.attackCooldown = Math.floor(Config.tps / currentAps);
            }
            this.moveToTarget(target.position, SAFE_DISTANCE_FROM_PLAYER, isAttacking);
            return;
        }

        // Wander toward safe zone or idle
        this.wanderOrIdle(enraged);
    }

    /**
     * Move toward a random point on the gas radius or idle.
     */
    private wanderOrIdle(enraged: boolean): void {
        this.moveTimer += 1 / Config.tps; // Assuming update per tick

        const currentDistanceToGas = Vec.length(Vec.sub(this.game.gas.newPosition, this.position));

        // If within safe zone proximity, idle
        if (currentDistanceToGas <= Werewolf.CENTER_PROXIMITY || !this.game.isStarted()) {
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
            const enragedSpeedMult = enraged ? Werewolf.ENRAGED_MULTIPLIER : 1;
            this.baseSpeed = Werewolf.WANDER_SPEED * this.speedMult * enragedSpeedMult;
            this.moveToTarget(this.wanderTarget, 0, false);
        } else {
            // Continue moving to current wander target
            if (this.wanderTarget) {
                const enragedSpeedMult = enraged ? Werewolf.ENRAGED_MULTIPLIER : 1;
                this.baseSpeed = Werewolf.WANDER_SPEED * this.speedMult * enragedSpeedMult;
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

        this.rotation += Werewolf.IDLE_ROTATION_SPEED * this.rotationDirection;
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
            this.rotation += Math.min(Math.abs(rotationDifference), Werewolf.ROTATION_RATE) * Math.sign(rotationDifference);
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
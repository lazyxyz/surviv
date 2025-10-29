import { GameConstants, Layer } from "@common/constants";
import { Explosions, type ExplosionDefinition } from "@common/definitions/explosions";
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
import { Explosion } from "../explosion";

/**
 * Boomer Class
 * Represents a specialized boss player character with unique traits and behaviors.
 * Moves like a Ghost: directly chases a random living Gamer player and attacks when in range.
 * On death, triggers a massive explosion damaging nearby entities.
 */
export class Boomer extends Player {
    private static readonly CHASE_DISTANCE = 40; // Rage radius to start attacking
    private static readonly ROTATION_RATE = 0.35; // Maximum rotation speed per update
    private static readonly IDLE_ROTATION_SPEED = 0.1; // Rotation speed when idling
    private static readonly SAFE_DISTANCE_FROM_PLAYER = 5; // Minimum distance from target
    private static readonly BASE_SPEED = GameConstants.player.baseSpeed * 0.5; // Base speed for chasing
    private static readonly BASE_APS = 0.8; // Base attacks per second (slower attack)
    private static readonly HEALTH_MULTIPLIER_PER_LEVEL = 0.1; // 10% health increase per level (tankier)
    private static readonly SPEED_MULTIPLIER_PER_LEVEL = 0.01; // 1% speed increase per level
    private static readonly APS_MULTIPLIER_PER_LEVEL = 0.02; // 2% attack speed increase per level
    private static readonly EXPLOSION_DAMAGE_MOD_BASE = 0.5; // Base explosion damage mod
    private static readonly EXPLOSION_DAMAGE_MOD_PER_LEVEL = 0.1; // 10% increase per level
    private static readonly NAMES = ["Boomer", "Exploder", "Detonator", "Burster", "Blast", "Kaboom", "Fuser", "Volatile"]; // Thematic names for Boomer

    private rotationDirection: number = 1; // Direction for idle rotation (1 or -1)
    private target: Gamer | null = null; // Current target Gamer to chase
    private attackCooldown: number = 0; // Cooldown timer for attacks (in ticks)
    private readonly attackInterval: number; // Interval between attacks (in ticks)
    private readonly explosionDamageMod: number; // Level-based explosion damage multiplier

    constructor(game: Game, userData: ActorContainer, position: Vector, layer?: Layer, team?: Team, level: number = 1) {
        super(game, userData, position, layer, team);
        this.health = this.health * 0.8; // Base health adjustment for Boomer (tankier)

        // Apply level-based multipliers
        const healthMultiplier = 1 + Boomer.HEALTH_MULTIPLIER_PER_LEVEL * (level - 1);
        this.health *= healthMultiplier;

        this.baseSpeed = Boomer.BASE_SPEED * (1 + Boomer.SPEED_MULTIPLIER_PER_LEVEL * (level - 1));

        const aps = Boomer.BASE_APS * (1 + Boomer.APS_MULTIPLIER_PER_LEVEL * (level - 1));
        this.attackInterval = Math.floor(Config.tps / aps);

        // Calculate level-based explosion damage mod: starts at 0.5, +10% per level
        this.explosionDamageMod = Boomer.EXPLOSION_DAMAGE_MOD_BASE * (1 + Boomer.EXPLOSION_DAMAGE_MOD_PER_LEVEL * (level - 1));

        this.isMobile = true;
        this.name = this.getRandomName(); // Assign random name
        this.loadout.skin = Skins.fromString("zone"); // Assuming a boomer skin exists
        this.inventory.scope = Scopes.definitions[0];

        // Set initial inventory with 20% chance for cola
        const randomCola = Math.random() < 0.2 ? 1 : 0;
        this.inventory.items.setItem('cola', randomCola);

        // Pick initial target
        this.target = this.pickNewTarget();
    }

    /**
     * Generate a random name from the NAMES list.
     */
    private getRandomName(): string {
        const index = Math.floor(Math.random() * Boomer.NAMES.length);
        return Boomer.NAMES[index];
    }

    /**
     * Pick a new random living Gamer target from connectedPlayers.
     */
    private pickNewTarget(): Gamer | null {
        const candidates = Array.from(this.game.livingPlayers).filter(
            (p): p is Gamer => p instanceof Gamer && !p.dead && !p.downed
        );
        if (candidates.length === 0) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    die(params: Omit<DamageParams, "amount">) {
        // Set dead first to prevent self-damage recursion in explosion
        this.dead = true;
        this.setDirty();

        this.game.totalBots--;
        this.dropLoot();

        // Trigger explosion on death (now safe since dead is set)
        const explosion = new Explosion(
            this.game,
            Explosions.fromString('barrel_explosion'),
            this.position,
            this, // Source is the Boomer itself
            this.layer,
            undefined, // No specific weapon
            this.explosionDamageMod // Use level-based damage mod
        );
        explosion.explode();

        super.die(params);
    }

    /**
     * Drop loot based on probabilities when the boomer dies.
     */
    private dropLoot(): void {
        // Higher chances for loot since it's a boss
        if (Math.random() < 0.05) {
            const amount = Math.floor(randomFloat(100, 200));
            this.game.addLoot('9mm', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.05) {
            const amount = Math.floor(randomFloat(40, 100));
            this.game.addLoot('12g', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.05) {
            const amount = Math.floor(randomFloat(80, 160));
            this.game.addLoot('556mm', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.05) {
            const amount = Math.floor(randomFloat(80, 160));
            this.game.addLoot('762mm', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.05) {
            const amount = Math.floor(randomFloat(40, 100));
            this.game.addLoot('50cal', this.position, this.layer, { count: amount });
        }
        if (Math.random() < 0.05) {
            const amount = Math.floor(randomFloat(40, 100));
            this.game.addLoot('338lap', this.position, this.layer, { count: amount });
        }

        // 1% chance for curadell (1 amount) - higher for boss
        if (Math.random() < 0.01) {
            this.game.addLoot('curadell', this.position, this.layer, { count: 1 });
        }
    }

    update(): void {
        super.update();

        // Re-pick target if current is invalid
        if (!this.target || this.target.dead || this.target.downed) {
            this.target = this.pickNewTarget();
        }

        // Chase and attack logic
        if (this.target) {
            const distToTarget = Vec.length(Vec.sub(this.target.position, this.position));

            // Update attack cooldown
            this.attackCooldown -= 1;

            let isAttacking = false;
            if (distToTarget < Boomer.CHASE_DISTANCE && this.attackCooldown <= 0) {
                isAttacking = true;
                this.attackCooldown = this.attackInterval; // Reset cooldown
            }

            // Move towards target
            this.moveToTarget(this.target.position, Boomer.SAFE_DISTANCE_FROM_PLAYER, isAttacking);
        } else {
            // Idle if no target
            this.idle();
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

        this.rotation += Boomer.IDLE_ROTATION_SPEED * this.rotationDirection;
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
            this.rotation += Math.min(Math.abs(rotationDifference), Boomer.ROTATION_RATE) * Math.sign(rotationDifference);
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
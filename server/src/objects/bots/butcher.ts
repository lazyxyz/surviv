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
import { MeleeItem } from "../../inventory/meleeItem";
import { SAFE_DISTANCE_FROM_PLAYER } from "./common";

/**
 * Butcher Class
 * Represents a specialized player character wielding a chainsaw, chasing and attacking players like a Ghost.
 * Directly chases a random living Gamer player and melee attacks when in range at a leveled rate.
 */
export class Butcher extends Player {
    private static readonly CHASE_DISTANCE = 40; // Rage radius to start attacking
    private static readonly ROTATION_RATE = 0.35; // Maximum rotation speed per update
    private static readonly IDLE_ROTATION_SPEED = 0.1; // Rotation speed when idling
    private static readonly BASE_SPEED = GameConstants.player.baseSpeed * 0.6; // Slightly faster than Ghost
    private static readonly BASE_APS = 1.5; // Base attacks per second (1.5 attacks per second)
    private static readonly HEALTH_MULTIPLIER_PER_LEVEL = 0.05; // 5% health increase per level
    private static readonly SPEED_MULTIPLIER_PER_LEVEL = 0.02; // 2% speed increase per level
    private static readonly APS_MULTIPLIER_PER_LEVEL = 0.03; // 3% attack speed increase per level
    private static readonly NAMES = ["Butcher", "Slaughterer", "Cleaver", "Reaper", "Hack", "Gore", "Mangler", "Carver"]; // Thematic names for Butcher

    private rotationDirection: number = 1; // Direction for idle rotation (1 or -1)
    private target: Gamer | null = null; // Current target Gamer to chase
    private attackCooldown: number = 0; // Cooldown timer for attacks (in ticks)
    private readonly attackInterval: number; // Interval between attacks (in ticks)

    constructor(game: Game, userData: ActorContainer, position: Vector, layer?: Layer, team?: Team, level: number = 1) {
        super(game, userData, position, layer, team);
        this.isMobile = true;
        this.name = this.getRandomName(); // Assign random name
        this.loadout.skin = Skins.fromString("skeleton"); // Assuming a butcher skin exists
        this.inventory.scope = Scopes.definitions[0];
        this.health = this.health * 0.4; // Adjust health as needed

        // Apply level-based multipliers
        const healthMultiplier = 1 + Butcher.HEALTH_MULTIPLIER_PER_LEVEL * (level - 1);
        this.health *= healthMultiplier;

        this.baseSpeed = Butcher.BASE_SPEED * (1 + Butcher.SPEED_MULTIPLIER_PER_LEVEL * (level - 1));

        const aps = Butcher.BASE_APS * (1 + Butcher.APS_MULTIPLIER_PER_LEVEL * (level - 1));
        this.attackInterval = Math.floor(Config.tps / aps); // TPS is 40, base interval ≈ 40 / 1.5 ≈ 26 ticks

        // Pick initial target
        this.target = this.pickNewTarget();
        this.inventory.weapons[2] = new MeleeItem("chainsaw", this);
    }

    /**
     * Generate a random name from the NAMES list.
     */
    private getRandomName(): string {
        const index = Math.floor(Math.random() * Butcher.NAMES.length);
        return Butcher.NAMES[index];
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
        this.game.totalBots--;
        this.dropLoot();
        super.die(params);
    }

    /**
     * Drop loot based on probabilities when the butcher dies.
     */
    private dropLoot(): void {
        // Similar to Ghost: 1% chance for each ammo type with random amount in range
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
            if (distToTarget < Butcher.CHASE_DISTANCE && this.attackCooldown <= 0) {
                isAttacking = true;
                this.attackCooldown = this.attackInterval; // Reset cooldown
            }

            // Move towards target
            this.moveToTarget(this.target.position, SAFE_DISTANCE_FROM_PLAYER, isAttacking);
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

        this.rotation += Butcher.IDLE_ROTATION_SPEED * this.rotationDirection;
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
            this.rotation += Math.min(Math.abs(rotationDifference), Butcher.ROTATION_RATE) * Math.sign(rotationDifference);
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

    override handleDeathDrops(position: Vector, layer: number): void {
        this.inventory.cleanInventory();
    }

    override handleDeathMarker(): void {}
}
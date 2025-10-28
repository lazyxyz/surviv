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

enum GhostSkill {
    Rage = "Rage",
    None = "None"
}

/**
 * Ghost Class
 * Represents a specialized player character with unique traits and behaviors.
 * Ghosts directly chase a random living Gamer player and attack when in range at a leveled rate.
 */
export class Ghost extends Player {
    private static readonly CHASE_DISTANCE = 40; // Rage radius to start attacking
    private static readonly ROTATION_RATE = 0.35; // Maximum rotation speed per update
    private static readonly IDLE_ROTATION_SPEED = 0.1; // Rotation speed when idling
    private static readonly SAFE_DISTANCE_FROM_PLAYER = 5; // Minimum distance from target
    private static readonly BASE_SPEED = GameConstants.player.baseSpeed * 0.5; // Base chase speed (faster than Zombie)
    private static readonly BASE_APS = 2; // Base attacks per second (2 attack per second)
    private static readonly HEALTH_MULTIPLIER_PER_LEVEL = 0.05; // 5% health increase per level
    private static readonly SPEED_MULTIPLIER_PER_LEVEL = 0.02; // 2% speed increase per level
    private static readonly APS_MULTIPLIER_PER_LEVEL = 0.03; // 3% attack speed increase per level
    private static readonly NAMES = ["Wraith", "Specter", "Phantom", "Shade", "Apparition", "Spirit", "Banshee", "Poltergeist"]; // Thematic names for Ghost
    private static readonly RAGE_SKILL_CHANCE = 0.05; // 5% chance to have Rage skill (configurable)

    private rotationDirection: number = 1; // Direction for idle rotation (1 or -1)
    private target: Gamer | null = null; // Current target Gamer to chase
    private attackCooldown: number = 0; // Cooldown timer for attacks (in ticks)
    private readonly attackInterval: number; // Interval between attacks (in ticks)
    private leveledSpeed: number; // Leveled base speed (modifiable for skills)
    private skill: GhostSkill = GhostSkill.None; // Assigned skill

    constructor(game: Game, userData: ActorContainer, position: Vector, layer?: Layer, team?: Team, level: number = 1) {
        super(game, userData, position, layer, team);
        this.isMobile = true;
        this.name = this.getRandomName(); // Assign random name
        this.loadout.skin = Skins.fromString("ghost");
        this.inventory.scope = Scopes.definitions[0];

        // Apply level-based multipliers
        const healthMultiplier = 1 + Ghost.HEALTH_MULTIPLIER_PER_LEVEL * (level - 1);
        this.maxHealth *= healthMultiplier;
        this.health = this.maxHealth; // Set health to new max

        this.leveledSpeed = Ghost.BASE_SPEED * (1 + Ghost.SPEED_MULTIPLIER_PER_LEVEL * (level - 1));

        const aps = Ghost.BASE_APS * (1 + Ghost.APS_MULTIPLIER_PER_LEVEL * (level - 1));
        this.attackInterval = Math.floor(Config.tps / aps); // TPS is 40, base interval = 40 / 1 = 40 ticks (1s)

        // Assign skill with chance
        this.skill = Math.random() < Ghost.RAGE_SKILL_CHANCE ? GhostSkill.Rage : GhostSkill.None;

        // Pick initial target
        this.target = this.pickNewTarget();
    }

    /**
     * Generate a random name from the NAMES list.
     */
    private getRandomName(): string {
        const index = Math.floor(Math.random() * Ghost.NAMES.length);
        return Ghost.NAMES[index];
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
     * Drop loot based on probabilities when the ghost dies.
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

        // Re-pick target if current is invalid
        if (!this.target || this.target.dead || this.target.downed) {
            this.target = this.pickNewTarget();
        }

        // Apply skills if applicable
        if (this.skill === GhostSkill.Rage && this.health < this.maxHealth * 0.3) {
            this.baseSpeed = this.leveledSpeed * 1.5; // 50% speed increase
        } else {
            this.baseSpeed = this.leveledSpeed; // Reset to normal
        }

        // Chase and attack logic
        if (this.target) {
            const distToTarget = Vec.length(Vec.sub(this.target.position, this.position));

            // Update attack cooldown
            this.attackCooldown -= 1;

            let isAttacking = false;
            if (distToTarget < Ghost.CHASE_DISTANCE && this.attackCooldown <= 0) {
                isAttacking = true;
                this.attackCooldown = this.attackInterval; // Reset cooldown
            }

            // Move towards target
            this.moveToTarget(this.target.position, Ghost.SAFE_DISTANCE_FROM_PLAYER, isAttacking);
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

        this.rotation += Ghost.IDLE_ROTATION_SPEED * this.rotationDirection;
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
            this.rotation += Math.min(Math.abs(rotationDifference), Ghost.ROTATION_RATE) * Math.sign(rotationDifference);
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
}
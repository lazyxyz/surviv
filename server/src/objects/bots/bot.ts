import { GameConstants, KillfeedEventType, Layer } from "@common/constants";
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
import { Obstacle } from "../obstacle";
const SAFE_DISTANCE_FROM_PLAYER = 5.5;

/**
 * Enum for bot behavior types.
 */
export enum BehaviorType {
    ProximityAttack, // Attack when player is near (like Zombie/Werewolf)
    ChaseRandom,     // Chase a random player directly (like Ghost)
    HideAndAttack,    // Hide in trees/bushes, attack if near (like Ninja)
    LockOnChase, // Combination: Acquire target if player enters chase range, then chase forever until invalid; wander otherwise
}

/**
 * Base Bot Class
 * Abstract base class for all bots, extending Player with common bot behaviors.
 */
export abstract class Bot extends Player {
    protected behaviorType: BehaviorType = BehaviorType.ProximityAttack;
    protected names: string[] = [];

    /**
  * Direction for idle rotation (1 or -1).
  * Used to simulate subtle, random turning when the bot is idling.
  */
    protected rotationDirection: number = 1;

    /**
     * Cooldown timer for attacks (in ticks).
     * Decremented each update; when <= 0, the bot can attack again.
     */
    protected attackCooldown: number = 0;

    /**
     * Base attacks per second (APS) for the bot.
     * Used to calculate attack interval: Math.floor(Config.tps / baseAps).
     */
    protected baseAps: number = 2;

    /**
     * Flag to determine if the bot uses an attack cooldown mechanism.
     * If false, the bot attacks continuously when in range (e.g., for certain aggressive behaviors).
     */
    protected useAttackCooldown: boolean = true;

    /**
     * Distance threshold to start chasing a target player (in game units).
     * Adjusted dynamically in subclasses via getChaseDistance() for behaviors like stage-based increases.
     */
    protected chaseDistance: number = 40;

    /**
     * Distance threshold to start attacking a target player (in game units).
     * Often the same as chaseDistance, but can be customized.
     */
    protected attackDistance: number = 10;

    /**
     * Base speed multiplier for chasing targets.
     * Applied to GameConstants.player.baseSpeed; scaled by speedMult and enragedMultiplier.
     */
    protected baseChaseSpeed: number = GameConstants.player.baseSpeed * 0.5;

    /**
     * Speed multiplier for wandering toward the safe zone.
     * Slower than chase speed to simulate cautious movement.
     */
    protected wanderSpeed: number = GameConstants.player.baseSpeed * 0.3;

    /**
     * Minimum duration (in seconds) before picking a new wander target.
     * Used in ProximityAttack behavior to create varied patrolling.
     */
    protected minMoveDuration: number = 1;

    /**
     * Maximum duration (in seconds) before picking a new wander target.
     * Randomized between min and max for unpredictable movement.
     */
    protected maxMoveDuration: number = 5;

    /**
     * Distance from gas center to consider the bot "at" the safe zone (in game units).
     * If within this proximity, the bot idles instead of wandering.
     */
    protected centerProximity: number = 100;

    /**
     * Health percentage threshold (0-1) below which the bot enters enraged mode.
     * Only used if enragedMultiplier > 1; increases speed and APS.
     */
    protected enragedHealthThreshold: number = 0.5;

    /**
     * Multiplier applied to speed and APS when the bot is enraged (low health).
     * Set to 1 in base class; subclasses like Werewolf set to 1.5 for 50% boost.
     */
    protected enragedMultiplier: number = 1;

    /**
     * Level-based speed multiplier (starts at 1, increases per level).
     * Applied to baseChaseSpeed and wanderSpeed for progression.
     */
    protected speedMult: number = 1;

    /**
     * Level-based attack speed multiplier (starts at 1, increases per level).
     * Applied to baseAps for faster attacks at higher levels.
     */
    protected apsMult: number = 1;

    /**
     * Current target Gamer to chase (for ChaseRandom behavior).
     * Repicked if invalid (dead/downed); null if no living players.
     */
    protected target: Gamer | null = null;

    /**
     * Timer tracking time since last wander target change (in seconds).
     * Incremented by 1 / Config.tps each update.
     */
    protected moveTimer: number = 0;

    /**
     * Current randomized duration for the ongoing wander movement (in seconds).
     * Set via getRandomMoveDuration() when picking a new target.
     */
    protected currentMoveDuration: number = 0;

    /**
     * Current wander target position (random point on gas radius).
     * Used in ProximityAttack to move toward safe zone when no player target.
     */
    protected wanderTarget: Vector | null = null;

    // For HideAndAttack behavior (e.g., Ninja-specific logic integrated into base for flexibility)

    /**
     * Timer tracking time spent at the current hide spot (in seconds).
     * Incremented by 1 / Config.tps; triggers move to new spot after currentHideDuration.
     */
    protected hideTimer: number = 0;

    /**
     * Position of the last assigned hide spot (e.g., bush or tree).
     * Used to return to or check proximity during hiding behavior.
     */
    protected lastHideSpot: Vector | null = null;

    /**
     * Flag indicating if the bot is en route to the gas radius (fallback when no hide spots found).
     * Checked in moveToTarget to intercept with nearby hide spots.
     */
    protected movingToRadius: boolean = false;

    /**
     * Cached nearest hide spot Obstacle for performance.
     * Updated if cache is stale (e.g., >1s old or moved >25 units).
     */
    protected cachedHideSpot: Obstacle | null = null;

    /**
     * Timestamp of the last cache update for hide spots (using game.now).
     * Ensures cache validity within 1000ms.
     */
    protected lastCacheUpdate: number = 0;

    /**
     * Position at the time of last cache update.
     * Used to invalidate cache if bot has moved significantly (>25 units).
     */
    protected lastCachePosition: Vector | null = null;

    /**
     * Safe stopping distance when approaching a hide spot (in game units).
     * Bots stop moving once within this distance to "hide."
     */
    protected safeDistanceHideSpot: number = 0.5;

    /**
     * Minimum squared distance buffer from gas edge when selecting new hide spots.
     * Ensures spots are safely inside the current safe zone.
     */
    protected minDistanceToGas: number = 30;

    /**
     * Increment per gas stage for chase/attack radius scaling.
     * Applied in getChaseDistance(): chaseDistance * (1 + radiusIncrement * stage).
     */
    protected radiusIncrement: number = 0;

    /**
     * Increment per gas stage for speed scaling.
     * Applied in getSpeedMult(): speedMult * (1 + speedIncrement * stage).
     */
    protected speedIncrement: number = 0;

    constructor(game: Game, userData: ActorContainer, position: Vector, behaviorType: BehaviorType, names: string[], skinId: string, layer?: Layer, team?: Team) {
        super(game, userData, position, layer, team);
        this.isMobile = true;
        this.names = names;
        this.name = this.getRandomName();
        this.loadout.skin = Skins.fromString(skinId);
        this.inventory.scope = Scopes.definitions[0];
        this.behaviorType = behaviorType;
        if (this.behaviorType === BehaviorType.HideAndAttack) {
            this.hideTimer = 0;
            this.currentMoveDuration = this.getRandomMoveDuration();
        } else {
            this.currentMoveDuration = this.getRandomMoveDuration();
        }
    }

    protected getRandomName(): string {
        const index = Math.floor(Math.random() * this.names.length);
        return this.names[index];
    }

    protected pickNewTarget(): Gamer | null {
        const candidates = Array.from(this.game.livingPlayers).filter(
            (p): p is Gamer => p instanceof Gamer && !p.dead && !p.downed
        );
        if (candidates.length === 0) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    protected getChaseDistance(): number {
        return this.chaseDistance * (1 + this.radiusIncrement * this.game.gas.stage);
    }

    protected getAttackDistance(): number {
        return this.getChaseDistance();
    }

    protected getSpeedMult(): number {
        return this.speedMult * (1 + this.speedIncrement * this.game.gas.stage);
    }

    protected getApsMult(): number {
        return this.apsMult;
    }

    protected getRotationRate(): number {
        return 0.35;
    }

    protected getIdleRotationSpeed(): number {
        return 0.1;
    }

    protected checkEnraged(): boolean {
        return false;
    }

    protected handleSpecialEffects(): void {
        // Override in subclasses if needed (e.g., Ghost particle check)
    }

    protected onDie(): void {
        // Override in subclasses if needed (e.g., decrement totalBots)
    }

    update(): void {
        super.update();
        this.handleSpecialEffects();
        if (this.useAttackCooldown) this.attackCooldown = Math.max(0, this.attackCooldown - 1);
        const target = this.findTarget();
        if (target) {
            this.handleChase(target);
        } else {
            this.handleNoTarget();
        }
    }

    protected findTarget(): Gamer | null {
        switch (this.behaviorType) {
            case BehaviorType.ChaseRandom:
                if (!this.target || this.target.dead || this.target.downed) {
                    this.target = this.pickNewTarget();
                }
                return this.target;
            case BehaviorType.ProximityAttack:
            case BehaviorType.HideAndAttack:
                let minDist = Infinity;
                let nearest: Gamer | null = null;
                const chaseDist = this.getChaseDistance();
                for (const obj of this.visibleObjects) {
                    if (obj instanceof Gamer && !obj.dead && !obj.downed) {
                        const dist = Vec.length(Vec.sub(obj.position, this.position));
                        if (dist < chaseDist && dist < minDist) {
                            minDist = dist;
                            nearest = obj;
                        }
                    }
                }
                return nearest;
            case BehaviorType.LockOnChase:
                if (this.target && !this.target.dead && !this.target.downed) {
                    return this.target;
                } else {
                    this.target = null;
                    let minDist = Infinity;
                    let nearest: Gamer | null = null;
                    const chaseDist = this.getChaseDistance();
                    for (const obj of this.visibleObjects) {
                        if (obj instanceof Gamer && !obj.dead && !obj.downed) {
                            const dist = Vec.length(Vec.sub(obj.position, this.position));
                            if (dist < chaseDist && dist < minDist) {
                                minDist = dist;
                                nearest = obj;
                            }
                        }
                    }
                    if (nearest) {
                        this.target = nearest;
                    }
                    return this.target;
                }
            default:
                return null;
        }
    }

    protected handleChase(target: Gamer): void {
        const distToTarget = Vec.length(Vec.sub(target.position, this.position));
        let speedMult = this.getSpeedMult();
        if (this.checkEnraged()) speedMult *= this.enragedMultiplier;
        this.baseSpeed = this.baseChaseSpeed * speedMult;
        const isAttacking = distToTarget < this.getAttackDistance() && this.canAttack();
        this.moveToTarget(target.position, SAFE_DISTANCE_FROM_PLAYER, isAttacking);
    }

    protected canAttack(): boolean {
        if (this.useAttackCooldown) {
            if (this.attackCooldown <= 0) {
                let aps = this.baseAps * this.getApsMult();
                if (this.checkEnraged()) aps *= this.enragedMultiplier;
                this.attackCooldown = Math.floor(Config.tps / aps);
                return true;
            }
            return false;
        } else {
            return true;
        }
    }

    protected handleNoTarget(): void {
        switch (this.behaviorType) {
            case BehaviorType.ChaseRandom:
                this.idle();
                break;
            case BehaviorType.ProximityAttack:
            case BehaviorType.LockOnChase:
                this.wanderOrIdle();
                break;
            case BehaviorType.HideAndAttack:
                this.hideInSafeSpot();
                break;
        }
    }

    protected wanderOrIdle(): void {
        this.moveTimer += 1 / Config.tps;
        const currentDistanceToGas = Vec.length(Vec.sub(this.game.gas.newPosition, this.position));
        if (currentDistanceToGas <= this.centerProximity || !this.game.isStarted()) {
            this.moveTimer = 0;
            this.wanderTarget = null;
            this.idle();
            return;
        }
        if (this.moveTimer >= this.currentMoveDuration || !this.wanderTarget) {
            this.wanderTarget = this.getRandomRadiusPosition();
            this.moveTimer = 0;
            this.currentMoveDuration = this.getRandomMoveDuration();
        }
        if (this.wanderTarget) {
            let speedMult = this.getSpeedMult();
            if (this.checkEnraged()) speedMult *= this.enragedMultiplier;
            this.baseSpeed = this.wanderSpeed * speedMult;
            this.moveToTarget(this.wanderTarget, 0, false);
        } else {
            this.idle();
        }
    }

    protected getRandomMoveDuration(): number {
        const distanceToGasCenterSq = Vec.squaredLength(Vec.sub(this.game.gas.newPosition, this.position));
        if (distanceToGasCenterSq > this.game.gas.newRadius * this.game.gas.newRadius) {
            return 0;
        }
        let duration = Math.random() * (this.maxMoveDuration - this.minMoveDuration) + this.minMoveDuration;
        if (this.behaviorType === BehaviorType.HideAndAttack && distanceToGasCenterSq > this.game.gas.newRadius * this.game.gas.newRadius) {
            duration /= 3;
        }
        return duration;
    }

    protected getRandomRadiusPosition(): Vector {
        const randomAngle = Math.random() * 2 * Math.PI;
        return Vec.add(this.game.gas.newPosition, {
            x: Math.cos(randomAngle) * this.game.gas.newRadius,
            y: Math.sin(randomAngle) * this.game.gas.newRadius
        });
    }

    protected hideInSafeSpot(): void {
        if (this.game.gas.isInGas(this.position)) {
            this.moveToSafePosition();
            return;
        }
        if (!this.game.isStarted()) {
            this.holdPositionPreGame();
            return;
        }
        this.hideTimer += 1 / Config.tps;
        const currentDistanceToGasSq = Vec.squaredLength(Vec.sub(this.game.gas.newPosition, this.position));
        if (currentDistanceToGasSq <= this.centerProximity * this.centerProximity) {
            this.moveToNearestHideSpot(currentDistanceToGasSq);
        } else if (this.hideTimer >= this.currentMoveDuration || !this.lastHideSpot) {
            this.moveToNewHideSpot(currentDistanceToGasSq);
        } else if (this.lastHideSpot) {
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.movingToRadius = false;
            this.moveToTarget(this.lastHideSpot, this.safeDistanceHideSpot, false);
        }
    }

    private holdPositionPreGame(): void {
        if (this.lastHideSpot) {
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.movingToRadius = false;
            this.moveToTarget(this.lastHideSpot, this.safeDistanceHideSpot, false);
        } else {
            const nearestHideSpot = this.findNearestObject<Obstacle>(Obstacle, (obj) =>
                ["bush", "tree"].includes(obj.definition.material) &&
                !obj.dead &&
                !this.game.gas.isInGas(obj.position)
            );
            if (nearestHideSpot) {
                this.lastHideSpot = Vec.clone(nearestHideSpot.position);
                this.baseSpeed = GameConstants.player.baseSpeed;
                this.movingToRadius = false;
                this.moveToTarget(nearestHideSpot.position, this.safeDistanceHideSpot, false);
            } else {
                this.movingToRadius = false;
                this.idle();
            }
        }
    }

    private moveToNearestHideSpot(currentDistanceToGasSq: number): void {
        const nearestHideSpot = this.findNearestObject<Obstacle>(Obstacle, (obj) =>
            ["bush", "tree"].includes(obj.definition.material) &&
            !obj.dead &&
            !this.game.gas.isInGas(obj.position)
        );

        if (nearestHideSpot) {
            this.lastHideSpot = Vec.clone(nearestHideSpot.position);
            this.hideTimer = 0;
            this.currentMoveDuration = this.getRandomMoveDuration();
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.movingToRadius = false;
            this.moveToTarget(nearestHideSpot.position, this.safeDistanceHideSpot, false);
        } else {
            this.hideTimer = 0;
            this.lastHideSpot = Vec.clone(this.position);
            this.movingToRadius = false;
        }
    }

    private moveToNewHideSpot(currentDistanceToGasSq: number): void {
        const nearestHideSpot = this.findNearestObject<Obstacle>(Obstacle, (obj) =>
            ["bush", "tree"].includes(obj.definition.material) &&
            !obj.dead &&
            !this.game.gas.isInGas(obj.position) &&
            Vec.squaredLength(Vec.sub(this.game.gas.newPosition, obj.position)) <= currentDistanceToGasSq - this.minDistanceToGas * this.minDistanceToGas &&
            (!this.lastHideSpot || Vec.squaredLength(Vec.sub(obj.position, this.lastHideSpot)) > 2 * this.safeDistanceHideSpot * this.safeDistanceHideSpot)
        );

        if (nearestHideSpot) {
            this.lastHideSpot = Vec.clone(nearestHideSpot.position);
            this.hideTimer = 0;
            this.currentMoveDuration = this.getRandomMoveDuration();
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.movingToRadius = false;
            this.moveToTarget(nearestHideSpot.position, this.safeDistanceHideSpot, false);
        } else {
            this.lastHideSpot = null;
            this.hideTimer = 0;
            this.currentMoveDuration = 0;
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.movingToRadius = true;
            const radiusTarget = this.getRandomRadiusPosition();
            this.moveToTarget(radiusTarget, 0, false);
        }
    }

    private moveToSafePosition(): void {
        const currentDistanceToGasSq = Vec.squaredLength(Vec.sub(this.game.gas.newPosition, this.position));

        const nearestHideSpot = this.findNearestObject<Obstacle>(Obstacle, (obj) =>
            ["bush", "tree"].includes(obj.definition.material) &&
            !obj.dead &&
            !this.game.gas.isInGas(obj.position) &&
            Vec.squaredLength(Vec.sub(this.game.gas.newPosition, obj.position)) < currentDistanceToGasSq
        );

        if (nearestHideSpot) {
            this.lastHideSpot = Vec.clone(nearestHideSpot.position);
            this.hideTimer = 0;
            this.currentMoveDuration = this.getRandomMoveDuration();
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.movingToRadius = false;
            this.moveToTarget(nearestHideSpot.position, this.safeDistanceHideSpot, false);
        } else {
            this.lastHideSpot = null;
            this.hideTimer = 0;
            this.currentMoveDuration = this.getRandomMoveDuration();
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.movingToRadius = true;
            const radiusTarget = this.getRandomRadiusPosition();
            this.moveToTarget(radiusTarget, 0, false);
        }
    }

    protected findNearestObject<T>(type: new (...args: any[]) => T, filter?: (obj: T) => boolean): T | null {
        if (
            this.cachedHideSpot &&
            this.game.now - this.lastCacheUpdate < 1000 &&
            this.lastCachePosition &&
            Vec.squaredLength(Vec.sub(this.position, this.lastCachePosition)) < 25 * 25 &&
            (!filter || filter(this.cachedHideSpot as unknown as T))
        ) {
            return this.cachedHideSpot as unknown as T;
        }

        let nearestObject: T | null = null;
        let nearestDistance = Infinity;

        for (const obj of this.visibleObjects) {
            if (obj instanceof type && (!filter || filter(obj))) {
                const distance = Vec.squaredLength(Vec.sub(obj.position, this.position));
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestObject = obj;
                }
            }
        }

        if (nearestObject instanceof Obstacle) {
            this.cachedHideSpot = nearestObject;
            this.lastCacheUpdate = this.game.now;
            this.lastCachePosition = Vec.clone(this.position);
        }
        return nearestObject;
    }

    protected moveToTarget(targetPosition: Vector, safeDistance: number, isAttacking: boolean): void {
        if (this.behaviorType === BehaviorType.HideAndAttack && this.movingToRadius) {
            const nearestHideSpot = this.findNearestObject<Obstacle>(Obstacle, (obj) =>
                ["bush", "tree"].includes(obj.definition.material) &&
                !obj.dead &&
                !this.game.gas.isInGas(obj.position) &&
                Vec.squaredLength(Vec.sub(this.game.gas.newPosition, obj.position)) <= Vec.squaredLength(Vec.sub(this.game.gas.newPosition, this.position))
            );

            if (nearestHideSpot) {
                this.lastHideSpot = Vec.clone(nearestHideSpot.position);
                this.hideTimer = 0;
                this.currentMoveDuration = this.getRandomMoveDuration();
                this.movingToRadius = false;
                targetPosition = nearestHideSpot.position;
                safeDistance = this.safeDistanceHideSpot;
                isAttacking = false;
            }
        }

        const directionToTarget = Vec.normalize(Vec.sub(targetPosition, this.position));
        const distanceToTarget = Vec.length(Vec.sub(targetPosition, this.position));
        const desiredRotation = Math.atan2(directionToTarget.y, directionToTarget.x);
        let rotationDifference = desiredRotation - this.rotation;
        rotationDifference = Math.atan2(Math.sin(rotationDifference), Math.cos(rotationDifference));
        const rotationThreshold = 0.05;
        if (Math.abs(rotationDifference) > rotationThreshold) {
            this.rotation += Math.min(Math.abs(rotationDifference), this.getRotationRate()) * Math.sign(rotationDifference);
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
        this.processInputs(packet);
    }

    protected idle(): void {
        if (Math.random() < 0.01) {
            this.rotationDirection *= -1;
        }
        this.rotation += this.getIdleRotationSpeed() * this.rotationDirection;
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
        this.processInputs(packet);
    }

    override die(params: Omit<DamageParams, "amount">) {
        this.onDie();
        super.die(params);
    }

    override isBot(): boolean {
        return true;
    }

    override handleDeathDrops(position: Vector, layer: number): void {
        this.inventory.cleanInventory();
    }

    override handleDeathMarker(): void { }


}

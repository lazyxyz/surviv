import { GameConstants, Layer } from "@common/constants";
import { type Vector, Vec } from "@common/utils/vector";
import { Game } from "../../game";
import { Team } from "../../team";
import { Player, ActorContainer } from "../player";
import { PlayerInputData } from "@common/packets/inputPacket";
import { Skins } from "@common/definitions/skins";
import { Gamer } from "../gamer";
import { Obstacle } from "../obstacle";
import { Scopes } from "@common/definitions/scopes";
import { GunItem } from "../../inventory/gunItem";
import { MeleeItem } from "../../inventory/meleeItem";
import { GunDefinition } from "@common/definitions/guns";
import { Config } from "../../config";

/**
 * Assassin Class
 * Represents a specialized player character with unique traits and behaviors.
 */
export class Assassin extends Player {
    private static ATTACK_RADIUS = 20; // Use melee attack when gamer too close
    private static SHOT_RADIUS = 60; // Use ranged attack within this radius

    private static readonly ATTACK_ROTATION_RATE = 0.35; // Maximum rotation speed per update
    private static readonly SHOT_ROTATION_RATE = 0.2; // Maximum rotation speed for shooting
    private static readonly SAFE_DISTANCE_HIDE_SPOT = 0.5; // Minimum distance to maintain from hiding spots
    private static readonly SAFE_DISTANCE_PLAYER = 5; // Minimum distance to maintain from players
    private static readonly AIM_DEVIATION = 0.07; // 7% aim deviation for shooting
    private static readonly BASE_ATTACK_SPEED = GameConstants.player.baseSpeed * 0.6; // Attack speed 60% of base
    private static readonly RADIUS_INCREMENT: number = 0.07; // Increase shot radius per gas stage
    private static readonly MIN_HIDE_DURATION = 5; // Minimum seconds to stay in a hiding spot
    private static readonly MAX_HIDE_DURATION = 15; // Maximum seconds to stay in a hiding spot
    private static readonly MIN_DISTANCE_TO_GAS = 30; // Minimum distance closer to gas safe zone
    private static readonly CENTER_PROXIMITY = 200; // Distance to consider bot "at" the gas safe zone

    private static readonly NAMES = ["Shadow", "Viper", "Specter", "Raven", "Ghost", "Wraith", "Shade", "Dusk"]; // Thematic names for Assassin

    private hideTimer: number = 0; // Tracks time spent in current hiding spot
    private lastHideSpot: Vector | null = null; // Tracks the current hiding spot position
    private currentHideDuration: number = this.getRandomHideDuration(); // Current random hide duration
    private movingToRadius: boolean = false; // Tracks if bot is moving to a random radius position
    private cachedHideSpot: Obstacle | null = null;
    private lastCacheUpdate: number = 0;
    private lastCachePosition: Vector | null = null;

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
        const index = Math.floor(Math.random() * Assassin.NAMES.length);
        return Assassin.NAMES[index];
    }

    /**
     * Generate a random hide duration or 0 if outside gas radius.
     */
    private getRandomHideDuration(): number {
        let duration = Math.random() * (Assassin.MAX_HIDE_DURATION - Assassin.MIN_HIDE_DURATION) + Assassin.MIN_HIDE_DURATION;
        const distanceToGasCenter = Vec.length(Vec.sub(this.game.gas.newPosition, this.position));
        // If outside gas newRadius, cut half time
        if (distanceToGasCenter > this.game.gas.newRadius) {
            duration /= 3;
        }
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

    private initializeLoadout(): void {
        this.loadout.skin = Skins.fromString("brush");
    }

    private initializeInventory(): void {
        const randomChance = Math.random() * 100;

        if (randomChance < 1) {
            this.equipWeapon("l115a1", '338lap', 12);
        } else if (randomChance < 6) {
            this.equipWeapon("vks", '50cal', 30);
        } else if (randomChance < 16) {
            this.equipWeapon("tango_51", '762mm', 90);
        } else if (randomChance < 26) {
            this.equipWeapon("mosin_nagant", '762mm', 90);
        } else if (randomChance < 56) {
            this.equipWeapon("sks", '762mm', 90);
        } else {
            this.equipWeapon("vss", '9mm', 120);
        }

        this.inventory.weapons[2] = new MeleeItem("kbar", this);
        this.inventory.setActiveWeaponIndex(0);
        this.inventory.scope = Scopes.definitions[2];

        const roll = Math.random(); // random number between 0 and 1

        if (roll < 0.5) {
            // 50% chance
            this.inventory.items.setItem('cola', 2);
        } else if (roll < 0.8) {
            // 30% chance (0.5 - 0.8)
            this.inventory.items.setItem('cola', 3);
        } else {
            // 20% chance (0.8 - 1.0)
            this.inventory.items.setItem('tablets', 2);
        }
    }

    private equipWeapon(weaponName: string, ammoType: string, ammoAmount: number): void {
        this.inventory.weapons[0] = new GunItem(weaponName, this);
        this.inventory.items.setItem(ammoType, ammoAmount);
    }

    update(): void {
        super.update();
        for (const obj of this.visibleObjects) {
            if (obj instanceof Gamer && !obj.dead && !obj.downed) {
                const distance = Vec.length(Vec.sub(obj.position, this.position));
                if (distance < Assassin.ATTACK_RADIUS) {
                    // Initiate melee attack if player is too close
                    this.initiateMeleeAttack(obj);
                    this.movingToRadius = false;
                    return;
                } else if (distance < this.shotRadius) {
                    this.inventory.setActiveWeaponIndex(0);
                    if (this.canFire()) {
                        // Shoot if player is within shot radius and can fire
                        this.shotNearestPlayer(obj);
                        this.movingToRadius = false;
                    } else if (distance < Assassin.ATTACK_RADIUS) {
                        // Fallback to melee if out of ammo
                        this.initiateMeleeAttack(obj);
                        this.movingToRadius = false;
                    }
                    return;
                }
            }
        }

        if (this.game.gas.isInGas(this.position)) {
            // Move to safe position if in gas
            this.moveToSafePosition();
        } else {
            // Hide in a safe spot
            this.hideInSafeSpot();
        }
    }

    /**
     * Calculate chase radius based on gas stage.
     */
    private get shotRadius(): number {
        const stageMultiplier = 1 + Assassin.RADIUS_INCREMENT * this.game.gas.stage;
        return Assassin.SHOT_RADIUS * stageMultiplier;
    }

    private initiateMeleeAttack(player: Gamer): void {
        this.inventory.setActiveWeaponIndex(2);
        this.attackNearestPlayer(player);
    }

    private canFire(): boolean {
        return this.inventory.items.hasItem((this.activeItemDefinition as GunDefinition).ammoType)
            || (this.inventory.activeWeapon instanceof GunItem && this.inventory.activeWeapon.ammo > 0);
    }

    private shotNearestPlayer(player: Gamer): void {
        const directionToPlayer = Vec.normalize(Vec.sub(player.position, this.position));
        const desiredRotation = Math.atan2(directionToPlayer.y, directionToPlayer.x);
        const rotationDifference = desiredRotation - this.rotation;
        const adjustedRotation = this.rotation + Math.min(Math.abs(rotationDifference), Assassin.SHOT_ROTATION_RATE) * Math.sign(rotationDifference);
        const randomRotation = (Math.random() * (Assassin.AIM_DEVIATION * 2)) - Assassin.AIM_DEVIATION;
        const rotation = adjustedRotation + (adjustedRotation * randomRotation);

        const packet: PlayerInputData = {
            movement: { up: false, down: false, left: false, right: false },
            attacking: !this.attacking,
            actions: [],
            isMobile: true,
            turning: true,
            mobile: {
                moving: false,
                angle: rotation,
            },
            rotation: rotation,
            distanceToMouse: 0,
        };

        // Process shooting input
        this.processInputs(packet);
    }

    private attackNearestPlayer(player: Gamer): void {
        // Attack nearest player with melee
        this.baseSpeed = Assassin.BASE_ATTACK_SPEED;
        this.moveToTarget(player.position, Assassin.SAFE_DISTANCE_PLAYER, !this.attacking);
    }

    private holdPositionPreGame(): void {
        if (this.lastHideSpot) {
            // Stay at current hiding spot
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.movingToRadius = false;
            this.moveToTarget(this.lastHideSpot, Assassin.SAFE_DISTANCE_HIDE_SPOT, false);
        } else {
            // Find nearest bush or tree to hide in
            const nearestHideSpot = this.findNearestObject<Obstacle>(Obstacle, (obj) =>
                ["bush", "tree"].includes(obj.definition.material) &&
                !obj.dead &&
                !this.game.gas.isInGas(obj.position)
            );
            if (nearestHideSpot) {
                // Move to initial hiding spot
                this.lastHideSpot = Vec.clone(nearestHideSpot.position);
                this.baseSpeed = GameConstants.player.baseSpeed;
                this.movingToRadius = false;
                this.moveToTarget(nearestHideSpot.position, Assassin.SAFE_DISTANCE_HIDE_SPOT, false);
            } else {
                // If no hiding spot, stay put
                this.movingToRadius = false;

                const packet: PlayerInputData = {
                    movement: { up: false, down: false, left: false, right: false },
                    attacking: false,
                    actions: [],
                    isMobile: true,
                    turning: true,
                    mobile: { moving: false, angle: this.rotation },
                    rotation: this.rotation,
                    distanceToMouse: 0,
                };

                this.processInputs(packet);
            }
        }
    }

    private hideInSafeSpot(): void {
        if (!this.game.isStarted()) {
            this.holdPositionPreGame();
            return;
        }

        this.hideTimer += 1 / Config.tps; // Assuming 60 FPS
        const currentDistanceToGas = Vec.length(Vec.sub(this.game.gas.newPosition, this.position));

        // If bot is within safe zone proximity, find nearest bush or tree
        if (currentDistanceToGas <= Assassin.CENTER_PROXIMITY) {
            const nearestHideSpot = this.findNearestObject<Obstacle>(Obstacle, (obj) =>
                ["bush", "tree"].includes(obj.definition.material) &&
                !obj.dead &&
                !this.game.gas.isInGas(obj.position)
            );

            if (nearestHideSpot) {
                // Move to nearest hiding spot
                this.lastHideSpot = Vec.clone(nearestHideSpot.position);
                this.hideTimer = 0;
                this.currentHideDuration = this.getRandomHideDuration();
                this.baseSpeed = GameConstants.player.baseSpeed;
                this.movingToRadius = false;
                this.moveToTarget(nearestHideSpot.position, Assassin.SAFE_DISTANCE_HIDE_SPOT, false);
            } else {
                // No hiding spot found, stay put
                this.hideTimer = 0;
                this.lastHideSpot = Vec.clone(this.position);
                this.movingToRadius = false;
            }
            return;
        }

        // Check if it's time to move to a new hiding spot
        if (this.hideTimer >= this.currentHideDuration || !this.lastHideSpot) {
            const nearestHideSpot = this.findNearestObject<Obstacle>(Obstacle, (obj) =>
                ["bush", "tree"].includes(obj.definition.material) &&
                !obj.dead &&
                !this.game.gas.isInGas(obj.position) &&
                Vec.length(Vec.sub(this.game.gas.newPosition, obj.position)) <= currentDistanceToGas - Assassin.MIN_DISTANCE_TO_GAS &&
                (!this.lastHideSpot || Vec.length(Vec.sub(obj.position, this.lastHideSpot)) > 2 * Assassin.SAFE_DISTANCE_HIDE_SPOT)
            );

            if (nearestHideSpot) {
                // Move to new hiding spot
                this.lastHideSpot = Vec.clone(nearestHideSpot.position);
                this.hideTimer = 0;
                this.currentHideDuration = this.getRandomHideDuration();
                this.baseSpeed = GameConstants.player.baseSpeed;
                this.movingToRadius = false;
                this.moveToTarget(nearestHideSpot.position, Assassin.SAFE_DISTANCE_HIDE_SPOT, false);
            } else {
                // Move to random point on gas radius, checking for hiding spots along the way
                this.lastHideSpot = null;
                this.hideTimer = 0;
                this.currentHideDuration = 0;
                this.baseSpeed = GameConstants.player.baseSpeed;
                this.movingToRadius = true;
                const radiusTarget = this.getRandomRadiusPosition();
                this.moveToTarget(radiusTarget, 0, false);
            }
        } else {
            // Stay at or move to current hiding spot
            if (this.lastHideSpot) {
                this.baseSpeed = GameConstants.player.baseSpeed;
                this.movingToRadius = false;
                this.moveToTarget(this.lastHideSpot, Assassin.SAFE_DISTANCE_HIDE_SPOT, false);
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
                    this.movingToRadius = false;
                    this.moveToTarget(nearestHideSpot.position, Assassin.SAFE_DISTANCE_HIDE_SPOT, false);
                } else {
                    // Move to random point on gas radius
                    this.lastHideSpot = null;
                    this.hideTimer = 0;
                    this.currentHideDuration = 0;
                    this.baseSpeed = GameConstants.player.baseSpeed;
                    this.movingToRadius = true;
                    const radiusTarget = this.getRandomRadiusPosition();
                    this.moveToTarget(radiusTarget, 0, false);
                }
            }
        }
    }

    private findNearestGamer(): Gamer | null {
        return this.findNearestObject<Gamer>(Gamer);
    }

    /**
     * Find the nearest object of a specific type.
     */
    private findNearestObject<T>(type: new (...args: any[]) => T, filter?: (obj: T) => boolean): T | null {
        if (
            this.cachedHideSpot &&
            this.game.now - this.lastCacheUpdate < 1000 &&
            this.lastCachePosition &&
            Vec.squaredLength(Vec.sub(this.position, this.lastCachePosition)) < 25 * 25 &&
            (!filter || filter(this.cachedHideSpot as unknown as T))
        ) {
            return this.cachedHideSpot as T;
        }

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

        if (nearestObject instanceof Obstacle) {
            this.cachedHideSpot = nearestObject;
            this.lastCacheUpdate = this.game.now;
            this.lastCachePosition = Vec.clone(this.position);
        }

        return nearestObject;
    }

    /**
     * Generic function to move towards a target position while rotating appropriately.
     */
    private moveToTarget(targetPosition: Vector, safeDistance: number, isAttacking: boolean): void {
        // If moving to a random radius position, check for hiding spots along the way
        if (this.movingToRadius) {
            const nearestHideSpot = this.findNearestObject<Obstacle>(Obstacle, (obj) =>
                ["bush", "tree"].includes(obj.definition.material) &&
                !obj.dead &&
                !this.game.gas.isInGas(obj.position) &&
                Vec.length(Vec.sub(this.game.gas.newPosition, obj.position)) <= Vec.length(Vec.sub(this.game.gas.newPosition, this.position))
            );

            if (nearestHideSpot) {
                // Found a hiding spot, switch to hiding there
                this.lastHideSpot = Vec.clone(nearestHideSpot.position);
                this.hideTimer = 0;
                this.currentHideDuration = this.getRandomHideDuration();
                this.movingToRadius = false;
                targetPosition = nearestHideSpot.position;
                safeDistance = Assassin.SAFE_DISTANCE_HIDE_SPOT;
                isAttacking = false;
            }
        }

        const directionToTarget = Vec.normalize(Vec.sub(targetPosition, this.position));
        const distanceToTarget = Vec.length(Vec.sub(targetPosition, this.position));
        const desiredRotation = Math.atan2(directionToTarget.y, directionToTarget.x);
        const rotationDifference = desiredRotation - this.rotation;
        const adjustedRotation = this.rotation + Math.min(Math.abs(rotationDifference), Assassin.ATTACK_ROTATION_RATE) * Math.sign(rotationDifference);

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
            distanceToMouse: 0,
        };

        // Process movement input
        this.processInputs(packet);
    }

    private moveToSafePosition(): void {
        this.inventory.setActiveWeaponIndex(2);
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
            this.movingToRadius = false;
            this.moveToTarget(nearestHideSpot.position, Assassin.SAFE_DISTANCE_HIDE_SPOT, !this.attacking);
        } else {
            // Move to random point on gas radius
            this.lastHideSpot = null;
            this.hideTimer = 0;
            this.currentHideDuration = this.getRandomHideDuration();
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.movingToRadius = true;
            const radiusTarget = this.getRandomRadiusPosition();
            this.moveToTarget(radiusTarget, 0, !this.attacking);
        }
    }
}
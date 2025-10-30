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
import { SAFE_DISTANCE_FROM_PLAYER } from "./common";

/**
 * Ninja Class
 * Represents a specialized player character with unique traits and behaviors.
 */
export class Ninja extends Player {
    private static readonly BASE_CHASE_RADIUS: number = 30;
    private static readonly ROTATION_RATE: number = 0.35;
    private static readonly SAFE_DISTANCE_HIDE_SPOT: number = 0.5;
    private static readonly BASE_ATTACK_SPEED: number = GameConstants.player.baseSpeed * 0.6;
    private static readonly RADIUS_INCREMENT: number = 0.05;
    private static readonly SPEED_INCREMENT: number = 0.05;
    private static readonly MIN_HIDE_DURATION = 5;
    private static readonly MAX_HIDE_DURATION = 15;
    private static readonly MIN_DISTANCE_TO_GAS = 30;
    private static readonly CENTER_PROXIMITY = 100;
    private static readonly NAMES = ["Shinobi", "Kage", "Ronin", "Shuriken", "Sai", "Katana", "Nighthawk", "Mist"];

    private hideTimer: number = 0;
    private lastHideSpot: Vector | null = null;
    private currentHideDuration: number = this.getRandomHideDuration();
    private movingToRadius: boolean = false;
    private cachedHideSpot: Obstacle | null = null;
    private lastCacheUpdate: number = 0;
    private lastCachePosition: Vector | null = null;

    constructor(game: Game, userData: ActorContainer, position: Vector, layer?: Layer, team?: Team) {
        super(game, userData, position, layer, team);
        this.health = this.health * 0.7;
        this.isMobile = true;
        this.name = this.getRandomName();
        this.initializeLoadout();
        this.initializeInventory();
    }

    private getRandomName(): string {
        const index = Math.floor(Math.random() * Ninja.NAMES.length);
        return Ninja.NAMES[index];
    }

    private getRandomHideDuration(): number {
        let duration = Math.random() * (Ninja.MAX_HIDE_DURATION - Ninja.MIN_HIDE_DURATION) + Ninja.MIN_HIDE_DURATION;
        const distanceToGasCenter = Vec.squaredLength(Vec.sub(this.game.gas.newPosition, this.position));
        if (distanceToGasCenter > this.game.gas.newRadius * this.game.gas.newRadius) {
            duration /= 3; // when outside safe zone, move faster
        }
        return duration;
    }

    private getRandomRadiusPosition(): Vector {
        const randomAngle = Math.random() * 2 * Math.PI;
        return Vec.add(this.game.gas.newPosition, {
            x: Math.cos(randomAngle) * this.game.gas.newRadius,
            y: Math.sin(randomAngle) * this.game.gas.newRadius
        });
    }

    private initializeLoadout(): void {
        this.loadout.skin = Skins.fromString("ninja");
    }

    private initializeInventory(): void {
        const roll = Math.random();
        if (roll < 0.2) {
            this.inventory.weapons[2] = new MeleeItem("steelfang", this);
            this.inventory.items.setItem('cola', 2);
        } else if (roll < 0.6) {
            this.inventory.weapons[2] = new MeleeItem("feral_claws", this);
            this.inventory.items.setItem('cola', 3);
        } else {
            this.inventory.weapons[2] = new MeleeItem("sickle", this);
            this.inventory.items.setItem('tablets', 2);
        }
    }

    update(): void {
        super.update();
        if (this.chasePlayer()) {
            this.movingToRadius = false;
            return;
        }

        if (this.game.gas.isInGas(this.position)) {
            this.moveToSafePosition();
            return;
        }

        this.hideInSafeSpot();
    }

    private get chaseRadius(): number {
        const stageMultiplier = 1 + Ninja.RADIUS_INCREMENT * this.game.gas.stage;
        return Ninja.BASE_CHASE_RADIUS * stageMultiplier;
    }

    private get attackSpeed(): number {
        const stageMultiplier = 1 + Ninja.SPEED_INCREMENT * this.game.gas.stage;
        return Ninja.BASE_ATTACK_SPEED * stageMultiplier;
    }

    private chasePlayer(): boolean {
        for (const obj of this.visibleObjects) {
            if (obj instanceof Gamer && !obj.dead && !obj.downed) {
                const squaredDistance = Vec.squaredLength(Vec.sub(obj.position, this.position));
                if (squaredDistance < this.chaseRadius * this.chaseRadius) {
                    this.attackNearestPlayer(obj);
                    return true;
                }
            }
        }
        return false;
    }

    private attackNearestPlayer(player: Gamer): void {
        this.baseSpeed = this.attackSpeed;
        this.moveToTarget(player.position, SAFE_DISTANCE_FROM_PLAYER, !this.attacking);
    }

    private holdPositionPreGame(): void {
        if (this.lastHideSpot) {
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.movingToRadius = false;
            this.moveToTarget(this.lastHideSpot, Ninja.SAFE_DISTANCE_HIDE_SPOT, false);
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
                this.moveToTarget(nearestHideSpot.position, Ninja.SAFE_DISTANCE_HIDE_SPOT, false);
            } else {
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

        this.hideTimer += 1 / Config.tps;
        const currentDistanceToGas = Vec.squaredLength(Vec.sub(this.game.gas.newPosition, this.position));

        if (currentDistanceToGas <= Ninja.CENTER_PROXIMITY * Ninja.CENTER_PROXIMITY) {
            this.moveToNearestHideSpot(currentDistanceToGas);
        } else if (this.hideTimer >= this.currentHideDuration || !this.lastHideSpot) {
            this.moveToNewHideSpot(currentDistanceToGas);
        } else if (this.lastHideSpot) {
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.movingToRadius = false;
            this.moveToTarget(this.lastHideSpot, Ninja.SAFE_DISTANCE_HIDE_SPOT, false);
        }
    }

    private moveToNearestHideSpot(currentDistanceToGas: number): void {
        const nearestHideSpot = this.findNearestObject<Obstacle>(Obstacle, (obj) =>
            ["bush", "tree"].includes(obj.definition.material) &&
            !obj.dead &&
            !this.game.gas.isInGas(obj.position)
        );

        if (nearestHideSpot) {
            this.lastHideSpot = Vec.clone(nearestHideSpot.position);
            this.hideTimer = 0;
            this.currentHideDuration = this.getRandomHideDuration();
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.movingToRadius = false;
            this.moveToTarget(nearestHideSpot.position, Ninja.SAFE_DISTANCE_HIDE_SPOT, false);
        } else {
            this.hideTimer = 0;
            this.lastHideSpot = Vec.clone(this.position);
            this.movingToRadius = false;
        }
    }

    private moveToNewHideSpot(currentDistanceToGas: number): void {
        const nearestHideSpot = this.findNearestObject<Obstacle>(Obstacle, (obj) =>
            ["bush", "tree"].includes(obj.definition.material) &&
            !obj.dead &&
            !this.game.gas.isInGas(obj.position) &&
            Vec.squaredLength(Vec.sub(this.game.gas.newPosition, obj.position)) <= currentDistanceToGas - Ninja.MIN_DISTANCE_TO_GAS * Ninja.MIN_DISTANCE_TO_GAS &&
            (!this.lastHideSpot || Vec.squaredLength(Vec.sub(obj.position, this.lastHideSpot)) > 2 * Ninja.SAFE_DISTANCE_HIDE_SPOT * Ninja.SAFE_DISTANCE_HIDE_SPOT)
        );

        if (nearestHideSpot) {
            this.lastHideSpot = Vec.clone(nearestHideSpot.position);
            this.hideTimer = 0;
            this.currentHideDuration = this.getRandomHideDuration();
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.movingToRadius = false;
            this.moveToTarget(nearestHideSpot.position, Ninja.SAFE_DISTANCE_HIDE_SPOT, false);
        } else {
            this.lastHideSpot = null;
            this.hideTimer = 0;
            this.currentHideDuration = 0;
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.movingToRadius = true;
            const radiusTarget = this.getRandomRadiusPosition();
            this.moveToTarget(radiusTarget, 0, false);
        }
    }

    private moveToSafePosition(): void {
        const currentDistanceToGas = Vec.squaredLength(Vec.sub(this.game.gas.newPosition, this.position));

        const nearestHideSpot = this.findNearestObject<Obstacle>(Obstacle, (obj) =>
            ["bush", "tree"].includes(obj.definition.material) &&
            !obj.dead &&
            !this.game.gas.isInGas(obj.position) &&
            Vec.squaredLength(Vec.sub(this.game.gas.newPosition, obj.position)) < currentDistanceToGas
        );

        if (nearestHideSpot) {
            this.lastHideSpot = Vec.clone(nearestHideSpot.position);
            this.hideTimer = 0;
            this.currentHideDuration = this.getRandomHideDuration();
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.movingToRadius = false;
            this.moveToTarget(nearestHideSpot.position, Ninja.SAFE_DISTANCE_HIDE_SPOT, !this.attacking);
        } else {
            this.lastHideSpot = null;
            this.hideTimer = 0;
            this.currentHideDuration = this.getRandomHideDuration();
            this.baseSpeed = GameConstants.player.baseSpeed;
            this.movingToRadius = true;
            const radiusTarget = this.getRandomRadiusPosition();
            this.moveToTarget(radiusTarget, 0, !this.attacking);
        }
    }

    private moveToTarget(targetPosition: Vector, safeDistance: number, isAttacking: boolean): void {
        if (this.movingToRadius) {
            const nearestHideSpot = this.findNearestObject<Obstacle>(Obstacle, (obj) =>
                ["bush", "tree"].includes(obj.definition.material) &&
                !obj.dead &&
                !this.game.gas.isInGas(obj.position) &&
                Vec.squaredLength(Vec.sub(this.game.gas.newPosition, obj.position)) <= Vec.squaredLength(Vec.sub(this.game.gas.newPosition, this.position))
            );

            if (nearestHideSpot) {
                this.lastHideSpot = Vec.clone(nearestHideSpot.position);
                this.hideTimer = 0;
                this.currentHideDuration = this.getRandomHideDuration();
                this.movingToRadius = false;
                targetPosition = nearestHideSpot.position;
                safeDistance = Ninja.SAFE_DISTANCE_HIDE_SPOT;
                isAttacking = false;
            }
        }

        const directionToTarget = Vec.normalize(Vec.sub(targetPosition, this.position));
        const distanceToTarget = Vec.length(Vec.sub(targetPosition, this.position));

        const desiredRotation = Math.atan2(directionToTarget.y, directionToTarget.x);
        const rotationDifference = desiredRotation - this.rotation;
        const adjustedRotation = this.rotation + Math.min(Math.abs(rotationDifference), Ninja.ROTATION_RATE) * Math.sign(rotationDifference);

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

        this.processInputs(packet);
    }

    private findNearestObject<T>(type: new (...args: any[]) => T, filter?: (obj: T) => boolean): T | null {
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

    override handleDeathDrops(position: Vector, layer: number): void {
        this.inventory.cleanInventory();
    }

    override handleDeathMarker(): void {}
}
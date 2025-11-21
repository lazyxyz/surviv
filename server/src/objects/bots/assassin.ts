import { Layer, GameConstants } from "@common/constants";
import { type Vector, Vec } from "@common/utils/vector";
import { Game } from "../../game";
import { Team } from "../../team";
import { ActorContainer } from "../player";
import { BehaviorType, Bot } from "./bot";
import { APS_LEVEL_MULT, calculateLevelStat, SPEED_LEVEL_MULT } from "./common";
import { GunItem } from "../../inventory/gunItem";
import { MeleeItem } from "../../inventory/meleeItem";
import { Scopes } from "@common/definitions/scopes";
import { PlayerInputData } from "@common/packets/inputPacket";
import { Config } from "../../config";
import { Gamer } from "../gamer";
const SAFE_DISTANCE_FROM_PLAYER = 5.5;

/**
 * Assassin Class
 * Inherits from Bot with HideAndAttack behavior, updated to use guns at range and melee up close.
 */
export class Assassin extends Bot {
    static NAMES = ["Shadow", "Viper", "Specter", "Raven", "Ghost", "Wraith", "Shade", "Dusk"];
    static SKIN_ID = "brush";

    protected shotDistance: number = 60;
    protected aimDeviation: number = 0.07;
    protected shotRotationRate: number = 0.2;

    constructor(game: Game, userData: ActorContainer, position: Vector, layer?: Layer, team?: Team, level: number = 1) {
        super(game, userData, position, BehaviorType.HideAndAttack, Assassin.NAMES, Assassin.SKIN_ID, layer, team);

        const healthMultiplier = calculateLevelStat(1, 0.05, level);
        this.speedMult = calculateLevelStat(1, SPEED_LEVEL_MULT, level);
        this.apsMult = calculateLevelStat(1, APS_LEVEL_MULT, level);

        this.health *= healthMultiplier;
        this.baseChaseSpeed = GameConstants.player.baseSpeed * 0.6;
        this.chaseDistance = this.shotDistance;
        this.attackDistance = 20;
        this.radiusIncrement = 0.07;
        this.useAttackCooldown = true; // Used for melee; ignored for ranged
        this.baseAps = 2; // Melee attacks per second
        this.minMoveDuration = 5;
        this.maxMoveDuration = 15;
        this.minDistanceToGas = 30;
        this.centerProximity = 200;
        this.safeDistanceHideSpot = 0.5;

        this.initializeInventory();
    }

    private initializeInventory(): void {
        const randomChance = Math.random();
        let weaponName: string, ammoType: string, ammoAmount: number;

        if (randomChance < 0.01) {
            weaponName = "l115a1";
            ammoType = "338lap";
            ammoAmount = 12;
        } else if (randomChance < 0.06) {
            weaponName = "vks";
            ammoType = "50cal";
            ammoAmount = 30;
        } else if (randomChance < 0.16) {
            weaponName = "tango_51";
            ammoType = "762mm";
            ammoAmount = 90;
        } else if (randomChance < 0.26) {
            weaponName = "mosin_nagant";
            ammoType = "762mm";
            ammoAmount = 90;
        } else if (randomChance < 0.56) {
            weaponName = "sks";
            ammoType = "762mm";
            ammoAmount = 90;
        } else {
            weaponName = "vss";
            ammoType = "9mm";
            ammoAmount = 120;
        }

        this.inventory.weapons[0] = new GunItem(weaponName, this);
        this.inventory.items.setItem(ammoType, ammoAmount);
        this.inventory.weapons[2] = new MeleeItem("kbar", this);
        this.inventory.scope = Scopes.definitions[2];

        const roll = Math.random();
        if (roll < 0.5) {
            this.inventory.items.setItem("cola", 2);
        } else if (roll < 0.8) {
            this.inventory.items.setItem("cola", 3);
        } else {
            this.inventory.items.setItem("tablets", 2);
        }

        this.inventory.setActiveWeaponIndex(0);
    }

    protected getChaseDistance(): number {
        return this.shotDistance * (1 + this.radiusIncrement * this.game.gas.stage);
    }

    protected getAttackDistance(): number {
        return this.attackDistance;
    }

    protected getRotationRate(): number {
        return 0.35; // Used for melee rotation
    }

    protected checkEnraged(): boolean {
        return false; // No enraged mode for Assassin
    }

    protected handleChase(target: Gamer): void {
        const distToTarget = Vec.length(Vec.sub(target.position, this.position));
        let speedMult = this.getSpeedMult();

        if (distToTarget < this.getAttackDistance()) {
            // Melee mode
            this.inventory.setActiveWeaponIndex(2);
            this.baseSpeed = this.baseChaseSpeed * speedMult;
            const isAttacking = this.canAttack(); // Uses cooldown for melee APS
            this.moveToTarget(target.position, SAFE_DISTANCE_FROM_PLAYER, !this.attacking); // Toggle to simulate pulses
        } else {
            // Ranged mode
            this.inventory.setActiveWeaponIndex(0);
            if (this.canFire()) {
                const directionToTarget = Vec.normalize(Vec.sub(target.position, this.position));
                const desiredRotation = Math.atan2(directionToTarget.y, directionToTarget.x);
                let rotationDifference = desiredRotation - this.rotation;
                rotationDifference = Math.atan2(Math.sin(rotationDifference), Math.cos(rotationDifference));
                const adjustedRotation = this.rotation + Math.min(Math.abs(rotationDifference), this.shotRotationRate) * Math.sign(rotationDifference);
                const randomDeviation = (Math.random() * (this.aimDeviation * 2)) - this.aimDeviation;
                const finalRot = adjustedRotation + randomDeviation;

                const packet: PlayerInputData = {
                    movement: { up: false, down: false, left: false, right: false },
                    attacking: !this.attacking, // Toggle to match old behavior
                    actions: [],
                    isMobile: true,
                    turning: true,
                    mobile: {
                        moving: false,
                        angle: finalRot,
                    },
                    rotation: finalRot,
                    distanceToMouse: 0,
                };
                this.processInputs(packet);
            } else {
                // No ammo and dist >= attackDistance: treat as no target and hide
                this.handleNoTarget();
            }
        }
    }

    private canFire(): boolean {
        const gun = this.inventory.activeWeapon as GunItem;
        return this.inventory.items.getItem(gun.definition.ammoType) > 0 || gun.ammo > 0;
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
}
import { GameConstants, Layer } from "@common/constants";
import { type Vector, Vec } from "@common/utils/vector";
import { Game } from "../../game";
import { Team } from "../../team";
import { Player, ActorContainer } from "../player";
import { PlayerInputData } from "@common/packets/inputPacket";
import { Skins } from "@common/definitions/skins";
import { Badges } from "@common/definitions/badges";
import { Emotes } from "@common/definitions/emotes";
import { Gamer } from "../gamer";


export class Zombie extends Player {
    constructor(game: Game, userData: ActorContainer, position: Vector,
        layer?: Layer, team?: Team) {
        super(game, userData, position, layer, team);
        this.health = this.health * 0.5;
        this.isMobile = true;
        this.name = `Zombie`;
        this.loadout.skin = Skins.fromString("bloodlust");
        this.loadout.badge = Badges.fromString('bdg_bleh');
        this.loadout.emotes = [Emotes.fromString("happy_face")];

        const randomCola = Math.random() < 0.3 ? 1 : 0; // 30% chance for 1, 90% chance for 0
        this.inventory.items.setItem('cola', randomCola);
    }

    private rotationDirection: number = 1;

    private static CHASE_DISTANCE = 40;
    private static ROTATION_RATE = 0.35;
    private static IDLE_ROTATION_SPEED = 0.05;
    private static SAFE_DISTANCE_FROM_PLAYER = 5;
    private static BASE_SPEED = GameConstants.player.baseSpeed * 0.8;

    update() {
        super.update();
        for (const obj of this.visibleObjects) {
            if (obj instanceof Gamer && !obj.dead) {
                if (Vec.length(Vec.sub(obj.position, this.position)) < Zombie.CHASE_DISTANCE) {
                    this.attackNearestPlayer();
                    return;
                }
            }
        }

        this.idle();
        return;
    }

    private attackNearestPlayer(): void {
        const nearestPlayer = this.findNearestObject<Gamer>(Gamer);

        if (nearestPlayer) {
            this.baseSpeed = Zombie.BASE_SPEED;
            this.moveToTarget(nearestPlayer.position, Zombie.SAFE_DISTANCE_FROM_PLAYER, !this.attacking);
        }
    }

    /** 
    * Generic function to move towards a target position while rotating appropriately. 
    */
    private moveToTarget(targetPosition: Vector, safeDistance: number, isAttacking: boolean): void {
        const directionToTarget = Vec.normalize(Vec.sub(targetPosition, this.position));
        const distanceToTarget = Vec.length(Vec.sub(targetPosition, this.position));

        const desiredRotation = Math.atan2(directionToTarget.y, directionToTarget.x);
        const rotationDifference = desiredRotation - this.rotation;
        const adjustedRotation = this.rotation + Math.min(Math.abs(rotationDifference), Zombie.ROTATION_RATE) * Math.sign(rotationDifference);

        const packet: PlayerInputData = {
            movement: { up: false, down: false, left: false, right: false },
            attacking: isAttacking,
            actions: [],
            isMobile: true,
            turning: true,
            mobile: {
                moving: distanceToTarget > safeDistance,
                angle: adjustedRotation,
            },
            rotation: adjustedRotation,
            distanceToMouse: undefined,
        };

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

    idle() {
        const shouldReverse = Math.random() < 0.01; // 1% chance to gradually reverse direction
        if (shouldReverse) {
            this.rotationDirection *= -1; // Reverse rotation direction gradually
        }

        this.rotation += Zombie.IDLE_ROTATION_SPEED * this.rotationDirection;
        const movement = {
            up: false,
            down: false,
            left: false,
            right: false,
        };
        const packet: PlayerInputData = {
            movement: movement,
            attacking: false,
            actions: [],
            isMobile: true,
            turning: true,
            mobile: {
                angle: this.rotation,
                moving: false,
            },
            rotation: this.rotation,
        };
        this.processInputs(packet);
    }
}
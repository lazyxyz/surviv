import { Layer } from "@common/constants";
import { type Vector, Vec } from "@common/utils/vector";
import { Game } from "../../game";
import { Team } from "../../team";
import { Player, ActorContainer } from "../player";
import { PlayerInputData } from "@common/packets/inputPacket";
import { Skins } from "@common/definitions/skins";
import { Badges } from "@common/definitions/badges";
import { Emotes } from "@common/definitions/emotes";

const CHASE_DISTANCE = 30;
const ROTATION_SPEED = 0.2;
const IDLE_ROTATION_SPEED = 0.05;
const MIN_DISTANCE_FROM_PLAYER = 5; // Minimum distance from the player to avoid colliding

export class Zombie extends Player {
    constructor(game: Game, userData: ActorContainer, position: Vector,
        layer?: Layer, team?: Team) {
        super(game, userData, position, layer, team);
        this.baseSpeed = this.baseSpeed * 0.7;
        this.health = this.health * 0.5;
        this.isMobile = true;
        this.name = `Zombie`;
        this.loadout.skin = Skins.fromString("bloodlust");
        this.loadout.badge = Badges.fromString('bdg_bleh');
        this.loadout.emotes = [Emotes.fromString("happy_face")];
    }

    private rotationDirection: number = 1;

    update() {
        super.update();
        for (const obj of this.visibleObjects) {
            if (obj instanceof Player && !obj.dead) {
                if (Vec.length(Vec.sub(obj.position, this.position)) < CHASE_DISTANCE) {
                    this.attackNearestPlayer();
                    return;
                }
            }
        }

        this.idle();
        return;
    }

    attackNearestPlayer() {
        let nearestPlayer: Player | null = null;
        let nearestDistance = Infinity;

        for (const obj of this.visibleObjects) {
            if (obj instanceof Player) {
                const distance = Vec.length(Vec.sub(obj.position, this.position));
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestPlayer = obj;
                }
            }
        }

        if (nearestPlayer) {
            const directionToPlayer = Vec.normalize(Vec.sub(nearestPlayer.position, this.position));
            const distanceToPlayer = Vec.length(Vec.sub(nearestPlayer.position, this.position));

            // Rotate towards the player
            const desiredRotation = Math.atan2(directionToPlayer.y, directionToPlayer.x); // Calculate desired rotation angle
            const rotationDifference = desiredRotation - this.rotation;
            const adjustedRotation = this.rotation + Math.min(Math.abs(rotationDifference), ROTATION_SPEED) * Math.sign(rotationDifference); // Limit rotation speed

            // Calculate the angle for mobile movement (angle in radians to degrees conversion)
            const movement = {
                up: false,
                down: false,
                left: false,
                right: false,
            };

            const packet: PlayerInputData = {
                movement: movement,
                attacking: !this.attacking,
                actions: [],
                isMobile: true,
                turning: true,
                mobile: {
                    moving: distanceToPlayer > MIN_DISTANCE_FROM_PLAYER, // Move only if not too close
                    angle: adjustedRotation
                },
                rotation: adjustedRotation,
                distanceToMouse: undefined,
            };
            this.processInputs(packet);
        }
    }

    idle() {
        const shouldReverse = Math.random() < 0.01; // 1% chance to gradually reverse direction
        if (shouldReverse) {
            this.rotationDirection *= -1; // Reverse rotation direction gradually
        }

        this.rotation += IDLE_ROTATION_SPEED * this.rotationDirection; // Rotate continuously with current direction
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


import { type WebSocket } from "uWebSockets.js";
import { InputActions, Layer, SpectateActions } from "@common/constants";
import { type Vector, Vec } from "@common/utils/vector";
import { Game } from "../../game";
import { Team } from "../../team";
import { ActorContainer, Player } from "../player";
import { Loot } from "../loot";
import { Logger } from "../../utils/misc";
import { PlayerInputData, InputAction } from "@common/packets/inputPacket";
import { GameObject } from "../gameObject";
import { Parachute } from "../parachute";


const PICKUP_DISTANCE = 5;

enum BotActions {
    Loot,
    Attack,
    Run,
    Idle
}

function detectBotAction(objects: Set<GameObject>): BotActions {
    for (const obj of objects) {
        if (obj instanceof Player) {
            return BotActions.Attack;
        }
    }

    for (const obj of objects) {
        if (obj instanceof Loot) {
            return BotActions.Loot;
        }
    }

    for (const obj of objects) {
        if (obj instanceof Parachute) {
            return BotActions.Idle;
        }
    }

    return BotActions.Run;
}

export class Bot extends Player {
    constructor(game: Game, userData: ActorContainer, position: Vector,
        layer?: Layer, team?: Team) {
        super(game, userData, position, layer, team);
    }

    private lastDirectionChange: number = 0;
    private randomDirectionVector: Vector = Vec.create(0, 0);

    update() {
        super.update();
        let packet;

        let botAction: BotActions = detectBotAction(this.nearObjects);

        switch (botAction) {
            case BotActions.Attack:
                // this.processInputs(packet);
                break;

            case BotActions.Run:
                this.randomMoving();
                break;

            case BotActions.Loot: {
                this.Looting();
                break;
            }
            case BotActions.Idle:
                // Idle logic here
                break;

            default:
                throw new Error(`Unhandled BotAction: ${botAction}`);
        }
    }

    Looting() {
        // Check for visible loot within range
        const pickupDistance = 5;
        let nearestLoot: Loot | null = null;
        let nearestDistance = Infinity;
        for (const obj of this.visibleObjects) {
            if (obj instanceof Loot) {
                const distance = Vec.length(Vec.sub(obj.position, this.position));
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestLoot = obj;
                }
            }
        }

        let actions: InputAction[] = [];
        let movement = {
            up: false,
            down: false,
            left: false,
            right: false
        };

        // Move towards the nearest loot if it's within range
        if (nearestLoot) {
            const directionToLoot = Vec.normalize(Vec.sub(nearestLoot.position, this.position));

            movement = {
                up: directionToLoot.y < 0,
                down: directionToLoot.y > 0,
                left: directionToLoot.x < 0,
                right: directionToLoot.x > 0
            };
        }

        // If the bot is close enough to the loot, pick it up
        if (nearestLoot && Vec.length(Vec.sub(nearestLoot.position, this.position)) <= pickupDistance) {
            actions.push({
                type: InputActions.Interact,
            });
        }

        // Create a PlayerInputData object with the loot pickup action
        const packet: PlayerInputData = {
            movement: movement,
            attacking: false,
            actions: actions,
            isMobile: false,
            turning: false,
            mobile: undefined,
            rotation: undefined,
        };
        this.processInputs(packet);
    }

    randomMoving() {
        if (this.game.now - this.lastDirectionChange > 2000) { // Change direction every 2 seconds
            this.lastDirectionChange = this.game.now;
            this.randomDirection();
        }

        const center = Vec.create(this.game.map.width / 3, this.game.map.height / 3);
        const directionToCenter = Vec.sub(center, this.position);

        const angle = Math.PI / 2; // 90 degrees to move tangentially
        const tangentialDirection = Vec.create(
            -directionToCenter.y, // Perpendicular X component
            directionToCenter.x  // Perpendicular Y component
        );

        const normalizedTangentialDirection = Vec.normalize(tangentialDirection);

        const combinedDirection = Vec.add(this.randomDirectionVector, normalizedTangentialDirection);

        let movement = {
            up: combinedDirection.y < 0,
            down: combinedDirection.y > 0,
            left: combinedDirection.x < 0,
            right: combinedDirection.x > 0
        };

        const packet: PlayerInputData = {
            movement: movement,
            attacking: false,
            actions: [],
            isMobile: false,
            turning: false,
            mobile: undefined,
            rotation: undefined,
        };
        this.processInputs(packet);
    }


    randomDirection() {
        const angle = Math.random() * 2 * Math.PI;
        this.randomDirectionVector = Vec.create(Math.cos(angle), Math.sin(angle));
    }
}

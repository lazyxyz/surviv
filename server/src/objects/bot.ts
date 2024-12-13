import { type WebSocket } from "uWebSockets.js";
import { InputActions, Layer, SpectateActions } from "@common/constants";
import { type Vector, Vec } from "@common/utils/vector";
import { Game } from "../game";
import { Team } from "../team";
import { Actor, PlayerContainer } from "./actor";
import { Loot } from "./loot";
import { Logger } from "../utils/misc";
import { PlayerInputData, InputAction } from "@common/packets/inputPacket";


export class Bot extends Actor {
    constructor(game: Game, userData: PlayerContainer, position: Vector,
        layer?: Layer, team?: Team) {
        super(game, userData, position, layer, team);
    }

    private lastDirectionChange: number = 0;
    private randomDirectionVector: Vector = Vec.create(0, 0);

    update() {
        super.update();


        this.Looting();
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
            // console.log("nearestLoot: ", nearestLoot.itemData);
            const directionToLoot = Vec.normalize(Vec.sub(nearestLoot.position, this.position));

            movement = {
                up: directionToLoot.y < 0,
                down: directionToLoot.y > 0,
                left: directionToLoot.x < 0,
                right: directionToLoot.x > 0
            };
        } else {
            movement = this.randomMoving();
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

    moving() {
        
    }

    randomMoving() {
        // Random direction change every 3 seconds
        if (this.game.now - this.lastDirectionChange > 3000) {
            this.lastDirectionChange = this.game.now;
            this.randomDirection();
        }

        // Movement towards the center
        const center = Vec.create(this.game.map.width / 2, this.game.map.height / 2);
        const directionToCenter = Vec.sub(center, this.position);

        // Combine random direction and center-seeking behavior
        const combinedDirection = Vec.add(this.randomDirectionVector, directionToCenter);

        return {
            up: combinedDirection.y < 0,
            down: combinedDirection.y > 0,
            left: combinedDirection.x < 0,
            right: combinedDirection.x > 0
        }
    }

    randomDirection() {
        const angle = Math.random() * 2 * Math.PI;
        this.randomDirectionVector = Vec.create(Math.cos(angle), Math.sin(angle));
    }


}

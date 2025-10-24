import { Layer, GameConstants } from "@common/constants";
import { MapPings, MapPing } from "@common/definitions/mapPings";
import { ObstacleDefinition, Obstacles } from "@common/definitions/obstacles";
import { Hitbox } from "@common/utils/hitbox";
import { Numeric } from "@common/utils/math";
import { randomRotation } from "@common/utils/random";
import { Vector, Vec } from "@common/utils/vector";
import { Game } from "../game";
import { Parachute } from "../objects/parachute";

export interface Airdrop {
    readonly position: Vector
    readonly type: ObstacleDefinition
}

export class AirdropManager {
    private game: Game;

    constructor(game: Game) {
        this.game = game;
    }

    summonAirdrop(position: Vector): void {
        if (this.game.pluginManager.emit("airdrop_will_summon", { position })) return;

        const paddingFactor = 1.25;

        const crateDef = Obstacles.fromString("airdrop_crate_locked");
        const crateHitbox = (crateDef.spawnHitbox ?? crateDef.hitbox).clone();
        let thisHitbox = crateHitbox.clone();

        let collided = true;
        let attempts = 0;
        let randomInt: number | undefined;

        while (collided) {
            if (attempts === 500) {
                switch (true) {
                    case position.x < this.game.map.height / 2 && position.y < this.game.map.height / 2:
                        randomInt = [1, 2, 3][Math.floor(Math.random() * 3)];
                        break;
                    case position.x > this.game.map.height / 2 && position.y < this.game.map.height / 2:
                        randomInt = [1, 4, 5][Math.floor(Math.random() * 3)];
                        break;
                    case position.x < this.game.map.height / 2 && position.y > this.game.map.height / 2:
                        randomInt = [3, 6, 7][Math.floor(Math.random() * 3)];
                        break;
                    case position.x > this.game.map.height / 2 && position.y > this.game.map.height / 2:
                        randomInt = [4, 6, 8][Math.floor(Math.random() * 3)];
                        break;
                }
            }

            if (randomInt !== undefined) {
                const distance = crateHitbox.toRectangle().max.x * 2 * paddingFactor;

                switch (randomInt) {
                    case 1:
                        position.y = position.y + distance;
                        break;
                    case 2:
                        position.x = position.x + distance;
                        position.y = position.y + distance;
                        break;
                    case 3:
                        position.x = position.x + distance;
                        break;
                    case 4:
                        position.x = position.x - distance;
                        break;
                    case 5:
                        position.x = position.x - distance;
                        position.y = position.y + distance;
                        break;
                    case 6:
                        position.y = position.y - distance;
                        break;
                    case 7:
                        position.y = position.y - distance;
                        position.x = position.x + distance;
                        break;
                    case 8:
                        position.y = position.y - distance;
                        position.x = position.x - distance;
                        break;
                }
            }

            attempts++;
            collided = false;

            for (const airdrop of this.game.airdrops) {
                thisHitbox = crateHitbox.transform(position);
                const thatHitbox = (airdrop.type.spawnHitbox ?? airdrop.type.hitbox).transform(airdrop.position);
                thatHitbox.scale(paddingFactor);

                if (Vec.equals(thisHitbox.getCenter(), thatHitbox.getCenter())) {
                    thisHitbox = thisHitbox.transform(Vec.fromPolar(randomRotation(), 0.01));
                }

                if (thisHitbox.collidesWith(thatHitbox)) {
                    collided = true;
                    if (attempts >= 500) continue;
                    thisHitbox.resolveCollision(thatHitbox);
                }
                position = thisHitbox.getCenter();
            }

            thisHitbox = crateHitbox.transform(position);

            {
                const padded = thisHitbox.clone();
                padded.scale(paddingFactor);
                for (const object of this.game.grid.intersectsHitbox(padded, Layer.Ground)) {
                    let hitbox: Hitbox;
                    if (
                        object.isObstacle
                        && !object.dead
                        && object.definition.indestructible
                        && ((hitbox = object.spawnHitbox.clone()).scale(paddingFactor), hitbox.collidesWith(thisHitbox))
                    ) {
                        collided = true;
                        if (attempts >= 500) continue;
                        thisHitbox.resolveCollision(object.spawnHitbox);
                    }
                    position = thisHitbox.getCenter();
                }
            }

            thisHitbox = crateHitbox.transform(position);

            {
                const padded = thisHitbox.clone();
                padded.scale(paddingFactor);
                // second loop, buildings
                for (const object of this.game.grid.intersectsHitbox(thisHitbox, Layer.Ground)) {
                    if (
                        object.isBuilding
                        && object.scopeHitbox
                        && object.definition.wallsToDestroy === Infinity
                    ) {
                        const hitbox = object.scopeHitbox.clone();
                        hitbox.scale(paddingFactor);
                        if (!thisHitbox.collidesWith(hitbox)) continue;
                        collided = true;
                        if (attempts >= 500) continue;
                        thisHitbox.resolveCollision(object.scopeHitbox);
                    }
                    position = thisHitbox.getCenter();
                }
            }

            thisHitbox = crateHitbox.transform(position);

            const { min, max } = thisHitbox.toRectangle();
            const width = max.x - min.x;
            const height = max.y - min.y;
            position.x = Numeric.clamp(position.x, width, this.game.map.width - width);
            position.y = Numeric.clamp(position.y, height, this.game.map.height - height);
        }

        const direction = randomRotation();

        const planePos = Vec.add(
            position,
            Vec.fromPolar(direction, -GameConstants.maxPosition)
        );

        const airdrop = { position, type: crateDef };

        this.game.airdrops.push(airdrop);

        this.game.planes.push({ position: planePos, direction });

        this.game.addTimeout(() => {
            const parachute = new Parachute(this.game, position, airdrop);
            this.game.grid.addObject(parachute);
            this.game.mapPings.push({
                definition: MapPings.fromString<MapPing>("airdrop_ping"),
                position
            });
        }, GameConstants.airdrop.flyTime);

        this.game.pluginManager.emit("airdrop_did_summon", { airdrop, position });
    }
}
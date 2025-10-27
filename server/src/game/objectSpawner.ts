import { Layer, GameConstants, ObjectCategory } from "@common/constants";
import { ExplosionDefinition } from "@common/definitions/explosions";
import { LootDefinition, Loots } from "@common/definitions/loots";
import { SyncedParticleDefinition, SyncedParticleSpawnerDefinition, SyncedParticles } from "@common/definitions/syncedParticles";
import { ThrowableDefinition } from "@common/definitions/throwables";
import { EaseFunctions } from "@common/utils/math";
import { ReifiableDef } from "@common/utils/objectDefinitions";
import { randomPointInsideCircle, randomRotation, randomFloat } from "@common/utils/random";
import { Vector, Vec } from "@common/utils/vector";
import { Game } from "../game";
import { GunItem } from "../inventory/gunItem";
import { MeleeItem } from "../inventory/meleeItem";
import { ThrowableItem } from "../inventory/throwableItem";
import { ServerBulletOptions, Bullet } from "../objects/bullet";
import { Explosion } from "../objects/explosion";
import { GameObject } from "../objects/gameObject";
import { ItemData, Loot } from "../objects/loot";
import { SyncedParticle } from "../objects/syncedParticle";
import { ThrowableProjectile } from "../objects/throwableProj";
import { Config } from "../config";
import { Obstacle } from "../objects/obstacle";

export class ObjectSpawner {
    private game: Game;

    constructor(game: Game) {
        this.game = game;
    }

    addLoot<Def extends LootDefinition = LootDefinition>(
        definition: ReifiableDef<Def>,
        position: Vector,
        layer: Layer,
        { count, pushVel, jitterSpawn = true, data }: {
            readonly count?: number
            readonly pushVel?: number
            readonly jitterSpawn?: boolean
            readonly data?: ItemData<Def>
        } = {}
    ): Loot<Def> | undefined {
        const args = {
            position,
            layer,
            count,
            pushVel,
            jitterSpawn,
            data
        };

        definition = Loots.reify<Def>(definition);

        if (
            this.game.pluginManager.emit(
                "loot_will_generate",
                {
                    definition,
                    ...args
                }
            )
        ) return;

        const loot = new Loot<Def>(
            this.game,
            definition,
            jitterSpawn
                ? Vec.add(
                    position,
                    randomPointInsideCircle(Vec.create(0, 0), GameConstants.lootSpawnDistance)
                )
                : position,
            layer,
            {
                count,
                pushVel,
                data
            }
        );
        this.game.grid.addObject(loot);

        this.game.pluginManager.emit(
            "loot_did_generate",
            { loot, ...args }
        );

        if (Config.objectLifetime) {
            this.game.addTimeout(() => {
                if (!loot.dead) {
                    this.removeLoot(loot);
                }
            }, Config.objectLifetime);
        }

        return loot;
    }

    removeLoot(loot: Loot): void {
        loot.dead = true;
        this.removeObject(loot);
    }

    addBullet(source: GunItem | Explosion, shooter: GameObject, options: ServerBulletOptions): Bullet {
        const bullet = new Bullet(
            this.game,
            source,
            shooter,
            options
        );

        this.game.bullets.add(bullet);
        this.game.newBullets.push(bullet);

        return bullet;
    }

    addExplosion(
        type: ReifiableDef<ExplosionDefinition>,
        position: Vector,
        source: GameObject,
        layer: Layer,
        weapon?: GunItem | MeleeItem | ThrowableItem,
        damageMod = 1
    ): Explosion {
        const explosion = new Explosion(this.game, type, position, source, layer, weapon, damageMod);
        this.game.explosions.push(explosion);
        return explosion;
    }

    addProjectile(definition: ThrowableDefinition, position: Vector, layer: Layer, source: ThrowableItem): ThrowableProjectile {
        const projectile = new ThrowableProjectile(this.game, position, layer, definition, source);
        this.game.grid.addObject(projectile);
        return projectile;
    }

    removeProjectile(projectile: ThrowableProjectile): void {
        this.removeObject(projectile);
        projectile.dead = true;
    }

    addSyncedParticle(definition: SyncedParticleDefinition, position: Vector, layer: Layer | number, creatorID?: number): SyncedParticle {
        const syncedParticle = new SyncedParticle(this.game, definition, position, layer, creatorID);
        this.game.grid.addObject(syncedParticle);
        return syncedParticle;
    }

    removeSyncedParticle(syncedParticle: SyncedParticle): void {
        this.removeObject(syncedParticle);
        syncedParticle.dead = true;
    }

    addSyncedParticles(particles: SyncedParticleSpawnerDefinition, position: Vector, layer: Layer | number): void {
        const particleDef = SyncedParticles.fromString(particles.type);
        const { spawnRadius, count, deployAnimation } = particles;

        const duration = deployAnimation?.duration;
        const circOut = EaseFunctions.cubicOut;

        const setParticleTarget = duration
            ? (particle: SyncedParticle, target: Vector) => {
                particle.setTarget(target, duration, circOut);
            }
            : (particle: SyncedParticle, target: Vector) => {
                particle._position = target;
            };

        const spawnParticles = (amount = 1): void => {
            for (let i = 0; i++ < amount; i++) {
                setParticleTarget(
                    this.addSyncedParticle(
                        particleDef,
                        position,
                        layer
                    ),
                    Vec.add(
                        Vec.fromPolar(
                            randomRotation(),
                            randomFloat(0, spawnRadius)
                        ),
                        position
                    )
                );
            }
        };

        if (deployAnimation?.staggering) {
            const staggering = deployAnimation.staggering;
            const initialAmount = staggering.initialAmount ?? 0;

            spawnParticles(initialAmount);

            const addTimeout = this.game.addTimeout.bind(this.game);
            const addParticles = spawnParticles.bind(null, staggering.spawnPerGroup);
            const delay = staggering.delay;

            for (let i = initialAmount, j = 1; i < count; i++, j++) {
                addTimeout(addParticles, j * delay);
            }
        } else {
            spawnParticles(particles.count);
        }
    }

    removeObject(object: GameObject): void {
        this.game.grid.removeObject(object);
        this.game._idAllocator.give(object.id);
        this.game.updateObjects = true;
    }
}

import { Layer, MODE, ObjectCategory } from "@common/constants";
import { type ExplosionDefinition } from "@common/definitions/explosions";
import { type LootDefinition } from "@common/definitions/loots";
import { type ObstacleDefinition } from "@common/definitions/obstacles";
import { type SyncedParticleDefinition, type SyncedParticleSpawnerDefinition } from "@common/definitions/syncedParticles";
import { type ThrowableDefinition } from "@common/definitions/throwables";
import { PlayerData } from "@common/packets/joinPacket";
import { type InputPacket } from "@common/packets/packet";
import { type PingSerialization } from "@common/packets/updatePacket";
import { Statistics } from "@common/utils/math";
import { Timeout } from "@common/utils/misc";
import { type ReifiableDef } from "@common/utils/objectDefinitions";
import { type Vector } from "@common/utils/vector";
import { type WebSocket } from "uWebSockets.js";
import { parentPort } from "worker_threads";
import { Config } from "./config";
import { Maps } from "./data/maps";
import { WorkerMessages, type GameData, type WorkerMessage } from "./gameManager";
import { Gas } from "./gas";
import { GunItem } from "./inventory/gunItem";
import { MeleeItem } from "./inventory/meleeItem";
import { ThrowableItem } from "./inventory/throwableItem";
import { GameMap } from "./map";
import { Bullet, type DamageRecord, type ServerBulletOptions } from "./objects/bullet";
import { type Emote } from "./objects/emote";
import { Explosion } from "./objects/explosion";
import { type BaseGameObject, type GameObject } from "./objects/gameObject";
import { Loot, type ItemData } from "./objects/loot";
import { Obstacle } from "./objects/obstacle";
import { Player } from "./objects/player";
import { Gamer, type PlayerContainer } from "./objects/gamer";
import { SyncedParticle } from "./objects/syncedParticle";
import { ThrowableProjectile } from "./objects/throwableProj";
import { PluginManager } from "./pluginManager";
import { Team } from "./team";
import { Grid } from "./utils/grid";
import { IDAllocator } from "./utils/idAllocator";
import { Logger } from "./utils/misc";
import { MAP } from "@common/definitions/modes";
import { createServer } from "./utils/serverHelpers";
import { Airdrop, AirdropManager } from "./game/airdropManager";
import { GameLifecycle } from "./game/gameLifecycle";
import { ObjectSpawner } from "./game/objectSpawner";
import { PlayerManager } from "./game/playerManager";
import { BotManager } from "./game/botManager";
import { ConnectionManager } from "./game/connectionManager";
import { SpawnManager } from "./game/spawnManager";
import { VehicleDefinition } from "@common/definitions/vehicles";
import { Vehicle } from "./objects/vehicle";
import { DungeonPacketData, DungeonPacket } from "@common/packets/dungeonPackage";

/*
    eslint-disable

    @stylistic/indent-binary-ops
*/

/*
    `@stylistic/indent-binary-ops`: eslint sucks at indenting ts types
 */
export class Game implements GameData {
    public readonly port: number;
    public readonly gameId: string;

    gas: Gas;

    readonly map: GameMap;
    readonly grid: Grid;
    readonly pluginManager = new PluginManager(this);

    readonly partialDirtyObjects = new Set<BaseGameObject>();
    readonly fullDirtyObjects = new Set<BaseGameObject>();

    updateObjects = false;

    readonly livingPlayers = new Set<Player>();
    readonly connectingPlayers = new Set<Player>();
    readonly connectedPlayers = new Set<Player>();
    spectatablePlayers: Player[] = [];
    newPlayers: Player[] = [];
    readonly deletedPlayers: number[] = [];

    readonly packets: InputPacket[] = [];

    readonly gameMode: MODE;

    readonly teamMode: boolean;

    readonly rainDrops: number = 0;

    readonly gameMap: MAP;
    totalBots: number = 0;

    destroyedObstacles: Array<{
        definition: ObstacleDefinition
        position: Vector
        rotation: number
        orientation: number
        scale: number
        layer: Layer
        variation?: number
    }> = [];

    readonly teams = new (class SetArray<T> extends Set<T> {
        private _valueCache?: T[];
        get valueArray(): T[] {
            return this._valueCache ??= [...super.values()];
        }

        add(value: T): this {
            super.add(value);
            this._valueCache = undefined;
            return this;
        }

        delete(value: T): boolean {
            const ret = super.delete(value);
            this._valueCache = undefined;
            return ret;
        }

        clear(): void {
            super.clear();
            this._valueCache = undefined;
        }

        values(): IterableIterator<T> {
            const iterator = this.values();
            this._valueCache ??= [...iterator];

            return iterator;
        }
    })<Team>();

    private _nextTeamID = -1;
    get nextTeamID(): number { return ++this._nextTeamID; }

    readonly teamsMapping: globalThis.Map<string, Team> = new globalThis.Map<string, Team>();

    readonly explosions: Explosion[] = [];
    readonly emotes: Emote[] = [];

    readonly bullets = new Set<Bullet>();
    readonly newBullets: Bullet[] = [];

    readonly airdrops: Airdrop[] = [];

    readonly planes: Array<{
        readonly position: Vector
        readonly direction: number
    }> = [];

    readonly detectors: Obstacle[] = [];

    readonly mapPings: PingSerialization[] = [];

    _timeouts = new Set<Timeout>();

    addTimeout(callback: () => void, delay = 0): Timeout {
        const timeout = new Timeout(callback, this.now + delay);
        this._timeouts.add(timeout);
        return timeout;
    }

    _started = false;

    startedTime = Number.MAX_VALUE;
    allowJoin = false;
    over = false;
    stopped = false;
    get aliveCount(): number {
        return this.livingPlayers.size;
    }

    startTimeout?: Timeout;

    aliveCountDirty = false;

    private _now = Date.now();
    get now(): number { return this._now; }

    private readonly idealDt = 1000 / Config.tps;

    private _dt = this.idealDt;
    get dt(): number { return this._dt; }

    private readonly _tickTimes: number[] = [];

    _idAllocator = new IDAllocator(16);

    private readonly _start = this._now;
    get start(): number { return this._start; }

    readonly app: any;

    gameWave: number = 1;

    get nextObjectID(): number {
        return this._idAllocator.takeNext();
    }

    // New managers
    spawnManager: SpawnManager;
    objectSpawner: ObjectSpawner;
    botManager: BotManager;
    private connectionManager: ConnectionManager;
    private playerManager: PlayerManager;
    private airdropManager: AirdropManager;
    private gameLifecycle: GameLifecycle;

    getRandomMap(): { map: MAP; rainDrops: number } {
        const configs: { map: MAP; rainChance: number }[] = [
            { map: "desert", rainChance: 0 },
            { map: "fall", rainChance: 0.5 },
            { map: "winter", rainChance: 0.5 },
            { map: "cursedIsland", rainChance: 1 },
        ];

        const selectedConfig = configs[(Math.random() * configs.length) | 0];
        const { map, rainChance } = selectedConfig;

        const rainValues = [200, 300, 400, 500];
        const rainDrops = Math.random() < rainChance
            ? rainValues[(Math.random() * rainValues.length) | 0]
            : 0;

        return { map, rainDrops };
    }

    constructor(port: number, maxTeamSize: MODE, gameId: string) {
        this.port = port;
        this.gameMode = maxTeamSize;
        this.gameId = gameId;
       
        this.gameMap = "fall";
        this.rainDrops = 0;

        // const randMap = this.getRandomMap();
        // this.gameMap = randMap.map;
        // this.rainDrops = randMap.rainDrops;

        this.teamMode = this.gameMode > MODE.Solo;
        this.updateGameData({
            aliveCount: 0,
            allowJoin: false,
            over: false,
            stopped: false,
            startedTime: -1
        });

        this.pluginManager.loadPlugins();
        // Initialize new managers
        this.botManager = new BotManager(this);
        this.connectionManager = new ConnectionManager(this);
        this.spawnManager = new SpawnManager(this);
        this.playerManager = new PlayerManager(this);
        this.objectSpawner = new ObjectSpawner(this);
        this.airdropManager = new AirdropManager(this);
        this.gameLifecycle = new GameLifecycle(this);

        const { width, height } = Maps[this.gameMap];
        this.grid = new Grid(this, width, height);
        this.map = new GameMap(this);
        this.gas = new Gas(this);

        this.setGameData({ allowJoin: true });

        this.pluginManager.emit("game_created", this);
        Logger.log(`Game ${this.port} | Created in ${Date.now() - this._start} ms`);

        this.app = createServer();

        if (Config.addBot) {
            this.botManager.activateBots();
        }

        this.connectionManager.initPlayRoutes(this.app);

        // Start the tick loop
        this.tick();
    }

    readonly tick = (): void => {
        const now = Date.now();
        this._dt = now - this._now;
        this._now = now;

        // execute timeouts
        for (const timeout of this._timeouts) {
            if (timeout.killed) {
                this._timeouts.delete(timeout);
                continue;
            }

            if (this.now > timeout.end) {
                timeout.callback();
                this._timeouts.delete(timeout);
            }
        }

        for (const loot of this.grid.pool.getCategory(ObjectCategory.Loot)) {
            loot.update();
        }

        for (const parachute of this.grid.pool.getCategory(ObjectCategory.Parachute)) {
            parachute.update();
        }

        for (const projectile of this.grid.pool.getCategory(ObjectCategory.ThrowableProjectile)) {
            projectile.update();
        }

        for (const syncedParticle of this.grid.pool.getCategory(ObjectCategory.SyncedParticle)) {
            syncedParticle.update();
        }
       
        for (const vehicle of this.grid.pool.getCategory(ObjectCategory.Vehicle)) {
            vehicle.update();
        }

        // Update bullets
        let records: DamageRecord[] = [];
        for (const bullet of this.bullets) {
            records = records.concat(bullet.update());

            if (bullet.dead) {
                const onHitExplosion = bullet.definition.onHitExplosion;
                if (onHitExplosion && !bullet.reflected) {
                    this.objectSpawner.addExplosion(
                        onHitExplosion,
                        bullet.position,
                        bullet.shooter,
                        bullet.layer,
                        bullet.sourceGun instanceof GunItem ? bullet.sourceGun : undefined
                    );
                }
                this.bullets.delete(bullet);
            }
        }

        for (const { object, damage, source, weapon, position } of records) {
            object.damage({
                amount: damage,
                source,
                weaponUsed: weapon,
                position: position
            });
        }

        // Handle explosions
        for (const explosion of this.explosions) {
            explosion.explode();
        }

        // Update detectors
        for (const detector of this.detectors) {
            detector.updateDetector();
        }

        // Update gas
        this.gas.tick();

        // Delete players that haven't sent a JoinPacket after 30 seconds
        for (const player of this.connectingPlayers) {
            if (this.now - player.joinTime > 30000) {
                player.disconnect("Failed to join game, please try again!");
            }
        }

        // First loop over players: movement, animations, & actions
        for (const player of this.grid.pool.getCategory(ObjectCategory.Player)) {
            if (!player.dead) player.update();
        }

        // Cache objects serialization
        for (const partialObject of this.partialDirtyObjects) {
            if (!this.fullDirtyObjects.has(partialObject)) {
                partialObject.serializePartial();
            }
        }
        for (const fullObject of this.fullDirtyObjects) {
            fullObject.serializeFull();
        }

        // Second loop over players: calculate visible objects & send updates
        for (const player of this.connectedPlayers) {
            if (!player.joined) continue;
            player.secondUpdate();
        }

        // Third loop over players: clean up after all packets have been sent
        for (const player of this.connectedPlayers) {
            if (!player.joined) continue;
            player.postPacket();
        }

        // Reset everything
        this.fullDirtyObjects.clear();
        this.partialDirtyObjects.clear();
        this.newBullets.length = 0;
        this.explosions.length = 0;
        this.emotes.length = 0;
        this.newPlayers.length = 0;
        this.deletedPlayers.length = 0;
        this.packets.length = 0;
        this.planes.length = 0;
        this.mapPings.length = 0;
        this.aliveCountDirty = false;
        this.gas.dirty = false;
        this.gas.completionRatioDirty = false;
        this.updateObjects = false;

        // Winning logic
        if (
            this._started
            && !this.over
            && !Config.startImmediately
            && this.gameMode != MODE.Dungeon
            && (
                this.teamMode
                    ? this.aliveCount <= (this.gameMode as number) && new Set([...this.livingPlayers].map(p => p.teamID)).size <= 1
                    : this.aliveCount <= 1
            )
        ) {
            this.gameLifecycle.endGame();
        }

        // game wave end
        if (this.gameMode === MODE.Dungeon && this._started && !this.over) {
            if (this.aliveCount == 0) {
                this.gameLifecycle.endGame();
            }

            if (this.gas.isFinal()) {
                this.gas.reset();
                setTimeout(() => this.gas.advanceGasStage(), 50);

                this.gameWave++;
                this.botManager.removeBots();

                for (const player of this.connectedPlayers) {
                    if (player.dead) {
                        player.damageHandler.resurrect();
                    };
                }

                setTimeout(() => {
                    this.packets.push(
                        DungeonPacket.create({
                            waves: this.gameWave,
                        } as DungeonPacketData)
                    );
                    this.botManager.activateBots()
                }, 5000);
            }
        }

        if (this.aliveCount >= Config.maxPlayersPerGame) {
            this.gameLifecycle.createNewGame();
        }

        // Record performance and start the next tick
        const tickTime = Date.now() - this.now;
        this._tickTimes.push(tickTime);

        if (this._tickTimes.length >= 200) {
            const mspt = Statistics.average(this._tickTimes);
            const stddev = Statistics.stddev(this._tickTimes);
            this._tickTimes.length = 0;
        }

        this.pluginManager.emit("game_tick", this);

        if (!this.stopped) {
            setTimeout(this.tick, this.idealDt);
        }
    };

    setGameData(data: Partial<Omit<GameData, "aliveCount">>): void {
        for (const [key, value] of Object.entries(data)) {
            this[key as keyof typeof data] = value as never;
        }
        this.updateGameData(data);
    }

    updateGameData(data: Partial<GameData>): void {
        parentPort?.postMessage({
            type: WorkerMessages.UpdateGameData, data
        } satisfies WorkerMessage);
    }

    // Delegated to playerManager
    get killLeader(): Player | undefined { return this.playerManager.killLeader; }
    updateKillLeader(player: Player): void { this.playerManager.updateKillLeader(player); }
    killLeaderDead(killer?: Player): void { this.playerManager.killLeaderDead(killer); }
    killLeaderDisconnected(leader: Player): void { this.playerManager.killLeaderDisconnected(leader); }

    // Delegated to playerManager
    addPlayer(socket: WebSocket<PlayerContainer>): Gamer | undefined {
        return this.playerManager.addPlayer(socket);
    }

    async activatePlayer(player: Gamer, packet: PlayerData) {
        await this.playerManager.activatePlayer(player, packet);
    }

    removePlayer(player: Player): void {
        this.playerManager.removePlayer(player);
    }

    // Delegated to gameLifecycle
    postGameStarted(): void {
        this.gameLifecycle.postGameStarted();

        if (this.gameMode === MODE.Dungeon) {
            this.packets.push(
                DungeonPacket.create({
                    waves: this.gameWave,
                } as DungeonPacketData)
            );
        }
    }

    // Delegated to objectSpawner
    addLoot<Def extends LootDefinition = LootDefinition>(
        definition: ReifiableDef<Def>,
        position: Vector,
        layer: Layer,
        options: { count?: number, pushVel?: number, jitterSpawn?: boolean, data?: ItemData<Def> } = {}
    ): Loot<Def> | undefined {
        return this.objectSpawner.addLoot(definition, position, layer, options);
    }

    removeLoot(loot: Loot): void {
        this.objectSpawner.removeLoot(loot);
    }

    addBullet(source: GunItem | Explosion, shooter: GameObject, options: ServerBulletOptions): Bullet {
        return this.objectSpawner.addBullet(source, shooter, options);
    }

    addExplosion(
        type: ReifiableDef<ExplosionDefinition>,
        position: Vector,
        source: GameObject,
        layer: Layer,
        weapon?: GunItem | MeleeItem | ThrowableItem,
        damageMod = 1
    ): Explosion {
        return this.objectSpawner.addExplosion(type, position, source, layer, weapon, damageMod);
    }

    addProjectile(definition: ThrowableDefinition, position: Vector, layer: Layer, source: ThrowableItem): ThrowableProjectile {
        return this.objectSpawner.addProjectile(definition, position, layer, source);
    }

    removeProjectile(projectile: ThrowableProjectile): void {
        this.objectSpawner.removeProjectile(projectile);
    }

    addSyncedParticle(definition: SyncedParticleDefinition, position: Vector, layer: Layer | number, creatorID?: number): SyncedParticle {
        return this.objectSpawner.addSyncedParticle(definition, position, layer, creatorID);
    }

    removeSyncedParticle(syncedParticle: SyncedParticle): void {
        this.objectSpawner.removeSyncedParticle(syncedParticle);
    }

    addSyncedParticles(particles: SyncedParticleSpawnerDefinition, position: Vector, layer: Layer | number): void {
        this.objectSpawner.addSyncedParticles(particles, position, layer);
    }

    removeObject(object: GameObject): void {
        this.objectSpawner.removeObject(object);
    }

    removeVehicle(vehicle: Vehicle): void {
        this.objectSpawner.removeVehicle(vehicle);
    }

    // Delegated to airdropManager
    summonAirdrop(position: Vector): void {
        this.airdropManager.summonAirdrop(position);
    }

    isStarted() {
        return this.gameLifecycle.isStarted();
    }
}
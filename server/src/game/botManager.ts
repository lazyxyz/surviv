import { CircleHitbox } from "@common/utils/hitbox";
import { Geometry } from "@common/utils/math";
import { MapObjectSpawnMode } from "@common/utils/objectDefinitions";
import { Vec } from "@common/utils/vector";
import { BotType, Zombie, Ninja, Boomer, Butcher, Ghost, Werewolf } from "../objects/bots";
import { ActorContainer, Player } from "../objects/player";
import { Game } from "../game";
import { Logger } from "../utils/misc";
import { Layer, MODE } from "@common/constants";
import { BehaviorType } from "../objects/bots/bot";
import { Team } from "../team";

export class BotManager {
    private game: Game;
    private bots: Set<Player> = new Set();

    constructor(game: Game) {
        this.game = game;
    }

    createBot(botType: BotType, botData: ActorContainer, behaviorType: BehaviorType,
        layer?: Layer, team?: Team, level?: number): Player {
        let spawnPosition = Vec.create(this.game.map.width / 2, this.game.map.height / 2);

        const hitbox = new CircleHitbox(5);
        const gasPosition = this.game.gas.newPosition;
        const gasRadius = this.game.gas.newRadius ** 2;

        let foundPosition = false;
        for (let tries = 0; !foundPosition && tries < 200; tries++) {
            const position = this.game.map.getRandomPosition(
                hitbox,
                {
                    maxAttempts: 500,
                    spawnMode: MapObjectSpawnMode.GrassAndSand,
                    getPosition: undefined,
                    collides: position => Geometry.distanceSquared(position, gasPosition) >= gasRadius
                }
            );

            if (!position) break;
            else {
                spawnPosition = position;
                foundPosition = true;
            }
        }

        let bot: Player;
        switch (botType) {
            case BotType.Zombie: {
                bot = new Zombie(this.game, botData, spawnPosition, behaviorType, layer, team, level);
                break;
            }

            case BotType.Ninja: {
                bot = new Ninja(this.game, botData, spawnPosition, behaviorType, layer, team, level);
                break;
            }
            case BotType.Ghost: {
                bot = new Ghost(this.game, botData, spawnPosition, behaviorType, layer, team, level);
                break;
            }
            case BotType.Butcher: {
                bot = new Butcher(this.game, botData, spawnPosition, behaviorType, layer, team, level);
                break;
            }
            case BotType.Werewolf: {
                bot = new Werewolf(this.game, botData, spawnPosition, behaviorType, layer, team, level);
                break;
            }
            case BotType.Boomer: {
                bot = new Boomer(this.game, botData, spawnPosition, behaviorType, layer, team, level);
                break;
            }
        }

        if (this.game.gameMode !== MODE.Dungeon) {
            this.game.livingPlayers.add(bot);
        }

        this.game.connectedPlayers.add(bot);
        this.game.newPlayers.push(bot);
        this.game.grid.addObject(bot);
        bot.setDirty();
        this.game.aliveCountDirty = true;
        this.game.updateObjects = true;
        this.game.updateGameData({ aliveCount: this.game.aliveCount });
        bot.joined = true;

        this.bots.add(bot);
        this.game.totalBots++;

        this.game.addTimeout(() => { bot.disableInvulnerability(); }, 5000);
        return bot;
    }


    activateBots(): void {
        const FIXED_BOTS = 75; // Fixed total bots per wave (adjust as needed, e.g., 100 for harder)

        const botData: ActorContainer = {
            autoFill: false,
            lobbyClearing: true,
            weaponPreset: "",
            ip: undefined
        };

        if (this.game.gameMode == MODE.Dungeon) {
            const wave = this.game.gameWave;

            // Determine available types: progressive for waves 1-5, all after
            let availableTypes: BotType[] = [];
            if (wave <= 5) {
                // Waves 1-5: Introduce one new type per wave
                if (wave >= 1) availableTypes.push(BotType.Zombie);
                if (wave >= 2) availableTypes.push(BotType.Werewolf);
                if (wave >= 3) availableTypes.push(BotType.Ghost);
                if (wave >= 4) availableTypes.push(BotType.Boomer);
                if (wave >= 5) availableTypes.push(BotType.Butcher);
            } else {
                // Waves 6+: Always all types
                availableTypes = [BotType.Zombie, BotType.Werewolf, BotType.Ghost, BotType.Boomer, BotType.Butcher];
            }

            if (availableTypes.length === 0) {
                Logger.log(`No bots spawned for wave ${wave}`);
                return;
            }

            // Dungeon-specific behavior mapping (different "skills" from non-Dungeon)
            const dungeonBehaviorMap: Record<BotType, BehaviorType> = {
                [BotType.Zombie]: BehaviorType.LockOnChase,
                [BotType.Werewolf]: BehaviorType.ChaseRandom,
                [BotType.Ghost]: BehaviorType.ChaseRandom,
                [BotType.Boomer]: BehaviorType.ChaseRandom,
                [BotType.Butcher]: BehaviorType.ChaseRandom,
                [BotType.Ninja]: BehaviorType.HideAndAttack,

            };

            const level = wave;

            // Fixed total bots, distributed evenly
            const perType = Math.floor(FIXED_BOTS / availableTypes.length);
            let remainder = FIXED_BOTS % availableTypes.length;
            let spawned = 0;

            for (const type of availableTypes) {
                const behavior = dungeonBehaviorMap[type]; // Dungeon-specific skill/behavior
                const count = perType + (remainder > 0 ? 1 : 0);
                remainder = Math.max(0, remainder - 1);

                for (let i = 0; i < count; i++) {
                    // Pass behavior, undefined for layer/team, wave-based level
                    this.createBot(type, botData, behavior, undefined, undefined, level);
                    spawned++;
                }
            }

            // Let createBot handle totalBots increments
            console.log(`Wave ${wave} Bots activated: ${spawned} fixed total (level ${level}), types: ${availableTypes.join(', ')}`);
        } else {
            // Non-Dungeon: Use original ("old") skills/behaviors and levels
            // Random total bots between 20 and 30
            const totalBots = Math.floor(Math.random() * 11) + 20; // 20-30 inclusive

            // Original 20% distribution for all types
            const typeConfigs: Array<{ type: BotType; percentage: number; behavior: BehaviorType; level: number }> = [
                { type: BotType.Zombie, percentage: 0.2, behavior: BehaviorType.ProximityAttack, level: 5 },
                { type: BotType.Ninja, percentage: 0.2, behavior: BehaviorType.HideAndAttack, level: 1 },
                { type: BotType.Werewolf, percentage: 0.2, behavior: BehaviorType.HideAndAttack, level: 5 },
                { type: BotType.Boomer, percentage: 0.2, behavior: BehaviorType.ProximityAttack, level: 5 },
                { type: BotType.Butcher, percentage: 0.2, behavior: BehaviorType.LockOnChase, level: 5 }
            ];

            // Calculate base counts
            let counts: Record<BotType, number> = {} as Record<BotType, number>;
            let currentTotal = 0;
            for (const { type, percentage } of typeConfigs) {
                counts[type] = Math.floor(totalBots * percentage);
                currentTotal += counts[type];
            }

            // Distribute remainder round-robin (fair)
            const remainder = totalBots - currentTotal;
            const typeOrder = typeConfigs.map(({ type }) => type);
            for (let i = 0; i < remainder; i++) {
                const type = typeOrder[i % typeOrder.length];
                counts[type]++;
            }

            // Spawn using original skills
            let spawned = 0;
            for (const { type, behavior, level } of typeConfigs) {
                const count = counts[type];

                for (let i = 0; i < count; i++) {
                    this.createBot(type, botData, behavior, undefined, undefined, level);
                    spawned++;
                }
            }

            // Let createBot handle totalBots increments
            Logger.log(`Bots added to game: Total Bots = ${spawned} (random ${totalBots}) (${Object.entries(counts).map(([t, c]) => `${t}: ${c}`).join(', ')})`);
        }
    }

    removeBots(): void {
        for (const bot of Array.from(this.bots)) {
            bot.dead = true;
            this.game.livingPlayers.delete(bot);
            this.game.spectatablePlayers = this.game.spectatablePlayers.filter(p => p !== bot);
            this.game.connectedPlayers.delete(bot);
            this.game.newPlayers = this.game.newPlayers.filter(p => p !== bot);
            this.game.grid.removeObject(bot);
            bot.destroy();
        }
        this.bots.clear();
        this.game.totalBots = 0;
        this.game.aliveCountDirty = true;
        this.game.updateObjects = true;
        this.game.updateGameData({ aliveCount: this.game.aliveCount });
        Logger.log(`All bots removed. Total bots cleaned: ${this.game.totalBots}`);
    }
}
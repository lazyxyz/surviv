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

        this.game.livingPlayers.add(bot);
        // this.game.spectatablePlayers.push(bot);
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

            // Base level = wave, +2 on milestone waves (5,10,15,...)
            const isMilestone = wave % 5 === 0;
            const level = wave + (isMilestone ? 2 : 0);

            // Fixed total bots, distributed evenly
            const perType = Math.floor(FIXED_BOTS / availableTypes.length);
            let remainder = FIXED_BOTS % availableTypes.length;
            let spawned = 0;

            for (const type of availableTypes) {
                const count = perType + (remainder > 0 ? 1 : 0);
                remainder = Math.max(0, remainder - 1);

                for (let i = 0; i < count; i++) {
                    // this.createBot(type, botData, level);
                    spawned++;
                }
            }

            this.game.totalBots = spawned;
            console.log(`Wave ${wave} Bots activated: ${spawned} fixed total (level ${level}), types: ${availableTypes.join(', ')} (milestone: ${isMilestone})`);
        } else {
            // Generate random total bots between 20 and 30
            const totalBots = Math.floor(Math.random() * (30 - 20 + 1)) + 20;

            // Calculate counts based on percentages (proportional distribution with flooring and remainder assignment)
            let zombieCount = Math.floor(totalBots * 0.40);
            let ninjaCount = Math.floor(totalBots * 0.20);
            let werewolfCount = Math.floor(totalBots * 0.20);
            let boomerCount = Math.floor(totalBots * 0.10);
            let ghostCount = Math.floor(totalBots * 0.05);
            let butcherCount = Math.floor(totalBots * 0.05);

            // Distribute any remainder to ensure exact total
            const currentTotal = zombieCount + ninjaCount + werewolfCount + boomerCount + ghostCount + butcherCount;
            const remainder = totalBots - currentTotal;
            const types = [
                { count: zombieCount, weight: 0.40 },
                { count: ninjaCount, weight: 0.20 },
                { count: werewolfCount, weight: 0.20 },
                { count: boomerCount, weight: 0.10 },
                { count: ghostCount, weight: 0.05 },
                { count: butcherCount, weight: 0.05 }
            ];
            for (let i = 0; i < remainder; i++) {
                // Add to the type with highest weight proportionally
                const maxWeightIndex = types.reduce((maxIdx, type, idx) => type.weight > types[maxIdx].weight ? idx : maxIdx, 0);
                types[maxWeightIndex].count++;
                types[maxWeightIndex].weight -= 0.01; // Slightly reduce to avoid always picking the same
            }

            // Extract updated counts
            ({ count: zombieCount } = types[0]);
            ({ count: ninjaCount } = types[1]);
            ({ count: werewolfCount } = types[2]);
            ({ count: boomerCount } = types[3]);
            ({ count: ghostCount } = types[4]);
            ({ count: butcherCount } = types[5]);

            // Create bots with correct behaviors (based on class definitions)
            for (let i = 0; i < zombieCount; i++) {
                this.createBot(BotType.Zombie, botData, BehaviorType.ProximityAttack, undefined, undefined, 5);
            }
            for (let i = 0; i < ninjaCount; i++) {
                this.createBot(BotType.Ninja, botData, BehaviorType.HideAndAttack, undefined, undefined, 5);
            }
            for (let i = 0; i < werewolfCount; i++) {
                this.createBot(BotType.Werewolf, botData, BehaviorType.ProximityAttack, undefined, undefined, 10);
            }
            for (let i = 0; i < boomerCount; i++) {
                this.createBot(BotType.Boomer, botData, BehaviorType.ProximityAttack, undefined, undefined, 10);
            }
            for (let i = 0; i < ghostCount; i++) {
                this.createBot(BotType.Ghost, botData, BehaviorType.ProximityAttack, undefined, undefined, 10);
            }
            for (let i = 0; i < butcherCount; i++) {
                this.createBot(BotType.Butcher, botData, BehaviorType.HideAndAttack, undefined, undefined, 10);
            }

            this.game.totalBots = totalBots;
            Logger.log(`Bots added to game: Total Bots = ${this.game.totalBots} (Zombies: ${zombieCount}, Ninjas: ${ninjaCount}, Werewolves: ${werewolfCount}, Boomers: ${boomerCount}, Ghosts: ${ghostCount}, Butchers: ${butcherCount})`);
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
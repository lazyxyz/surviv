import { CircleHitbox } from "@common/utils/hitbox";
import { Geometry } from "@common/utils/math";
import { MapObjectSpawnMode } from "@common/utils/objectDefinitions";
import { Vec } from "@common/utils/vector";
import { BotType, Zombie, Ninja, Assassin } from "../objects/bots";
import { ActorContainer, Player } from "../objects/player";
import { Game } from "../game";
import { Logger } from "../utils/misc";
import { Layer, MODE } from "@common/constants";
import { Ghost } from "../objects/bots/ghost";
import { Butcher } from "../objects/bots/butcher";
import { Werewolf } from "../objects/bots/werewolf";
import { Boomer } from "../objects/bots/boomer";

export class BotManager {
    private game: Game;
    private bots: Set<Player> = new Set();

    constructor(game: Game) {
        this.game = game;
    }

    createBot(botType: BotType, botData: ActorContainer, level?: number): Player {
        let spawnPosition = Vec.create(this.game.map.width / 2, this.game.map.height / 2);
        let spawnLayer: Layer | undefined;

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
                bot = new Zombie(this.game, botData, spawnPosition, spawnLayer, undefined, level);
                break;
            }

            case BotType.Ninja: {
                bot = new Ninja(this.game, botData, spawnPosition, spawnLayer, undefined);
                break;
            }
            case BotType.Assassin: {
                bot = new Assassin(this.game, botData, spawnPosition, spawnLayer, undefined);
                break;
            }
            case BotType.Ghost: {
                bot = new Ghost(this.game, botData, spawnPosition, spawnLayer, undefined, level);
                break;
            }
            case BotType.Butcher: {
                bot = new Butcher(this.game, botData, spawnPosition, spawnLayer, undefined, level);
                break;
            }
            case BotType.Werewolf: {
                bot = new Werewolf(this.game, botData, spawnPosition, spawnLayer, undefined, level);
                break;
            }
            case BotType.Boomer: {
                bot = new Boomer(this.game, botData, spawnPosition, spawnLayer, undefined, level);
                break;
            }
        }

        // this.game.livingPlayers.add(bot);
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

        if (this.game.maxTeamSize == MODE.CursedIsland) {
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
                    this.createBot(type, botData, level);
                    spawned++;
                }
            }

            this.game.totalBots = spawned;
            Logger.log(`Wave ${wave} Bots activated: ${spawned} fixed total (level ${level}), types: ${availableTypes.join(', ')} (milestone: ${isMilestone})`);
        } else {
            const zombieCount = 15; // Fixed for non-dungeon mode too
            const ninjaCount = 7;
            const assassinCount = 4;

            for (let i = 0; i < zombieCount; i++) {
                this.createBot(BotType.Zombie, botData);
            }
            for (let i = 0; i < ninjaCount; i++) {
                this.createBot(BotType.Ninja, botData);
            }
            for (let i = 0; i < assassinCount; i++) {
                this.createBot(BotType.Assassin, botData);
            }
            this.game.totalBots = zombieCount + ninjaCount + assassinCount;
            Logger.log(`Bots added to game: Total Bots = ${this.game.totalBots} (Zombies: ${zombieCount}, Ninjas: ${ninjaCount}, Assassins: ${assassinCount})`);
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
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

export class BotManager {
    private game: Game;
    private bots: Set<Player> = new Set();

    constructor(game: Game) {
        this.game = game;
    }

    createBot(botType: BotType, botData: ActorContainer): Player {
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
        if (botType === BotType.Zombie) {
            bot = new Zombie(this.game, botData, spawnPosition, spawnLayer);
        } else if (botType === BotType.Ninja) {
            bot = new Ninja(this.game, botData, spawnPosition, spawnLayer);
        } else if(botType == BotType.Assassin) {
            bot = new Assassin(this.game, botData, spawnPosition, spawnLayer);
        } else {
            bot = new Ghost(this.game, botData, spawnPosition, spawnLayer);
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
        const randomInRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

        const zombieCount = randomInRange(10, 20);
        const ninjaCount = randomInRange(5, 10);
        const assassinCount = randomInRange(3, 5);

        const botData: ActorContainer = {
            autoFill: false,
            lobbyClearing: true,
            weaponPreset: "",
            ip: undefined
        };

        for (let i = 0; i < 50; i++) {
            this.createBot(BotType.Ghost, botData);
        }

        // for (let i = 0; i < zombieCount; i++) {
        //     this.createBot(BotType.Zombie, botData);
        // }
        // for (let i = 0; i < ninjaCount; i++) {
        //     this.createBot(BotType.Ninja, botData);
        // }
        // for (let i = 0; i < assassinCount; i++) {
        //     this.createBot(BotType.Assassin, botData);
        // }

        this.game.totalBots = zombieCount + ninjaCount + assassinCount;
        Logger.log(`Bots added to game: Total Bots = ${this.game.totalBots} (Zombies: ${zombieCount}, Ninjas: ${ninjaCount}, Assassins: ${assassinCount})`);
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
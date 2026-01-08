import { parentPort } from "worker_threads";
import { Game } from "../game";
import { WorkerMessages } from "../gameManager";
import { Gamer } from "../objects/gamer";
import { Logger } from "../utils/misc";
import { MODE } from "@common/constants";

export class GameLifecycle {
    private game: Game;

    constructor(game: Game) {
        this.game = game;
    }

    postGameStarted(): void {
        this.game._started = true;
        this.game.setGameData({ startedTime: this.game.now });
        this.game.gas.advanceGasStage();
        let allowJoin = false;
        if (this.game.gameMode == MODE.Bloody) allowJoin = true;
        this.game.setGameData({ allowJoin: allowJoin });
    }

    endGame(): void {
        this.game.setGameData({ allowJoin: false, over: true });

        for (const player of this.game.livingPlayers) {
            const { movement } = player;
            movement.up = movement.down = movement.left = movement.right = false;
            player.attacking = false;
            player.communicationHandler.sendEmote(player.loadout.emotes[4]);
            if (player instanceof Gamer) {
                player.handleGameOver(true);
            }
            this.game.pluginManager.emit("player_did_win", player);
        }
        this.game.pluginManager.emit("game_end", this.game);

        // End the game in 2 seconds
        this.game.addTimeout(() => {
            // Clear all collections
            this.game.livingPlayers.clear();
            this.game.connectedPlayers.clear();
            this.game.connectingPlayers.clear();
            this.game.spectatablePlayers.length = 0;
            this.game.teams.clear();
            this.game.airdrops.length = 0;
            this.game.detectors.length = 0;
            this.game.bullets.clear();
            this.game.newBullets.length = 0;
            this.game.explosions.length = 0;
            this.game.emotes.length = 0;
            this.game.newPlayers.length = 0;
            this.game.deletedPlayers.length = 0;
            this.game.packets.length = 0;
            this.game.planes.length = 0;
            this.game.mapPings.length = 0;
            this.game._timeouts.forEach(timeout => timeout.kill());
            this.game._timeouts.clear();
            this.game.grid.pool.clear();

            this.game.setGameData({ stopped: true });
            this.game.app.close();
            Logger.log(`Game ${this.game.port} | Ended`);
            parentPort?.postMessage({ type: WorkerMessages.GameEnded });
        }, 2000);
    }

    createNewGame(): void {
        if (!this.game.allowJoin) return;

        parentPort?.postMessage({
            type: WorkerMessages.CreateNewGame, maxTeamSize: this.game.gameMode
        });
        Logger.log(`Game ${this.game.port} | Attempting to create new game`);
        this.game.setGameData({ allowJoin: false });
    }

    isStarted(): boolean {
        return this.game._started;
    }
}
import { MODE } from "@common/constants";
import { type GetGameResponse } from "@common/typings";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { Config } from "./config";
import { Game } from "./game";
import { v4 as uuidv4 } from 'uuid';

export const GAMES: Array<GameContainer | undefined> = [];

export interface WorkerInitData {
    readonly id: number
    readonly maxTeamSize: number
}

export enum WorkerMessages {
    AllowIP,
    IPAllowed,
    UpdateGameData,
    UpdateMaxTeamSize,
    CreateNewGame,
    GameEnded,
}

export type WorkerMessage =
    | {
        readonly type: WorkerMessages.UpdateGameData
        readonly data: Partial<GameData>
    }
    | {
        readonly type: WorkerMessages.UpdateMaxTeamSize
        readonly maxTeamSize: MODE
    }
    | {
        readonly type:
        | WorkerMessages.CreateNewGame
        readonly maxTeamSize: MODE
    }
    | {
        readonly type:
        | WorkerMessages.GameEnded
    };

export interface GameData {
    aliveCount: number
    allowJoin: boolean
    over: boolean
    stopped: boolean
    startedTime: number
}

export class GameContainer {
    readonly worker: Worker;

    resolve: (id: number) => void;
    maxTeamSize: MODE;

    private _data: GameData = {
        aliveCount: 0,
        allowJoin: false,
        over: false,
        stopped: false,
        startedTime: -1
    };

    get aliveCount(): number { return this._data.aliveCount; }
    get allowJoin(): boolean { return this._data.allowJoin; }
    get over(): boolean { return this._data.over; }
    get stopped(): boolean { return this._data.stopped; }
    get startedTime(): number { return this._data.startedTime; }

    private readonly _ipPromiseMap = new Map<string, Array<() => void>>();

    constructor(readonly id: number, maxTeamSize: MODE, resolve: (id: number) => void) {
        this.resolve = resolve;
        this.maxTeamSize = maxTeamSize;
        (
            this.worker = new Worker(
                __filename,
                {
                    workerData: { id, maxTeamSize } satisfies WorkerInitData,
                    execArgv: __filename.endsWith(".ts")
                        ? ["-r", "ts-node/register", "-r", "tsconfig-paths/register"]
                        : undefined
                }
            )
        ).on("message", (message: WorkerMessage): void => {
            switch (message.type) {
                case WorkerMessages.UpdateGameData: {
                    this._data = { ...this._data, ...message.data };

                    if (message.data.allowJoin === true) { // This means the game was just created
                        this.resolve(this.id);
                    }
                    break;
                }
                case WorkerMessages.CreateNewGame: {
                    const teamSize = message.maxTeamSize;
                    void newGame(teamSize);
                    break;
                }
                case WorkerMessages.GameEnded: {
                    this.worker.terminate();
                    GAMES[this.id] = undefined; // Clear from games array
                    break;
                }
            }
        });
    }

    sendMessage(message: WorkerMessage): void {
        this.worker.postMessage(message);
    }
}

export async function findGame(teamSize: MODE): Promise<GetGameResponse> {
    let gameID: number;
    let eligibleGames = GAMES.filter((g?: GameContainer): g is GameContainer =>
        !!g && g.maxTeamSize == teamSize && g.allowJoin && !g.over);

    // Attempt to create a new game if one isn't available
    if (!eligibleGames.length) {
        gameID = await newGame(teamSize);

        if (gameID !== -1) {
            return { success: true, gameID };
        } else {
            return gameID !== undefined
                ? { success: true, gameID }
                : { success: false };
        }
    }

    gameID = eligibleGames
        .reduce((a, b) =>
            (
                a.allowJoin && b.allowJoin
                    ? a.aliveCount < b.aliveCount
                    : a.startedTime > b.startedTime
            )
                ? a
                : b
        )
        ?.id;
    return gameID !== undefined
        ? { success: true, gameID }
        : { success: false };
}

export async function newGame(maxTeamSize?: MODE): Promise<number> {
    return new Promise<number>(resolve => {
        const teamSize = maxTeamSize ? maxTeamSize : MODE.Solo;
        let startGameId = Config.soloPort;

        switch (maxTeamSize) {
            case MODE.Solo:
                startGameId = Config.soloPort;
                break;
                
            case MODE.Squad:
                startGameId = Config.squadPort;
                break;

            case MODE.V50:
                startGameId = Config.v50Port;
                break;

            case MODE.Dungeon:
                startGameId = Config.cursedIslandPort;
                break;
        }

        const maxGames = Config.maxGames + startGameId;
        for (let i = startGameId; i < maxGames; i++) {
            const game = GAMES[i];
            if (!game || game.stopped) {
                GAMES[i] = new GameContainer(i, teamSize, resolve);
                resolve(i);
                return;
            }
        }
        resolve(-1);
    });
}


if (!isMainThread) {
    const port = (workerData as WorkerInitData).id;
    const gameId = uuidv4();
    let maxTeamSize = (workerData as WorkerInitData).maxTeamSize;

    new Game(port, maxTeamSize, gameId);

    parentPort?.on("message", (message: WorkerMessage) => {
        switch (message.type) {

            case WorkerMessages.UpdateMaxTeamSize: {
                maxTeamSize = message.maxTeamSize;
                break;
            }
        }
    });
}

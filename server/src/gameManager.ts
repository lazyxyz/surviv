import { TeamSize } from "@common/constants";
import { type GetGameResponse } from "@common/typings";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { Config } from "./config";
import { Game } from "./game";
import { createServer } from "./utils/serverHelpers";
import { initPlayRoutes } from "./api/play";
import { v4 as uuidv4 } from 'uuid';

export interface WorkerInitData {
    readonly id: number
    readonly maxTeamSize: number
}

export enum WorkerMessages {
    AllowIP,
    IPAllowed,
    UpdateGameData,
    UpdateMaxTeamSize,
    CreateNewGame
}

export type WorkerMessage =
    | {
        readonly type: WorkerMessages.AllowIP | WorkerMessages.IPAllowed
        readonly ip: string
    }
    | {
        readonly type: WorkerMessages.UpdateGameData
        readonly data: Partial<GameData>
    }
    | {
        readonly type: WorkerMessages.UpdateMaxTeamSize
        readonly maxTeamSize: TeamSize
    }
    | {
        readonly type:
        | WorkerMessages.CreateNewGame
        readonly maxTeamSize: TeamSize
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
    maxTeamSize: TeamSize;

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

    constructor(readonly id: number, maxTeamSize: TeamSize, resolve: (id: number) => void) {
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
                case WorkerMessages.IPAllowed: {
                    const promises = this._ipPromiseMap.get(message.ip);
                    if (!promises) break;
                    for (const resolve of promises) resolve();
                    this._ipPromiseMap.delete(message.ip);
                    break;
                }
            }
        });
    }

    sendMessage(message: WorkerMessage): void {
        this.worker.postMessage(message);
    }

    async allowIP(ip: string): Promise<void> {
        return await new Promise(resolve => {
            const promises = this._ipPromiseMap.get(ip);
            if (promises) {
                promises.push(resolve);
            } else {
                this.sendMessage({ type: WorkerMessages.AllowIP, ip });

                this._ipPromiseMap.set(ip, [resolve]);
            }
        });
    }
}

export async function findGame(teamSize: TeamSize): Promise<GetGameResponse> {
    let gameID: number;
    let eligibleGames = games.filter((g?: GameContainer): g is GameContainer =>
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

export async function newGame(maxTeamSize?: TeamSize): Promise<number> {
    return new Promise<number>(resolve => {
        const teamSize = maxTeamSize ? maxTeamSize : TeamSize.Solo;

        let startGameId = Config.soloPort;
        if (maxTeamSize == TeamSize.Squad) {
            startGameId = Config.squadPort;
        }
        const maxGames = Config.maxGames + startGameId;
        for (let i = startGameId; i < maxGames; i++) {
            const game = games[i];
            if (!game || game.stopped) {
                games[i] = new GameContainer(i, teamSize, resolve);
                resolve(i);
                return;
            }
        }
        resolve(-1);
    });
}

export const games: Array<GameContainer | undefined> = [];

if (!isMainThread) {
    const port = (workerData as WorkerInitData).id;
    const gameId = uuidv4();
    let maxTeamSize = (workerData as WorkerInitData).maxTeamSize;
    
    let game = new Game(port, maxTeamSize, gameId);

    // string = ip, number = expire time
    const allowedIPs = new Map<string, number>();
    let joinAttempts: Record<string, number> = {};

    parentPort?.on("message", (message: WorkerMessage) => {
        switch (message.type) {
            case WorkerMessages.AllowIP: {
                allowedIPs.set(message.ip, game.now + 10000);
                parentPort?.postMessage({
                    type: WorkerMessages.IPAllowed,
                    ip: message.ip
                });
                break;
            }
            case WorkerMessages.UpdateMaxTeamSize: {
                maxTeamSize = message.maxTeamSize;
                break;
            }
        }
    });

    const app = createServer();
    initPlayRoutes(app, game, allowedIPs, joinAttempts);

    if (Config.protection?.maxJoinAttempts) {
        setInterval((): void => {
            joinAttempts = {};
        }, Config.protection.maxJoinAttempts.duration);
    }
}

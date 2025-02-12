
import { TeamSize } from "@common/constants";
import { ColorStyles, Logger, styleText } from "@common/utils/logging";
import os from "os";
import { isMainThread } from "worker_threads";
import { version } from "../../package.json";
import { Config } from "./config";
import { WorkerMessages, games, newGame } from "./gameManager";
import { CustomTeam } from "./team";
import { createServer } from "./utils/serverHelpers";
import { initGameRoutes } from "./api/game";
import { initAuthRoutes } from "@api/index";
import { initTeamRoutes } from "./api/team";
import { modeFromMap } from "./utils/misc";
import { Cron } from "croner";

export let map = typeof Config.map === "string" ? Config.map : Config.map.rotation[0];
let mapSwitchCron: Cron | undefined;
let mapRotationIndex = 0;


export let teamsCreated: Record<string, number> = {};
export const customTeams: Map<string, CustomTeam> = new Map<string, CustomTeam>();
export let maxTeamSize = typeof Config.maxTeamSize === "number" ? Config.maxTeamSize : Config.maxTeamSize.rotation[0];

if (isMainThread) {
    let app = createServer();
    initGameRoutes(app);
    initTeamRoutes(app);
    initAuthRoutes(app);

    app.listen(Config.host, Config.port, async (): Promise<void> => {
        console.log(
            `
  SSSSS U   U RRRR  V   V IIIII V   V
 S      U   U R   R V   V   I   V   V
  SSS   U   U RRRR   V V    I    V V 
     S  U   U R  R    V     I     V  
  SSSS   UUU  R   R   V   IIIII   V  
`);

        Logger.log(`Suroi Server v${version}`);
        Logger.log(`Listening on ${Config.host}:${Config.port}`);
        Logger.log("Press Ctrl+C to exit.");

        await newGame(TeamSize.Solo);
        await newGame(TeamSize.Squad);

        setInterval(() => {
            const memoryUsage = process.memoryUsage().rss;

            let perfString = `RAM usage: ${Math.round(memoryUsage / 1024 / 1024 * 100) / 100} MB`;

            // windows L
            if (os.platform() !== "win32") {
                const load = os.loadavg().join("%, ");
                perfString += ` | CPU usage (1m, 5m, 15m): ${load}%`;
            }

            serverLog(perfString);
        }, 60000);

        const teamSize = Config.maxTeamSize;
        if (typeof teamSize === "object") {
            for (const size of teamSize.rotation) {
                maxTeamSize = size;
                const humanReadableTeamSizes = [undefined, "solos", "squads"];
                Logger.log(`Switching to ${humanReadableTeamSizes[maxTeamSize] ?? `team size ${maxTeamSize}`}`);
            }
        }

        const _map = Config.map;
        if (typeof _map === "object") {
            mapSwitchCron = Cron(_map.switchSchedule, () => {
                map = _map.rotation[++mapRotationIndex % _map.rotation.length];

                for (const game of games) {
                    game?.worker.postMessage({ type: WorkerMessages.UpdateMap, map });
                }

                serverLog(`Switching to "${map}" map`);
            });
        }
    });

}

export function serverLog(...message: unknown[]): void {
    Logger.log(styleText("[Server]", ColorStyles.foreground.magenta.normal), ...message);
}

export function serverWarn(...message: unknown[]): void {
    Logger.warn(styleText("[Server] [WARNING]", ColorStyles.foreground.yellow.normal), ...message);
}

export function serverError(...message: unknown[]): void {
    Logger.warn(styleText("[Server] [ERROR]", ColorStyles.foreground.red.normal), ...message);
}



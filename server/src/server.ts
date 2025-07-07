import { TeamSize } from "@common/constants";
import os from "os";
import { isMainThread } from "worker_threads";
import { version } from "../../package.json";
import { Config } from "./config";
import { newGame } from "./gameManager";
import { CustomTeam } from "./team";
import { Logger } from "./utils/misc";
import { createServer } from "./utils/serverHelpers";
import { initGameRoutes } from "./api/game";
import { initTeamRoutes } from "./api/team";

export let teamsCreated: Record<string, number> = {};

export const customTeams: Map<string, CustomTeam> = new Map<string, CustomTeam>();
export let maxTeamSize = typeof Config.maxTeamSize === "number" ? Config.maxTeamSize : Config.maxTeamSize.rotation[0];

if (isMainThread) {
    let app = createServer();
    initGameRoutes(app);
    initTeamRoutes(app);

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

            let perfString = `Server | Memory usage: ${Math.round(memoryUsage / 1024 / 1024 * 100) / 100} MB`;

            // windows L
            if (os.platform() !== "win32") {
                const load = os.loadavg().join("%, ");
                perfString += ` | Load (1m, 5m, 15m): ${load}%`;
            }

            Logger.log(perfString);
        }, 60000);

        const teamSize = Config.maxTeamSize;
        if (typeof teamSize === "object") {
            for (const size of teamSize.rotation) {
                maxTeamSize = size;
                const humanReadableTeamSizes = [undefined, "solos", "squads"];
                Logger.log(`Switching to ${humanReadableTeamSizes[maxTeamSize] ?? `team size ${maxTeamSize}`}`);
            }
        }
    });

}


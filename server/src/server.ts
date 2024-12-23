import { GameConstants, TeamSize } from "@common/constants";
import { Badges } from "@common/definitions/badges";
import { Skins } from "@common/definitions/skins";
import { type GetGameResponse } from "@common/typings";
import { Numeric } from "@common/utils/math";
import { Cron } from "croner";
import { URLSearchParams } from "node:url";
import os from "os";
import { type WebSocket } from "uWebSockets.js";
import { isMainThread } from "worker_threads";
import { version } from "../../package.json";
import { Config } from "./config";
import { findGame, games, newGame, WorkerMessages } from "./gameManager";
import { CustomTeam, CustomTeamPlayer, type CustomTeamPlayerContainer } from "./team";
import { cleanUsername, Logger } from "./utils/misc";
import { cors, createServer, forbidden, getIP, textDecoder } from "./utils/serverHelpers";

let teamsCreated: Record<string, number> = {};

export const customTeams: Map<string, CustomTeam> = new Map<string, CustomTeam>();

export let maxTeamSize = typeof Config.maxTeamSize === "number" ? Config.maxTeamSize : Config.maxTeamSize.rotation[0];
let teamSizeRotationIndex = 0;

let maxTeamSizeSwitchCron: Cron | undefined;

if (isMainThread) {
    // Initialize the server
    createServer().get("/api/serverInfo", res => {
        cors(res);
        res
            .writeHeader("Content-Type", "application/json")
            .end(JSON.stringify({
                playerCount: games.reduce((a, b) => (a + (b?.aliveCount ?? 0)), 0),
                maxTeamSize,

                nextSwitchTime: maxTeamSizeSwitchCron?.nextRun()?.getTime(),
                protocolVersion: GameConstants.protocolVersion
            }));
    }).get("/api/getGame", async (res, req) => {
        let aborted = false;
        res.onAborted(() => { aborted = true; });
        cors(res);

        const ip = getIP(res, req);
        const searchParams = new URLSearchParams(req.getQuery());
        const teamSize = Number(searchParams.get("teamSize"));

        let teamID;
        if (teamSize == TeamSize.Squad) {
            teamID = new URLSearchParams(req.getQuery()).get("teamID"); // must be here or it causes uWS errors
        }

        let response: GetGameResponse;
        if (teamID) {
            const team = customTeams.get(teamID);
            if (team?.gameID !== undefined) {
                const game = games[team.gameID];
                response = game && !game.stopped
                    ? { success: true, gameID: team.gameID }
                    : { success: false };
            } else {
                response = { success: false };
            }
        } else {
            response = await findGame(teamSize);
        }

        if (response.success) {
            await games[response.gameID]?.allowIP(ip);
        }

        if (!aborted) {
            res.cork(() => {
                res.writeHeader("Content-Type", "application/json").end(JSON.stringify(response));
            });
        }
    }).listen(Config.host, Config.port, async (): Promise<void> => {
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

        await newGame(Config.soloPort, TeamSize.Solo);
        await newGame(Config.squadPort, TeamSize.Squad);

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
        let maxTeamSizeSwitchCron: Cron | null = null;

        if (typeof teamSize === "object") {
            // Check for the "always" schedule and skip cron job
            if (teamSize.switchSchedule === 'all') {
                for (const size of teamSize.rotation) {
                    maxTeamSize = size;
                    for (const game of games) {
                        game?.worker.postMessage({ type: WorkerMessages.UpdateMaxTeamSize, maxTeamSize });
                    }
                    const humanReadableTeamSizes = [undefined, "solos", "duos", "trios", "squads"];
                    Logger.log(`Switching to ${humanReadableTeamSizes[maxTeamSize] ?? `team size ${maxTeamSize}`}`);
                }
            } else {
                // If it's a valid cron pattern, set up the cron job
                maxTeamSizeSwitchCron = Cron(teamSize.switchSchedule, () => {
                    maxTeamSize = teamSize.rotation[teamSizeRotationIndex = (teamSizeRotationIndex + 1) % teamSize.rotation.length];

                    for (const game of games) {
                        game?.worker.postMessage({ type: WorkerMessages.UpdateMaxTeamSize, maxTeamSize });
                    }

                    const humanReadableTeamSizes = [undefined, "solos", "duos", "trios", "squads"];
                    Logger.log(`Switching to ${humanReadableTeamSizes[maxTeamSize] ?? `team size ${maxTeamSize}`}`);
                });
            }
        }
    });

}

// .ws("/team", {
//     idleTimeout: 30,

//     /**
//      * Upgrade the connection to WebSocket.
//      */
//     upgrade(res, req, context) {
//         res.onAborted((): void => { /* Handle errors in WS connection */ });

//         const ip = getIP(res, req);
//         const maxTeams = Config.protection?.maxTeams;
//         if (
//             maxTeamSize === TeamSize.Solo
//             || (maxTeams && teamsCreated[ip] > maxTeams)
//         ) {
//             forbidden(res);
//             return;
//         }

//         const searchParams = new URLSearchParams(req.getQuery());
//         const teamID = searchParams.get("teamID");

//         let team!: CustomTeam;
//         const noTeamIdGiven = teamID !== null;
//         if (
//             noTeamIdGiven
//             // @ts-expect-error cleanest overall way to do this (`undefined` gets filtered out anyways)
//             && (team = customTeams.get(teamID)) === undefined
//         ) {
//             forbidden(res);
//             return;
//         }

//         if (noTeamIdGiven) {
//             if (team.locked || team.players.length >= (maxTeamSize as number)) {
//                 forbidden(res); // TODO "Team is locked" and "Team is full" messages
//                 return;
//             }
//         } else {
//             team = new CustomTeam();
//             customTeams.set(team.id, team);

//             if (Config.protection?.maxTeams) {
//                 teamsCreated[ip] = (teamsCreated[ip] ?? 0) + 1;
//             }
//         }

//         const name = cleanUsername(searchParams.get("name"));
//         let skin = searchParams.get("skin") ?? GameConstants.player.defaultSkin;
//         let badge = searchParams.get("badge") ?? undefined;

//         //
//         // Role
//         //
//         const password = searchParams.get("password");
//         const givenRole = searchParams.get("role");
//         let role = "";
//         let nameColor: number | undefined;

//         if (
//             password !== null
//             && givenRole !== null
//             && givenRole in Config.roles
//             && Config.roles[givenRole].password === password
//         ) {
//             role = givenRole;

//             if (Config.roles[givenRole].isDev) {
//                 try {
//                     const colorString = searchParams.get("nameColor");
//                     if (colorString) nameColor = Numeric.clamp(parseInt(colorString), 0, 0xffffff);
//                 } catch { /* lol your color sucks */ }
//             }
//         }

//         // Validate skin
//         const rolesRequired = Skins.fromStringSafe(skin)?.rolesRequired;
//         if (rolesRequired && !rolesRequired.includes(role)) {
//             skin = GameConstants.player.defaultSkin;
//         }

//         // Validate badge
//         const roles = badge ? Badges.fromStringSafe(badge)?.roles : undefined;
//         if (roles?.length && !roles.includes(role)) {
//             badge = undefined;
//         }

//         res.upgrade(
//             {
//                 player: new CustomTeamPlayer(
//                     team,
//                     name,
//                     skin,
//                     badge,
//                     nameColor
//                 )
//             },
//             req.getHeader("sec-websocket-key"),
//             req.getHeader("sec-websocket-protocol"),
//             req.getHeader("sec-websocket-extensions"),
//             context
//         );
//     },

//     /**
//      * Handle opening of the socket.
//      * @param socket The socket being opened.
//      */
//     open(socket: WebSocket<CustomTeamPlayerContainer>) {
//         const player = socket.getUserData().player;
//         player.socket = socket;
//         player.team.addPlayer(player);
//     },

//     /**
//      * Handle messages coming from the socket.
//      * @param socket The socket in question.
//      * @param message The message to handle.
//      */
//     message(socket: WebSocket<CustomTeamPlayerContainer>, message: ArrayBuffer) {
//         const player = socket.getUserData().player;
//         // we pray

//         // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
//         void player.team.onMessage(player, JSON.parse(textDecoder.decode(message)));
//     },

//     /**
//      * Handle closing of the socket.
//      * @param socket The socket being closed.
//      */
//     close(socket: WebSocket<CustomTeamPlayerContainer>) {
//         const player = socket.getUserData().player;
//         player.team.removePlayer(player);
//     }
// })

import { GameConstants, TeamSize } from "@common/constants";
import { Badges } from "@common/definitions/badges";
import { Skins } from "@common/definitions/skins";
import { Numeric } from "@common/utils/math";
import { URLSearchParams } from "node:url";
import { TemplatedApp, type WebSocket } from "uWebSockets.js";
import { Config } from "../config";
import { CustomTeam, CustomTeamPlayer, type CustomTeamPlayerContainer } from "../team";
import { Logger, cleanUsername } from "../utils/misc";
import { forbidden, getIP, textDecoder } from "../utils/serverHelpers";
import { customTeams, maxTeamSize, teamsCreated } from "../server";
import { validateJWT } from "@api/auth";

export function initTeamRoutes(app: TemplatedApp) {
    app.ws("/team", {
        idleTimeout: 30,
        /**
         * Upgrade the connection to WebSocket.
         */
        upgrade(res, req, context) {
            res.onAborted((): void => { /* Handle errors in WS connection */ });

            const ip = getIP(res, req);
            const maxTeams = Config.protection?.maxTeams;
            if (
                maxTeamSize === TeamSize.Solo
                || (maxTeams && teamsCreated[ip] > maxTeams)
            ) {
                forbidden(res);
                return;
            }

            const searchParams = new URLSearchParams(req.getQuery());
            const teamID = searchParams.get("teamID");

             // Extract token from Authorization header
             {
                const token = searchParams.get('token');

                if (!token) {
                    Logger.log(`Team ${teamID} | Missing JWT: ${ip}`);
                    forbidden(res);
                    return;
                }

                const decoded = validateJWT(token);
                if (!decoded) {
                    Logger.log(`Game ${teamID} | Invalid JWT: ${ip}`);
                    forbidden(res);
                    return;
                }

            }

            let team!: CustomTeam;
            const noTeamIdGiven = teamID !== null;
            if (
                noTeamIdGiven
                // @ts-expect-error cleanest overall way to do this (`undefined` gets filtered out anyways)
                && (team = customTeams.get(teamID)) === undefined
            ) {
                forbidden(res);
                return;
            }

            if (noTeamIdGiven) {
                if (team.locked || team.players.length >= (maxTeamSize as number)) {
                    forbidden(res); // TODO "Team is locked" and "Team is full" messages
                    return;
                }
            } else {
                team = new CustomTeam();
                customTeams.set(team.id, team);

                if (Config.protection?.maxTeams) {
                    teamsCreated[ip] = (teamsCreated[ip] ?? 0) + 1;
                }
            }

            const name = cleanUsername(searchParams.get("name"));
            let skin = searchParams.get("skin") ?? GameConstants.player.defaultSkin;
            let badge = searchParams.get("badge") ?? undefined;

            //
            // Role
            //
            let nameColor: number = 0xffffff;


            // Validate skin
            skin = GameConstants.player.defaultSkin;

            // Validate badge
            badge = undefined;

            res.upgrade(
                {
                    player: new CustomTeamPlayer(
                        team,
                        name,
                        skin,
                        badge,
                        nameColor
                    )
                },
                req.getHeader("sec-websocket-key"),
                req.getHeader("sec-websocket-protocol"),
                req.getHeader("sec-websocket-extensions"),
                context
            );
        },

        /**
         * Handle opening of the socket.
         * @param socket The socket being opened.
         */
        open(socket: WebSocket<CustomTeamPlayerContainer>) {
            const player = socket.getUserData().player;
            player.socket = socket;
            player.team.addPlayer(player);
        },

        /**
         * Handle messages coming from the socket.
         * @param socket The socket in question.
         * @param message The message to handle.
         */
        message(socket: WebSocket<CustomTeamPlayerContainer>, message: ArrayBuffer) {
            const player = socket.getUserData().player;
            // we pray

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            void player.team.onMessage(player, JSON.parse(textDecoder.decode(message)));
        },

        /**
         * Handle closing of the socket.
         * @param socket The socket being closed.
         */
        close(socket: WebSocket<CustomTeamPlayerContainer>) {
            const player = socket.getUserData().player;
            player.team.removePlayer(player);
        }
    })
}

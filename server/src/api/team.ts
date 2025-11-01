import { GameConstants, MODE } from "@common/constants";
import { URLSearchParams } from "node:url";
import { TemplatedApp, type WebSocket } from "uWebSockets.js";
import { Config } from "../config";
import { CustomTeam, CustomTeamPlayer, type CustomTeamPlayerContainer } from "../team";
import { Logger, cleanUsername } from "../utils/misc";
import { forbidden, getIP, textDecoder } from "../utils/serverHelpers";
import { CUSTOM_TEAMS, teamsCreated } from "../server";

export function initTeamRoutes(app: TemplatedApp) {
    app.ws("/team", {
        idleTimeout: 30,
        /**
         * Upgrade the connection to WebSocket.
         */
        upgrade(res, req, context) {
            res.onAborted((): void => { /* Handle errors in WS connection */ });

            const ip = getIP(res, req);

            const searchParams = new URLSearchParams(req.getQuery());
            const teamID = searchParams.get("teamID");

            let team!: CustomTeam;
            const noTeamIdGiven = teamID !== null;
            if (
                noTeamIdGiven
                // @ts-expect-error cleanest overall way to do this (`undefined` gets filtered out anyways)
                && (team = CUSTOM_TEAMS.get(teamID)) === undefined
            ) {
                forbidden(res);
                return;
            }

            if (noTeamIdGiven) {
                if (team.locked || (!team.roomMode && team.players.length >= team.teamSize )) {
                    forbidden(res); // TODO "Team is locked" and "Team is full" messages
                    return;
                }
            } else {
                team = new CustomTeam();
                CUSTOM_TEAMS.set(team.id, team);

                if (Config.protection?.maxTeams) {
                    teamsCreated[ip] = (teamsCreated[ip] ?? 0) + 1;
                }
            }

            const name = cleanUsername(searchParams.get("name"));
            const skin = searchParams.get("skin") ?? GameConstants.player.defaultSkin;
            const badge = searchParams.get("badge") ?? undefined;
            const nameColor = 0xffffff;

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
    });
}

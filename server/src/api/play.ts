import { Numeric } from "@common/utils/math";
import { SuroiByteStream } from "@common/utils/suroiByteStream";
import { TemplatedApp, WebSocket } from "uWebSockets.js";
import { Config } from "../config";
import { Game } from "../game";
import { PlayerContainer } from "../objects/gamer";
import { Logger } from "../utils/misc";
import {  forbidden, getIP } from "../utils/serverHelpers";

const simultaneousConnections: Record<string, number> = {};
let joinAttempts: Record<string, number> = {};

export function initPlayRoutes(app: TemplatedApp, game: Game, allowedIPs:  Map<string, number>, joinAttempts: Record<string, number>) {
    app.ws("/play", {
        idleTimeout: 30,

        /**
         * Upgrade the connection to WebSocket.
         */
        upgrade(res, req, context) {
            res.onAborted((): void => { /* Handle errors in WS connection */ });

            const ip = getIP(res, req);

            //
            // Rate limits
            //
            if (Config.protection) {
                const { maxSimultaneousConnections, maxJoinAttempts } = Config.protection;

                if (
                    (simultaneousConnections[ip] >= (maxSimultaneousConnections ?? Infinity))
                    || (joinAttempts[ip] >= (maxJoinAttempts?.count ?? Infinity))
                ) {
                    Logger.log(`Game ${game.id} | Rate limited: ${ip}`);
                    forbidden(res);
                    return;
                } else {
                    if (maxSimultaneousConnections) {
                        simultaneousConnections[ip] = (simultaneousConnections[ip] ?? 0) + 1;
                        Logger.log(`Game ${game.id} | ${simultaneousConnections[ip]}/${maxSimultaneousConnections} simultaneous connections: ${ip}`);
                    }
                    if (maxJoinAttempts) {
                        joinAttempts[ip] = (joinAttempts[ip] ?? 0) + 1;
                        Logger.log(`Game ${game.id} | ${joinAttempts[ip]}/${maxJoinAttempts.count} join attempts in the last ${maxJoinAttempts.duration} ms: ${ip}`);
                    }
                }
            }

            const searchParams = new URLSearchParams(req.getQuery());

            //
            // Ensure IP is allowed
            //
            if ((allowedIPs.get(ip) ?? 0) < game.now) {
                forbidden(res);
                return;
            }

            //
            // Validate and parse role and name color
            //
            const password = searchParams.get("password");
            const givenRole = searchParams.get("role");
            let role: string | undefined;
            let isDev = false;

            let nameColor: number | undefined;
            if (
                password !== null
                && givenRole !== null
                && givenRole in Config.roles
                && Config.roles[givenRole].password === password
            ) {
                role = givenRole;
                isDev = Config.roles[givenRole].isDev ?? false;

                if (isDev) {
                    try {
                        const colorString = searchParams.get("nameColor");
                        if (colorString) nameColor = Numeric.clamp(parseInt(colorString), 0, 0xffffff);
                    } catch { /* guess your color sucks lol */ }
                }
            }

            //
            // Upgrade the connection
            //
            res.upgrade(
                {
                    teamID: searchParams.get("teamID") ?? undefined,
                    autoFill: Boolean(searchParams.get("autoFill")),
                    player: undefined,
                    ip,
                    role,
                    isDev,
                    nameColor,
                    lobbyClearing: searchParams.get("lobbyClearing") === "true",
                    weaponPreset: searchParams.get("weaponPreset") ?? ""
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
        open(socket: WebSocket<PlayerContainer>) {
            const data = socket.getUserData();
            if ((data.player = game.addPlayer(socket)) === undefined) {
                socket.close();
            }

            // data.player.sendGameOverPacket(false); // uncomment to test game over screen
        },

        /**
         * Handle messages coming from the socket.
         * @param socket The socket in question.
         * @param message The message to handle.
         */
        message(socket: WebSocket<PlayerContainer>, message) {
            const stream = new SuroiByteStream(message);
            try {
                const player = socket.getUserData().player;
                if (player === undefined) return;
                game.onMessage(stream, player);
            } catch (e) {
                console.warn("Error parsing message:", e);
            }
        },

        /**
         * Handle closing of the socket.
         * @param socket The socket being closed.
         */
        close(socket: WebSocket<PlayerContainer>) {
            const { player, ip } = socket.getUserData();

            // this should never be null-ish, but will leave it here for any potential race conditions (i.e. TFO? (verification required))
            if (Config.protection && ip !== undefined) simultaneousConnections[ip]--;

            if (!player) return;

            Logger.log(`Game ${game.id} | "${player.name}" left`);
            game.removePlayer(player);
        }
    }).listen(Config.host, game.id, (): void => {
        Logger.log(`Game ${game.id} | Listening on ${Config.host}:${game.id}`);
    });
}
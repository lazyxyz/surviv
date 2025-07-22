import { Numeric } from "@common/utils/math";
import { SuroiByteStream } from "@common/utils/suroiByteStream";
import { TemplatedApp, WebSocket } from "uWebSockets.js";
import { Config } from "../config";
import { Game } from "../game";
import { PlayerContainer } from "../objects/gamer";
import { Logger } from "../utils/misc";
import { forbidden, getIP } from "../utils/serverHelpers"
import { validateJWT } from "./api";
import { PacketStream } from "@common/packets/packetStream";
import { ReadyPacket } from "@common/packets/readyPacket";
import { DEFAULT_SKIN, Skins } from "@common/definitions/skins";
import { Badges } from "@common/definitions/badges";
import { EMOTE_SLOTS } from "@common/constants";
import { EmoteDefinition, Emotes } from "@common/definitions/emotes";
import { Melees } from "@common/definitions/melees";
import { Guns } from "@common/definitions/guns";
import { verifyEmotes, verifyGun, verifyMelee, verifySkin } from "./balances";
import { DisconnectPacket } from "@common/packets/disconnectPacket";

const simultaneousConnections: Record<string, number> = {};

function disconnect(socket: WebSocket<PlayerContainer>, reason: string): void {
    const stream = new PacketStream(new ArrayBuffer(128));
    stream.serializeServerPacket(
        DisconnectPacket.create({
            reason
        })
    );

    try {
        socket.send(stream.getBuffer(), true, false);
    } catch (e) {
        console.warn("Error sending packet. Details:", e);
    }
    socket.close();
}


export function initPlayRoutes(app: TemplatedApp, game: Game, allowedIPs: Map<string, number>, joinAttempts: Record<string, number>) {
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
                    Logger.log(`Game ${game.port} | Rate limited: ${ip}`);
                    forbidden(res);
                    return;
                } else {
                    if (maxSimultaneousConnections) {
                        simultaneousConnections[ip] = (simultaneousConnections[ip] ?? 0) + 1;
                        Logger.log(`Game ${game.port} | ${simultaneousConnections[ip]}/${maxSimultaneousConnections} simultaneous connections: ${ip}`);
                    }
                    if (maxJoinAttempts) {
                        joinAttempts[ip] = (joinAttempts[ip] ?? 0) + 1;
                        Logger.log(`Game ${game.port} | ${joinAttempts[ip]}/${maxJoinAttempts.count} join attempts in the last ${maxJoinAttempts.duration} ms: ${ip}`);
                    }
                }
            }

            // Extract token from Authorization header
            const searchParams = new URLSearchParams(req.getQuery());
            const token = searchParams.get('token');

            //
            // Ensure IP is allowed
            //
            if ((allowedIPs.get(ip) ?? 0) < game.now) {
                forbidden(res);
                return;
            }

            //
            // Validate and parse name color
            //

            let nameColor = 0xffffff;

            //
            // Upgrade the connection
            //
            res.upgrade(
                {
                    name: searchParams.get("name") ?? "No name",
                    teamID: searchParams.get("teamID") ?? undefined,
                    autoFill: Boolean(searchParams.get("autoFill")),
                    address: searchParams.get("address") ?? "",
                    token: token,
                    ip,
                    nameColor,
                    lobbyClearing: searchParams.get("lobbyClearing") === "true",
                    weaponPreset: searchParams.get("weaponPreset") ?? "",
                    skin: searchParams.get("skin") ?? "",
                    emotes: searchParams.get("emotes") ?? "",
                    badge: searchParams.get("badge") ?? "",
                    melee: searchParams.get("melee") ?? "",
                    gun: searchParams.get("gun") ?? "",
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
        async open(socket: WebSocket<PlayerContainer>) {
            try {
                const data = socket.getUserData();

                if (!data.token) {
                    disconnect(socket, `Authentication token not found. Please reconnect your wallet.`);
                    return;
                }
                const token = data.token;
                const payload = await validateJWT(token);

                if (payload.walletAddress != data.address?.toLowerCase()) {
                    disconnect(socket, `Invalid address. Please reconnect your wallet.`);
                    return;
                }

                if ((data.player = game.addPlayer(socket)) === undefined) {
                    disconnect(socket, `Authentication failed. Please reconnect your wallet.`);
                    return;
                }

                let emotes: readonly (EmoteDefinition | undefined)[] = [];
                // await verifyEmotes(data.address, data.emotes.split(',')).then((validEmotes) => {
                //     emotes = validEmotes.map(emoteId => Emotes.fromStringSafe(emoteId));
                // }).catch(err => {
                //     console.log("Verify melee failed: ", err);
                //     emotes = EMOTE_SLOTS.map(slot => undefined);
                // })

                // Verify Skin
                let skin = Skins.fromStringSafe(DEFAULT_SKIN); // Default skins
                // await verifySkin(data.address, data.skin, 5000).then((isValid) => {
                //     if (isValid) skin = Skins.fromStringSafe(data.skin);
                // }).catch(err => {
                //     console.log("Verify skin failed: ", err);
                // })

                // Verify Melee
                let melee = undefined;
                // await verifyMelee(data.address, data.melee, 3000).then((isValid) => {
                //     if (isValid) melee = Melees.fromStringSafe(data.melee);
                // }).catch(err => {
                //     console.log("Verify melee failed: ", err);
                // })

                // Verify Gun
                let gun = undefined;
                // await verifyGun(data.address, data.gun, 2000).then((isValid) => {
                //     if (isValid) gun = Guns.fromStringSafe(data.gun);
                // }).catch(err => {
                //     console.log("Verify gun failed: ", err);
                // })

                const stream = new PacketStream(new ArrayBuffer(128));
                stream.serializeServerPacket(
                    ReadyPacket.create({
                        isMobile: false,
                        address: data.address ? data.address : "",
                        emotes: emotes,
                        name: data.name,
                        skin: skin,
                        badge: Badges.fromStringSafe(data.badge),
                        melee: melee,
                        gun: gun,
                    })
                );
                socket.send(stream.getBuffer(), true, false);
                // data.player.sendGameOverPacket(false); // uncomment to test game over screen
            } catch (err: any) {
                console.log("Open websocket failed: ", err);
                disconnect(socket, "Unknown error. Please contact Surviv team.");
            }
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

            Logger.log(`Game ${game.port} | "${player.name}" left`);
            game.removePlayer(player);
        }
    }).listen(Config.host, game.port, (): void => {
        Logger.log(`Game ${game.port} | Listening on ${Config.host}:${game.port}`);
    });
}
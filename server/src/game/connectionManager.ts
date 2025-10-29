import { Game } from "../game";
import { getIP } from "../utils/serverHelpers";
import { Gamer, PlayerContainer } from "../objects/gamer";
import { TemplatedApp, type WebSocket } from "uWebSockets.js";
import { EMOTE_SLOTS } from "@common/constants";
import { Badges } from "@common/definitions/badges";
import { Emotes } from "@common/definitions/emotes";
import { Guns } from "@common/definitions/guns";
import { Melees } from "@common/definitions/melees";
import { ModeToNumber } from "@common/definitions/modes";
import { Skins } from "@common/definitions/skins";
import { DisconnectPacket } from "@common/packets/disconnectPacket";
import { JoinPacket } from "@common/packets/joinPacket";
import { PacketStream } from "@common/packets/packetStream";
import { SuroiByteStream } from "@common/utils/suroiByteStream";
import { validateJWT } from "../api/api";
import { Config } from "../config";
import { Logger } from "../utils/misc";
import { ClientChatPacket, ServerChatPacket, ServerChatPacketData } from "@common/packets/chatPacket";
import { PlayerInputPacket } from "@common/packets/inputPacket";
import { OutputPacket } from "@common/packets/packet";
import { PingPacket } from "@common/packets/pingPacket";
import { SpectatePacket } from "@common/packets/spectatePacket";
import { Player } from "../objects/player";



const simultaneousConnections: Record<string, number> = {};

export class ConnectionManager {
    private game: Game;

    constructor(game: Game) {
        this.game = game;
    }

    initPlayRoutes(app: TemplatedApp): void {
        app.ws("/play", {
            idleTimeout: 30,
            upgrade: (res, req, context) => {
                res.onAborted((): void => { /* Handle errors in WS connection */ });

                const ip = getIP(res, req);

                // Extract token from Authorization header
                const searchParams = new URLSearchParams(req.getQuery());
                const token = searchParams.get('token');

                let nameColor = 0xffffff;

                //
                // Upgrade the connection
                //
                res.upgrade(
                    {
                        name: searchParams.get("name") ?? "No name",
                        teamID: searchParams.get("teamID") ?? undefined,
                        autoFill: Boolean(searchParams.get("autoFill")),
                        roomMode: Boolean(searchParams.get("roomMode")),
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

            open: async (socket: WebSocket<PlayerContainer>) => {
               try {
                const data = socket.getUserData();

                if (!data.token) {
                    this.disconnect(socket, `Authentication token not found. Please reconnect your wallet.`);
                    return;
                }
                const token = data.token;
                const payload = await validateJWT(token);

                if (payload.walletAddress != data.address?.toLowerCase()) {
                    this.disconnect(socket, `Invalid address. Please reconnect your wallet.`);
                    return;
                }

                if ((data.player = this.game.addPlayer(socket)) === undefined) {
                    this.disconnect(socket, `Authentication failed. Please reconnect your wallet.`);
                    return;
                }

                const ownedEmotes = data.emotes.split(',');
                const emotes = EMOTE_SLOTS.map((_, i) => Emotes.fromStringSafe(ownedEmotes[i] || ''))

                const stream = new PacketStream(new ArrayBuffer(1024));
                stream.serializeServerPacket(
                    JoinPacket.create({
                        isMobile: false,
                        address: data.address ? data.address : "",
                        gameMode: ModeToNumber[this.game.gameMap],
                        emotes: emotes,
                        name: data.name,
                        badge: Badges.fromStringSafe(data.badge),
                        skin: Skins.fromStringSafe(data.skin),
                        melee: Melees.fromStringSafe(data.melee),
                        gun: Guns.fromStringSafe(data.gun),
                        rainDrops: this.game.rainDrops,
                    })
                );
                socket.send(stream.getBuffer(), true, false);
            } catch (err: any) {
                console.log("Open websocket failed: ", err);
                this.disconnect(socket, "Unknown error. Please contact Surviv team.");
            }
            },

            message: (socket: WebSocket<PlayerContainer>, message: ArrayBuffer) => {
                const stream = new SuroiByteStream(message);
                try {
                    const player = socket.getUserData().player;
                    if (player === undefined) return;
                    this.onMessage(stream, player);
                } catch (e) {
                    console.warn("Error parsing message:", e);
                }
            },

            close: (socket: WebSocket<PlayerContainer>) => {
                const { player, ip } = socket.getUserData();

                if (Config.protection && ip !== undefined) simultaneousConnections[ip]--;

                if (!player) return;

                Logger.log(`Game ${this.game.port} | "${player.name}" left`);
                this.game.removePlayer(player);
            }
        }).listen(Config.host, this.game.port, (): void => {
            Logger.log(`Game ${this.game.port} | Listening on ${Config.host}:${this.game.port}`);
        });
    }

    private disconnect(socket: WebSocket<PlayerContainer>, reason: string): void {
        try {
            const stream = new PacketStream(new ArrayBuffer(128));
            stream.serializeServerPacket(
                DisconnectPacket.create({
                    reason
                })
            );

            const buffer = stream.getBuffer();
            const sendResult = socket.send(buffer, true, false);
            if (sendResult !== 1) {
                console.warn(`Failed to send disconnect packet. Reason: ${reason}, Send result: ${sendResult}`);
            }
            socket.end(1000, reason);
        } catch (e) {
            console.warn(`Error during disconnect. Reason: ${reason}, Details:`, e);
        }
    }

    private onMessage(stream: SuroiByteStream, player: Gamer): void {
        const packetStream = new PacketStream(stream);
        while (true) {
            const packet = packetStream.deserializeClientPacket();
            if (packet === undefined) break;
            this.onPacket(packet, player);
        }
    }

    private sendChatMessage(player: Player, isSendAll: boolean, message: string): void {
        if (isSendAll && player.loadout.badge) {
            this.game.packets.push(
                ServerChatPacket.create({
                    messageColor: 0xffffff,
                    message
                } as ServerChatPacketData)
            );
        } else if (this.game.teamMode && !isSendAll && player.team) {
            player.team.sendTeamMessage(message);
        }
    }

    private onPacket(packet: OutputPacket, player: Gamer): void {
        switch (true) {
            case packet instanceof JoinPacket:
                this.game.activatePlayer(player, packet.output);
                break;
            case packet instanceof PlayerInputPacket:
                // Ignore input packets from players that haven't finished joining, dead players, and if the game is over
                if (!player.joined || player.dead || player.game.over) return;
                player.processInputs(packet.output);
                break;
            case packet instanceof SpectatePacket:
                player.spectate(packet.output);
                break;
            case packet instanceof PingPacket: {
                if (Date.now() - player.lastPingTime < 4000) return;
                player.lastPingTime = Date.now();
                const stream = new PacketStream(new ArrayBuffer(8));
                stream.serializeServerPacket(PingPacket.create());
                player.sendData(stream.getBuffer());
                break;
            }
            case packet instanceof ClientChatPacket: {
                this.sendChatMessage(player, packet.output.isSendAll, packet.output.message);
                break;
            }
        }
    }
}
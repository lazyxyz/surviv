import { Game } from "../game";
import { getIP } from "../utils/serverHelpers";
import { Gamer, PlayerContainer } from "../objects/gamer";
import { TemplatedApp, type WebSocket } from "uWebSockets.js";
import { ModeToNumber } from "@common/definitions/modes";
import { DisconnectPacket } from "@common/packets/disconnectPacket";
import { JoinPacket } from "@common/packets/joinPacket";
import { PacketStream } from "@common/packets/packetStream";
import { SuroiByteStream } from "@common/utils/suroiByteStream";
import { Config } from "../config";
import { Logger } from "../utils/misc";
import { PlayerInputPacket } from "@common/packets/inputPacket";
import { OutputPacket } from "@common/packets/packet";
import { PingPacket } from "@common/packets/pingPacket";
import { SpectatePacket } from "@common/packets/spectatePacket";
import { Player } from "../objects/player";
import { ConnectPacket } from "@common/packets/connectPacket";



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
                console.log("Player IP: ", ip);

                // Extract token from Authorization header
                const searchParams = new URLSearchParams(req.getQuery());

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
                        ip,
                        nameColor,
                        lobbyClearing: searchParams.get("lobbyClearing") === "true",
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

                    if ((data.player = this.game.addPlayer(socket)) === undefined) {
                        this.disconnect(socket, `Authentication failed. Please reconnect your wallet.`);
                        return;
                    }

                    const stream = new PacketStream(new ArrayBuffer(32));
                    stream.serializeServerPacket(
                        ConnectPacket.create({
                            gameMode: ModeToNumber[this.game.gameMap],
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
        }
    }
}
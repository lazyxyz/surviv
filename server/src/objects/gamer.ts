import { type WebSocket } from "uWebSockets.js";
import { Layer, SpectateActions } from "@common/constants";
import { Vector } from "@common/utils/vector";
import { Game } from "../game";
import { Team } from "../team";
import { Player, ActorContainer } from "./player";

import { PacketStream } from "@common/packets/packetStream";
import { SuroiByteStream } from "@common/utils/suroiByteStream";
import { DisconnectPacket } from "@common/packets/disconnectPacket";
import { type SpectatePacketData } from "@common/packets/spectatePacket";
import { ReportPacket } from "@common/packets/reportPacket";
import { Geometry, Numeric } from "@common/utils/math";
import { pickRandomInArray } from "@common/utils/random";
import { randomBytes } from "crypto";
import { Config } from "../config";

export interface PlayerContainer {
    readonly teamID?: string
    readonly autoFill: boolean
    player?: Gamer
    readonly address?: string
    readonly token?: string
    readonly ip: string | undefined

    readonly nameColor?: number
    readonly lobbyClearing: boolean
    readonly weaponPreset: string
    readonly skin: string
    readonly badge: string
    readonly emotes: string
    readonly melee: string
    readonly gun: string
}

export class Gamer extends Player {
    private readonly _packetStream = new PacketStream(new SuroiByteStream(new ArrayBuffer(1 << 16)));

    readonly socket: WebSocket<PlayerContainer>;

    constructor(game: Game, socket: WebSocket<PlayerContainer>, position: Vector, layer?: Layer, team?: Team) {
        const userData = socket.getUserData();
        const actorData: ActorContainer = {
            teamID: userData.teamID,
            autoFill: userData.autoFill,
            ip: userData.ip,
            nameColor: userData.nameColor,
            lobbyClearing: userData.lobbyClearing,
            weaponPreset: userData.weaponPreset,
        };
        super(game, actorData, position, layer, team);

        this.socket = socket;
    }

    sendData(buffer: ArrayBuffer): void {
        try {
            this.socket.send(buffer, true, false);
        } catch (e) {
            console.warn("Error sending packet. Details:", e);
        }
    }

    secondUpdate(): void {
        super.secondUpdate();

        this._packetStream.stream.index = 0;
        for (const packet of this._packets) {
            this._packetStream.serializeServerPacket(packet);
        }

        for (const packet of this.game.packets) {
            this._packetStream.serializeServerPacket(packet);
        }

        this._packets.length = 0;

        this.sendData(this._packetStream.getBuffer());
    }

    disconnect(reason: string): void {
        const stream = new PacketStream(new ArrayBuffer(128));
        stream.serializeServerPacket(
            DisconnectPacket.create({
                reason
            })
        );
        this.sendData(stream.getBuffer());

        super.disconnect();
    }

    spectate(packet: SpectatePacketData): void {
        if (!this.dead) return;
        const game = this.game;
        if (game.now - this.lastSpectateActionTime < 200) return;
        this.lastSpectateActionTime = game.now;

        let toSpectate: Player | undefined;

        const { spectatablePlayers } = game;
        switch (packet.spectateAction) {
            case SpectateActions.BeginSpectating: {
                if (this.game.teamMode && this._team?.hasLivingPlayers()) {
                    // Find closest teammate
                    toSpectate = this._team.getLivingPlayers()
                        .reduce((a, b) => Geometry.distanceSquared(a.position, this.position) < Geometry.distanceSquared(b.position, this.position) ? a : b);
                } else if (this.killedBy !== undefined && !this.killedBy.dead) {
                    toSpectate = this.killedBy;
                } else if (spectatablePlayers.length > 1) {
                    toSpectate = pickRandomInArray(spectatablePlayers);
                }
                break;
            }
            case SpectateActions.SpectatePrevious:
                if (this.spectating !== undefined) {
                    toSpectate = spectatablePlayers[
                        Numeric.absMod(spectatablePlayers.indexOf(this.spectating) - 1, spectatablePlayers.length)
                    ];
                }
                break;
            case SpectateActions.SpectateNext:
                if (this.spectating !== undefined) {
                    toSpectate = spectatablePlayers[
                        Numeric.absMod(spectatablePlayers.indexOf(this.spectating) + 1, spectatablePlayers.length)
                    ];
                }
                break;
            case SpectateActions.SpectateSpecific: {
                toSpectate = spectatablePlayers.find(player => player.id === packet.playerID);
                break;
            }
            case SpectateActions.SpectateKillLeader: {
                toSpectate = game.killLeader;
                break;
            }
            case SpectateActions.Report: {
                const reportID = randomBytes(4).toString("hex");
                // SERVER HOSTERS assign your custom server an ID somewhere then pass it into the report body region: region
                const reportJson = {
                    id: reportID,
                    reporterName: this.name,
                    suspectName: this.spectating?.name,
                    suspectIP: this.spectating?.ip,
                    reporterIP: this.ip
                };

                this.sendPacket(ReportPacket.create({
                    playerName: this.spectating?.name ?? "",
                    reportID: reportID
                }));
                if (Config.protection) {
                    const reportURL = String(Config.protection?.ipChecker?.logURL);
                    const reportData = {
                        embeds: [
                            {
                                title: "Report Received",
                                description: `Report ID: \`${reportID}\``,
                                color: 16711680,
                                fields: [
                                    {
                                        name: "Username",
                                        value: `\`${this.spectating?.name}\``
                                    },
                                    {
                                        name: "Time reported",
                                        value: this.game.now
                                    },
                                    {
                                        name: "Reporter",
                                        value: this.name
                                    }

                                ]
                            }
                        ]
                    };

                    // Send report to Discord
                    fetch(reportURL, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(reportData)
                    }).catch(error => {
                        console.error("Error: ", error);
                    });

                    // Post the report to the server
                    fetch(`${Config.protection?.punishments?.url}/reports`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "api-key": Config?.protection?.punishments?.password || "" },
                        body: JSON.stringify(reportJson)
                    }).then(response => response.json())
                        .then(console.log)
                        .catch((e: unknown) => console.error(e));
                }
            }
        }

        if (toSpectate === undefined) return;

        this.spectating?.spectators.delete(this);
        this.updateObjects = true;
        this.startedSpectating = true;
        this.spectating = toSpectate;
        toSpectate.spectators.add(this);
    }
}

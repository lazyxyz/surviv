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
import { Geometry, Numeric } from "@common/utils/math";
import { pickRandomInArray } from "@common/utils/random";
import { Config } from "../config";
import { RewardsData, RewardsPacket } from "@common/packets/rewardsPacket";
import { saveGameResult } from "../api/api";
import { GameOverData, GameOverPacket } from "@common/packets/gameOverPacket";
import { DamageParams } from "./gameObject";

export interface PlayerContainer {
    readonly name: string
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
    gameOver: boolean = false;

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

    die(params: Omit<DamageParams, "amount">): void {
        super.die(params);

        // Send game over to dead player
        if (!this.disconnected && !this.gameOver) {
            this.handleGameOver();
        }
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
            case SpectateActions.SpectatePrevious: {
                if (this.spectating !== undefined) {
                    let availablePlayers = spectatablePlayers;
                    if (this.game.teamMode && this._team?.hasLivingPlayers()) {
                        // Filter to only living teammates who are spectatable
                        availablePlayers = this._team.players.filter(
                            player => this.game.livingPlayers.has(player) && spectatablePlayers.includes(player)
                        );
                    }
                    if (availablePlayers.length > 0) {
                        const currentIndex = availablePlayers.indexOf(this.spectating);
                        toSpectate = availablePlayers[
                            Numeric.absMod(currentIndex - 1, availablePlayers.length)
                        ];
                    }
                }
                break;
            }
            case SpectateActions.SpectateNext: {
                if (this.spectating !== undefined) {
                    let availablePlayers = spectatablePlayers;
                    if (this.game.teamMode && this._team?.hasLivingPlayers()) {
                        // Filter to only living teammates who are spectatable
                        availablePlayers = this._team.players.filter(
                            player => this.game.livingPlayers.has(player) && spectatablePlayers.includes(player)
                        );
                    }
                    if (availablePlayers.length > 0) {
                        const currentIndex = availablePlayers.indexOf(this.spectating);
                        toSpectate = availablePlayers[
                            Numeric.absMod(currentIndex + 1, availablePlayers.length)
                        ];
                    }
                }
                break;
            }
            case SpectateActions.SpectateSpecific: {
                toSpectate = spectatablePlayers.find(player => player.id === packet.playerID);
                break;
            }
            case SpectateActions.SpectateKillLeader: {
                toSpectate = game.killLeader;
                break;
            }
        }

        if (toSpectate === undefined) return;

        this.spectating?.spectators.delete(this);
        this.updateObjects = true;
        this.startedSpectating = true;
        this.spectating = toSpectate;
        toSpectate.spectators.add(this);
    }

    handleGameOver(won = false): void {
        if (!this.address || this.gameOver) return; // Skip bot and recall
        this.gameOver = true;

        // Calculate rank
        let rank: number | undefined;
        if (this.game.teamMode && this.team) {
            if (won) {
                rank = 1; // Winning team gets rank 1
            } else {
                // Check if all teammates are dead
                const teammates = this.team.players;
                const teamIsDead = teammates.every(player => !this.game.livingPlayers.has(player));
                if (teamIsDead) {
                    // Count unique teams still alive
                    const uniqueTeams = new Set(
                        [...this.game.livingPlayers].map(p => p.teamID).filter(id => id !== undefined)
                    ).size;
                    rank = uniqueTeams + 1; // Rank is number of teams still alive + 1
                }
            }
        } else {
            rank = won ? 1 : this.game.aliveCount + 1; // Solo mode logic
        }

        // If no rank, exit early
        if (!rank) {
            this.spectate({ spectateAction: SpectateActions.BeginSpectating });
            return
        };

        // Send game over packets
        if (this.game.teamMode && this.team) {
            for (const teammate of this.team.players) {
                if (teammate instanceof Gamer) teammate.sendGameOverPacket(rank);
            }
        } else {
            this.sendGameOverPacket(rank);
        }

        // Handle rewards if rank qualifies
        if (rank < Config.assetsConfig.rank) {
            if (this.game.teamMode && this.team) {
                for (const teammate of this.team.players) {
                    if (teammate instanceof Gamer) teammate.sendRewardsPacket(rank);
                }
            } else {
                this.sendRewardsPacket(rank);
            }
        }
    }

    isGameOverSend = false; // Prevent resent
    sendGameOverPacket(rank: number): void {
        if (this.isGameOverSend) return;
        this.isGameOverSend = true;

        const gameOverPacket = GameOverPacket.create({
            won: rank == 1,
            playerID: this.id,
            kills: this.kills,
            damageDone: this.damageDone,
            damageTaken: this.damageTaken,
            timeAlive: (this.game.now - this.joinTime) / 1000,
            rank,
        } as unknown as GameOverData);

        this.sendPacket(gameOverPacket);
    }

    isRewardsSend = false; // Prevent resent
    async sendRewardsPacket(rank: number): Promise<void> {
        if (this.isRewardsSend) {
            return;
        }
        this.isRewardsSend = true;

        const processRewardsPacket = (eligible: boolean, rewards: number) => {
            this.sendPacket(RewardsPacket.create({
                eligible,
                rank,
                rewards,
            } as unknown as RewardsData));
        };

        if (!this.loadout.badge) {
            processRewardsPacket(false, 0);
            return;
        }

        try {
            const data = await saveGameResult(
                this.address,
                rank,
                this.kills,
                this.game.teamMode,
                this.game.gameId
            );
            processRewardsPacket(data.success && data.rewards.success, data.rewards.amount || 0);
        } catch (err) {
            console.log("Error claiming rewards:", err);
            processRewardsPacket(false, 0);
        }
    }

}

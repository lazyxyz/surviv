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
import { savePlayerGame, savePlayerRank } from "../api/api";
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

    private calculateRank(won: boolean): number | undefined {
        if (this.game.teamMode && this.team) {
            if (won) return 1;
            const teammates = this.team.players;
            const teamIsDead = teammates.every(player => !this.game.livingPlayers.has(player));
            if (teamIsDead) {
                const uniqueTeams = new Set(
                    [...this.game.livingPlayers]
                        .map(p => p.teamID)
                        .filter(id => id !== undefined)
                ).size;
                return uniqueTeams + 1;
            }
            return undefined;
        }
        return won ? 1 : this.game.aliveCount + 1;
    }

    handleGameOver(won = false): void {
        if (!this.address || this.gameOver) return;
        this.gameOver = true;

        const rank = this.calculateRank(won);
        if (!rank) {
            this.spectate({ spectateAction: SpectateActions.BeginSpectating });
            return;
        }

        const gameOverData = {
            won: rank === 1,
            playerID: this.id,
            kills: this.kills,
            damageDone: this.damageDone,
            damageTaken: this.damageTaken,
            timeAlive: (this.game.now - this.joinTime) / 1000,
            rank,
        } as unknown as GameOverData;

        // Notify players and spectators
        this.notifyPlayers(gameOverData);
        this.notifySpectators(gameOverData);

        // Handle rewards if rank qualifies
        if (rank < Config.earnConfig.rank) {
            this.handleRewards(rank);
        }
    }

    private notifyPlayers(gameOverData: GameOverData): void {
        if (this.game.teamMode && this.team) {
            for (const teammate of this.team.players) {
                if (teammate instanceof Gamer) {
                    teammate.sendGameOverPacket(gameOverData.rank);
                }
            }
        } else {
            this.sendGameOverPacket(gameOverData.rank);
        }
    }

    private notifySpectators(gameOverData: GameOverData): void {
        if (this.spectators.size) {
            for (const spectator of this.spectators) {
                if (spectator instanceof Gamer) {
                    spectator.spectatorSendGameOverPacket(gameOverData);
                }
            }
        }
    }

    isGameOverSend = false;
    sendGameOverPacket(rank: number): void {
        if (this.isGameOverSend) return;
        this.isGameOverSend = true;

        const gameOverPacket = GameOverPacket.create({
            won: rank === 1,
            playerID: this.id,
            kills: this.kills,
            damageDone: this.damageDone,
            timeAlive: (this.game.now - this.joinTime) / 1000,
            rank,
        } as unknown as GameOverData);

        this.sendPacket(gameOverPacket);
        this.saveGame(rank);
    }

    spectatorSendGameOverPacket(data: GameOverData): void {
        const gameOverPacket = GameOverPacket.create(data);
        this.sendPacket(gameOverPacket);
    }

    isRewardsSend = false;
    async handleRewards(rank: number): Promise<void> {
        if (this.isRewardsSend) return;
        this.isRewardsSend = true;

        const processRewardsPacket = (eligible: boolean, rank: number, crates: number, keys: number) => {
            this.sendPacket(RewardsPacket.create({
                eligible,
                rank,
                crates,
                keys,
            } as unknown as RewardsData));
        };

        if (!this.loadout.badge) {
            processRewardsPacket(false, rank, 0, 0);
            return;
        }

        try {
            const data = await savePlayerRank(
                this.address,
                rank,
                this.game.teamMode,
                this.game.gameId,
                3000
            );

            console.log("data: ", data);
            if (data.success && data.rewards.success) {
                const rewards = data.rewards.rewards;
                console.log("rewards: ", rewards);
                if (rewards.crates > 0 || rewards.keys > 0) {
                    processRewardsPacket(true, rank, rewards.crates, rewards.keys);
                }
            }
        } catch (err) {
            console.log("Error claiming rewards:", err);
        }
    }

    async saveGame(rank: number): Promise<void> {
        try {
            const timeAlive = (this.game.now - this.joinTime) / 1000;
            await savePlayerGame(
                this.address,
                rank,
                this.game.teamMode,
                this.game.gameId,
                this.kills,
                timeAlive,
                this.damageDone,
                this.damageTaken,
                3000
            );
        } catch (err) {
            console.log("Error save game:", err);
        }
    }
}
import { Layer, GameConstants, KillfeedMessageType } from "@common/constants";
import { JoinedPacket } from "@common/packets/joinedPacket";
import { PlayerData } from "@common/packets/joinPacket";
import { KillFeedPacketData, KillFeedPacket } from "@common/packets/killFeedPacket";
import { Vec } from "@common/utils/vector";
import { verifyBadges, verifyAllAssets } from "../api/balances";
import { Config } from "../config";
import { Game } from "../game";
import { GunItem } from "../inventory/gunItem";
import { MeleeItem } from "../inventory/meleeItem";
import { PlayerContainer, Gamer } from "../objects/gamer";
import { Player } from "../objects/player";
import { cleanUsername, Logger, removeFrom } from "../utils/misc";
import { type WebSocket } from "uWebSockets.js";
import { validateJWT } from "../api/api";
import { blockchainByNumber, getSurvivAddress } from "@common/blockchain/contracts";
import { chainToConfig } from "@common/blockchain/config";

export class PlayerManager {
    private game: Game;
    private _killLeader: Player | undefined;
    get killLeader(): Player | undefined { return this._killLeader; }

    constructor(game: Game) {
        this.game = game;
    }

    addPlayer(socket: WebSocket<PlayerContainer>): Gamer | undefined {
        if (this.game.pluginManager.emit("player_will_connect")) {
            return undefined;
        }

        let spawnPosition = Vec.create(this.game.map.width / 2, this.game.map.height / 2);
        let spawnLayer: Layer | undefined;

        let team = this.game.spawnManager.getTeam(socket);

        const { pos, layer } = this.game.spawnManager.getSpawnPosition(team);
        if (pos) spawnPosition = pos;
        if (layer) spawnLayer = layer;

        const player = new Gamer(this.game, socket, spawnPosition, spawnLayer, team);
        this.game.connectingPlayers.add(player);
        this.game.pluginManager.emit("player_did_connect", player);
        return player;
    }

    async activatePlayer(player: Gamer, packet: PlayerData) {
        const rejectedBy = this.game.pluginManager.emit("player_will_join", { player, joinPacket: packet });
        if (rejectedBy) {
            player.disconnect(`Connection rejected by server plugin '${rejectedBy.constructor.name}'`);
            return;
        }

        if (packet.protocolVersion !== GameConstants.protocolVersion) {
            player.disconnect(`Invalid game version (expected ${GameConstants.protocolVersion}, was ${packet.protocolVersion})`);
            return;
        }
        player.isMobile = packet.isMobile;
        player.name = cleanUsername(packet.name);
        player.chain = blockchainByNumber[packet.chain];

        if (packet.address) {
            const token = packet.token;
            const rpcURL = chainToConfig[player.chain].rpcUrls[0];

            if (!token) {
                player.disconnect(`Authentication token not found. Please reconnect your wallet.`);
                return;
            }

            const payload = await validateJWT(token);

            if (payload.walletAddress != packet.address?.toLowerCase()) {
                player.disconnect(`Invalid address. Please reconnect your wallet.`);
                return;
            }

            player.address = packet.address;
            if (packet.badge) {
                const badgesAddress = getSurvivAddress(player.chain, "SurvivBadges");
                const badgeResults = await verifyBadges(packet.address, rpcURL, badgesAddress, packet.badge);
                player.loadout.badge = badgeResults.badgeDefinition;
                player.rewardsBoost = badgeResults.totalBoost;
            }

            const assetsAddress = getSurvivAddress(player.chain, "SurvivAssets");
            const assets = await verifyAllAssets(packet.address, rpcURL, assetsAddress, {
                skin: packet.skin,
                melee: packet.melee,
                gun: packet.gun,
                emotes: packet.emotes?.split(",").map(v => v === "" ? undefined : v),
            });

            player.loadout.emotes = assets.emotes;
            if (assets.skin) player.loadout.skin = assets.skin;
            if (assets.melee) player.inventory.weapons[2] = new MeleeItem(assets.melee, player);
            if (assets.gun) player.inventory.weapons[0] = new GunItem(assets.gun, player);
        }

        this.game.livingPlayers.add(player);
        this.game.spectatablePlayers.push(player);
        this.game.connectingPlayers.delete(player);
        this.game.connectedPlayers.add(player);
        this.game.newPlayers.push(player);
        this.game.grid.addObject(player);
        player.setDirty();
        this.game.aliveCountDirty = true;
        this.game.updateObjects = true;
        this.game.updateGameData({ aliveCount: this.game.aliveCount });

        player.joined = true;

        player.sendPacket(
            JoinedPacket.create(
                {
                    maxTeamSize: this.game.gameMode,
                    teamID: player.teamID ?? 0,
                    emotes: player.loadout.emotes,
                    gameId: this.game.gameId,
                }
            )
        );

        this.game.addTimeout(() => { player.disableInvulnerability(); }, 5000);

        player.sendData(this.game.map.buffer);

        this.game.addTimeout(() => { player.disableInvulnerability(); }, 5000);

        // Start the game
        if (
            !this.game._started
            && this.game.startTimeout === undefined
        ) {
            this.game.startTimeout = this.game.addTimeout(() => {
                this.game.addTimeout(this.game.postGameStarted.bind(this.game), Config.gameJoinTime * 1000);
            }, 3000);
        }

        Logger.log(`Game ${this.game.port} | "${player.name}" joined`);
        this.game.pluginManager.emit("player_did_join", { player, joinPacket: packet });
    }

    removePlayer(player: Player): void {
        if (player === this.killLeader) {
            this.killLeaderDisconnected(player);
        }

        player.disconnected = true;
        this.game.aliveCountDirty = true;
        this.game.connectingPlayers.delete(player);
        this.game.connectedPlayers.delete(player);

        if (player.canDespawn) {
            this.game.livingPlayers.delete(player);
            this.game.objectSpawner.removeObject(player);
            this.game.deletedPlayers.push(player.id);
            removeFrom(this.game.spectatablePlayers, player);
            this.game.updateGameData({ aliveCount: this.game.aliveCount });

            if (this.game.teamMode) {
                const team = player.team;
                if (team) {
                    team.removePlayer(player);

                    if (!team.players.length) {
                        this.game.teams.delete(team);
                    }
                }
                player.damageHandler.teamWipe();
                player.beingRevivedBy?.action?.cancel();
            }
        } else {
            player.rotation = 0;
            player.movement.up = player.movement.down = player.movement.left = player.movement.right = false;
            player.attacking = false;
            player.setPartialDirty();

            if (this.game.teamMode && this.game.now - player.joinTime < 10000) {
                player.team?.removePlayer(player);
            }
        }

        if (player.spectating !== undefined) {
            player.spectating.spectators.delete(player);
        }

        if (this.game.aliveCount < 2) {
            this.game.startTimeout?.kill();
            this.game.startTimeout = undefined;
        }

        if (player instanceof Gamer) {
            try {
                player.socket.close();
            } catch (_) {
                // Ignore socket close errors
            }
        }

        this.game.pluginManager.emit("player_disconnect", player);
    }

    updateKillLeader(player: Player): void {
        const oldKillLeader = this._killLeader;

        if (player.kills > (this._killLeader?.kills ?? (GameConstants.player.killLeaderMinKills - 1)) && !player.dead) {
            this._killLeader = player;

            if (oldKillLeader !== this._killLeader) {
                this._sendKillLeaderKFPacket(KillfeedMessageType.KillLeaderAssigned);
            }
        } else if (player === oldKillLeader) {
            this._sendKillLeaderKFPacket(KillfeedMessageType.KillLeaderUpdated);
        }
    }

    killLeaderDead(killer?: Player): void {
        this._sendKillLeaderKFPacket(KillfeedMessageType.KillLeaderDeadOrDisconnected, { attackerId: killer?.id });
        let newKillLeader: Player | undefined;
        for (const player of this.game.livingPlayers) {
            if (player.kills > (newKillLeader?.kills ?? (GameConstants.player.killLeaderMinKills - 1)) && !player.dead) {
                newKillLeader = player;
            }
        }
        this._killLeader = newKillLeader;
        this._sendKillLeaderKFPacket(KillfeedMessageType.KillLeaderAssigned);
    }

    killLeaderDisconnected(leader: Player): void {
        this._sendKillLeaderKFPacket(KillfeedMessageType.KillLeaderDeadOrDisconnected, { disconnected: true });
        let newKillLeader: Player | undefined;
        for (const player of this.game.livingPlayers) {
            if (player === leader) continue;
            if (player.kills > (newKillLeader?.kills ?? (GameConstants.player.killLeaderMinKills - 1)) && !player.dead) {
                newKillLeader = player;
            }
        }

        if ((this._killLeader = newKillLeader) !== undefined) {
            this._sendKillLeaderKFPacket(KillfeedMessageType.KillLeaderAssigned);
        }
    }

    private _sendKillLeaderKFPacket<
        Message extends
        | KillfeedMessageType.KillLeaderAssigned
        | KillfeedMessageType.KillLeaderDeadOrDisconnected
        | KillfeedMessageType.KillLeaderUpdated
    >(
        messageType: Message,
        options?: Partial<Omit<KillFeedPacketData & { readonly messageType: NoInfer<Message> }, "messageType" | "playerID" | "attackerKills">>
    ): void {
        if (this._killLeader === undefined) return;

        this.game.packets.push(
            KillFeedPacket.create({
                messageType,
                victimId: this._killLeader.id,
                attackerKills: this._killLeader.kills,
                ...options
            } as KillFeedPacketData & { readonly messageType: Message })
        );
    }
}
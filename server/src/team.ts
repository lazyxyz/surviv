import { CustomTeamMessages, type CustomTeamMessage } from "@common/typings";
import { random } from "@common/utils/random";
import { type WebSocket } from "uWebSockets.js";
import { findGame } from "./gameManager";
import { type Player } from "./objects/player";
import { CUSTOM_TEAMS } from "./server";
import { removeFrom } from "./utils/misc";
import { TEAMMATE_COLORS, TeamSize } from "@common/constants";
import { ServerChatPacket, ServerChatPacketData } from "@common/packets/chatPacket";

export class Team {
    readonly id: number; // team index in a game

    private readonly _players: Player[] = [];
    get players(): readonly Player[] { return this._players; }

    readonly _indexMapping = new Map<Player, number>();

    kills = 0;

    readonly autoFill: boolean;

    constructor(id: number, autoFill = true) {
        this.id = id;
        this.autoFill = autoFill;
    }

    addPlayer(player: Player): void {
        player.colorIndex = this.getNextAvailableColorIndex();
        this._indexMapping.set(player, this._players.push(player) - 1);
        this.setDirty();
    }

    removePlayer(player: Player): boolean {
        const index = this._indexMapping.get(player);
        const exists = index !== undefined;
        if (exists) {
            this._players.splice(index, 1);
            this._indexMapping.delete(player);

            for (const [player, mapped] of this._indexMapping.entries()) { // refresh mapping
                if (mapped <= index) continue;
                this._indexMapping.set(player, mapped - 1);
                this.reassignColorIndexes();
            }
        }
        return exists;
    }

    setDirty(): void {
        for (const player of this.players) {
            player.dirty.teammates = true;
        }
    }

    // Team color indexes must be checked and updated in order not to have duplicates.
    getNextAvailableColorIndex(): number {
        const existingIndexes = this.players.map(player => player.colorIndex);
        let newIndex = 0;
        while (existingIndexes.includes(newIndex)) {
            newIndex++;
        }
        return newIndex;
    }

    reassignColorIndexes(): void {
        this.players.forEach((player, index) => {
            player.colorIndex = index;
        });
    }

    hasLivingPlayers(): boolean {
        return this.players.some(player => !player.dead && !player.disconnected);
    }

    getLivingPlayers(): Player[] {
        return this.players.filter(player => !player.dead && !player.disconnected);
    }

    sendTeamMessage(colorIndex: number, message: string): void {
        const playerColor = TEAMMATE_COLORS[colorIndex];
        for (const player of this.players) {
            player.sendPacket(
                ServerChatPacket.create({
                    messageColor: playerColor,
                    message: message
                } as ServerChatPacketData)
            );
        }
    }
}

export class CustomTeam {
    private static readonly _idChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static readonly _idCharMax = this._idChars.length - 1;

    readonly id: string;

    readonly players: CustomTeamPlayer[] = [];

    autoFill = false;
    locked = false;

    gameID?: number;
    resetTimeout?: NodeJS.Timeout;

    constructor() {
        this.id = Array.from({ length: 4 }, () => CustomTeam._idChars.charAt(random(0, CustomTeam._idCharMax))).join("");
    }

    addPlayer(player: CustomTeamPlayer): void {
        player.sendMessage({
            type: CustomTeamMessages.Join,
            teamID: this.id,
            isLeader: player.isLeader,
            ready: player.ready,
            autoFill: this.autoFill,
            locked: this.locked
        });

        this._publishPlayerUpdate();
    }

    removePlayer(player: CustomTeamPlayer): void {
        removeFrom(this.players, player);

        if (!this.players.length) {
            clearTimeout(this.resetTimeout);
            CUSTOM_TEAMS.delete(this.id);
            return;
        }

        this._publishPlayerUpdate();
    }

    async onMessage(player: CustomTeamPlayer, message: CustomTeamMessage): Promise<void> {
        switch (message.type) {
            case CustomTeamMessages.Settings: {
                if (!player.isLeader) break; // Only leader can change settings

                if (message.autoFill !== undefined) this.autoFill = message.autoFill;
                if (message.locked !== undefined) this.locked = message.locked;

                this._publishMessage({
                    type: CustomTeamMessages.Settings,
                    autoFill: this.autoFill,
                    locked: this.locked
                });
                break;
            }
            case CustomTeamMessages.Start: {
                if (player.isLeader) {
                    const result = await findGame(TeamSize.Squad);
                    if (result.success) {
                        this.gameID = result.gameID;
                        clearTimeout(this.resetTimeout);
                        this.resetTimeout = setTimeout(() => this.gameID = undefined, 500);

                        for (const player of this.players) {
                            player.ready = false;
                        }

                        this._publishMessage({ type: CustomTeamMessages.Started });
                        this._publishPlayerUpdate();
                    }
                } else {
                    player.ready = !player.ready;
                    this._publishPlayerUpdate();
                }
                break;
            }
        }
    }

    private _publishPlayerUpdate(): void {
        const players = this.players.map(p => ({
            isLeader: p.isLeader,
            ready: p.ready,
            name: p.name,
            skin: p.skin,
            badge: p.badge,
            nameColor: p.nameColor
        }));

        for (const player of this.players) {
            player.sendMessage({
                type: CustomTeamMessages.Update,
                players,
                isLeader: player.isLeader,
                ready: player.ready,
            });
        }
    }

    private _publishMessage(message: CustomTeamMessage): void {
        for (const player of this.players) {
            player.sendMessage(message);
        }
    }
}

export class CustomTeamPlayer {
    socket!: WebSocket<CustomTeamPlayerContainer>;
    team: CustomTeam;
    get id(): number { return this.team.players.indexOf(this); }
    get isLeader(): boolean { return this.id === 0; }
    name: string;
    ready: boolean;
    skin: string;
    badge?: string;
    nameColor?: number;

    constructor(
        team: CustomTeam,
        name: string,
        skin: string,
        badge?: string,
        nameColor?: number
    ) {
        this.team = team;
        team.players.push(this);
        this.name = name;
        this.ready = false;
        this.skin = skin;
        this.badge = badge;
        this.nameColor = nameColor;
    }

    sendMessage(message: CustomTeamMessage): void {
        this.socket.send(JSON.stringify(message));
    }
}

export interface CustomTeamPlayerContainer { player: CustomTeamPlayer }

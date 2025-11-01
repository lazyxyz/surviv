import { type AllowedEmoteSources } from "@common/packets/inputPacket";
import { type PlayerPing } from "@common/definitions/mapPings";
import { Emote } from "../emote";
import { type Vector } from "@common/utils/vector";
import { GameConstants } from "@common/constants";
import { type Player } from "../player";  // Adjust import to main Player
import { ItemType } from "@common/utils/objectDefinitions";

export class CommunicationHandler {
    constructor(private player: Player) {}

    rateLimitCheck(): boolean {
        if (this.player.blockEmoting) return false;

        this.player.emoteCount++;

        if (this.player.emoteCount > GameConstants.player.rateLimitPunishmentTrigger) {
            this.player.blockEmoting = true;
            this.player.setDirty();
            this.player.game.addTimeout(() => {
                this.player.blockEmoting = false;
                this.player.setDirty();
                this.player.emoteCount = 0;
            }, GameConstants.player.emotePunishmentTime);
            return false;
        }

        return true;
    }

    sendEmote(source?: AllowedEmoteSources): void {
        if (!this.rateLimitCheck()) return;

        if (
            source !== undefined
            && !this.player.game.pluginManager.emit("player_will_emote", {
                player: this.player,
                emote: source
            })
        ) {
            if (
                ("itemType" in source)
                && (source.itemType === ItemType.Ammo || source.itemType === ItemType.Healing)
                && !this.player.game.teamMode
            ) return;

            this.player.game.emotes.push(new Emote(source, this.player));

            this.player.game.pluginManager.emit("player_did_emote", {
                player: this.player,
                emote: source
            });
        }
    }

    sendMapPing(ping: PlayerPing, position: Vector): void {
        if (!this.rateLimitCheck()) return;

        if (
            this.player.game.pluginManager.emit("player_will_map_ping", {
                player: this.player,
                ping,
                position
            })
        ) return;

        if (this.player._team) {
            for (const player of this.player._team.players) {
                if (!player) continue;

                player._mapPings.push({
                    definition: ping,
                    position,
                    playerId: this.player.id
                });
            }

            return;
        }

        this.player._mapPings.push({
            definition: ping,
            position,
            playerId: this.player.id
        });

        this.player.game.pluginManager.emit("player_did_map_ping", {
            player: this.player,
            ping,
            position
        });
    }
}
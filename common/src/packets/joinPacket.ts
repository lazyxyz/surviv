import { GameConstants } from "../constants";
import { BadgeDefinition, Badges } from "../definitions/badges";
import { EmoteDefinition, Emotes } from "../definitions/emotes";
import { Loots } from "../definitions/loots";
import { MeleeDefinition, Melees } from "../definitions/melees";
import { GunDefinition, Guns } from "../definitions/guns";
import { SkinDefinition, Skins } from "../definitions/skins";
import { createPacket } from "./packet";

export type PlayerData = {
    readonly protocolVersion: number
    readonly name: string
    readonly address: string
    readonly isMobile: boolean
    readonly emotes: ReadonlyArray<EmoteDefinition | undefined>

    readonly skin?: SkinDefinition
    readonly badge?: BadgeDefinition

    readonly melee?: MeleeDefinition
    readonly gun?: GunDefinition
} & {
    readonly gameMode: number
} & {
    readonly rainDrops: number, // num
};

// protocol version is automatically set; use this type when
// creating an object for use by a ReadyPacket
export type JoinPacketCreation = Omit<PlayerData, "protocolVersion">;

export const JoinPacket = createPacket("JoinPacket")<JoinPacketCreation, PlayerData>({
    serialize(stream, data) {
        const emotes = data.emotes;
        const hasSkin = data.skin !== undefined;
        const hasBadge = data.badge !== undefined;
        const hasMelee = data.melee !== undefined;
        const hasGun = data.gun !== undefined;

        stream.writeBooleanGroup(
            data.isMobile,
            hasSkin,
            hasBadge,
            hasMelee,
            hasGun,
        );
        stream.writeBooleanGroup(
            emotes[0] !== undefined,
            emotes[1] !== undefined,
            emotes[2] !== undefined,
            emotes[3] !== undefined,
            emotes[4] !== undefined,
            emotes[5] !== undefined
        );

        stream.writeUint16(GameConstants.protocolVersion);
        stream.writePlayerName(data.name);
        stream.writePlayerAddress(data.address);

        if (hasSkin) {
            Loots.writeToStream(stream, data.skin);
        }

        if (hasBadge) {
            Badges.writeToStream(stream, data.badge);
        }

        for (let i = 0; i < 6; i++) {
            const emote = emotes[i];
            if (emote !== undefined) {
                Emotes.writeToStream(stream, emote);
            }
        }

        if (hasMelee) {
            Melees.writeToStream(stream, data.melee);
        }

        if (hasGun) {
            Guns.writeToStream(stream, data.gun);
        }
        stream.writeInt8(data.gameMode);

        stream.writeUint16(data.rainDrops);
    },

    deserialize(stream) {
        const [
            isMobile,
            hasSkin,
            hasBadge,
            hasMelee,
            hasGun
        ] = stream.readBooleanGroup();

        const [
            ...emotes
        ] = stream.readBooleanGroup();

        return {
            protocolVersion: stream.readUint16(),
            name: stream.readPlayerName().replaceAll(/<[^>]+>/g, "").trim(), // Regex strips out HTML
            address: stream.readPlayerAddress().replaceAll(/<[^>]+>/g, "").trim(), // Regex strips out HTML
            isMobile,

            skin: hasSkin ? Skins.readFromStream(stream) : undefined,
            badge: hasBadge ? Badges.readFromStream(stream) : undefined,

            emotes: Array.from({ length: 6 }, (_, i) => emotes[i] ? Emotes.readFromStream(stream) : undefined),
            melee: hasMelee ? Melees.readFromStream(stream) : undefined,
            gun: hasGun ? Guns.readFromStream(stream) : undefined,
            gameMode: stream.readInt8(),
            rainDrops: stream.readUint16(),
        };
    }
});

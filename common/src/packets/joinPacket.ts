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

    readonly isMobile: boolean
    readonly address?: string
    readonly token?: string
    readonly chain: number
} & {
    readonly emotes?: string
    readonly skin?: string
    readonly badge?: string

    readonly melee?: string
    readonly gun?: string
}

// protocol version is automatically set; use this type when
// creating an object for use by a ReadyPacket
export type JoinPacketCreation = Omit<PlayerData, "protocolVersion">;

export const JoinPacket = createPacket("JoinPacket")<JoinPacketCreation, PlayerData>({
    serialize(stream, data) {
        const hasAddress = data.address !== undefined;
        const hasToken = data.token !== undefined;
        const hasEmotes = data.emotes !== undefined;
        const hasSkin = data.skin !== undefined;
        const hasBadge = data.badge !== undefined;
        const hasMelee = data.melee !== undefined;
        const hasGun = data.gun !== undefined;

        stream.writeBooleanGroup(
            data.isMobile,
            hasAddress,
            hasToken,
            hasEmotes,
            hasSkin,
            hasBadge,
            hasMelee,
            hasGun,
        );

        stream.writeUint16(GameConstants.protocolVersion);
        stream.writePlayerName(data.name);

        if (hasAddress) stream.writePlayerAddress(data.address);
        if (hasToken) stream.writeToken(data.token);
        stream.writeUint8(data.chain);

        if (hasEmotes) stream.writeEmoteIds(data.emotes);
        if (hasSkin) stream.writeLootStringId(data.skin);
        if (hasBadge) stream.writeLootStringId(data.badge);
        if (hasMelee) stream.writeLootStringId(data.melee);
        if (hasGun) stream.writeLootStringId(data.gun);

    },

    deserialize(stream) {
        const [
            isMobile,
            hasAddress,
            hasToken,
            hasEmotes,
            hasSkin,
            hasBadge,
            hasMelee,
            hasGun,
        ] = stream.readBooleanGroup();


        return {
            protocolVersion: stream.readUint16(),
            name: stream.readPlayerName().replaceAll(/<[^>]+>/g, "").trim(), // Regex strips out HTML
            isMobile,
            address: hasAddress ? stream.readPlayerAddress().replaceAll(/<[^>]+>/g, "").trim() : undefined, // Regex strips out HTML
            token: hasToken ? stream.readToken() : undefined,
            chain: stream.readUint8(),

            emotes: hasEmotes ? stream.readEmoteIds() : undefined,
            skin: hasSkin ? stream.readLootStringId() : undefined,
            badge: hasBadge ? stream.readLootStringId() : undefined,
            melee: hasMelee ? stream.readLootStringId() : undefined,
            gun: hasGun ? stream.readLootStringId() : undefined,
        };
    }
});

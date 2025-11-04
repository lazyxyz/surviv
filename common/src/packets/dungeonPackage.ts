import { createPacket } from "./packet";

export type DungeonPacketData = {
    readonly waves: number
};

export const DungeonPacket = createPacket("DungeonPacket")<DungeonPacketData>({
    serialize(stream, data) {
        stream.writeUint8(data.waves);
    },

    deserialize(stream) {
        return {
            waves: stream.readInt8()
        };
    }
});

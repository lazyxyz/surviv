import { createPacket } from "./packet";

export type ResurrectPacketData = {
    readonly time: number
};

export const ResurrectPacket = createPacket("ResurrectPacket")<ResurrectPacketData>({
    serialize(stream, data) {
        stream.writeUint8(data.time);
    },

    deserialize(stream) {
        return {
            time: stream.readInt8()
        };
    }
});

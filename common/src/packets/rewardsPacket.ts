import { createPacket } from "./packet";

export type RewardsData = ({
    readonly eligible: false
    readonly rank: 0,
    readonly crates: 0,
    readonly keys: 0,
} | {
    readonly eligible: boolean
    readonly rank: number
    readonly crates: number
    readonly keys: number
});

export const RewardsPacket = createPacket("RewardsPacket")<RewardsData>({
    serialize(strm, data) {
        strm.writeBooleanGroup(data.eligible)
            .writeUint8(data.rank)
            .writeInt8(data.crates)
            .writeInt8(data.keys);
    },

    deserialize(stream) {
        const [eligible] = stream.readBooleanGroup(); // get first boolean

        return {
            eligible: eligible,
            rank: stream.readUint8(),
            crates: stream.readInt8(),
            keys: stream.readInt8(),
        } as RewardsData;
    }
});

import { createPacket } from "./packet";

export type RewardsData = ({
    readonly eligible: false
    readonly rank: 0,
    readonly rewards: 0,
} | {
    readonly eligible: boolean
    readonly rank: number
    readonly rewards: number
});

export const RewardsPacket = createPacket("RewardsPacket")<RewardsData>({
    serialize(strm, data) {
        strm.writeBooleanGroup(data.eligible)
            .writeUint8(data.rank)
            .writeInt8(data.rewards);
    },

    deserialize(stream) {
        const [eligible] = stream.readBooleanGroup(); // get first boolean

        return {
            eligible,
            rank: stream.readUint8(),
            rewards: stream.readInt8(),
        } as RewardsData;
    }
});

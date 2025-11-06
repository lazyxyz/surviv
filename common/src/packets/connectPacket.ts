import { createPacket } from "./packet";

export type ConnectData = {
    readonly gameMode: number,
    readonly rainDrops: number
};

// protocol version is automatically set; use this type when
// creating an object for use by a ReadyPacket
export type ConnectPacketCreation = Omit<ConnectData, "protocolVersion">;

export const ConnectPacket = createPacket("ConnectPacket")<ConnectPacketCreation, ConnectData>({
    serialize(stream, data) {
         stream.writeInt8(data.gameMode);

        stream.writeUint16(data.rainDrops);
    },

    deserialize(stream) {
        return {
            gameMode: stream.readInt8(),
            rainDrops: stream.readUint16(),
        };
    }
});

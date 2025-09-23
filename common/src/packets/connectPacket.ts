import { createPacket } from "./packet";

export type ConnectData = {
    readonly url: string
};

// protocol version is automatically set; use this type when
// creating an object for use by a ReadyPacket
export type ConnectPacketCreation = Omit<ConnectData, "protocolVersion">;

export const ConnectPacket = createPacket("ConnectPacket")<ConnectPacketCreation, ConnectData>({
    serialize(stream, data) {
        stream.writePlayerName(data.url);
    },

    deserialize(stream) {
        return {
            url: stream.readURL().replaceAll(/<[^>]+>/g, "").trim(),
        };
    }
});

import { createPacket } from "./packet";

export type ChatPacketData =
    {
        readonly name: string,
        readonly message: string,
    };

export const ChatPacket = createPacket("ChatPacket")<ChatPacketData>({
    serialize(stream, data) {
        stream.writePlayerName(data.name);
        stream.writeChatMessage(data.message);
    },
    deserialize(stream) {
        return {
            name: stream.readPlayerName().replaceAll(/<[^>]+>/g, "").trim(),
            message: stream.readChatMessage().replaceAll(/<[^>]+>/g, "").trim(),
        };
    }
});

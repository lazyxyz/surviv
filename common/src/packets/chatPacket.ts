import { createPacket } from "./packet";

export type ChatPacketData =
    {
        readonly message: string,
    };

export const ChatPacket = createPacket("ChatPacket")<ChatPacketData>({
    serialize(stream, data) {
        stream.writeChatMessage(data.message);
    },
    deserialize(stream) {
        return {
            message: stream.readChatMessage().replaceAll(/<[^>]+>/g, "").trim(),
        };
    }
});

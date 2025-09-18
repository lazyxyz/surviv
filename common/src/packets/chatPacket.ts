import { createPacket } from "./packet";

export type ChatPacketData =
    {
        readonly isSendAll: boolean,
        readonly message: string,
    };

export const ChatPacket = createPacket("ChatPacket")<ChatPacketData>({
    serialize(stream, data) {
        stream.writeBooleanGroup(
            data.isSendAll,
        );
        stream.writeChatMessage(data.message);
    },
    deserialize(stream) {
        const [
            isSendAll,
        ] = stream.readBooleanGroup();
        return {
            isSendAll,
            message: stream.readChatMessage().replaceAll(/<[^>]+>/g, "").trim(),
        };
    }
});

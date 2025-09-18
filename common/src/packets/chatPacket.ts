import { createPacket } from "./packet";

export type ClientChatPacketData =
    {
        readonly isSendAll: boolean,
        readonly message: string,
    };

export const ClientChatPacket = createPacket("ClientChatPacket")<ClientChatPacketData>({
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

export type ServerChatPacketData =  {
    readonly message: string;
    readonly messageColor: number;
};

export const ServerChatPacket = createPacket("ServerChatPacket")<ServerChatPacketData>({
    serialize(stream, data) {
        stream.writeUint24(data.messageColor);
        stream.writeChatMessage(data.message);
    },
    deserialize(stream) {
        return {
            messageColor: stream.readUint24(),
            message: stream.readChatMessage().replaceAll(/<[^>]+>/g, "").trim(),
        };
    }
});

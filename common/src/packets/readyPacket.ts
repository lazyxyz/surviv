import { createPacket } from "./packet";

export const ReadyPacket = createPacket("PingPacket")<void>({
    serialize(_stream) { /* no-op */ },
    deserialize(_stream) { /* no-op */ }
});

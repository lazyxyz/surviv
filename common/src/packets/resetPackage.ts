import { createPacket } from "./packet";


export const ResetPacket = createPacket("ResetPackage")<void>({
    serialize(_stream) { /* no-op */ },
    deserialize(_stream) { /* no-op */ }
});

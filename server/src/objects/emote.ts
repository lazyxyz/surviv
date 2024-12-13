import type { AllowedEmoteSources } from "@common/packets/inputPacket";
import { Actor } from "./actor";

export class Emote {
    readonly playerID: number;

    constructor(
        readonly definition: AllowedEmoteSources,
        readonly player: Actor
    ) {
        this.playerID = player.id;
    }
}

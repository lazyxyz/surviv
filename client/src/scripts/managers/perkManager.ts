import type { PerkDefinition } from "@common/definitions/perks";
<<<<<<< HEAD
import { PerkManager, type PerkCollection } from "@common/utils/perkManager";
=======
import type { PerkCollection } from "@common/packets/updatePacket";
import { PerkManager } from "@common/utils/perkManager";
>>>>>>> grindy/main
import type { Game } from "../game";

export class ClientPerkManager extends PerkManager {
    constructor(readonly game: Game, perks?: number | readonly PerkDefinition[]) {
        super(perks);
    }

    overwrite(perks: PerkCollection): void {
<<<<<<< HEAD
        this._items = perks.asBitfield();
=======
        this._perks = perks.asBitfield();
>>>>>>> grindy/main
    }
}

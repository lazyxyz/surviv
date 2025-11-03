import { ObjectCategory } from "@common/constants";
import { type SyncedParticleDefinition } from "@common/definitions/syncedParticles";
import { getEffectiveZIndex } from "@common/utils/layer";
import { Numeric } from "@common/utils/math";
import { type ObjectsNetData } from "@common/utils/objectsSerializations";
import { type Game } from "../game";
import { DIFF_LAYER_HITBOX_OPACITY, HITBOX_COLORS, HITBOX_DEBUG_MODE } from "../utils/constants";
import { drawHitbox, SuroiSprite, toPixiCoords } from "../utils/pixi";
import { GameObject } from "./gameObject";
import { GAME_CONSOLE } from "../..";
import type { VehicleDefinition } from "@common/definitions/vehicle";
import { Vec } from "@common/utils/vector";

export class Vehicle extends GameObject.derive(ObjectCategory.Vehicle) {
    readonly image: SuroiSprite;

    private _definition!: VehicleDefinition;
    get definition(): VehicleDefinition { return this._definition; }

    constructor(game: Game, id: number, data: ObjectsNetData[ObjectCategory.Vehicle]) {
        super(game, id);
        this.image = new SuroiSprite();
        this.image.anchor.set(0.5, 0.5);
        this.container.addChild(this.image);
        this.updateFromData(data, true);
        game.camera.addObject(this.container);
    }

    override updateFromData(data: ObjectsNetData[ObjectCategory.Vehicle], isNew = false): void {
        const full = data.full;
        let texture;
        if (full) {
            const { definition } = full;

            this._definition = definition;
            this.layer = data.layer;

            this.updateZIndex();
            texture = !this.dead ? definition.idString : `${definition.idString}_residue`;
        }

        if (texture) this.image.setFrame(texture);

        this.position = data.position;
        this.rotation = data.rotation;

        this.image.rotation = this.rotation;
        this.image.setPos(this.position.x, this.position.y);
    }

    update(): void {
        // Optional: If vehicles need per-tick updates (e.g., animation), add here.
    }

    override updateZIndex(): void {
        // this.image.zIndex = getEffectiveZIndex(this.definition.zIndex, this.layer, this.game.layer);
    }

    override destroy(): void {
        super.destroy();
        this.image.destroy();
    }
}
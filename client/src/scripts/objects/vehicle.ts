import { GameConstants, Layer, Layers, ObjectCategory, ZIndexes } from "@common/constants";
import { type VehicleDefinition } from "@common/definitions/vehicle";
import { getEffectiveZIndex, adjacentOrEqualLayer } from "@common/utils/layer";
import { FloorNames, FloorTypes } from "@common/utils/terrain";  // Import for floorType
import { type ObjectsNetData } from "@common/utils/objectsSerializations";
import { type Game } from "../game";
import { SuroiSprite, toPixiCoords } from "../utils/pixi";
import { GameObject } from "./gameObject";

export class Vehicle extends GameObject.derive(ObjectCategory.Vehicle) {
    definition!: VehicleDefinition;

    readonly image: SuroiSprite;

    floorType: FloorNames = FloorNames.Grass;  // Add: Like Player/Obstacle

    constructor(game: Game, id: number, data: ObjectsNetData[ObjectCategory.Vehicle]) {
        super(game, id);

        this.image = new SuroiSprite();
        this.container.addChild(this.image);

        this.layer = data.layer;

        this.updateFromData(data);
    }

    override updateFromData(data: ObjectsNetData[ObjectCategory.Vehicle]): void {
        // Compute floorType like Player/Obstacle (fixes doOverlay)
        const floorType = this.game.map.terrain.getFloor(this.position, this.layer, this.game.gameMap);
        this.floorType = floorType;  // Cache for doOverlay/zIndex

        this.position = data.position;
        this.rotation = data.rotation;
        this.layer = data.layer;

        // Handle definition (from full on spawn/update)
        if (data.full?.definition) {
            this.definition = data.full.definition;
        }

        // Set image frame from definition.image (e.g., "vehicles/buggy")
        if (this.definition) {
            this.image.setFrame(this.definition.image);
            this.container.scale.set(this.definition.scale);  // Resize
        }

        // Position/rotate
        this.container.position.copyFrom(toPixiCoords(this.position));
        this.container.rotation = this.rotation;

        // Visibility: Like Obstacle—hide only on layer mismatch (prevents close-range overwrite)
        this.container.visible = true;  // Default visible unless dead/invisible

        this.updateZIndex();
    }

    override updateZIndex(): void {
        // Like Obstacle: Base zIndex with dead/overlay handling
        const baseZIndex = this.definition?.zIndex ?? ZIndexes.Vehicles ?? ZIndexes.ObstaclesLayer1;
        const zIndex = this.dead  // Assuming you add dead later; stub for now
            ? this.doOverlay()  // doOverlay now works via floorType
                ? ZIndexes.UnderWaterDeadObstacles
                : ZIndexes.DeadObstacles
            : baseZIndex;

        this.container.zIndex = getEffectiveZIndex(zIndex, this.layer, this.game.layer);
    }

    // Stub dead for future (like Obstacle)
    dead = false;

    override destroy(): void {
        this.image.destroy();
        super.destroy();
    }
}
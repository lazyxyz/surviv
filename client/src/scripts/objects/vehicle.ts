import { GameConstants, Layer, Layers, ObjectCategory, ZIndexes } from "@common/constants";
import { type VehicleDefinition } from "@common/definitions/vehicle";
import { getEffectiveZIndex, adjacentOrEqualLayer } from "@common/utils/layer";
import { FloorNames, FloorTypes } from "@common/utils/terrain";  // Import for floorType
import { type ObjectsNetData } from "@common/utils/objectsSerializations";
import { type Game } from "../game";
import { drawHitbox, SuroiSprite, toPixiCoords } from "../utils/pixi";
import { GameObject } from "./gameObject";
import type { Hitbox } from "@common/utils/hitbox";
import type { Orientation } from "@common/typings";
import { DIFF_LAYER_HITBOX_OPACITY, HITBOX_COLORS, HITBOX_DEBUG_MODE } from "../utils/constants";
import type { Vector } from "@common/utils/vector";

export class Vehicle extends GameObject.derive(ObjectCategory.Vehicle) {
    definition!: VehicleDefinition;

    readonly image: SuroiSprite;

    floorType: FloorNames = FloorNames.Grass;  // Add: Like Player/Obstacle
    hitbox!: Hitbox;
    orientation: Orientation = 0;
    dead = false;

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
            this.hitbox = this.definition.hitbox.transform(this.position, 1, this.orientation);
        }

        const wasDead = this.dead;
        this.dead = wasDead;  // From partial

        let texture: string | undefined;
        texture = !this.dead
            ? this.definition.idString  // Normal: "vehicles/buggy"
            : `${this.definition.idString}_residue`;  // Destroyed: "vehicles/buggy_residue"


        if (texture) {
            this.image.setFrame(texture);
        }

        // if (this.definition) {
        //     this.image.setFrame(this.definition.idString);
        //     this.container.scale.set(this.definition.scale);  // Resize
        // }

        // Position/rotate
        this.container.position.copyFrom(toPixiCoords(this.position));
        this.container.rotation = this.rotation;
        // Visibility: Like Obstacle—hide only on layer mismatch (prevents close-range overwrite)
        this.container.visible = true;  // Default visible unless dead/invisible

        this.updateZIndex();
    }

    override updateZIndex(): void {
        const baseZIndex = this.definition?.zIndex ?? ZIndexes.Vehicles ?? ZIndexes.ObstaclesLayer1;
        const zIndex = this.dead  // Assuming you add dead later; stub for now
            ? this.doOverlay()  // doOverlay now works via floorType
                ? ZIndexes.UnderWaterDeadObstacles
                : ZIndexes.DeadObstacles
            : baseZIndex;

        this.container.zIndex = getEffectiveZIndex(zIndex, this.layer, this.game.layer);
    }


    override destroy(): void {
        this.image.destroy();
        super.destroy();
    }

    override updateDebugGraphics(): void {
        if (!HITBOX_DEBUG_MODE) return;

        const alpha = this.game.activePlayer !== undefined && this.layer === this.game.activePlayer.layer
            ? 1
            : DIFF_LAYER_HITBOX_OPACITY;

        drawHitbox(
            this.hitbox,
            this.dead ? HITBOX_COLORS.obstacleNoCollision : HITBOX_COLORS.obstacle,  // Vehicle color
            this.debugGraphics,
            alpha
        );
    }


    interact(): void {
        console.log(`Interacted with vehicle: ${this.definition.idString}`);  // Expand: e.g., enter vehicle logic
    }

    canInteract(player: any): boolean {  // 'any' for Player type—fix import if needed
        return !this.dead;
    }

    hitEffect(position: Vector, angle: number): void {
        // if (this.definition.noHitEffect) return;

        // if (!this.definition.hitSoundVariations) this.hitSound?.stop();

        // const { material } = this.definition;
        // this.hitSound = this.game.soundManager.play(
        //     `${MaterialSounds[material]?.hit ?? material}_hit_${this.definition.hitSoundVariations ? random(1, this.definition.hitSoundVariations) : randomBoolean() ? "1" : "2"}`,
        //     {
        //         position,
        //         falloff: 0.2,
        //         maxRange: 96,
        //         layer: this.layer
        //     }
        // );

        // this.game.particleManager.spawnParticle({
        //     frames: this.particleFrames,
        //     position,
        //     zIndex: Numeric.max((this.definition.zIndex ?? ZIndexes.Players) + 1, 4),
        //     lifetime: 600,
        //     layer: this.layer,
        //     scale: { start: 0.9, end: 0.2 },
        //     alpha: { start: 1, end: 0.65 },
        //     speed: Vec.fromPolar((angle + randomFloat(-0.3, 0.3)), randomFloat(2.5, 4.5))
        // });
    }

}
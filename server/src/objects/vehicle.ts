import { Layer, ObjectCategory, PlayerActions } from "@common/constants";
import { CircleHitbox, Hitbox, RectangleHitbox } from "@common/utils/hitbox";
import { BaseGameObject } from "./gameObject";
import { SDeepMutable } from "@common/utils/misc";
import { FullData } from "@common/utils/objectsSerializations";
import { HealingAction } from "../inventory/action";
import { ThrowableDefinition } from "@common/definitions/throwables";
import { ObjectDefinition } from "@common/utils/objectDefinitions";
import { Vector } from "@common/utils/vector";
import { Game } from "../game";
import { ThrowableItem } from "../inventory/throwableItem";
import { VehicleDefinition } from "@common/definitions/vehicle";
import { RotationMode } from "@common/definitions/obstacles";
import { Orientation } from "@common/typings";

export class Vehicle extends BaseGameObject.derive(ObjectCategory.Vehicle) {
    private static readonly baseHitbox = RectangleHitbox.fromRect(9.2, 9.2);

    override readonly fullAllocBytes = 8;
    override readonly partialAllocBytes = 14;
    declare hitbox: Hitbox;

    private _height = 1;

    get height(): number { return this._height; }

    constructor(
        game: Game,
        position: Vector,
        layer: Layer,
        readonly definition: VehicleDefinition,
    ) {
        super(game, position);
        this.layer = layer;
        const hitboxRotation = this.definition.rotationMode === RotationMode.Limited ? this.rotation as Orientation : 0;
        this.hitbox = this.definition.hitbox.transform(this.position, this.definition.scale, hitboxRotation);
    }


    override get data(): FullData<ObjectCategory.Vehicle> {
        const data: SDeepMutable<FullData<ObjectCategory.Vehicle>> = {
            position: this.position,
            rotation: this.rotation,
            layer: this.layer,
            full: {
                definition: this.definition,
            }
        };

        return data;
    }

    override damage(): void { }
}
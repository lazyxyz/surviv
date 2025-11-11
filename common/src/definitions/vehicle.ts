import { Layers, ZIndexes } from "../constants";
import { GroupHitbox, Hitbox, RectangleHitbox } from "../utils/hitbox";
import { ObjectDefinitions, type ObjectDefinition } from "../utils/objectDefinitions";
import { Vec } from "../utils/vector";
import { Materials, RotationMode } from "./obstacles";  // Reuse from obstacles, as vehicles rotate like them

export interface VehicleDefinition extends ObjectDefinition {
    readonly scale: number;
    /**
     * @default {RotationMode.Limited}
     */
    readonly rotationMode: RotationMode;
    readonly hitbox: Hitbox;
    readonly bulletHitbox: Hitbox;
    readonly health: number;
    readonly zIndex?: ZIndexes;
    readonly reflectBullets: boolean;
    readonly material?: typeof Materials[number];
    readonly explosion?: string
}

export const Vehicles = ObjectDefinitions.withDefault<VehicleDefinition>()(
    "Vehicles",
    {
        scale: 1,  // Default size
        rotationMode: RotationMode.Limited,
        hitbox: RectangleHitbox.fromRect(9.2, 15),

        bulletHitbox: new GroupHitbox(
            // Hood (front)
            RectangleHitbox.fromRect(7.6, 8, Vec.create(0, -9)), // y=-9 backward;
            // Back (rear)
            RectangleHitbox.fromRect(7.6, 7, Vec.create(0, 4.6)),
        ),
        health: 1000,
        reflectBullets: true,
        material: "metal_heavy",
    },
    () => [
        {
            name: "Buggy",
            idString: "buggy",
            hitbox: RectangleHitbox.fromRect(7.6, 26),
            health: 10000,
            explosion: "super_barrel_explosion",

        }
    ].map(def => {
        return {
            ...def
        };
    })
);
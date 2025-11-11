import { Layers, ZIndexes } from "../constants";
import { GroupHitbox, Hitbox, RectangleHitbox } from "../utils/hitbox";
import { ObjectDefinitions, type ObjectDefinition } from "../utils/objectDefinitions";
import { Vec, Vector } from "../utils/vector";
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
    readonly explosion?: string;
    // readonly wheels?: Vector[];
    readonly wheels?: Array<{  // NEW: Per-wheel config
        offset: Vector;     // Position relative to vehicle center
        scale: number;   // Wheel size multiplier
        zIndex: ZIndexes; // Layer (e.g., behind body)
    }>;

    readonly maxSpeed: number;
    readonly acceleration: number;
    readonly turnSpeed: number;
    readonly drag: number;
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

        maxSpeed: 0.1, // Default slower than player
        acceleration: 0.0005, // Reach maxSpeed in ~1s (tune as needed)
        turnSpeed: 0.002, // ~114 deg/s (tune for feel)
        drag: 0.001, // Decel time constant ~1s
        
        wheels: [
            {  // Front-left
                offset: Vec.create(-120, -230),
                scale: 0.8,
                zIndex: ZIndexes.Vehicles + 1
            },
            {  // Front-right
                offset: Vec.create(120, -230),
                scale: 0.8,
                zIndex: ZIndexes.Vehicles + 1
            },
            {  // Rear-left
                offset: Vec.create(-140, 170),
                scale: 1.0,  // Standard rear
                zIndex: ZIndexes.Vehicles + 1
            },
            {  // Rear-right
                offset: Vec.create(140, 170),
                scale: 1.0,
                zIndex: ZIndexes.Ground
            }
        ]
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
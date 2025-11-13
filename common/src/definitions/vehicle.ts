import { Layers, ZIndexes } from "../constants";
import { CircleHitbox, GroupHitbox, Hitbox, RectangleHitbox } from "../utils/hitbox";
import { ObjectDefinitions, type ObjectDefinition } from "../utils/objectDefinitions";
import { Vec, Vector } from "../utils/vector";
import { Materials, RotationMode } from "./obstacles";  // Reuse from obstacles, as vehicles rotate like them

export enum SeatType {
    Driver,
    Passenger
}

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

    readonly wheels: Array<{  // NEW: Per-wheel config
        offset: Vector;     // Position relative to vehicle center
        scale: number;   // Wheel size multiplier
        zIndex: ZIndexes; // Layer (e.g., behind body)
    }>;

    readonly maxSpeed: number;
    readonly acceleration: number;
    readonly turnSpeed: number;
    readonly drag: number;
    readonly seats: Array<{
        readonly offset: Vector;     // Position relative to vehicle center
        readonly type: SeatType; // Seat type
        readonly zIndex?: ZIndexes;  // Optional zIndex for rendering adjustments
    }>;
}

const defaultVehicle: VehicleDefinition = {
    idString: "buggy",
    name: "Buggy",
    scale: 1,
    rotationMode: RotationMode.Full,
    hitbox: new GroupHitbox(
        // Hood (front)
        new CircleHitbox(4, Vec.create(0, -9)),
        // Back (rear)
        new CircleHitbox(3.6, Vec.create(0, 4.6)),
    ),
    bulletHitbox: new GroupHitbox(
        // Hood (front)
        RectangleHitbox.fromRect(7.6, 8, Vec.create(0, -9)),
        // Back (rear)
        RectangleHitbox.fromRect(7.6, 7, Vec.create(0, 4.6))
    ),
    health: 1000,
    reflectBullets: true,
    material: "metal_heavy",
    maxSpeed: 0.09,
    acceleration: 0.00008,
    turnSpeed: 0.002,
    drag: 0.001,
    wheels: [
        {
            offset: Vec.create(-120, -230),
            scale: 0.8,
            zIndex: ZIndexes.Vehicles - 1
        },
        {
            offset: Vec.create(120, -230),
            scale: 0.8,
            zIndex: ZIndexes.Vehicles - 1
        },
        {
            offset: Vec.create(-140, 170),
            scale: 1.0, // Standard rear
            zIndex: ZIndexes.Vehicles - 1
        },
        {
            offset: Vec.create(140, 170),
            scale: 1.0,
            zIndex: ZIndexes.Vehicles - 1
        }
    ],

    seats: [
        {
            offset: Vec.create(0, -1.4), // Driver seat, centered forward
            type: SeatType.Driver
        },
        {
            offset: Vec.create(0, 10), // Passenger seat, offset to the right
            type: SeatType.Passenger
        }
    ],

};

export const Vehicles = ObjectDefinitions.withDefault<VehicleDefinition>()(
    "Vehicles",
    defaultVehicle,
    () => [
        {
            idString: "buggy",
            name: "Buggy",
            scale: 1,  // Default size
            rotationMode: RotationMode.Limited,
            hitbox: new GroupHitbox(
                new CircleHitbox(3.6, Vec.create(10, 0)),
                new CircleHitbox(4, Vec.create(4.6, 0)),
                new CircleHitbox(5, Vec.create(0, 0)),
                new CircleHitbox(3.8, Vec.create(-9, 0)),
            ),
            bulletHitbox: new GroupHitbox(
                // Hood (front)
                new CircleHitbox(3.8, Vec.create(9, 0)),
                // Back (rear)
                new CircleHitbox(3.6, Vec.create(-4.6, 0)),
            ),
            health: 1000,
            reflectBullets: true,
            material: Materials[5],

            maxSpeed: 0.09, // Default slower than player
            acceleration: 0.00008, // Reach maxSpeed in ~4s (tune as needed)
            turnSpeed: 0.002, // ~114 deg/s (tune for feel)
            drag: 0.001, // Decel time constant ~1s
            explosion: "super_barrel_explosion",

            wheels: [
                {  // Front-left
                    offset: Vec.create(230, -120), // forward, left/right
                    scale: 0.8,
                    zIndex: ZIndexes.Vehicles + 1
                },
                {  // Front-right
                    offset: Vec.create(230, 120),
                    scale: 0.8,
                    zIndex: ZIndexes.Vehicles + 1
                },
                {  // Rear-left
                    offset: Vec.create(-170, -140),
                    scale: 1.0,  // Standard rear
                    zIndex: ZIndexes.Vehicles + 1
                },
                {  // Rear-right
                    offset: Vec.create(-170, 140),
                    scale: 1.0,
                    zIndex: ZIndexes.Ground
                }
            ],

            seats: [
                {
                    offset: Vec.create(1.4, 0), // Driver seat, centered forward
                    type: SeatType.Driver,
                },
                {
                    offset: Vec.create(-10, 0), // Passenger seat, offset to the right
                    type: SeatType.Passenger
                }
            ]
        }
    ].map(def => ({
        ...defaultVehicle,
        ...def
    }))
);
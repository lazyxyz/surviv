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

    readonly maxSteerAngle: number;  // Max front wheel deflection (radians, e.g., Math.PI / 6 ≈ 30°)
    readonly steerRate: number;     // Max rate of steering change (rad/s, e.g., Math.PI / 2 for quick response)

    readonly drag: number;
    readonly seats: Array<{
        readonly offset: Vector;     // Position relative to vehicle center
        readonly type: SeatType; // Seat type
        readonly exitOffset: Vector;
        readonly zIndex?: ZIndexes;  // Optional zIndex for rendering adjustments
    }>;
    readonly baseDamage: number;
    readonly frictionFactor: number; // Tune 0-1; higher=more slide reduction (real tire grip)
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
    maxSteerAngle: Math.PI / 6,  // 30° max wheel turn
    steerRate: Math.PI / 2,     // 90°/s response
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
            type: SeatType.Driver,
            exitOffset: Vec.create(140, 170),
        },
        {
            offset: Vec.create(0, 10), // Passenger seat, offset to the right
            type: SeatType.Passenger,
            exitOffset: Vec.create(140, 170),
        }
    ],
    baseDamage: 30,
    frictionFactor: 0.6,
};

export const Vehicles = ObjectDefinitions.withDefault<VehicleDefinition>()(
    "Vehicles",
    defaultVehicle,
    () => [
        {
            idString: "jeep",
            name: "Jeep",
            scale: 1,  // Default size
            rotationMode: RotationMode.Limited,
            spawnHitbox: RectangleHitbox.fromRect(20, 18.4),
            hitbox: new GroupHitbox(
                new CircleHitbox(8.6, Vec.create(9.2, 0)),
                new CircleHitbox(8.6, Vec.create(0, 0)),
                new CircleHitbox(8.6, Vec.create(-9.2, 0)),
            ),
            bulletHitbox: new GroupHitbox(
                // Hood (front)
                new CircleHitbox(8.6, Vec.create(9.2, 0)),
                new CircleHitbox(2.6, Vec.create(3.2, -6)),
                new CircleHitbox(2.6, Vec.create(3.2, 6)),
            ),
            health: 1000,
            reflectBullets: true,
            material: Materials[5],

            maxSpeed: 0.09, // Default slower than player
            acceleration: 0.00008, // Reach maxSpeed in ~4s (tune as needed)
            turnSpeed: 0.0001, // ~114 deg/s (tune for feel)
            drag: 0.001, // Decel time constant ~1s
            explosion: "super_barrel_explosion",

            wheels: [
                {  // Front-left
                    offset: Vec.create(240, -145), // forward, left/right
                    scale: 1.1,
                    zIndex: ZIndexes.Ground - 1
                },
                {  // Front-right
                    offset: Vec.create(240, 145),
                    scale: 1.1,
                    zIndex: ZIndexes.Ground - 1
                },
                {  // Rear-left
                    offset: Vec.create(-190, -145),
                    scale: 1.1,  // Standard rear
                    zIndex: ZIndexes.Ground - 1
                },
                {  // Rear-right
                    offset: Vec.create(-190, 145),
                    scale: 1.1,
                    zIndex: ZIndexes.Ground - 1
                }
            ],

            seats: [

                {
                    offset: Vec.create(-3.4, -3.5), // Driver seat, centered forward
                    type: SeatType.Driver,
                    exitOffset: Vec.create(0, -10),

                },
                {
                    offset: Vec.create(-3.4, 3.5), // Passenger seat, offset to the right
                    type: SeatType.Passenger,
                    exitOffset: Vec.create(0, 10),

                },
                {
                    offset: Vec.create(-11.4, -3.5), // Passenger seat, offset to the right
                    type: SeatType.Driver,
                    exitOffset: Vec.create(4, -10),

                },
                {
                    offset: Vec.create(-11.2, 3.5), // Passenger seat, offset to the right
                    type: SeatType.Driver,
                    exitOffset: Vec.create(0, 10),
                },
            ]
        },
        {
            idString: "buggy",
            name: "Buggy",
            scale: 1,  // Default size
            rotationMode: RotationMode.Limited,
            hitbox: new GroupHitbox(
                new CircleHitbox(3.2, Vec.create(10, 0)),
                new CircleHitbox(3.8, Vec.create(4.6, 0)),
                new CircleHitbox(4.6, Vec.create(0, 0)),
                new CircleHitbox(3.4, Vec.create(-9, 0)),
            ),
            bulletHitbox: new GroupHitbox(
                // Hood (front)
                new CircleHitbox(3.2, Vec.create(9, 0)),
                // Back (rear)
                new CircleHitbox(3.4, Vec.create(-4.6, 0)),
            ),
            health: 1000,
            reflectBullets: true,
            material: Materials[5],

            maxSpeed: 0.07,
            acceleration: 0.00008, // Reach maxSpeed in ~4s (tune as needed)

            maxSteerAngle: Math.PI / 8,
            steerRate: Math.PI / 2,

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
                    exitOffset: Vec.create(0, -10),
                },
                {
                    offset: Vec.create(-10, 0), // Passenger seat, offset to the right
                    type: SeatType.Passenger,
                    exitOffset: Vec.create(0, -10),
                }
            ],

            baseDamage: 20,
            frictionFactor: 0.4,
        }
    ].map(def => ({
        ...defaultVehicle,
        ...def
    }))
);
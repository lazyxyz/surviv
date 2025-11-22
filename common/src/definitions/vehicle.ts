// common/src/definitions/vehicle.ts
import { ZIndexes } from "../constants";
import { CircleHitbox, GroupHitbox, Hitbox, RectangleHitbox } from "../utils/hitbox";
import { MapObjectSpawnMode, ObjectDefinitions, type ObjectDefinition } from "../utils/objectDefinitions";
import { Vec, Vector } from "../utils/vector";
import { Materials, RotationMode } from "./obstacles";

export enum SeatType {
    Driver,
    Passenger
}

export interface VehicleDefinition extends ObjectDefinition {
    readonly scale: number;
    readonly rotationMode: RotationMode;
    readonly hitbox: Hitbox;
    readonly bulletHitbox: Hitbox;
    readonly spawnHitbox?: Hitbox
    readonly health: number;
    readonly zIndex?: ZIndexes;
    readonly reflectBullets: boolean;
    readonly material?: typeof Materials[number];
    readonly explosion?: string;
    readonly spawnMode: MapObjectSpawnMode;

    readonly wheels: Array<{
        offset: Vector;
        scale: number;
        zIndex: ZIndexes;
    }>;

    readonly maxSpeed: number;
    readonly acceleration: number;

    readonly maxSteerAngle: number;
    readonly steerRate: number;

    readonly drag: number;
    readonly seats: Array<{
        readonly offset: Vector;
        readonly type: SeatType;
        readonly exitOffset: Vector;
        readonly zIndex?: ZIndexes;
    }>;
    readonly baseDamage: number;
    readonly frictionFactor: number;
    readonly hitSoundVariations?: number
}


export const Vehicles = ObjectDefinitions.create<VehicleDefinition>(
    "Vehicles",
    [
        {
            idString: "jeep",
            name: "Jeep",
            scale: 1,
            rotationMode: RotationMode.Limited,
            hitbox: new GroupHitbox(
                new CircleHitbox(8.2, Vec.create(9.2, 0)),
                new CircleHitbox(8.4, Vec.create(0, 0)),
                new CircleHitbox(8.4, Vec.create(-9.2, 0)),
            ),
            bulletHitbox: new GroupHitbox(
                new CircleHitbox(8.0, Vec.create(9.2, 0)),
                new CircleHitbox(2.6, Vec.create(3.2, -5.8)),
                new CircleHitbox(2.6, Vec.create(3.2, 5.8)),
            ),
            spawnHitbox: new CircleHitbox(18),
            health: 1000,
            reflectBullets: true,
            material: Materials[5],
            explosion: "super_barrel_explosion",
            spawnMode: MapObjectSpawnMode.Trail,

            maxSpeed: 0.08,
            acceleration: 0.00008,
            maxSteerAngle: Math.PI / 5,
            steerRate: Math.PI * 0.8,
            drag: 0.00095,

            frictionFactor: 0.75,

            wheels: [
                { offset: Vec.create(240, -145), scale: 1.1, zIndex: ZIndexes.UnderWheels },
                { offset: Vec.create(240, 145), scale: 1.1, zIndex: ZIndexes.UnderWheels },
                { offset: Vec.create(-190, -145), scale: 1.1, zIndex: ZIndexes.UnderWheels },
                { offset: Vec.create(-190, 145), scale: 1.1, zIndex: ZIndexes.UnderWheels }
            ],

            seats: [
                { offset: Vec.create(-3.4, -3.5), type: SeatType.Driver, exitOffset: Vec.create(0, -10) },
                { offset: Vec.create(-3.4, 3.5), type: SeatType.Passenger, exitOffset: Vec.create(0, 10) },
                { offset: Vec.create(-11.4, -3.5), type: SeatType.Passenger, exitOffset: Vec.create(4, -10) },
                { offset: Vec.create(-11.2, 3.5), type: SeatType.Passenger, exitOffset: Vec.create(0, 10) }
            ],

            baseDamage: 35
        },
        {
            idString: "buggy",
            name: "Buggy",
            scale: 1,
            rotationMode: RotationMode.Limited,
            hitbox: new GroupHitbox(
                new CircleHitbox(3.2, Vec.create(10, 0)),
                new CircleHitbox(3.8, Vec.create(4.6, 0)),
                new CircleHitbox(4.6, Vec.create(0, 0)),
                new CircleHitbox(3.4, Vec.create(-9, 0)),
            ),
            bulletHitbox: new GroupHitbox(
                new CircleHitbox(3.2, Vec.create(9, 0)),
                new CircleHitbox(3.4, Vec.create(-4.6, 0)),
            ),
            spawnHitbox: new CircleHitbox(14),
            health: 600,
            reflectBullets: true,
            material: Materials[5],
            explosion: "super_barrel_explosion",
            spawnMode: MapObjectSpawnMode.Trail,

            maxSpeed: 0.075,
            acceleration: 0.00008,
            maxSteerAngle: Math.PI / 7,
            steerRate: Math.PI / 2,
            drag: 0.0009,
            frictionFactor: 0.5,
            baseDamage: 20,
            hitSoundVariations: 2,

            wheels: [
                { offset: Vec.create(230, -120), scale: 0.8, zIndex: ZIndexes.Vehicles },
                { offset: Vec.create(230, 120), scale: 0.8, zIndex: ZIndexes.Vehicles },
                { offset: Vec.create(-170, -140), scale: 1.0, zIndex: ZIndexes.Vehicles },
                { offset: Vec.create(-170, 140), scale: 1.0, zIndex: ZIndexes.Vehicles }
            ],

            seats: [
                { offset: Vec.create(1.4, 0), type: SeatType.Driver, exitOffset: Vec.create(0, -10) },
                { offset: Vec.create(-10, 0), type: SeatType.Passenger, exitOffset: Vec.create(0, -10) }
            ],

        }
    ]
);
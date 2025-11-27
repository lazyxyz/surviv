import { ZIndexes } from "../constants";
import { CircleHitbox, GroupHitbox, Hitbox } from "../utils/hitbox";
import { MapObjectSpawnMode, ObjectDefinitions, type ObjectDefinition } from "../utils/objectDefinitions";
import { Vec, Vector } from "../utils/vector";
import { Materials, RotationMode } from "./obstacles";

export enum SeatType {
    Driver,
    Passenger
}

export interface VehicleDefinition extends ObjectDefinition {
    idString: string; // override
    name: string; // override

    readonly base: string;
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

    readonly wheelType: string;
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
    readonly smokeOffset?: Vector;
}

export const DEFAULT_VEHICLES: string[] = ["rover", "buggy"];

// BASE STATS
const BaseVehicles: Record<string, Omit<VehicleDefinition, "base" | "idString" | "name">> = {
    rover: {
        scale: 1,
        rotationMode: RotationMode.Limited,
        hitbox: new GroupHitbox(
            new CircleHitbox(7.8, Vec.create(9, 0)),
            new CircleHitbox(7.6, Vec.create(0, 0)),
            new CircleHitbox(7.8, Vec.create(-9, 0)),

            // front hood
            new CircleHitbox(4, Vec.create(12.2, -5)),
            new CircleHitbox(4, Vec.create(12.2, 5)),
        ),
        bulletHitbox: new GroupHitbox(
            new CircleHitbox(7, Vec.create(7.4, 0)),
            new CircleHitbox(2.6, Vec.create(3.2, -5.2)),
            new CircleHitbox(2.6, Vec.create(3.2, 5.2)),
        ),
        spawnHitbox: new CircleHitbox(18),
        health: 1092,
        reflectBullets: true,
        material: Materials[5],
        explosion: "super_barrel_explosion",
        spawnMode: MapObjectSpawnMode.Trail,
        zIndex: ZIndexes.Vehicles,
        maxSpeed: 0.077,
        acceleration: 6000, // 6s to reach full speed
        maxSteerAngle: Math.PI / 5,
        steerRate: Math.PI * 0.7,
        drag: 0.45,

        frictionFactor: 0.75,
        wheelType: 'basic_wheel',
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

        smokeOffset: Vec.create(14, 0),
        baseDamage: 35
    },

    buggy: {
        scale: 1,
        rotationMode: RotationMode.Limited,
        hitbox: new GroupHitbox(
            new CircleHitbox(3.2, Vec.create(11, 0)),
            new CircleHitbox(3.8, Vec.create(4.6, 0)),
            new CircleHitbox(4.6, Vec.create(0, 0)),
            new CircleHitbox(3.4, Vec.create(-9, 0)),

            // Front Wheels
            new CircleHitbox(2.5, Vec.create(11.2, -4.6)),
            new CircleHitbox(2.5, Vec.create(11.2, 4.6)),

            // Back Wheels
            new CircleHitbox(3, Vec.create(-8.2, -4.8)),
            new CircleHitbox(3, Vec.create(-8.2, 4.8)),

        ),
        bulletHitbox: new GroupHitbox(
            new CircleHitbox(3.2, Vec.create(9, 0)),
            new CircleHitbox(3.4, Vec.create(-4.6, 0)),
        ),
        spawnHitbox: new CircleHitbox(14),
        health: 765,
        reflectBullets: true,
        material: Materials[5],
        explosion: "super_barrel_explosion",
        spawnMode: MapObjectSpawnMode.Trail,
        zIndex: ZIndexes.Vehicles,

        maxSpeed: 0.083,
        acceleration: 4000, // 4s
        maxSteerAngle: Math.PI / 6,
        steerRate: Math.PI * 1.0,
        drag: 0.5,
        frictionFactor: 0.6,
        baseDamage: 20,
        hitSoundVariations: 2,
        wheelType: 'basic_wheel',
        wheels: [
            { offset: Vec.create(230, -118), scale: 0.9, zIndex: ZIndexes.Vehicles },
            { offset: Vec.create(230, 118), scale: 0.9, zIndex: ZIndexes.Vehicles },
            { offset: Vec.create(-164, -136), scale: 1.0, zIndex: ZIndexes.Vehicles },
            { offset: Vec.create(-164, 136), scale: 1.0, zIndex: ZIndexes.Vehicles }
        ],

        seats: [
            { offset: Vec.create(1.4, 0), type: SeatType.Driver, exitOffset: Vec.create(0, -10) },
            { offset: Vec.create(-10, 0), type: SeatType.Passenger, exitOffset: Vec.create(0, -10) }
        ],
        smokeOffset: Vec.create(12, 0),
    }
};

// VARIATIONS LIST
interface VehicleVariantConfig {
    base: keyof typeof BaseVehicles;
    idString: string;
    name: string;
    overrides?: Partial<VehicleDefinition>;
}

const Variations: VehicleVariantConfig[] = [
    // --- ROVERS ---
    {
        base: "rover",
        idString: "rover",
        name: "Rover",
    },
    {
        base: "rover",
        idString: "rover_rust",
        name: "Rover Rust",
    },
    {
        base: "rover",
        idString: "rover_captain",
        name: "Rover Captain",
    },
    {
        base: "rover",
        idString: "rover_reaper",
        name: "Rover Reaper",
    },

    // --- BUGGIES ---
    {
        base: "buggy",
        idString: "buggy",
        name: "Buggy",
    },
    {
        base: "buggy",
        idString: "buggy_rust",
        name: "Buggy Rust",
    },
    {
        base: "buggy",
        idString: "buggy_captain",
        name: "Buggy Captain",
    },
    {
        base: "buggy",
        idString: "buggy_reaper",
        name: "Buggy Reaper",
    },

];

export const Vehicles = ObjectDefinitions.create<VehicleDefinition>(
    "Vehicles",
    Variations.map(variant => {
        const baseStats = BaseVehicles[variant.base];
        if (!baseStats) throw new Error(`Unknown base vehicle: ${variant.base}`);

        return {
            ...baseStats,
            ...variant.overrides,
            idString: variant.idString,
            name: variant.name,
            base: variant.base
        };
    })
);
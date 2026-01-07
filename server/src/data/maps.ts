import { Layer } from "@common/constants";
import { Buildings, type BuildingDefinition } from "@common/definitions/buildings";
import { Guns } from "@common/definitions/guns";
import { Loots } from "@common/definitions/loots";
import { Obstacles, RotationMode, type ObstacleDefinition } from "@common/definitions/obstacles";
import { Orientation, type Variation } from "@common/typings";
import { CircleHitbox } from "@common/utils/hitbox";
import { Collision } from "@common/utils/math";
import { ItemType, MapObjectSpawnMode, type ReferenceTo } from "@common/utils/objectDefinitions";
import { random, randomFloat } from "@common/utils/random";
import { Vec, type Vector } from "@common/utils/vector";
import { GameMap } from "../map";
import { getLootFromTable, LootTables } from "./lootTables";
import { Perks } from "@common/definitions/perks";
import { Melees } from "@common/definitions/melees";
import { Scopes } from "@common/definitions/scopes";
import { VehicleDefinition, Vehicles } from "@common/definitions/vehicles";

export interface RiverDefinition {
    readonly minAmount: number
    readonly maxAmount: number
    readonly maxWideAmount: number
    readonly wideChance: number
    readonly minWidth: number
    readonly maxWidth: number
    readonly minWideWidth: number
    readonly maxWideWidth: number
}

export interface OasisDefinition {
    readonly minAmount: number
    readonly maxAmount: number
    readonly minRadius: number
    readonly maxRadius: number
    readonly bankWidth: number
}

export interface MapDefinition {
    readonly width: number
    readonly height: number
    readonly oceanSize: number
    readonly beachSize: number
    readonly rivers?: RiverDefinition
    readonly oases?: OasisDefinition
    readonly trails?: RiverDefinition
    readonly clearings?: {
        readonly minWidth: number
        readonly minHeight: number
        readonly maxWidth: number
        readonly maxHeight: number
        readonly count: number
        readonly allowedObstacles: Array<ReferenceTo<ObstacleDefinition>>
        readonly obstacles: Array<{ idString: ReferenceTo<ObstacleDefinition>, min: number, max: number }>
    }

    readonly bridges?: ReadonlyArray<ReferenceTo<BuildingDefinition>>
    readonly majorBuildings?: ReadonlyArray<ReferenceTo<BuildingDefinition>>
    readonly buildings?: Record<ReferenceTo<BuildingDefinition>, number>
    readonly quadBuildingLimit?: Record<ReferenceTo<BuildingDefinition>, number>
    readonly obstacles?: Record<ReferenceTo<ObstacleDefinition>, number>
    readonly obstacleClumps?: readonly ObstacleClump[]
    readonly loots?: Record<keyof typeof LootTables, number>

    readonly places?: ReadonlyArray<{
        readonly name: string
        readonly position: Vector
    }>

    readonly vehicles?: Record<ReferenceTo<VehicleDefinition>, number>

    readonly onGenerate?: (map: GameMap, params: string[]) => void
}

export type ObstacleClump = {
    /**
     * How many of these clumps per map
     */
    readonly clumpAmount: number
    /**
     * Data for any given clump
     */
    readonly clump: {
        /**
         * Id's of obstacles that may appear in the clump
         */
        readonly obstacles: ReadonlyArray<ReferenceTo<ObstacleDefinition>>
        readonly minAmount: number
        readonly maxAmount: number
        readonly radius: number
        readonly jitter: number
    }
};

const maps = {
    normal: {
        width: 1632,
        height: 1632,
        oceanSize: 128,
        beachSize: 32,
        rivers: {
            minAmount: 2,
            maxAmount: 3,
            maxWideAmount: 1,
            wideChance: 0.35,
            minWidth: 12,
            maxWidth: 18,
            minWideWidth: 25,
            maxWideWidth: 30
        },
        buildings: {
            large_bridge: 2,
            small_bridge: Infinity,
            port_complex: 1,
            sea_traffic_control: 1,
            tugboat_red: 1,
            tugboat_white: 5,
            armory: 1,
            headquarters: 1,
            small_bunker: 1,
            refinery: 1,
            warehouse: 5,
            green_house: 3,
            blue_house: 3,
            red_house: 3,
            red_house_v2: 3,
            construction_site: 1,
            mobile_home: 10,
            porta_potty: 12,
            container_3: 2,
            container_4: 2,
            container_5: 2,
            container_6: 2,
            container_7: 1,
            container_8: 2,
            container_9: 1,
            container_10: 2
        },
        majorBuildings: ["armory", "refinery", "port_complex", "headquarters"],
        quadBuildingLimit: {
            red_house: 1,
            red_house_v2: 1,
            warehouse: 2,
            green_house: 1,
            blue_house: 1,
            mobile_home: 3,
            porta_potty: 3,
            construction_site: 1
        },
        obstacles: {
            oil_tank: 12,
            oak_tree: 10,
            small_oak_tree: 100,
            birch_tree: 20,
            pine_tree: 10,
            loot_tree: 1,
            regular_crate: 160,
            flint_crate: 5,
            aegis_crate: 5,
            grenade_crate: 35,
            rock: 150,
            river_chest: 1,
            river_rock: 45,
            bush: 110,
            lily_pad: 20,
            blueberry_bush: 30,
            barrel: 80,
            viking_chest: 1,
            super_barrel: 30,
            melee_crate: 1,
            gold_rock: 1,
            loot_barrel: 1,
            flint_stone: 1
        },
        obstacleClumps: [
            {
                clumpAmount: 100,
                clump: {
                    minAmount: 2,
                    maxAmount: 3,
                    jitter: 5,
                    obstacles: ["small_oak_tree"],
                    radius: 12
                }
            },
            {
                clumpAmount: 25,
                clump: {
                    minAmount: 2,
                    maxAmount: 3,
                    jitter: 5,
                    obstacles: ["birch_tree"],
                    radius: 12
                }
            },
            {
                clumpAmount: 4,
                clump: {
                    minAmount: 2,
                    maxAmount: 3,
                    jitter: 5,
                    obstacles: ["pine_tree"],
                    radius: 12
                }
            }
        ],
        loots: {
            ground_loot: 60
        },
        places: [
            { name: "Banana", position: Vec.create(0.23, 0.2) },
            { name: "Takedown", position: Vec.create(0.23, 0.8) },
            { name: "Lavlandet", position: Vec.create(0.75, 0.2) },
            { name: "Noskin Narrows", position: Vec.create(0.72, 0.8) },
            { name: "Mt. Sanger", position: Vec.create(0.5, 0.35) },
            { name: "Deepwood", position: Vec.create(0.5, 0.65) }
        ]
    },

    fall: {
        width: 2048,
        height: 2048,
        oceanSize: 64,
        beachSize: 8,
        rivers: {
            minAmount: 2,
            maxAmount: 2,
            wideChance: 0.35,
            minWidth: 12,
            maxWidth: 18,
            minWideWidth: 25,
            maxWideWidth: 28,
            maxWideAmount: 1
        },
        trails: {
            minAmount: 3,
            maxAmount: 5,
            wideChance: 0.2,
            minWidth: 2,
            maxWidth: 4,
            minWideWidth: 3,
            maxWideWidth: 5,
            maxWideAmount: 1
        },
        clearings: {
            minWidth: 200,
            minHeight: 150,
            maxWidth: 250,
            maxHeight: 200,
            count: 2,
            allowedObstacles: ["clearing_boulder", "flint_crate", "rock", "vibrant_bush", "river_chest", "lily_pad", "grenade_crate", "oak_leaf_pile", "river_rock", "melee_crate", "flint_stone"],
            obstacles: [
                { idString: "clearing_boulder", min: 3, max: 6 },
                { idString: "flint_crate", min: 0, max: 2 },
                { idString: "grenade_crate", min: 0, max: 2 },
                { idString: "melee_crate", min: 0, max: 1 },
                { idString: "flint_stone", min: 0, max: 1 }
            ]
        },
        buildings: {
            small_bridge: Infinity,
            plumpkin_bunker: 1,
            sea_traffic_control: 1,
            lodge: 1,
            bombed_armory: 1,
            barn: 3,
            green_house: 2,
            warehouse: 4,
            red_house: 2,
            red_house_v2: 2,
            tent_big_1: 2,
            tent_big_2: 2,
            tent_big_3: 2,
            tent_big_4: 2,
            hay_shed_1: 1,
            hay_shed_2: 3,
            hay_shed_3: 3,
            tent_1: 3,
            tent_2: 3,
            tent_3: 3,
            tent_4: 3,
            tent_5: 1,
            outhouse: 10
        },
        majorBuildings: ["bombed_armory", "lodge", "plumpkin_bunker"],
        quadBuildingLimit: {
            barn: 1,
            outhouse: 3,
            red_house: 1,
            green_house: 1,
            red_house_v2: 1,
            warehouse: 2,
            bombed_armory: 1,
            lodge: 1,
            tent_1: 1,
            tent_2: 1,
            tent_3: 1,
            tent_4: 1
        },
        obstacles: {
            oak_tree: 100,
            small_oak_tree: 50,
            birch_tree: 25,
            maple_tree: 50,
            pine_tree: 30,
            dormant_oak_tree: 25,
            stump: 20,
            hatchet_stump: 3,
            regular_crate: 200,
            flint_crate: 10,
            grenade_crate: 50,
            rock: 30,
            clearing_boulder: 15,
            river_chest: 1,
            river_rock: 30,
            vibrant_bush: 100,
            oak_leaf_pile: 100,
            lily_pad: 50,
            barrel: 30,
            viking_chest: 1,
            super_barrel: 15,
            melee_crate: 1,
            gold_rock: 1,
            loot_tree: 4,
            loot_barrel: 1,
            flint_stone: 1,
            pumpkin: 200,
            large_pumpkin: 5,
            pebble: 110
        },
        obstacleClumps: [
            {
                clumpAmount: 110,
                clump: {
                    minAmount: 2,
                    maxAmount: 3,
                    jitter: 5,
                    obstacles: ["oak_tree"],
                    radius: 12
                }
            },
            {
                clumpAmount: 15,
                clump: {
                    minAmount: 2,
                    maxAmount: 3,
                    jitter: 5,
                    obstacles: ["small_oak_tree"],
                    radius: 12
                }
            },
            {
                clumpAmount: 15,
                clump: {
                    minAmount: 2,
                    maxAmount: 3,
                    jitter: 5,
                    obstacles: ["birch_tree"],
                    radius: 12
                }
            },
            {
                clumpAmount: 15,
                clump: {
                    minAmount: 2,
                    maxAmount: 3,
                    jitter: 5,
                    obstacles: ["pine_tree"],
                    radius: 12
                }
            }
        ],
        loots: {
            ground_loot: 60
        },
        places: [
            { name: "Antler", position: Vec.create(0.23, 0.2) },
            { name: "Deadfall", position: Vec.create(0.23, 0.8) },
            { name: "Beaverdam", position: Vec.create(0.75, 0.2) },
            { name: "Crimson Hills", position: Vec.create(0.72, 0.8) },
            { name: "Emerald Farms", position: Vec.create(0.5, 0.35) },
            { name: "Darkwood", position: Vec.create(0.5, 0.65) }
        ],
        vehicles: {
            buggy: 3,
            rover: 3,
        }
    },

    winter: {
        width: 2048,
        height: 2048,
        oceanSize: 64,
        beachSize: 8,
        rivers: {
            minAmount: 2,
            maxAmount: 3,
            maxWideAmount: 1,
            wideChance: 0.35,
            minWidth: 12,
            maxWidth: 18,
            minWideWidth: 25,
            maxWideWidth: 30
        },
        trails: {
            minAmount: 3,
            maxAmount: 5,
            wideChance: 0.2,
            minWidth: 2,
            maxWidth: 4,
            minWideWidth: 3,
            maxWideWidth: 5,
            maxWideAmount: 1
        },
        buildings: {
            large_bridge: 2,
            small_bridge: Infinity,
            port_complex: 1,
            sea_traffic_control: 1,
            armory: 1,
            headquarters: 1,
            small_bunker: 1,
            refinery: 1,
            warehouse: 4,
            christmas_camp: 1,
            green_house: 3,
            blue_house: 3,
            red_house: 3,
            red_house_v2: 3,
            construction_site: 1,
            mobile_home: 8,
            porta_potty: 12,
            container_3: 2,
            container_4: 2,
            container_5: 2,
            container_6: 2,
            container_7: 1,
            container_8: 2,
            container_9: 1,
            container_10: 3
        },
        majorBuildings: ["armory", "refinery", "port_complex", "headquarters", "christmas_camp"],
        quadBuildingLimit: {
            red_house: 1,
            red_house_v2: 1,
            warehouse: 2,
            green_house: 1,
            blue_house: 1,
            mobile_home: 3,
            porta_potty: 3,
            construction_site: 1
        },
        obstacles: {
            oil_tank_winter: 12,
            oak_tree: 40,
            birch_tree: 20,
            pine_tree: 90,
            loot_tree: 1,
            regular_crate_winter: 160,
            frozen_crate: 10,
            flint_crate_winter: 5,
            aegis_crate_winter: 5,
            grenade_crate_winter: 35,
            rock: 30,
            river_chest: 1,
            river_rock: 45,
            bush: 110,
            blueberry_bush: 30,
            barrel_winter: 30,
            viking_chest: 1,
            super_barrel_winter: 30,
            melee_crate_winter: 1,
            gold_rock: 1,
            loot_barrel: 1,
            flint_stone_winter: 1
        },
        obstacleClumps: [
            {
                clumpAmount: 25,
                clump: {
                    minAmount: 2,
                    maxAmount: 3,
                    jitter: 5,
                    obstacles: ["oak_tree"],
                    radius: 12
                }
            },
            {
                clumpAmount: 25,
                clump: {
                    minAmount: 2,
                    maxAmount: 3,
                    jitter: 5,
                    obstacles: ["birch_tree"],
                    radius: 12
                }
            },
            {
                clumpAmount: 65,
                clump: {
                    minAmount: 2,
                    maxAmount: 3,
                    jitter: 5,
                    obstacles: ["pine_tree"],
                    radius: 12
                }
            }
        ],
        loots: {
            ground_loot: 60
        },
        places: [
            { name: "Banana", position: Vec.create(0.23, 0.2) },
            { name: "Takedown", position: Vec.create(0.23, 0.8) },
            { name: "Lavlandet", position: Vec.create(0.75, 0.2) },
            { name: "Noskin Narrows", position: Vec.create(0.72, 0.8) },
            { name: "Mt. Sanger", position: Vec.create(0.5, 0.35) },
            { name: "Deepwood", position: Vec.create(0.5, 0.65) }
        ],
        vehicles: {
            buggy: 3,
            rover: 3,
        }
    },

    desert: {
        width: 2048,
        height: 2048,
        oceanSize: 64,
        beachSize: 8,
        oases: {
            minAmount: 7,
            maxAmount: 7,
            minRadius: 40,
            maxRadius: 80,
            bankWidth: 12
        },
        trails: {
            minAmount: 3,
            maxAmount: 5,
            wideChance: 0.2,
            minWidth: 2,
            maxWidth: 4,
            minWideWidth: 3,
            maxWideWidth: 5,
            maxWideAmount: 1
        },
        clearings: {
            minWidth: 200,
            minHeight: 150,
            maxWidth: 250,
            maxHeight: 200,
            count: 2,
            allowedObstacles: ["clearing_boulder", "flint_crate", "rock", "vibrant_bush", "river_chest", "lily_pad", "grenade_crate", "oak_leaf_pile", "river_rock", "melee_crate", "flint_stone"],
            obstacles: [
                { idString: "clearing_boulder", min: 3, max: 6 },
                { idString: "flint_crate", min: 0, max: 2 },
                { idString: "grenade_crate", min: 0, max: 2 },
                { idString: "melee_crate", min: 0, max: 1 },
                { idString: "flint_stone", min: 0, max: 1 }
            ]
        },
        buildings: {
            small_bridge: Infinity,
            sea_traffic_control: 1,
            bombed_armory: 1,
            warehouse: 5,
            tent_big_1: 3,
            tent_big_2: 3,
            tent_big_3: 3,
            tent_big_4: 3,
            hay_shed_1: 1,
            hay_shed_2: 3,
            hay_shed_3: 3,
            tent_1: 3,
            tent_2: 3,
            tent_3: 3,
            tent_4: 3,
            tent_5: 3,
            outhouse: 10
        },
        obstacles: {
            palm_tree: 100,
            date_palm_tree: 100,
            small_palm_tree: 50,
            child_palm_tree: 60,
            doum_palm_tree: 100,
            quiver_tree: 60,
            wood_barrel: 100,
            ceramic_jar: 60,
            barrel_cactus: 100,
            century_plant: 100,
            ghost_plant: 80,
            pencil_cactus: 80,
            bull_skeleton: 30,
            dinosaur_skeleton: 10,
            mammoth_skeleton: 5,
            dry_tree: 100,
            stump: 40,
            hatchet_stump: 3,
            regular_crate: 100,
            flint_crate: 10,
            grenade_crate: 50,
            rock: 30,
            clearing_boulder: 15,
            river_chest: 7,
            river_rock: 20,
            lily_pad: 15,
            barrel: 30,
            viking_chest: 1,
            super_barrel: 15,
            melee_crate: 1,
            gold_rock: 1,
            loot_tree: 4,
            loot_barrel: 1,
            flint_stone: 1,
            pebble: 110
        },
        loots: {
            ground_loot: 40
        },
        places: [
            { name: "Sand Antler", position: Vec.create(0.23, 0.2) },
            { name: "Dune Fall", position: Vec.create(0.23, 0.8) },
            { name: "Oasis Dam", position: Vec.create(0.75, 0.2) },
            { name: "Crimson Dunes", position: Vec.create(0.72, 0.8) },
            { name: "Mirage Farms", position: Vec.create(0.5, 0.35) },
            { name: "Shadow Sands", position: Vec.create(0.5, 0.65) }
        ],
        vehicles: {
            buggy: 3,
            rover: 3,
        }
    },

    cursedIsland: {
        width: 1924,
        height: 1924,
        oceanSize: 64,
        beachSize: 16,
        oases: {
            minAmount: 2,
            maxAmount: 3,
            minRadius: 40,
            maxRadius: 80,
            bankWidth: 12
        },
        rivers: {
            minAmount: 1,
            maxAmount: 1,
            wideChance: 0.35,
            minWidth: 12,
            maxWidth: 18,
            minWideWidth: 25,
            maxWideWidth: 28,
            maxWideAmount: 1
        },
        trails: {
            minAmount: 2,
            maxAmount: 5,
            wideChance: 0.2,
            minWidth: 2,
            maxWidth: 4,
            minWideWidth: 3,
            maxWideWidth: 5,
            maxWideAmount: 1
        },
        clearings: {
            minWidth: 200,
            minHeight: 150,
            maxWidth: 250,
            maxHeight: 200,
            count: 2,
            allowedObstacles: ["clearing_boulder", "rock", "vibrant_bush", "river_chest", "lily_pad", "grenade_crate", "oak_leaf_pile", "river_rock", "melee_crate", "flint_stone"],
            obstacles: [
                { idString: "clearing_boulder", min: 3, max: 6 },
                { idString: "grenade_crate", min: 0, max: 2 },
                { idString: "melee_crate", min: 0, max: 1 },
                { idString: "flint_stone", min: 0, max: 1 }
            ]
        },
        buildings: {
            small_bridge: Infinity,
            sea_traffic_control: 1,
            tent_big_1: 3,
            tent_big_2: 3,
            tent_big_3: 3,
            tent_big_4: 3,
            hay_shed_1: 1,
            hay_shed_2: 3,
            hay_shed_3: 3,
            tent_1: 3,
            tent_2: 3,
            tent_3: 3,
            tent_4: 3,
            tent_5: 3,
            outhouse: 10
        },
        obstacles: {
            // palm_tree: 100,
            // date_palm_tree: 150,
            // small_palm_tree: 50,
            // child_palm_tree: 60,
            // doum_palm_tree: 100,
            // quiver_tree: 60,
            spooky_oak_tree: 100,
            mutant_oak_tree: 100,
            skull_oak_tree: 100,

            // wood_barrel: 100,
            haunted_tree: 50,

            // ceramic_jar: 60,
            cauldron: 60,
            // barrel_cactus: 100,
            jack_o_lantern: 120,

            // century_plant: 100,
            spooky_bush: 120,

            ghost_plant: 80,
            pencil_cactus: 80,
            // bull_skeleton: 60,
            // dinosaur_skeleton: 15,
            // mammoth_skeleton: 5,
            small_tombstone: 50,
            modern_tombstone: 20,
            skeleton_bone: 10,
            // dry_tree: 100,
            cursed_tree: 150,

            stump: 40,
            hatchet_stump: 3,
            // regular_crate: 100,
            webbed_crate: 100,
            // halloween_crate: 100,

            grenade_crate: 50,
            rock: 220,
            clearing_boulder: 15,
            river_chest: 3,
            river_rock: 20,
            lily_pad: 15,
            barrel: 90,
            viking_chest: 1,
            super_barrel: 35,
            melee_crate: 1,
            gold_rock: 1,
            loot_tree: 4,
            loot_barrel: 1,
            pebble: 110,

            flint_stone: 3,
            wood_coffin: 10,
            titanium_coffin: 5,
        },
        loots: {
            ground_loot: 40
        },
        places: [
            { name: "Sand Antler", position: Vec.create(0.23, 0.2) },
            { name: "Dune Fall", position: Vec.create(0.23, 0.8) },
            { name: "Oasis Dam", position: Vec.create(0.75, 0.2) },
            { name: "Crimson Dunes", position: Vec.create(0.72, 0.8) },
            { name: "Mirage Farms", position: Vec.create(0.5, 0.35) },
            { name: "Shadow Sands", position: Vec.create(0.5, 0.65) }
        ]
    },

    bloody: (() => {
        return {
            width: 512,
            height: 512,
            beachSize: 32,
            oceanSize: 8,
            onGenerate(map, args) {
                const season = args[0];
                let obstacles = {};
                switch (season) {
                    case "normal":
                        obstacles = {
                            oak_tree: 2,
                            small_oak_tree: 20,
                            birch_tree: 4,
                            pine_tree: 2,
                            rock: 30,
                            river_rock: 9,
                        };
                        break;
                    case "fall":
                        obstacles = {
                            oak_tree: 20,
                            small_oak_tree: 10,
                            birch_tree: 5,
                            maple_tree: 10,
                            pine_tree: 6,
                            dormant_oak_tree: 5,
                            stump: 4,
                            hatchet_stump: 1,
                            rock: 6,
                            clearing_boulder: 3,
                            river_rock: 6,
                        };
                        break;
                    case "winter":
                        obstacles = {
                            oak_tree: 15,
                            birch_tree: 15,
                            pine_tree: 20,
                            rock: 15,
                        };
                        break;
                    case "desert":
                        obstacles = {
                            palm_tree: 20,
                            date_palm_tree: 20,
                            small_palm_tree: 10,
                            child_palm_tree: 12,
                            doum_palm_tree: 20,
                            quiver_tree: 12,
                            dry_tree: 20,
                            stump: 8,
                            hatchet_stump: 1,
                            rock: 6,
                            clearing_boulder: 3,
                            river_rock: 4,
                        };
                        break;
                    case "cursedIsland":
                        obstacles = {
                            spooky_oak_tree: 20,
                            mutant_oak_tree: 20,
                            skull_oak_tree: 20,
                            haunted_tree: 10,
                            cursed_tree: 30,
                            stump: 8,
                            hatchet_stump: 1,
                            rock: 44,
                            clearing_boulder: 3,
                            river_rock: 4,
                        };
                        break;
                    default:
                        obstacles = {
                            oak_tree: 2,
                            small_oak_tree: 20,
                            birch_tree: 4,
                            pine_tree: 2,
                            rock: 30,
                            river_rock: 9,
                        };
                }
                for (const [idString, count] of Object.entries(obstacles)) {
                    map._generateObstacles(idString, count as number);
                }
            }
        };
    })(),


    gunsTest: (() => {
        return {
            width: 300,
            height: 300,
            beachSize: 8,
            oceanSize: 8,
            onGenerate(map) {
                let itemPos = Vec.create(0, 20); // Start slightly inset from top-left for better spacing
                const colSpacing = 15;
                const rowSpacing = 20;
                const maxX = map.width - 20; // Leave margin on right

                const placeItem = (item: any, isGun = false) => {
                    map.game.addLoot(item, itemPos, 0, { count: 1, pushVel: 0, jitterSpawn: false });
                    if (isGun) {
                        map.game.addLoot(item.ammoType, itemPos, 0, { count: Infinity });
                    }

                    if (itemPos.x > maxX) {
                        itemPos.x = 0;
                        itemPos.y += rowSpacing;
                    }
                    itemPos.x += colSpacing;
                };

                // Place guns
                for (const item of Guns.definitions) {
                    placeItem(item, true);
                }


                // Place melees
                for (const item of Melees.definitions) {
                    placeItem(item);
                }

                // Place scopes
                for (const item of Scopes.definitions) {
                    placeItem(item);
                }

                for (const vehicle of Vehicles.definitions) {
                    map.game.objectSpawner.addVehicle(vehicle, Vec.create(itemPos.x, itemPos.y));
                    if ((itemPos.x * 2) > maxX) {
                        itemPos.x = 0;
                        itemPos.y += rowSpacing;
                    }
                    itemPos.x += colSpacing * 3;
                }

                itemPos.y += rowSpacing;
                for (let i = 0; i < 10; i++) {
                    itemPos.x += colSpacing;
                    map.game.objectSpawner.addObstacle(Obstacles.fromString('regular_crate'), Vec.create(itemPos.x + 30, itemPos.y));
                }

                // itemPos.x = 0;
                // itemPos.y += rowSpacing;
                // map.game.objectSpawner.addObstacle(Obstacles.fromString('regular_crate'), Vec.create(itemPos.x + 30, itemPos.y));
            }
        };
    })(),

} satisfies Record<string, MapDefinition>;

export type MapName = keyof typeof maps;
export const Maps: Record<MapName, MapDefinition> = maps;

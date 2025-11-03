import { ZIndexes } from "../constants";
import { type Variation } from "../typings";
import { CircleHitbox } from "../utils/hitbox";
import { type EaseFunctions } from "../utils/math";
import { ObjectDefinitions, type ObjectDefinition, type ReferenceTo } from "../utils/objectDefinitions";
import { Vec, type Vector } from "../utils/vector";
import { type ScopeDefinition } from "./scopes";


export type VehicleDefinition = ObjectDefinition & {
   
};


export const Vehicles = ObjectDefinitions.withDefault<VehicleDefinition>()(
    "Vehicles",
    {

    },
    () => [
        {
            idString: "buggy",
            name: "Buggy"
        }
    ]
);

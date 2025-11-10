import { ZIndexes } from "../constants";
import { ObjectDefinitions, type ObjectDefinition } from "../utils/objectDefinitions";
import { RotationMode } from "./obstacles";  // Reuse from obstacles, as vehicles rotate like them

export interface VehicleDefinition extends ObjectDefinition {
    readonly image: string;
    readonly scale: number;  // For resize—e.g., 1.0 default, 0.5 for smaller
    /**
     * @default {RotationMode.Limited}
     */
    readonly rotationMode: RotationMode;
    readonly zIndex?: ZIndexes;  // Optional layer override
}

export const Vehicles = ObjectDefinitions.withDefault<VehicleDefinition>()(
    "Vehicles",
    {
        scale: 1,  // Default size
        rotationMode: RotationMode.Limited  // Vehicles rotate in 90° steps initially
    },
    () => [
        {
            name: "Buggy",
            // Add more props if needed, e.g., scale: 1.2 for bigger buggy
        }
        // Add more vehicles here later, e.g., { name: "Truck", scale: 1.5 }
    ].map(def => {
        const idString = def.name.toLowerCase().replace(/ /g, "_");

        return {
            idString,
            image: `${idString}`,  // Frame ID for sprite loader (matches your SVG path)
            ...def
        };
    })
);
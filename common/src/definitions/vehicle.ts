import { ZIndexes } from "../constants";
import { Hitbox, RectangleHitbox } from "../utils/hitbox";
import { ObjectDefinitions, type ObjectDefinition } from "../utils/objectDefinitions";
import { RotationMode } from "./obstacles";  // Reuse from obstacles, as vehicles rotate like them

export interface VehicleDefinition extends ObjectDefinition {
    readonly image: string;
    readonly scale: number;  // For resize—e.g., 1.0 default, 0.5 for smaller
    /**
     * @default {RotationMode.Limited}
     */
    readonly rotationMode: RotationMode;
    readonly zIndex?: ZIndexes;
    readonly hitbox: Hitbox;
}

export const Vehicles = ObjectDefinitions.withDefault<VehicleDefinition>()(
    "Vehicles",
    {
        scale: 1,  // Default size
        rotationMode: RotationMode.Limited,
        hitbox: RectangleHitbox.fromRect(9.2, 15),
    },
    () => [
        {
            name: "Buggy",
            hitbox: RectangleHitbox.fromRect(9.2, 15),
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
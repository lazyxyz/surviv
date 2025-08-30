import { createTemplate, ObjectDefinitions, type ObjectDefinition } from "../utils/objectDefinitions";

export interface BadgeDefinition extends ObjectDefinition {
    readonly roles?: readonly string[]
}

const badge = createTemplate<BadgeDefinition>()((name: string, roles: string[] = []) => ({
    idString: name.toLowerCase().replace(/ /g, "_"),
    name: name
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" "),
    roles
}));

export const Badges = ObjectDefinitions.create<BadgeDefinition>("Badges", [
    badge(["surviv_card", ["Genesis Survivor"]]),
    badge(["surviv_s1_gold", ["Survivor S1 Gold"]]),
    badge(["surviv_s1_silver", ["Survivor S1 Silver"]]),
    badge(["somnia_s1", ["Somnia S1"]]),
]);



import { createTemplate, ObjectDefinitions, type ObjectDefinition } from "../utils/objectDefinitions";

export interface BadgeDefinition extends ObjectDefinition {
    readonly roles?: readonly string[]
}

const badge = createTemplate<BadgeDefinition>()((name: string, roles: string[] = []) => ({
    idString: `${name.toLowerCase().replace(/ /g, "_")}`,
    name,
    roles
}));

export const Badges = ObjectDefinitions.create<BadgeDefinition>("Badges", [
    badge(["Cards"])
]);

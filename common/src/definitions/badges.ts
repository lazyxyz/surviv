import { createTemplate, ObjectDefinitions, type ObjectDefinition } from "../utils/objectDefinitions";

export interface BadgeDefinition extends ObjectDefinition {
    readonly roles?: readonly string[]
}

const badge = createTemplate<BadgeDefinition>()((name: string, roles: string[] = []) => ({
    idString: `bdg_${name.toLowerCase().replace(/ /g, "_")}`,
    name,
    roles
}));

export const freeBadges: string[] = [];

export const Badges = ObjectDefinitions.create<BadgeDefinition>("Badges", [
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    ...[...Array(100)].map((_, index) => badge([`Khan’s American Steed ${index}`]))
]);

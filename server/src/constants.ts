export const KNOCK_BACK_AMOUNT = 0.6; // knockback distance when bullet/explosion hit bot 

export const materialMultipliers = {
  tree: 0.5,         // Soft wood, absorbs impact
  stone: 1.8,        // Hard, high damage
  bush: 0,         // Very soft, minimal damage
  crate: 0.3,        // Wooden crate, moderate
  metal_light: 1.2,  // Light metal, some damage
  metal_heavy: 2.0,  // Heavy metal, maximum damage
  wood: 0.7,         // Similar to crate
  pumpkin: 0.4,      // Soft vegetable, low damage
  glass: 1.0,        // Brittle, standard damage
  porcelain: 0.7,    // Fragile ceramic, slightly more
  cardboard: 0.4,    // Very soft, low
  appliance: 1.3,    // Metal/plastic mix, moderate-high
  sand: 0.6,         // Soft, absorbing
  fence: 0.8,        // Wire/wood, moderate
  iron: 1.7,         // Hard metal, high
  piano: 1.4,        // Wooden with metal strings, moderate-high
  trash_bag: 0.2,    // Extremely soft, minimal
  ice: 0.9           // Slippery but breakable, standard
} as const;
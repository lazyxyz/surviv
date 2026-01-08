export const KNOCK_BACK_AMOUNT = 0.6; // knockback distance when bullet/explosion hit bot 

export const materialMultipliers = {
  tree: 0.5,         // Soft wood, absorbs impact
  stone: 1,        // Hard, high damage
  bush: 0,         // Very soft, minimal damage
  crate: 0,        // Wooden crate, moderate
  metal_light: 1.2,  // Light metal, some damage
  metal_heavy: 1.5,  // Heavy metal, maximum damage
  wood: 0.7,         // Similar to crate
  pumpkin: 0,      // Soft vegetable, low damage
  glass: 0,        // Brittle, standard damage
  porcelain: 0,    // Fragile ceramic, slightly more
  cardboard: 0,    // Very soft, low
  appliance: 1.3,    // Metal/plastic mix, moderate-high
  sand: 0,         // Soft, absorbing
  fence: 0.2,        // Wire/wood, moderate
  iron: 1.3,         // Hard metal, high
  piano: 0.8,        // Wooden with metal strings, moderate-high
  trash_bag: 0,    // Extremely soft, minimal
  ice: 0.9           // Slippery but breakable, standard
} as const;

export const BLOODY_WEAPONS = [
  "fists", "gas_can", "baseball_bat", "crowbar", "feral_claws", "hatchet",
  "ice_pick", "kbar", "sickle", "fire_hatchet", "seax",
  "pan", "falchion", "steelfang", "maul",
  "heap_sword", "chainsaw"
]

export const SUBLEVELS_PER_WEAPON = [
  1, 1, 1, 1, 1,  // First 5 upgrades: 1 kill each (blitz to Hatchet)
  2, 2, 2, 2, 2,  // Next 5: 2 kills each (+1 more needed)
  4, 4, 4, 4,     // Next 4: 3 kills each (then 2 more)
  8, 8            // Last 2 unlocks: jump to 5 kills each
];

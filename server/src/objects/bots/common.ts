export function calculateLevelStat(base: number, percentage: number, level: number): number {
    const multiplier = Math.pow(1 + percentage, level - 1);
    return base * multiplier;
}

export const SPEED_LEVEL_MULT = 0.04; // bot increase 4% stats each level 
export const APS_LEVEL_MULT = 0.04; // bot increase 4% stats each level 
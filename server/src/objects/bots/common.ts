export function calculateLevelStat(base: number, percentage: number, level: number): number {
    const multiplier = Math.pow(1 + percentage, level - 1);
    return base * multiplier;
}
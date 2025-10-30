import { GasState } from "@common/constants";

export interface GasStage {
    readonly state: GasState
    readonly duration: number
    readonly oldRadius: number
    readonly newRadius: number
    readonly dps: number
    readonly summonAirdrop?: boolean
}

// // TESTING
// export const GasStages: GasStage[] = [
//     {
//         state: GasState.Inactive,
//         duration: 0,
//         oldRadius: 0.762,
//         newRadius: 0.762,
//         dps: 0,
//         summonAirdrop: true
//     },
//     // Round 1
//     {
//         state: GasState.Waiting,
//         duration: 60,
//         oldRadius: 0.762,
//         newRadius: 0.68,
//         dps: 0,
//         summonAirdrop: true
//     },
//     {
//         state: GasState.Advancing,
//         duration: 3,
//         oldRadius: 0.762,
//         newRadius: 0.68,
//         dps: 0
//     },
//     // Round 2
//     {
//         state: GasState.Waiting,
//         duration: 3,
//         oldRadius: 0.68,
//         newRadius: 0.55,
//         dps: 0
//     },
//     {
//         state: GasState.Advancing,
//         duration: 10,
//         oldRadius: 0.68,
//         newRadius: 0.55,
//         dps: 0
//     },
//     // Round 3
//     {
//         state: GasState.Waiting,
//         duration: 3,
//         oldRadius: 0.55,
//         newRadius: 0.42,
//         dps: 0,
//         summonAirdrop: true
//     },
//     {
//         state: GasState.Advancing,
//         duration: 5,
//         oldRadius: 0.55,
//         newRadius: 0.42,
//         dps: 0
//     },
//     // Round 4
//     {
//         state: GasState.Waiting,
//         duration: 5,
//         oldRadius: 0.42,
//         newRadius: 0.2,
//         dps: 0
//     },
//     {
//         state: GasState.Advancing,
//         duration: 5,
//         oldRadius: 0.42,
//         newRadius: 0.2,
//         dps: 0
//     },
//     // Round 5
//     {
//         state: GasState.Waiting,
//         duration: 5,
//         oldRadius: 0.2,
//         newRadius: 0.07,
//         dps: 0
//     },
//     {
//         state: GasState.Advancing,
//         duration: 5,
//         oldRadius: 0.2,
//         newRadius: 0.07,
//         dps: 0
//     },
//     // End
//     {
//         state: GasState.Final,
//         duration: 0,
//         oldRadius: 0,
//         newRadius: 0,
//         dps: 0
//     },
// ];

export const GasStages: GasStage[] = [
    {
        state: GasState.Inactive,
        duration: 0,
        oldRadius: 0.762,
        newRadius: 0.762,
        dps: 0,
        summonAirdrop: true
    },
    // Round 1
    {
        state: GasState.Waiting,
        duration: 35,
        oldRadius: 0.762,
        newRadius: 0.68,
        dps: 0,
        summonAirdrop: true
    },
    {
        state: GasState.Advancing,
        duration: 12,
        oldRadius: 0.762,
        newRadius: 0.68,
        dps: 1
    },
    // Round 2
    {
        state: GasState.Waiting,
        duration: 30,
        oldRadius: 0.68,
        newRadius: 0.55,
        dps: 1
    },
    {
        state: GasState.Advancing,
        duration: 10,
        oldRadius: 0.68,
        newRadius: 0.55,
        dps: 1.5
    },
    // Round 3
    {
        state: GasState.Waiting,
        duration: 30,
        oldRadius: 0.55,
        newRadius: 0.42,
        dps: 2,
        summonAirdrop: true
    },
    {
        state: GasState.Advancing,
        duration: 10,
        oldRadius: 0.55,
        newRadius: 0.42,
        dps: 2.5
    },
    // Round 4
    {
        state: GasState.Waiting,
        duration: 30,
        oldRadius: 0.42,
        newRadius: 0.3,
        dps: 3
    },
    {
        state: GasState.Advancing,
        duration: 10,
        oldRadius: 0.42,
        newRadius: 0.3,
        dps: 3.5
    },
    // Round 5
    {
        state: GasState.Waiting,
        duration: 25,
        oldRadius: 0.3,
        newRadius: 0.2,
        dps: 4,
        summonAirdrop: true
    },
    {
        state: GasState.Advancing,
        duration: 8,
        oldRadius: 0.3,
        newRadius: 0.2,
        dps: 5
    },
    // Round 6
    {
        state: GasState.Waiting,
        duration: 25,
        oldRadius: 0.2,
        newRadius: 0.12,
        dps: 6
    },
    {
        state: GasState.Advancing,
        duration: 7,
        oldRadius: 0.2,
        newRadius: 0.12,
        dps: 7
    },
    // Round 7
    {
        state: GasState.Waiting,
        duration: 20,
        oldRadius: 0.12,
        newRadius: 0.07,
        dps: 8,
        summonAirdrop: true
    },
    {
        state: GasState.Advancing,
        duration: 6,
        oldRadius: 0.12,
        newRadius: 0.07,
        dps: 9.5
    },
    // Round 8
    {
        state: GasState.Waiting,
        duration: 18,
        oldRadius: 0.07,
        newRadius: 0.035,
        dps: 11
    },
    {
        state: GasState.Advancing,
        duration: 6,
        oldRadius: 0.07,
        newRadius: 0.035,
        dps: 13
    },
    // Round 9 
    {
        state: GasState.Waiting,
        duration: 5,
        oldRadius: 0.035,
        newRadius: 0.035,
        dps: 14
    },
    {
        state: GasState.Advancing,
        duration: 5,
        oldRadius: 0.035,
        newRadius: 0.035,
        dps: 15
    },
    // Round 10 (final)
    {
        state: GasState.Final,
        duration: 0,
        oldRadius: 0,
        newRadius: 0,
        dps: 15
    },
];

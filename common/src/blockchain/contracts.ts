export enum Blockchain {
    Shannon = "Shannon Testnet",
    Somnia = "Somnia Mainnet",
    Minato = "Minato Testnet",
    Soneium = "Soneium Mainnet"
}

export type SurvivContractName = keyof typeof chainToAssetsMapping[Blockchain.Shannon];

export const chainToAssetsMapping = {
    [Blockchain.Shannon]: {
        SurvivRewards: "0x9e8557ABb6D9E27d565AA3029F4a54a25716f474",
        SurvivBase: "0x1B6E62dF1bfB09F2aa641131D012c18DE34BDdc4",
        SurvivShop: "0x629E2c8F1d159BbF228cEFDD970150A81AD60765",
        SurvivShopV2: "0xddD63965B6003543e1ca8b0f919DdB06bA3aD8B9",
        NativeToken: "0x0000000000000000000000000000000000000000",
    },
    [Blockchain.Somnia]: {
        SurvivRewards: "0x0000000000000000000000000000000000000000", // Replace with actual
        SurvivBase: "0x0000000000000000000000000000000000000000", // Replace with actual
        SurvivShop: "0x0000000000000000000000000000000000000000", // Replace with actual
        SurvivShopV2: "0x0000000000000000000000000000000000000000", // Replace with actual
        NativeToken: "0x0000000000000000000000000000000000000000", // Replace with actual
    },
    [Blockchain.Minato]: {
        SurvivRewards: "0x0000000000000000000000000000000000000000", // Replace with actual
        SurvivBase: "0x0000000000000000000000000000000000000000", // Replace with actual
        SurvivShop: "0x0000000000000000000000000000000000000000", // Replace with actual
        SurvivShopV2: "0x0000000000000000000000000000000000000000", // Replace with actual
        NativeToken: "0x0000000000000000000000000000000000000000", // Replace with actual
    },
    [Blockchain.Soneium]: {
        SurvivRewards: "0x0000000000000000000000000000000000000000", // Replace with actual
        SurvivBase: "0x0000000000000000000000000000000000000000", // Replace with actual
        SurvivShop: "0x0000000000000000000000000000000000000000", // Replace with actual
        SurvivShopV2: "0x0000000000000000000000000000000000000000", // Replace with actual
        NativeToken: "0x0000000000000000000000000000000000000000", // Replace with actual
    },
} as const;

export function getSurvivAddress(
    chain: Blockchain,
    name: SurvivContractName
): string {
    return chainToAssetsMapping[chain][name];
}

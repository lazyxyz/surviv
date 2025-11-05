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
        SurvivAssets: "0x7b46D28d5d439B4DcEe76cdE459Fe712429D8EF9",
        SurvivBadges: "0x0bbF184FA70BB7E1900323BE5E31D0Ff76B094e0",
        SurvivKits: "0x95E3539ecED81E7293d80E2eA41c91257dC61b10",
    },
    [Blockchain.Somnia]: {
        SurvivAssets: "",
        SurvivBadges: "",
        SurvivKits: "",
        SurvivRewards: "0x0000000000000000000000000000000000000000", // Replace with actual
        SurvivBase: "0x0000000000000000000000000000000000000000", // Replace with actual
        SurvivShop: "0x0000000000000000000000000000000000000000", // Replace with actual
        SurvivShopV2: "0x0000000000000000000000000000000000000000", // Replace with actual
        NativeToken: "0x0000000000000000000000000000000000000000", // Replace with actual

    },
    [Blockchain.Minato]: {
        SurvivAssets: "",
        SurvivBadges: "",
        SurvivKits: "",
        SurvivRewards: "0x0000000000000000000000000000000000000000", // Replace with actual
        SurvivBase: "0x0000000000000000000000000000000000000000", // Replace with actual
        SurvivShop: "0x0000000000000000000000000000000000000000", // Replace with actual
        SurvivShopV2: "0x0000000000000000000000000000000000000000", // Replace with actual
        NativeToken: "0x0000000000000000000000000000000000000000", // Replace with actual
    },
    [Blockchain.Soneium]: {
        SurvivAssets: "",
        SurvivBadges: "",
        SurvivKits: "",
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

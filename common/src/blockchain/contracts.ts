export enum Blockchain {
    Shannon = "Shannon Testnet",
    Somnia = "Somnia Mainnet",
    Minato = "Minato Testnet",
    Soneium = "Soneium Mainnet"
}

// Number → Enum
export const blockchainByNumber: Record<number, Blockchain> = {
  0: Blockchain.Shannon,
  1: Blockchain.Somnia,
  2: Blockchain.Minato,
  3: Blockchain.Soneium
};

// Enum → Number
export const numberByBlockchain: Record<Blockchain, number> = {
  [Blockchain.Shannon]: 0,
  [Blockchain.Somnia]: 1,
  [Blockchain.Minato]: 2,
  [Blockchain.Soneium]: 3
};

export type SurvivContractName = keyof typeof chainToAssetsMapping[Blockchain.Shannon];

export const chainToAssetsMapping = {
    [Blockchain.Shannon]: {
        SurvivRewards: "0x9e8557ABb6D9E27d565AA3029F4a54a25716f474",
        SurvivBase: "0x1B6E62dF1bfB09F2aa641131D012c18DE34BDdc4",
        SurvivShop: "0x629E2c8F1d159BbF228cEFDD970150A81AD60765",
        SurvivShopV2: "",
        SurvivAssets: "0x7b46D28d5d439B4DcEe76cdE459Fe712429D8EF9",
        SurvivBadges: "0x0bbF184FA70BB7E1900323BE5E31D0Ff76B094e0",
        SurvivKits: "0x95E3539ecED81E7293d80E2eA41c91257dC61b10",
    },
    [Blockchain.Minato]: {
        SurvivAssets: "0x55593e1c10736268D8dfDF4a3fE035C9E8214EA0",
        SurvivBadges: "0x07A86ca631836A950f51343C71E01ECCe8fa311B",
        SurvivKits: "0xAE4357b774E3cB87AEc75cbbc5bD2e5C513544b1",
        SurvivRewards: "0x2CE90d50B240E9243A9C4DEea46f362F331E7127", 
        SurvivBase: "0x102143C4A493f99117179008C9De79Ae85C010be", 
        SurvivShop: "0x220204B77B9461301F8278448Bea3EbaBa2E0B71", 
        SurvivShopV2: "", 
    },
    [Blockchain.Somnia]: {
        SurvivAssets: "0x32d2FbF76E0B43A77C92429433a5BfB9b5addCd4",
        SurvivBadges: "0x0a65a380A5fc7E623F997ad81c4393C825F6329a",
        SurvivKits: "0x460b62aF271A06b101A6f4AaA20f6623cc4B28d7",
        SurvivRewards: "0x50fFa867ad37022fd4f19404A8De1Ce9909b7a53", 
        SurvivBase: "0x9AA9d6b7966F20b60e813D88cb9604E0e943e608", 
        SurvivShop: "", 
        SurvivShopV2: "0x680179f4cc4f6B727d8a4A14F082ebe40642Fda9",
    },
    [Blockchain.Soneium]: {
        SurvivAssets: "0x32d2FbF76E0B43A77C92429433a5BfB9b5addCd4",
        SurvivBadges: "0x0a65a380A5fc7E623F997ad81c4393C825F6329a",
        SurvivKits: "0x460b62aF271A06b101A6f4AaA20f6623cc4B28d7",
        SurvivRewards: "0x74fD4541Ce9A144e9cA92D75DC71EB103B083a64", 
        SurvivBase: "0xDFb67a8c4Bf0C0b29d269C0d595d6e5B3d6606FE", 
        SurvivShop: "0x9AA9d6b7966F20b60e813D88cb9604E0e943e608", 
        SurvivShopV2: "", 
    },
} as const;

export function getSurvivAddress(
    chain: Blockchain,
    name: SurvivContractName
): string {
    return chainToAssetsMapping[chain][name];
}

import { type TeamSize } from "@common/constants";
import { toBeHex } from "ethers";

export const Config = {
    regions: {
        dev: {
            name: "Local Server",
            mainAddress: "http://127.0.0.1:8000",
            gameAddress: "ws://127.0.0.1:<ID>",
            teamAddress: "ws://127.0.0.1:8000",
            apiAddress: "https://test-api.grindy.io",
            // apiAddress: "http://localhost:3001",
        },
        test: {
            name: "Test",
            mainAddress: "https://as.grindy.io",
            gameAddress: "wss://<ID>.as.grindy.io",
            teamAddress: "wss://team.as.grindy.io",
            apiAddress: "https://test-api.grindy.io",
        },
    },
    defaultRegion: "test",
} satisfies ConfigType as ConfigType;

export const ChainConfig = {
    chainId: toBeHex(50312),
    chainName: "Somnia Testnet",
    rpcUrls: ["https://dream-rpc.somnia.network/"],
    nativeCurrency: {
        name: "Somnia Testnet Token",
        symbol: "STT",
        decimals: 18
    },
    blockExplorerUrls: ["https://shannon-explorer.somnia.network/"],
    blockExplorerAPI: "https://somnia.w3us.site",
} satisfies ChainInfo as ChainInfo;

export interface ConfigType {
    readonly regions: Record<string, Region>
    readonly defaultRegion: string,
}

export interface Region {
    /**
     * The human-readable name of the region, displayed in the server selector.
     */
    readonly name: string

    /**
     * The address of the region's main server.
     */
    readonly mainAddress: string

    /**
     * Pattern used to determine the address of the region's game servers.
     * The string <ID> is replaced by the gameID given by the /getGame API, plus one.
     * For example, if gameID is 0, and gameAddress is "ws://127.0.0.1:800<ID>", the resulting address will be ws://127.0.0.1:8001.
     */
    readonly gameAddress: string

    readonly teamAddress: string

    // public api get game assets
    readonly apiAddress: string
}

export interface ServerInfo {
    readonly protocolVersion: number
    readonly playerCount: number
    readonly maxTeamSize: TeamSize
    readonly nextSwitchTime: number
};

export interface ChainInfo {
    readonly chainId: string
    readonly chainName: string
    readonly rpcUrls: string[]
    readonly nativeCurrency: {
        name: string,
        symbol: string,
        decimals: number,
    }
    readonly blockExplorerUrls: string[],
    readonly blockExplorerAPI: string
}
import { type TeamSize } from "@common/constants";

export const Config = {
    regions: {
        dev: {
            name: "Local Server",
            mainAddress: "http://127.0.0.1:8000",
            gameAddress: "ws://127.0.0.1:<ID>",
            teamAddress: "ws://127.0.0.1:8000",
            apiAddress: "http://127.0.0.1:3001",
        },
        as: {
            name: "Asia",
            mainAddress: "https://as.surviv.fun",
            gameAddress: "wss://<ID>.as.surviv.fun",
            teamAddress: "wss://team.as.surviv.fun",
            apiAddress: "https://api.surviv.fun",
        }
    },
    defaultRegion: "dev"
} satisfies ConfigType as ConfigType;

export interface ConfigType {
    readonly regions: Record<string, Region>
    readonly defaultRegion: string
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

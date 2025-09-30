import { GameConstants, TeamSize } from "@common/constants";
import { type GetGameResponse } from "@common/typings";
import { URLSearchParams } from "node:url";
import { Config } from "../config";
import { findGame, GAMES } from "../gameManager";
import { cors } from "../utils/serverHelpers";
import { TemplatedApp } from "uWebSockets.js";
import { CUSTOM_TEAMS } from "../server";

export function initGameRoutes(app: TemplatedApp) {
    app
        .get("/api/serverInfo", (res) => {
            cors(res);
            res
                .writeHeader("Content-Type", "application/json")
                .end(JSON.stringify({
                    playerCount: GAMES.reduce((a, b) => a + (b?.aliveCount ?? 0), 0),
                    maxTeamSize: Config.maxTeamSize,
                    protocolVersion: GameConstants.protocolVersion
                }));
        }).get("/api/getGame", async (res, req) => {
            let aborted = false;
            res.onAborted(() => { aborted = true; });
            cors(res);

            const searchParams = new URLSearchParams(req.getQuery());

            let teamSize = Number(searchParams.get("teamSize"));

            if (!teamSize) teamSize = TeamSize.Solo;

            let teamID = new URLSearchParams(req.getQuery()).get("teamID");
           
            let response: GetGameResponse;
            if (teamID) {
                const team = CUSTOM_TEAMS.get(teamID);
                if (team?.gameID !== undefined) {
                    const game = GAMES[team.gameID];
                    
                    // Should allow member join even game started after specific duration
                    response = game && !game.stopped && game.startedTime == -1 ? { success: true, gameID: team.gameID }
                        : { success: false };

                } else {
                    response = await findGame(teamSize);
                }
            } else {
                response = await findGame(teamSize);
            }

            if (!aborted) {
                res.cork(() => {
                    res.writeHeader("Content-Type", "application/json").end(JSON.stringify(response));
                });
            }
        })
}

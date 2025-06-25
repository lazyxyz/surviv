import { GameConstants, TeamSize } from "@common/constants";
import { type GetGameResponse } from "@common/typings";
import { URLSearchParams } from "node:url";
import { Config } from "../config";
import { findGame, games } from "../gameManager";
import { cors, forbidden, getIP } from "../utils/serverHelpers";
import { TemplatedApp } from "uWebSockets.js";
import { customTeams } from "../server";

export function initGameRoutes(app: TemplatedApp) {
    app
        .get("/api/serverInfo", (res) => {
            cors(res);
            res
                .writeHeader("Content-Type", "application/json")
                .end(JSON.stringify({
                    playerCount: games.reduce((a, b) => a + (b?.aliveCount ?? 0), 0),
                    maxTeamSize: Config.maxTeamSize,
                    protocolVersion: GameConstants.protocolVersion
                }));
        }).get("/api/getGame", async (res, req) => {
            let aborted = false;
            res.onAborted(() => { aborted = true; });
            cors(res);

            const ip = getIP(res, req);
            const searchParams = new URLSearchParams(req.getQuery());

            let teamSize = Number(searchParams.get("teamSize"));

            if (!teamSize) teamSize = TeamSize.Solo;

            let teamID;
            if (teamSize != TeamSize.Solo) {
                teamSize = TeamSize.Squad;
                teamID = new URLSearchParams(req.getQuery()).get("teamID"); // must be here or it causes uWS errors
            }

            let response: GetGameResponse;
            if (teamID) {
                const team = customTeams.get(teamID);
                if (team?.gameID !== undefined) {
                    const game = games[team.gameID];
                    response = game && !game.stopped
                        ? { success: true, gameID: team.gameID }
                        : { success: false };
                } else {
                    response = { success: false };
                }
            } else {
                response = await findGame(teamSize);
            }

            if (response.success) {
                await games[response.gameID]?.allowIP(ip);
            }

            if (!aborted) {
                res.cork(() => {
                    res.writeHeader("Content-Type", "application/json").end(JSON.stringify(response));
                });
            }
        })
}

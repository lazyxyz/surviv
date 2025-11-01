import { Layer, MODE } from "@common/constants";
import { CircleHitbox } from "@common/utils/hitbox";
import { Geometry } from "@common/utils/math";
import { MapObjectSpawnMode } from "@common/utils/objectDefinitions";
import { pickRandomInArray, randomPointInsideCircle } from "@common/utils/random";
import { Vec, Vector } from "@common/utils/vector";
import { Config, SpawnMode } from "../config";
import { Game } from "../game";
import { Team } from "../team";
import { PlayerContainer } from "../objects/gamer";
import { type WebSocket } from "uWebSockets.js";

export class SpawnManager {
    private game: Game;

    constructor(game: Game) {
        this.game = game;
    }

    getSpawnPosition(team?: Team): { pos: Vector | undefined, layer: Layer | undefined } {
        let pos: Vector | undefined;
        let layer: Layer | undefined;

        switch (Config.spawn.mode) {
            case SpawnMode.Normal: {
                const hitbox = new CircleHitbox(5);
                const gasPosition = this.game.gas.currentPosition;
                const gasRadius = this.game.gas.newRadius ** 2;
                const teamPosition = this.game.teamMode
                    ? pickRandomInArray(team?.getLivingPlayers() ?? [])?.position
                    : undefined;

                let foundPosition = false;
                for (let tries = 0; !foundPosition && tries < 200; tries++) {
                    const position = this.game.map.getRandomPosition(
                        hitbox,
                        {
                            maxAttempts: 500,
                            spawnMode: MapObjectSpawnMode.GrassAndSand,
                            getPosition: this.game.teamMode && teamPosition
                                ? () => randomPointInsideCircle(teamPosition, 20, 10)
                                : undefined,
                            collides: position => Geometry.distanceSquared(position, gasPosition) >= gasRadius
                        }
                    );

                    // Break if the above code couldn't find a valid position, as it's unlikely that subsequent loops will
                    if (!position) break;
                    else pos = position;

                    // Ensure the position is at least 60 units from other players
                    foundPosition = true;
                    const radiusHitbox = new CircleHitbox(60, pos);
                    for (const object of this.game.grid.intersectsHitbox(radiusHitbox)) {
                        if (
                            object.isPlayer
                            && (!this.game.teamMode || !team?.players.includes(object))
                        ) {
                            foundPosition = false;
                        }
                    }
                }

                if (!foundPosition) {
                    console.warn(`Failed to find spawn position after 200 tries`);
                }

                // Spawn on top of a random teammate if a valid position couldn't be found
                if (!foundPosition && teamPosition) pos = teamPosition;
                break;
            }
            case SpawnMode.Radius: {
                const { x, y } = Config.spawn.position;
                pos = randomPointInsideCircle(
                    Vec.create(x, y),
                    Config.spawn.radius
                );
                break;
            }
            case SpawnMode.Fixed: {
                const { x, y } = Config.spawn.position;
                pos = Vec.create(x, y);
                layer = Config.spawn.layer ?? Layer.Ground;
                break;
            }
            case SpawnMode.Center: {
                // no-op; this is the default
                break;
            }
        }

        return { pos, layer };
    }

    getTeam(socket: WebSocket<PlayerContainer>): Team | undefined {
        let team: Team | undefined;
        if (this.game.teamMode) {
            const { teamID, autoFill, roomMode } = socket.getUserData();

            if (this.game.gameMode == MODE.Dungeon) {
                const vacantTeams = this.game.teams.valueArray.filter(
                    team => team.players.length < (this.game.gameMode as number)
                        && team.hasLivingPlayers()
                );
                
                if (vacantTeams.length > 0) {
                    team = vacantTeams[0];
                } else {
                    this.game.teams.add(team = new Team(this.game.nextTeamID));
                }

                console.log("TEAM: ", team.id);
            } else if (teamID && !roomMode) {
                team = this.game.teamsMapping.get(teamID);
                if (
                    !team // team doesn't exist
                    || (team.players.length && !team.hasLivingPlayers()) // team isn't empty but has no living players
                    || team.players.length >= (this.game.gameMode as number) // team is full
                ) {
                    this.game.teams.add(team = new Team(this.game.nextTeamID, autoFill));
                    this.game.teamsMapping.set(teamID, team);
                }
            } else {
                const vacantTeams = this.game.teams.valueArray.filter(
                    team =>
                        team.autoFill
                        && team.players.length < (this.game.gameMode as number)
                        && team.hasLivingPlayers()
                );
                if (vacantTeams.length > 1) {
                    let minSize = Infinity;
                    for (const team of vacantTeams) {
                        if (team.players.length < minSize) {
                            minSize = team.players.length;
                        }
                    }
                    const smallestTeams = vacantTeams.filter(team => team.players.length === minSize);
                    team = pickRandomInArray(smallestTeams);
                } else {
                    this.game.teams.add(team = new Team(this.game.nextTeamID));
                }
            }
        }
        return team;
    }
}
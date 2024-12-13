import { type WebSocket } from "uWebSockets.js";
import { Layer, SpectateActions } from "@common/constants";
import { Vector } from "@common/utils/vector";
import { Game } from "../game";
import { Team } from "../team";
import { Actor, PlayerContainer } from "./actor";


export class Bot extends Actor {
    constructor(game: Game, userData: PlayerContainer, position: Vector,
        layer?: Layer, team?: Team) {
        super(game, userData, position, layer, team);
    }

}

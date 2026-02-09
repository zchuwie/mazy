import { validHallwayPosition, spawnRandomOrb } from "./helper.js";
import { Orb } from "./components/orb.js";
import {
    HEIGHT,
    TILEW,
    TILEH,
    OFFSETY
} from "./interface.js";

export const renderOrbSpawn = (p, map) => {
    const hallwayPositions = validHallwayPosition(map, TILEW, TILEH, OFFSETY);
    let orbs = [];
    const orbTypes = ["speed", "damage", "health", "rapid", "slow"];

    for (let i = 0; i < 5; i++) {
        spawnRandomOrb(hallwayPositions, orbTypes, orbs, p, Orb);
    }
    
    return orbs;
}
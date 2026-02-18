import { validHallwayPosition, spawnRandomOrb } from "./helper.js";
import { Orb } from "./components/orb.js";
import { HEIGHT, TILEW, TILEH, OFFSETY } from "./interface.js";

export const renderOrbSpawn = (p, map, orbTypes) => {
  const hallwayPositions = validHallwayPosition(map, TILEW, TILEH, OFFSETY);
  let orbs = [];

  for (let i = 0; i < 8; i++) {
    spawnRandomOrb(hallwayPositions, orbTypes, orbs, p, Orb);
  }

  return orbs;
};

import * as THREE from "three";

import { getSceneData } from "@/data/scene-data";

/**
 * Live world position of every planet, keyed by project id.
 *
 * `Planets` writes here once per frame; `Connections` reads it to hang energy
 * beams on moving endpoints. A plain module map keeps the two systems
 * decoupled — connections never reach into the planet's scene graph, and
 * planets never know beams exist. Positions start far off-screen and are
 * filled on the very first frame (planets subscribe before connections do),
 * so a beam can never flash from the origin.
 *
 * The map is rebuilt by `syncPlanetRegistry()` whenever the active scene
 * changes (universe swap): ids from the previous scene are dropped, new ids
 * are seeded off-screen. Writes upsert, so a frame that races a swap can
 * never throw on a missing key.
 */
const PLANET_POSITIONS = new Map<string, THREE.Vector3>();

const OFFSCREEN = () => new THREE.Vector3(0, 0, -10_000);

/** Seed every id of the active scene off-screen (called on scene swap). */
export function syncPlanetRegistry(): void {
  PLANET_POSITIONS.clear();
  for (const project of getSceneData().projects) {
    PLANET_POSITIONS.set(project.id, OFFSCREEN());
  }
}

export function readPlanetPosition(id: string): THREE.Vector3 | undefined {
  return PLANET_POSITIONS.get(id);
}

export function writePlanetPosition(id: string, position: THREE.Vector3): void {
  const existing = PLANET_POSITIONS.get(id);
  if (existing) existing.copy(position);
  else PLANET_POSITIONS.set(id, position.clone());
}

/* Seed the stock graph at module init so the default path behaves exactly
 * as the pre-workspace build did before any swap ever happens. */
syncPlanetRegistry();

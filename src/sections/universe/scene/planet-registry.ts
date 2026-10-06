import * as THREE from "three";

import { PROJECTS } from "@/data";

/**
 * Live world position of every planet, keyed by project id.
 *
 * `Planets` writes here once per frame; `Connections` reads it to hang energy
 * beams on moving endpoints. A plain module map keeps the two systems
 * decoupled — connections never reach into the planet's scene graph, and
 * planets never know beams exist. Positions start far off-screen and are
 * filled on the very first frame (planets subscribe before connections do),
 * so a beam can never flash from the origin.
 */
const PLANET_POSITIONS = new Map<string, THREE.Vector3>(
  PROJECTS.map((project) => [project.id, new THREE.Vector3(0, 0, -10_000)]),
);

export function readPlanetPosition(id: string): THREE.Vector3 | undefined {
  return PLANET_POSITIONS.get(id);
}

export function writePlanetPosition(id: string, position: THREE.Vector3): void {
  PLANET_POSITIONS.get(id)?.copy(position);
}

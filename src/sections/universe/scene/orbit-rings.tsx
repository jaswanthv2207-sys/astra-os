"use client";

import * as React from "react";
import * as THREE from "three";

import { ORBIT_CENTRES, type Project } from "@/data";
import { useSceneData, useSceneProjects } from "@/hooks/use-scene-data";
import { useTimeline } from "@/hooks/use-timeline";

import { timelineEngaged } from "../timeline";

/* ────────────────────────────────────────────────────────────────────────── *
 * OrbitRings — the visible ellipses the worlds travel.
 *
 * Two audiences, one geometry:
 *
 *   - generated universes draw their paths at rest (`SceneAmbient.
 *     showOrbitRings` — the contract has always promised rings for themed
 *     scenes, using the ambient orbit colour);
 *   - stock scenes keep their paths invisible at rest (byte-for-byte
 *     untouched), but light them up while the knowledge timeline travels,
 *     giving the orbit milestone markers a path to sit on.
 *
 * One unit-circle geometry is shared by every ring (radius via group scale),
 * drawn as 128-segment `LineLoop`s with additive blending so they read as
 * hairline light rather than geometry, and fogged like everything else.
 * The opacity step at engage/disengage lands under the timeline's warp
 * veil, so it never pops.
 * ────────────────────────────────────────────────────────────────────────── */

/** Segments per ring — a smooth circle at any camera distance. */
const SEGMENTS = 128;
/** Resting opacity for themed scenes' paths. */
const REST_OPACITY = 0.18;
/** Lifted while the timeline is travelling (all scenes). */
const ENGAGED_OPACITY = 0.32;

interface RingSpec {
  key: string;
  centre: readonly [number, number, number];
  plane: [number, number, number];
  radius: number;
}

export function OrbitRings() {
  const scene = useSceneData();
  const projects = useSceneProjects();
  const { date, now } = useTimeline();

  /* Shared unit circle — scaled per ring by its radius. */
  const circle = React.useMemo(() => {
    const positions = new Float32Array(SEGMENTS * 3);
    for (let i = 0; i < SEGMENTS; i++) {
      const angle = (i / SEGMENTS) * Math.PI * 2;
      positions[i * 3] = Math.cos(angle);
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = Math.sin(angle);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, []);
  React.useEffect(() => () => circle.dispose(), [circle]);

  const rings = React.useMemo<RingSpec[]>(
    () =>
      projects.map((project: Project) => ({
        key: project.id,
        centre:
          scene.centres[project.orbit.centre] ??
          ORBIT_CENTRES[project.orbit.centre],
        plane: project.orbit.plane,
        radius: project.orbit.radius,
      })),
    [projects, scene.centres],
  );

  const themed = scene.ambient?.showOrbitRings ?? false;
  const engaged = timelineEngaged(date, now);
  if (!themed && !engaged) return null;
  if (rings.length === 0) return null;

  const ringColor = scene.ambient?.orbitRingColor ?? "rgb(255 255 255)";
  const opacity = engaged ? ENGAGED_OPACITY : REST_OPACITY;

  return (
    <group>
      {rings.map((ring) => (
        <group
          key={ring.key}
          position={[ring.centre[0], ring.centre[1], ring.centre[2]]}
          rotation={ring.plane}
        >
          <lineLoop
            geometry={circle}
            scale={[ring.radius, 1, ring.radius]}
            frustumCulled={false}
          >
            <lineBasicMaterial
              color={ringColor}
              transparent
              opacity={opacity}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </lineLoop>
        </group>
      ))}
    </group>
  );
}

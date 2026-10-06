"use client";

import * as React from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { ORBIT_CENTRES, PROJECTS } from "@/data";

/* ────────────────────────────────────────────────────────────────────────── *
 * AsteroidBelts — three slow rock rings, one beyond each invisible system
 * centre, giving the void its slowest layer of life.
 *
 * Each belt is a single InstancedMesh (~260 low-poly icosahedra, tinted
 * per-rock around a cold slate-violet) tilted onto the orbital plane of
 * that system's outermost world and pushed past every planet's reach
 * (outermost orbit + radius + 3–5 units), so it can never crowd a planet
 * or another system. The whole ring then rotates as ONE rigid body —
 * orbit motion costs a single `rotation.y` increment per frame instead of
 * hundreds of matrix writes, which is what keeps this free.
 *
 * Placement, tilt and speed are derived from `@/data` at module init, so
 * the belts stay correct if worlds are ever re-tuned. Reduced motion
 * freezes each ring on a deterministic starting angle.
 * ────────────────────────────────────────────────────────────────────────── */

/** Rock counts and speeds per centre — one entry per ORBIT_CENTRES slot. */
const RING_SPEEDS = [0.034, -0.028, 0.04];
const ROCKS_PER_RING = 260;

interface BeltSpec {
  position: [number, number, number];
  /** Euler tilt — the plane of the system's outermost world. */
  plane: [number, number, number];
  inner: number;
  outer: number;
  speed: number;
  count: number;
  seed: number;
}

function buildBeltSpecs(): BeltSpec[] {
  return ORBIT_CENTRES.map((centre, index) => {
    const worlds = PROJECTS.filter((project) => project.orbit.centre === index);
    const lead = worlds.reduce((outer, world) =>
      world.orbit.radius >= outer.orbit.radius ? world : outer,
    );
    const reach = Math.max(
      ...worlds.map((world) => world.orbit.radius + world.planet.radius),
    );
    return {
      position: [centre[0], centre[1], centre[2]],
      plane: [...lead.orbit.plane],
      inner: reach + 3,
      outer: reach + 5,
      speed: RING_SPEEDS[index % RING_SPEEDS.length],
      count: ROCKS_PER_RING,
      seed: index * 17.7 + 3.1,
    };
  });
}

const BELT_SPECS = buildBeltSpecs();

/** Deterministic PRNG — belts look identical on every visit and capture. */
function rng(seed: number) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function BeltRing({ spec, reduced }: { spec: BeltSpec; reduced: boolean }) {
  const mesh = React.useRef<THREE.InstancedMesh>(null);
  const geometry = React.useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const material = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#9aa3c7",
        roughness: 1,
        metalness: 0.04,
        flatShading: true,
      }),
    [],
  );

  React.useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  React.useLayoutEffect(() => {
    const instance = mesh.current;
    if (!instance) return;
    const random = rng(spec.seed);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < spec.count; i++) {
      const roll = random();
      const radius =
        spec.inner + Math.pow(random(), 0.8) * (spec.outer - spec.inner);
      const theta = random() * Math.PI * 2;
      dummy.position.set(
        Math.cos(theta) * radius,
        (random() - 0.5) * 0.9,
        Math.sin(theta) * radius,
      );
      dummy.rotation.set(
        random() * Math.PI,
        random() * Math.PI,
        random() * Math.PI,
      );
      // Skewed small so most rocks are dust with a few readable boulders.
      dummy.scale.setScalar(0.12 + Math.pow(roll, 1.7) * 0.3);
      dummy.updateMatrix();
      instance.setMatrixAt(i, dummy.matrix);
      color.setHSL(
        0.63 + random() * 0.1,
        0.14 + random() * 0.12,
        0.4 + random() * 0.3,
      );
      instance.setColorAt(i, color);
    }
    instance.instanceMatrix.needsUpdate = true;
    if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
    // Deterministic starting pose (and the frozen pose under reduced motion).
    instance.rotation.y = spec.seed;
  }, [spec]);

  useFrame((_, delta) => {
    const instance = mesh.current;
    if (!instance || reduced) return;
    instance.rotation.y += Math.min(delta, 0.1) * spec.speed;
  });

  return (
    <group position={spec.position} rotation={spec.plane}>
      <instancedMesh
        ref={mesh}
        args={[geometry, material, spec.count]}
        frustumCulled={false}
        aria-hidden="true"
      />
    </group>
  );
}

export interface AsteroidBeltsProps {
  reduced?: boolean;
}

export function AsteroidBelts({ reduced = false }: AsteroidBeltsProps) {
  return (
    <>
      {BELT_SPECS.map((spec) => (
        <BeltRing
          key={`${spec.position[0]},${spec.position[2]}`}
          spec={spec}
          reduced={reduced}
        />
      ))}
    </>
  );
}

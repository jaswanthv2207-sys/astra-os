"use client";

import * as React from "react";
import { useFrame, useThree, invalidate } from "@react-three/fiber";
import * as THREE from "three";

/* ────────────────────────────────────────────────────────────────────────── *
 * ShootingStars — rare meteors with particle trails.
 *
 * Six meteors share one draw call. Each trail is 34 points sampled along the
 * meteor's past trajectory (straight flight with a gentle gravity droop), so
 * the head glows hot while the tail dissolves. CPU work per frame is one
 * buffer sync of 204 points; spawn/respawn timing is jittered so meteors
 * arrive unpredictably, one at a time, never as a shower — quiet sky, rare
 * punctuation.
 * ────────────────────────────────────────────────────────────────────────── */

const METEORS = 6;
const TRAIL = 34;
const POINTS = METEORS * TRAIL;

interface Meteor {
  active: boolean;
  /** Spawn origin. */
  ox: number;
  oy: number;
  oz: number;
  /** Unit direction of travel. */
  dx: number;
  dy: number;
  dz: number;
  speed: number;
  age: number;
  life: number;
  /** Seconds until next spawn while inactive. */
  wait: number;
  tint: [number, number, number];
}

const TINTS: ReadonlyArray<readonly [number, number, number]> = [
  [0.91, 0.96, 1.0], // ice white
  [0.77, 0.71, 0.99], // violet
  [0.65, 0.95, 0.99], // cyan
];

const vertexShader = /* glsl */ `
  uniform float uPixelRatio;

  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    vAlpha = aAlpha;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float depth = -mvPosition.z;

    gl_PointSize = min(
      aSize * uPixelRatio * (260.0 / max(1.0, depth)),
      48.0
    );
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    if (vAlpha <= 0.001) discard;

    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    float soft = 1.0 - smoothstep(0.0, 0.5, d);
    gl_FragColor = vec4(vColor, pow(soft, 1.8) * vAlpha);
  }
`;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function spawn(meteor: Meteor): void {
  meteor.active = true;
  meteor.ox = (Math.random() - 0.5) * 240;
  meteor.oy = 22 + Math.random() * 46;
  meteor.oz = -65 - Math.random() * 80;

  // Mostly a diagonal sweep across the sky, alternating sides.
  const side = Math.random() < 0.5 ? -1 : 1;
  let dx = side * (0.55 + Math.random() * 0.5);
  let dy = -(0.12 + Math.random() * 0.35);
  let dz = (Math.random() - 0.5) * 0.3;
  const len = Math.hypot(dx, dy, dz) || 1;
  dx /= len;
  dy /= len;
  dz /= len;

  meteor.dx = dx;
  meteor.dy = dy;
  meteor.dz = dz;
  meteor.speed = 40 + Math.random() * 30;
  meteor.age = 0;
  meteor.life = 1.6 + Math.random() * 1.0;

  const tint = TINTS[Math.floor(Math.random() * TINTS.length)];
  meteor.tint = [tint[0], tint[1], tint[2]];
}

function createMeteors(): Meteor[] {
  return Array.from({ length: METEORS }, (_, i) => ({
    active: false,
    ox: 0,
    oy: 0,
    oz: 0,
    dx: 1,
    dy: 0,
    dz: 0,
    speed: 0,
    age: 0,
    life: 2,
    // Stagger the first arrivals so the sky wakes up gradually.
    wait: 0.5 + i * 1.1 + Math.random() * 1.5,
    tint: [1, 1, 1],
  }));
}

/** Write every meteor's trail into the shared buffers. */
function syncBuffers(
  meteors: readonly Meteor[],
  position: THREE.BufferAttribute,
  alpha: THREE.BufferAttribute,
  color: THREE.BufferAttribute,
): void {
  const pos = position.array as Float32Array;
  const alp = alpha.array as Float32Array;
  const col = color.array as Float32Array;
  // Each trail samples 0.32 s of flight history behind the head.
  const HISTORY_SECONDS = 0.32;

  for (let m = 0; m < meteors.length; m += 1) {
    const meteor = meteors[m];
    const base = m * TRAIL;

    if (!meteor.active) {
      for (let i = 0; i < TRAIL; i += 1) alp[base + i] = 0;
      continue;
    }

    const t01 = meteor.age / meteor.life;
    const env = smoothstep(0, 0.16, t01) * (1 - smoothstep(0.62, 1, t01));

    const [cr, cg, cb] = meteor.tint;
    const headX = meteor.ox + meteor.dx * meteor.speed * meteor.age;
    const headY =
      meteor.oy +
      meteor.dy * meteor.speed * meteor.age -
      1.8 * meteor.age * meteor.age;
    const headZ = meteor.oz + meteor.dz * meteor.speed * meteor.age;

    for (let i = 0; i < TRAIL; i += 1) {
      const idx = base + i;
      // Look back along the flight path; points not yet "born" fade out.
      const look = (i / (TRAIL - 1)) * HISTORY_SECONDS;
      const ti = meteor.age - look;
      if (ti <= 0) {
        pos[idx * 3] = headX;
        pos[idx * 3 + 1] = headY;
        pos[idx * 3 + 2] = headZ;
        alp[idx] = 0;
        continue;
      }

      pos[idx * 3] = meteor.ox + meteor.dx * meteor.speed * ti;
      pos[idx * 3 + 1] =
        meteor.oy + meteor.dy * meteor.speed * ti - 1.8 * ti * ti;
      pos[idx * 3 + 2] = meteor.oz + meteor.dz * meteor.speed * ti;

      // Head hot, tail gone: cubic falloff along the trail.
      const along = i / (TRAIL - 1);
      alp[idx] = Math.pow(1 - along, 2.2) * env;

      col[idx * 3] = cr;
      col[idx * 3 + 1] = cg;
      col[idx * 3 + 2] = cb;
    }
  }

  position.needsUpdate = true;
  alpha.needsUpdate = true;
  color.needsUpdate = true;
}

export interface ShootingStarsProps {
  /** Render two frozen meteors instead of animating (reduced motion). */
  reduced?: boolean;
}

export function ShootingStars({ reduced = false }: ShootingStarsProps) {
  const dpr = useThree((state) => state.viewport.dpr);
  const meteors = React.useMemo(() => createMeteors(), []);

  const geometry = React.useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(POINTS * 3), 3),
    );
    g.setAttribute(
      "aColor",
      new THREE.BufferAttribute(new Float32Array(POINTS * 3), 3),
    );
    g.setAttribute(
      "aAlpha",
      new THREE.BufferAttribute(new Float32Array(POINTS), 1),
    );
    // Head large, tail small — set once, never touched again.
    const sizes = new Float32Array(POINTS);
    for (let m = 0; m < METEORS; m += 1) {
      for (let i = 0; i < TRAIL; i += 1) {
        sizes[m * TRAIL + i] = 3.6 - (2.4 * i) / (TRAIL - 1);
      }
    }
    g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    return g;
  }, []);

  const material = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uPixelRatio: { value: 1 } },
      }),
    [],
  );

  React.useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  /* Reduced motion: two meteors frozen mid-flight, then never again. */
  React.useEffect(() => {
    if (!reduced) return;
    spawn(meteors[0]);
    spawn(meteors[1]);
    meteors[0].age = meteors[0].life * 0.42;
    meteors[1].age = meteors[1].life * 0.55;
    syncBuffers(
      meteors,
      geometry.getAttribute("position") as THREE.BufferAttribute,
      geometry.getAttribute("aAlpha") as THREE.BufferAttribute,
      geometry.getAttribute("aColor") as THREE.BufferAttribute,
    );
    // frameloop="demand" won't repaint on its own — request one frame.
    invalidate();
  }, [reduced, meteors, geometry]);

  useFrame((_, delta) => {
    material.uniforms.uPixelRatio.value = dpr;
    if (reduced) return;

    const dt = Math.min(delta, 0.05);

    for (const meteor of meteors) {
      if (meteor.active) {
        meteor.age += dt;
        if (meteor.age >= meteor.life) {
          meteor.active = false;
          meteor.wait = 1.8 + Math.random() * 4.5; // rare, unhurried
        }
      } else {
        meteor.wait -= dt;
        if (meteor.wait <= 0) {
          spawn(meteor);
        }
      }
    }

    // One buffer sync of 204 points — invisible next to the GPU work.
    syncBuffers(
      meteors,
      geometry.getAttribute("position") as THREE.BufferAttribute,
      geometry.getAttribute("aAlpha") as THREE.BufferAttribute,
      geometry.getAttribute("aColor") as THREE.BufferAttribute,
    );
  });

  return (
    <points
      geometry={geometry}
      material={material}
      frustumCulled={false}
      aria-hidden="true"
    />
  );
}

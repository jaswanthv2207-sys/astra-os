"use client";

import * as React from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";

/* ────────────────────────────────────────────────────────────────────────── *
 * LensFlares — in-scene optical flares, deliberately faint.
 *
 * Each flare is a camera-facing quad carrying an anamorphic streak, a soft
 * core and two ghost rings — the anatomy of a real coating flare, kept at
 * ~10-15% opacity so it reads as atmosphere rather than as an effect. They
 * sit on the scene's brightest anchors (galaxy cores, the nebula heart) and
 * breathe on slow, offset phases.
 * ────────────────────────────────────────────────────────────────────────── */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uOpacity;
  uniform vec3 uTint;

  varying vec2 vUv;

  void main() {
    vec2 p = vUv - 0.5;

    float breathe = 0.72 + 0.28 * sin(uTime * 0.3 + uSeed);

    // Horizontal anamorphic streak — wide, thin, the flare's signature.
    float streak = exp(-abs(p.y) * 140.0) * exp(-abs(p.x) * 7.5);
    // Compact core.
    float core = exp(-length(p) * 34.0);
    // Two faint ghost rings along the optical axis.
    float g1 = smoothstep(0.035, 0.0, abs(length(p - vec2(-0.16, -0.1)) - 0.055));
    float g2 = smoothstep(0.03, 0.0, abs(length(p - vec2(0.22, 0.14)) - 0.04));

    float glow = streak * 0.85 + core + (g1 + g2) * 0.16;
    float alpha = glow * uOpacity * breathe;

    // Ghosts lean cool, core stays white.
    vec3 color = mix(uTint, vec3(1.0), core * 0.8 + streak * 0.4);
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

interface FlareSpec {
  position: [number, number, number];
  scale: number;
  opacity: number;
  seed: number;
  tint: string;
}

const FLARES: readonly FlareSpec[] = [
  // Galaxy cores (mirrors the positions in ./galaxies).
  {
    position: [-62, 36, -168],
    scale: 26,
    opacity: 0.16,
    seed: 0.4,
    tint: "#c7d2fe",
  },
  {
    position: [74, -10, -210],
    scale: 34,
    opacity: 0.14,
    seed: 2.6,
    tint: "#f5d0fe",
  },
  {
    position: [12, 64, -256],
    scale: 18,
    opacity: 0.11,
    seed: 5.1,
    tint: "#a5f3fc",
  },
  // The nebula heart, lower right — the scene's brightest cloud.
  {
    position: [34, 22, -122],
    scale: 22,
    opacity: 0.12,
    seed: 3.9,
    tint: "#fbcfe8",
  },
];

function Flare({ spec, reduced }: { spec: FlareSpec; reduced: boolean }) {
  const material = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: spec.seed },
          uSeed: { value: spec.seed },
          uOpacity: { value: spec.opacity },
          uTint: { value: new THREE.Color(spec.tint) },
        },
      }),
    [spec],
  );

  React.useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame((_, delta) => {
    if (reduced) return;
    material.uniforms.uTime.value += delta;
  });

  return (
    <Billboard position={spec.position}>
      <mesh scale={spec.scale} material={material} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </Billboard>
  );
}

export interface LensFlaresProps {
  /** Freeze the breathing pulse (reduced motion). */
  reduced?: boolean;
}

export function LensFlares({ reduced = false }: LensFlaresProps) {
  return (
    <>
      {FLARES.map((spec) => (
        <Flare key={spec.seed} spec={spec} reduced={reduced} />
      ))}
    </>
  );
}

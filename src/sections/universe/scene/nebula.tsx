"use client";

import * as React from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ────────────────────────────────────────────────────────────────────────── *
 * NebulaField — colourful volumetric clouds.
 *
 * Each cloud is a billboarded plane running a domain-warped fBm shader
 * (noise of noise) so the gas swirls instead of sliding. Additive blending
 * stacks the layers into depth; a radial falloff keeps every plane square
 * invisible at the edges.
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
  uniform float uIntensity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rotation = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p = rotation * p * 2.03;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 p = vUv * 2.6 + uSeed;
    float t = uTime * 0.05;

    // Domain warp: displace the lookup with more noise → swirling gas.
    vec2 warp = vec2(
      fbm(p + vec2(t, -t * 0.6)),
      fbm(p + vec2(4.7 - t * 0.4, 2.1 + t * 0.5))
    );
    float n = fbm(p + 1.7 * warp + t * 0.25);

    // Round the plane off so its square border never shows.
    float falloff = smoothstep(0.5, 0.06, distance(vUv, vec2(0.5)));
    float density = smoothstep(0.3, 0.95, n) * falloff;

    vec3 color = mix(uColorA, uColorB, clamp(n * 1.6, 0.0, 1.0));

    // Additive blending: rgb is already premultiplied by density.
    gl_FragColor = vec4(color * density * uIntensity, 1.0);
  }
`;

interface CloudConfig {
  position: readonly [number, number, number];
  scale: readonly [number, number];
  colorA: string;
  colorB: string;
  intensity: number;
  seed: number;
}

/**
 * Seeded layout — asymmetric on purpose: one hero mass up-right, a cool
 * counterweight down-left, and thin veils bridging the middle.
 */
const CLOUDS: readonly CloudConfig[] = [
  {
    position: [34, 22, -120],
    scale: [150, 110],
    colorA: "#6d28d9",
    colorB: "#e879f9",
    intensity: 0.85,
    seed: 1.7,
  },
  {
    position: [-46, -18, -140],
    scale: [170, 130],
    colorA: "#1d4ed8",
    colorB: "#22d3ee",
    intensity: 0.8,
    seed: 7.3,
  },
  {
    position: [-14, 34, -165],
    scale: [130, 95],
    colorA: "#7c3aed",
    colorB: "#60a5fa",
    intensity: 0.6,
    seed: 12.9,
  },
  {
    position: [42, -34, -155],
    scale: [140, 100],
    colorA: "#a21caf",
    colorB: "#818cf8",
    intensity: 0.55,
    seed: 3.1,
  },
  {
    position: [4, -6, -195],
    scale: [220, 150],
    colorA: "#312e81",
    colorB: "#0ea5e9",
    intensity: 0.5,
    seed: 21.4,
  },
];

interface NebulaCloudProps extends CloudConfig {
  reduced: boolean;
}

function NebulaCloud({
  position,
  scale,
  colorA,
  colorB,
  intensity,
  seed,
  reduced,
}: NebulaCloudProps) {
  const meshRef = React.useRef<THREE.Mesh>(null);

  const material = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: seed },
          uIntensity: { value: intensity },
          uColorA: { value: new THREE.Color(colorA) },
          uColorB: { value: new THREE.Color(colorB) },
        },
      }),
    [seed, intensity, colorA, colorB],
  );

  React.useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame((_, delta) => {
    if (reduced) return;
    material.uniforms.uTime.value += delta;
    // Barely-there drift keeps the composition breathing.
    if (meshRef.current) meshRef.current.rotation.z += delta * 0.004;
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      scale={[scale[0], scale[1], 1]}
      material={material}
      frustumCulled={false}
      aria-hidden="true"
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

export interface NebulaFieldProps {
  /** Freeze gas evolution (prefers-reduced-motion). */
  reduced?: boolean;
}

export function NebulaField({ reduced = false }: NebulaFieldProps) {
  return (
    <group>
      {CLOUDS.map((cloud) => (
        <NebulaCloud key={cloud.seed} {...cloud} reduced={reduced} />
      ))}
    </group>
  );
}

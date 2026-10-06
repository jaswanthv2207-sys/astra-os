"use client";

import * as React from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ────────────────────────────────────────────────────────────────────────── *
 * Aurora — three distant curtains of charged light.
 *
 * Each curtain is a subdivided plane whose vertices ripple on two slow sine
 * frequencies (real curtains undulate; they don't just slide). The fragment
 * shader layers three-octave value noise into vertical rays that flow
 * sideways at a crawl, brightens the lower edge where the curtain "rains"
 * down, and fades both ends so no curtain ever shows a hard border.
 * ────────────────────────────────────────────────────────────────────────── */

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;

  varying vec2 vUv;

  void main() {
    vUv = uv;

    vec3 p = position;
    float sway =
      sin(uv.y * 4.0 + uTime * 0.22 + uSeed * 3.1) * 0.9 +
      sin(uv.x * 7.0 - uTime * 0.16 + uSeed) * 0.6;
    // Top of the curtain travels further than the anchored base.
    p.z += sway * smoothstep(0.0, 1.0, uv.y) * 2.4;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uIntensity;
  uniform vec3 uColorBase;
  uniform vec3 uColorTip;

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
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p *= 2.1;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float t = uTime * 0.05;

    // Warp the ray field so curtains curl instead of combing straight down.
    float warp = fbm(vec2(vUv.x * 3.0 + uSeed, vUv.y * 1.4 - t * 0.6));
    float field = fbm(vec2(vUv.x * 6.5 + warp * 2.2 + t, vUv.y * 2.0 - t * 1.4));
    // fbm centers near 0.44 — window it so curtains open wide but keep
    // dark gaps between rays.
    float rays = pow(smoothstep(0.3, 0.72, field), 2.0);

    // Bright base, dissolving tip.
    float vertical = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.3, 1.0, vUv.y));
    // Soft left/right ends.
    float horizontal =
      smoothstep(0.0, 0.18, vUv.x) * (1.0 - smoothstep(0.82, 1.0, vUv.x));

    float shimmer = 0.82 + 0.18 * sin(t * 6.0 + vUv.x * 9.0 + warp * 5.0);
    float glow = rays * vertical * horizontal * shimmer * uIntensity;

    vec3 color = mix(uColorBase, uColorTip, clamp(vUv.y * 1.5 + warp * 0.3, 0.0, 1.0));
    gl_FragColor = vec4(color, glow);
  }
`;

interface CurtainSpec {
  position: [number, number, number];
  size: [number, number];
  rotation: [number, number, number];
  seed: number;
  intensity: number;
  base: string;
  tip: string;
}

const CURTAINS: readonly CurtainSpec[] = [
  {
    position: [-38, 52, -158],
    size: [150, 54],
    rotation: [0, 0.1, 0.05],
    seed: 1.7,
    intensity: 0.4,
    base: "#34d399",
    tip: "#67e8f9",
  },
  {
    position: [62, 66, -198],
    size: [132, 50],
    rotation: [0, -0.14, -0.07],
    seed: 4.2,
    intensity: 0.34,
    base: "#22d3ee",
    tip: "#a78bfa",
  },
  {
    position: [-104, 40, -190],
    size: [116, 44],
    rotation: [0, 0.24, 0.09],
    seed: 7.9,
    intensity: 0.28,
    base: "#6ee7b7",
    tip: "#c4b5fd",
  },
];

function Curtain({ spec, reduced }: { spec: CurtainSpec; reduced: boolean }) {
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
          uTime: { value: spec.seed },
          uSeed: { value: spec.seed },
          uIntensity: { value: spec.intensity },
          uColorBase: { value: new THREE.Color(spec.base) },
          uColorTip: { value: new THREE.Color(spec.tip) },
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
    <mesh
      position={spec.position}
      rotation={spec.rotation}
      material={material}
      frustumCulled={false}
      aria-hidden="true"
    >
      <planeGeometry args={[spec.size[0], spec.size[1], 24, 12]} />
    </mesh>
  );
}

export interface AuroraProps {
  /** Freeze ripples and flow (reduced motion). */
  reduced?: boolean;
}

export function Aurora({ reduced = false }: AuroraProps) {
  return (
    <>
      {CURTAINS.map((spec) => (
        <Curtain key={spec.seed} spec={spec} reduced={reduced} />
      ))}
    </>
  );
}

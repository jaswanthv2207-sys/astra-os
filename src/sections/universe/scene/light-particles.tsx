"use client";

import * as React from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ────────────────────────────────────────────────────────────────────────── *
 * LightParticles — floating motes of pure light, larger and calmer than the
 * dust field.
 *
 * ~110 soft bokeh orbs drift on three incommensurate sine frequencies (so no
 * two ever sync into a visible pattern) while their brightness breathes on a
 * per-particle phase. Sizes are capped so a mote passing near the lens reads
 * as defocused light rather than as a blob.
 * ────────────────────────────────────────────────────────────────────────── */

const COUNT = 110;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;

  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;

    vec3 p = position;
    // Three sine layers at unrelated frequencies — organic, never looping.
    p.x += sin(uTime * 0.07 + aPhase) * 3.4 + sin(uTime * 0.11 + aPhase * 2.3) * 1.5;
    p.y += sin(uTime * 0.055 + aPhase * 1.7) * 2.6 + cos(uTime * 0.09 + aPhase) * 1.2;
    p.z += cos(uTime * 0.065 + aPhase * 3.1) * 3.0;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    float depth = -mvPosition.z;

    // Breathing luminance: slow inhale/exhale per mote.
    float breathe = 0.55 + 0.45 * sin(uTime * 0.35 + aPhase * 4.0);
    float near = smoothstep(2.0, 14.0, depth);
    float far = 1.0 - smoothstep(70.0, 140.0, depth);
    vAlpha = breathe * near * far;

    float size = aSize * uPixelRatio * (170.0 / max(1.0, depth));
    gl_PointSize = min(size, 34.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    if (vAlpha <= 0.002) discard;

    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    // Soft halo with a warm center — bokeh, not a dot.
    float halo = 1.0 - smoothstep(0.0, 0.5, d);
    float core = 1.0 - smoothstep(0.0, 0.18, d);
    float alpha = pow(halo, 2.4) * 0.75 + pow(core, 2.0) * 0.55;
    gl_FragColor = vec4(vColor, alpha * vAlpha);
  }
`;

const PALETTE = ["#dbeafe", "#e9d5ff", "#ccfbf1", "#fef3c7", "#fce7f3"];

function buildGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const phases = new Float32Array(COUNT);
  const color = new THREE.Color();

  for (let i = 0; i < COUNT; i += 1) {
    const i3 = i * 3;
    // A wide shell around the camera path, biased to the upper half.
    const r = 14 + Math.random() * 62;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(1 - Math.random() * 1.6);
    positions[i3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i3 + 1] = Math.cos(phi) * r * 0.75 + 6;
    positions[i3 + 2] = Math.sin(phi) * Math.sin(theta) * r - 24;

    color.set(PALETTE[i % PALETTE.length]);
    const brightness = 0.7 + Math.random() * 0.5;
    colors[i3] = color.r * brightness;
    colors[i3 + 1] = color.g * brightness;
    colors[i3 + 2] = color.b * brightness;

    sizes[i] = 2.2 + Math.random() * 3.4;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  return geometry;
}

export interface LightParticlesProps {
  /** Freeze drift and breathing (reduced motion). */
  reduced?: boolean;
}

export function LightParticles({ reduced = false }: LightParticlesProps) {
  const dpr = useThree((state) => state.viewport.dpr);

  const geometry = React.useMemo(() => buildGeometry(), []);

  const material = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 7.3 },
          uPixelRatio: { value: 1 },
        },
      }),
    [],
  );

  React.useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((_, delta) => {
    material.uniforms.uPixelRatio.value = dpr;
    if (reduced) return;
    material.uniforms.uTime.value += delta;
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

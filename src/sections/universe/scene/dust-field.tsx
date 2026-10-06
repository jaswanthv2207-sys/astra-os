"use client";

import * as React from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ────────────────────────────────────────────────────────────────────────── *
 * DustField — fine particulate drifting between the camera and the nebula.
 *
 * Two populations: a near shell around the camera path (parallax on every
 * camera move) and a mid-field sprinkle reaching toward the clouds. The drift
 * lives in the vertex shader (sin of a per-particle seed), so the whole field
 * animates for the cost of one uniform update.
 * ────────────────────────────────────────────────────────────────────────── */

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;

  attribute float aSize;
  attribute float aSeed;
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.12 + aSeed * 6.2831) * 1.6;
    p.y += cos(uTime * 0.09 + aSeed * 6.2831) * 1.2;
    p.z += sin(uTime * 0.07 + aSeed * 12.566) * 1.6;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    float depth = -mvPosition.z;

    vColor = aColor;
    // Fade dust out as it recedes toward the nebula depth.
    vAlpha = smoothstep(120.0, 6.0, depth);

    gl_PointSize = aSize * uPixelRatio * (90.0 / max(1.0, depth));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    float soft = 1.0 - smoothstep(0.0, 0.5, d);
    gl_FragColor = vec4(vColor, pow(soft, 2.6) * vAlpha * 0.75);
  }
`;

const DUST_TINTS: readonly string[] = [
  "#c4b5fd",
  "#a5f3fc",
  "#f5f3ff",
  "#f0abfc",
];

function buildDustGeometry(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const near = i % 5 !== 0; // 80% near shell, 20% mid-field

    if (near) {
      // Shell around the camera's orbit — radius 6..36.
      const radius = 6 + Math.random() * 30;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.7;
      positions[i * 3 + 2] = radius * Math.cos(phi) - 8;
    } else {
      positions[i * 3] = (Math.random() - 0.5) * 110;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 2] = -60 - Math.random() * 110;
    }

    color.set(DUST_TINTS[Math.floor(Math.random() * DUST_TINTS.length)]);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    sizes[i] = 0.6 + Math.random() * 1.7;
    seeds[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  return geometry;
}

export interface DustFieldProps {
  /** How many motes to seed. */
  count?: number;
  /** Freeze drift (prefers-reduced-motion). */
  reduced?: boolean;
}

export function DustField({ count = 1400, reduced = false }: DustFieldProps) {
  const dpr = useThree((state) => state.viewport.dpr);

  const geometry = React.useMemo(() => buildDustGeometry(count), [count]);

  const material = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
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

"use client";

import * as React from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/* ────────────────────────────────────────────────────────────────────────── *
 * CosmicDust — a slow vortex of soft, wispy haze circling the scene.
 *
 * Where DustField is fine near-field particulate, this is the deep-sky
 * stuff: ~450 large, barely-visible puffs on a tilted orbit band, all
 * revolving together at ~0.012 rad/s with per-particle phase wobble. It
 * gives the void a sense of current — you never see it move, but you feel
 * the sky turning.
 * ────────────────────────────────────────────────────────────────────────── */

const COUNT = 450;
const ORBIT_SPEED = 0.012; // rad/s ≈ one revolution per 8.7 minutes

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;

  attribute float aSize;
  attribute float aPhase;
  attribute float aOrbit;   // angular velocity multiplier (per-particle variety)
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;

    vec3 p = position;
    // Revolve around the scene's vertical axis — the vortex.
    float angle = uTime * aOrbit;
    float c = cos(angle);
    float s = sin(angle);
    p = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);

    // Slow vertical breathing so the band never looks like a solid ring.
    p.y += sin(uTime * 0.05 + aPhase) * 4.0;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    float depth = -mvPosition.z;

    float fade = smoothstep(4.0, 30.0, depth) * (1.0 - smoothstep(160.0, 320.0, depth));
    float pulse = 0.7 + 0.3 * sin(uTime * 0.14 + aPhase * 2.0);
    vAlpha = fade * pulse;

    gl_PointSize = min(aSize * uPixelRatio * (420.0 / max(1.0, depth)), 90.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    if (vAlpha <= 0.003) discard;

    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    // Gauzy falloff — a wisp, not a sprite.
    float soft = 1.0 - smoothstep(0.0, 0.5, d);
    float alpha = pow(soft, 3.0) * 0.16 * vAlpha;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

const PALETTE = ["#7dd3fc", "#c4b5fd", "#f9a8d4", "#99f6e4"];

function buildGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const phases = new Float32Array(COUNT);
  const orbits = new Float32Array(COUNT);
  const color = new THREE.Color();

  // Tilted orbit band: ring radius 40–140, thin in y, leaning slightly.
  for (let i = 0; i < COUNT; i += 1) {
    const i3 = i * 3;
    const radius = 40 + Math.pow(Math.random(), 0.7) * 100;
    const theta = Math.random() * Math.PI * 2;
    const band = (Math.random() - 0.5) * 46; // band thickness
    const lean = 0.18; // tilt of the vortex plane

    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    positions[i3] = x;
    positions[i3 + 1] = band + x * lean + (Math.random() - 0.5) * 10;
    positions[i3 + 2] = z;

    color.set(PALETTE[i % PALETTE.length]);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;

    sizes[i] = 26 + Math.random() * 48;
    phases[i] = Math.random() * Math.PI * 2;
    // ±20% velocity spread keeps the band coherent but never rigid.
    orbits[i] = ORBIT_SPEED * (0.8 + Math.random() * 0.4);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aOrbit", new THREE.BufferAttribute(orbits, 1));
  return geometry;
}

export interface CosmicDustProps {
  /** Freeze the vortex (reduced motion). */
  reduced?: boolean;
}

export function CosmicDust({ reduced = false }: CosmicDustProps) {
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
          uTime: { value: 40 }, // start mid-rotation so it reads as ongoing
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

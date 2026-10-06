"use client";

import * as React from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";

/* ────────────────────────────────────────────────────────────────────────── *
 * Galaxies — three distant spiral galaxies, each a single point cloud.
 *
 * Stars are seeded along logarithmic-spiral arms with angular scatter, so the
 * arms read as structure rather than as rings. Each galaxy spins on its own
 * tilted axis at ~0.015 rad/s (a full turn every ~7 minutes) — slow enough to
 * feel like deep time, visible enough that the sky is never still. A soft
 * billboard core anchors each disc.
 * ────────────────────────────────────────────────────────────────────────── */

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

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float depth = -mvPosition.z;

    // Gentle photometric breathing — slow, never a twinkle.
    float breathe = 0.86 + 0.14 * sin(uTime * 0.5 + aPhase);
    vAlpha = breathe;

    gl_PointSize = aSize * uPixelRatio * (420.0 / max(1.0, depth));
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
    gl_FragColor = vec4(vColor, pow(soft, 2.0) * vAlpha);
  }
`;

const coreVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const coreFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;

  void main() {
    float d = distance(vUv, vec2(0.5));
    float glow = pow(max(0.0, 1.0 - d * 2.0), 3.2);
    gl_FragColor = vec4(uColor * glow * uIntensity, 1.0);
  }
`;

interface GalaxySpec {
  position: [number, number, number];
  /** Euler tilt of the disc relative to the camera. */
  tilt: [number, number, number];
  radius: number;
  count: number;
  arms: number;
  /** How far the arms wind across the full radius, in radians. */
  twist: number;
  /** Rotation speed in rad/s (sign sets direction). */
  spin: number;
  coreColor: string;
  armColor: string;
  edgeColor: string;
}

const GALAXIES: readonly GalaxySpec[] = [
  {
    position: [-62, 36, -170],
    tilt: [1.05, 0.25, 0.35],
    radius: 44,
    count: 3600,
    arms: 2,
    twist: 4.4,
    spin: 0.014,
    coreColor: "#ffffff",
    armColor: "#a5b4fc",
    edgeColor: "#67e8f9",
  },
  {
    position: [74, -10, -212],
    tilt: [0.88, -0.3, -0.5],
    radius: 58,
    count: 3200,
    arms: 3,
    twist: 3.8,
    spin: -0.011,
    coreColor: "#fff7ed",
    armColor: "#f0abfc",
    edgeColor: "#818cf8",
  },
  {
    position: [12, 64, -258],
    tilt: [1.22, 0.1, 1.1],
    radius: 30,
    count: 1700,
    arms: 2,
    twist: 5.0,
    spin: 0.019,
    coreColor: "#f0f9ff",
    armColor: "#67e8f9",
    edgeColor: "#c4b5fd",
  },
];

function gauss(): number {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

function buildGalaxy(spec: GalaxySpec): THREE.BufferGeometry {
  const { count, radius, arms, twist } = spec;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);

  const core = new THREE.Color(spec.coreColor);
  const arm = new THREE.Color(spec.armColor);
  const edge = new THREE.Color(spec.edgeColor);
  const mixed = new THREE.Color();

  const coreCount = Math.floor(count * 0.16);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    let x: number;
    let y: number;
    let z: number;
    let t: number; // 0 core → 1 rim

    if (i < coreCount) {
      // Dense, slightly flattened nucleus.
      const r = radius * 0.18 * Math.random();
      const theta = Math.random() * Math.PI * 2;
      x = Math.cos(theta) * r + gauss() * radius * 0.03;
      z = Math.sin(theta) * r + gauss() * radius * 0.03;
      y = gauss() * radius * 0.05;
      t = Math.min(1, (Math.hypot(x, z) / radius) * 1.6);
    } else {
      const u = Math.random();
      const r = radius * (0.14 + 0.86 * Math.pow(u, 0.62));
      const armIndex = Math.floor(Math.random() * arms);
      let theta =
        (armIndex / arms) * Math.PI * 2 +
        (r / radius) * twist +
        gauss() * (0.14 + 0.3 * (r / radius));

      // A fraction of stars live between the arms as haze.
      if (Math.random() < 0.12) theta = Math.random() * Math.PI * 2;

      const scatter = radius * 0.05 * (0.4 + r / radius);
      x = Math.cos(theta) * r + gauss() * scatter;
      z = Math.sin(theta) * r + gauss() * scatter;
      y = gauss() * radius * 0.045 * (1.1 - (r / radius) * 0.5);
      t = r / radius;
    }

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;

    if (t < 0.55) {
      mixed.copy(core).lerp(arm, t / 0.55);
    } else {
      mixed.copy(arm).lerp(edge, (t - 0.55) / 0.45);
    }
    const brightness = 0.72 + Math.random() * 0.5;
    colors[i3] = Math.min(1, mixed.r * brightness);
    colors[i3 + 1] = Math.min(1, mixed.g * brightness);
    colors[i3 + 2] = Math.min(1, mixed.b * brightness);

    const rare = Math.random() < 0.03;
    sizes[i] = rare ? 3.4 + Math.random() : 1.1 + (1 - t) * 1.4;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  return geometry;
}

function Galaxy({ spec, reduced }: { spec: GalaxySpec; reduced: boolean }) {
  const dpr = useThree((state) => state.viewport.dpr);
  const spinRef = React.useRef<THREE.Group>(null);

  const geometry = React.useMemo(() => buildGalaxy(spec), [spec]);

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

  const coreMaterial = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: coreVertex,
        fragmentShader: coreFragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uColor: { value: new THREE.Color(spec.coreColor) },
          uIntensity: { value: 0.5 },
        },
      }),
    [spec.coreColor],
  );

  React.useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
      coreMaterial.dispose();
    };
  }, [geometry, material, coreMaterial]);

  useFrame((_, delta) => {
    material.uniforms.uPixelRatio.value = dpr;
    if (reduced) return;
    material.uniforms.uTime.value += delta;
    if (spinRef.current) {
      spinRef.current.rotation.y += delta * spec.spin;
    }
  });

  return (
    <group position={spec.position} rotation={spec.tilt}>
      <group ref={spinRef}>
        <points
          geometry={geometry}
          material={material}
          frustumCulled={false}
          aria-hidden="true"
        />
        <Billboard>
          <mesh scale={spec.radius * 0.85} frustumCulled={false}>
            <planeGeometry args={[1, 1]} />
            <primitive object={coreMaterial} attach="material" />
          </mesh>
        </Billboard>
      </group>
    </group>
  );
}

export interface GalaxiesProps {
  /** Freeze spin and breathing (reduced motion). */
  reduced?: boolean;
}

export function Galaxies({ reduced = false }: GalaxiesProps) {
  return (
    <>
      {GALAXIES.map((spec) => (
        <Galaxy
          key={`${spec.position.join()}-${spec.radius}`}
          spec={spec}
          reduced={reduced}
        />
      ))}
    </>
  );
}

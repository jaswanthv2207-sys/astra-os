"use client";

import * as React from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { cameraState } from "./camera-state";

/* ────────────────────────────────────────────────────────────────────────── *
 * StarField — thousands of animated stars as ONE draw call.
 *
 * A custom point shader does the heavy lifting: per-star size, colour and a
 * twinkle phase that rides a sine wave, all on the GPU. Stars are seeded on a
 * flattened sphere shell (45% get squashed toward the equator) so the field
 * reads as a galaxy band rather than uniform static. During a warp jump the
 * same shader grows each point and pulls it into a radial, blue-white streak
 * along its axis away from screen centre — the starfield becomes a tunnel.
 * ────────────────────────────────────────────────────────────────────────── */

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uWarp;
  uniform float uAspect;

  attribute float aSize;
  attribute float aPhase;
  attribute float aSpeed;
  attribute vec3 aColor;

  varying vec3 vColor;
  varying float vTwinkle;
  varying vec2 vAxis;

  void main() {
    vColor = aColor;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec4 clip = projectionMatrix * mvPosition;

    float twinkle = 0.62 + 0.38 * sin(uTime * aSpeed + aPhase);
    vTwinkle = twinkle;

    /* Pixel-space direction pointing away from the screen centre — during
       a warp every star smears along this radial axis, the classic
       hyperdrive starfield tunnel. Aspect-corrected so streaks sit on the
       true line of flight, not the NDC oval. */
    vec2 ndc = clip.xy / max(clip.w, 0.0001);
    vAxis = normalize(ndc * vec2(uAspect, 1.0) + vec2(1e-3, 1e-3));

    // Perspective attenuation — distant stars shrink AND soften.
    float base = aSize * uPixelRatio * (0.7 + 0.55 * twinkle) *
      (140.0 / max(1.0, -mvPosition.z));

    // Warp: grow each sprite into a streak canvas. The cap keeps ~9k
    // additive quads inside the fill budget on phones as well as desktops.
    float warpGrow = 1.0 + uWarp * 6.5;
    gl_PointSize = min(base * warpGrow, 56.0 * uPixelRatio);

    gl_Position = clip;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uWarp;

  varying vec3 vColor;
  varying float vTwinkle;
  varying vec2 vAxis;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    // Soft radial falloff with a hot core — reads as a star, not a dot.
    float core = 1.0 - smoothstep(0.0, 0.5, d);
    float alpha = pow(core, 2.2) * (0.3 + 0.7 * vTwinkle);
    vec3 tint = vColor;

    if (uWarp > 0.002) {
      /* Hyperspace: pull the dot along its outward axis into a tapered
         streak — hairline across, hottest at the leading head. */
      float along = dot(uv, vAxis);
      float across = abs(dot(uv, vec2(-vAxis.y, vAxis.x)));
      float taper = 1.0 - smoothstep(0.0, 0.5, abs(along));
      float halfWidth = mix(0.5, 0.035, uWarp);
      float hair = 1.0 - smoothstep(halfWidth * 0.4, halfWidth, across);
      float head = 0.3 + 0.7 * smoothstep(-0.4, 0.5, along);
      float streak = taper * hair * head;
      alpha = max(alpha, streak * uWarp * (0.55 + 0.45 * vTwinkle));
      // Streaks burn blue-white the faster they run.
      tint = mix(tint, vec3(0.72, 0.9, 1.0), uWarp * 0.7);
    }

    gl_FragColor = vec4(tint * (0.55 + 0.85 * vTwinkle), alpha);
  }
`;

/** [hex, weight] — mostly white/blue-white with rare violet/cyan/warm accents. */
const PALETTE: ReadonlyArray<readonly [string, number]> = [
  ["#ffffff", 0.4],
  ["#dbeafe", 0.26],
  ["#e9d5ff", 0.14],
  ["#a5f3fc", 0.11],
  ["#fde68a", 0.09],
];

function pickColor(): THREE.Color {
  let roll = Math.random();
  for (const [hex, weight] of PALETTE) {
    roll -= weight;
    if (roll <= 0) return new THREE.Color(hex);
  }
  return new THREE.Color(PALETTE[0][0]);
}

function buildStarGeometry(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);

  const direction = new THREE.Vector3();
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    direction.randomDirection();
    // Flatten nearly half the stars toward the equator → galactic band.
    if (Math.random() < 0.45) direction.y *= 0.42;
    direction.normalize();

    const radius = 60 + Math.pow(Math.random(), 0.75) * 165;
    positions[i * 3] = direction.x * radius;
    positions[i * 3 + 1] = direction.y * radius;
    positions[i * 3 + 2] = direction.z * radius;

    // 6% are "hero" stars — bigger and brighter than the field.
    sizes[i] =
      Math.random() < 0.06
        ? 3.2 + Math.random() * 2.4
        : 1.0 + Math.random() * 1.6;
    phases[i] = Math.random() * Math.PI * 2;
    speeds[i] = 0.5 + Math.random() * 2.4;

    color.copy(pickColor());
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  return geometry;
}

export interface StarFieldProps {
  /** How many stars to seed. Fewer on phones keeps the frame budget sane. */
  count?: number;
  /** Freeze twinkle + rotation (prefers-reduced-motion). */
  reduced?: boolean;
}

export function StarField({ count = 9000, reduced = false }: StarFieldProps) {
  const groupRef = React.useRef<THREE.Points>(null);
  const dpr = useThree((state) => state.viewport.dpr);
  const size = useThree((state) => state.size);

  const geometry = React.useMemo(() => buildStarGeometry(count), [count]);

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
          uWarp: { value: 0 },
          uAspect: { value: 1 },
        },
      }),
    [],
  );

  /* GPU resources are created imperatively — dispose them by hand. */
  React.useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((_, delta) => {
    material.uniforms.uPixelRatio.value = dpr;
    material.uniforms.uAspect.value =
      size.height > 0 ? size.width / size.height : 1;
    /* Hyperspace streaks track the warp envelope (signed state: the
       negative pre-launch dip draws no streaks). */
    material.uniforms.uWarp.value = reduced
      ? 0
      : Math.min(1, Math.max(0, cameraState.warp));
    if (reduced) return;
    material.uniforms.uTime.value += delta;
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.008;
      groupRef.current.rotation.x += delta * 0.002;
    }
  });

  return (
    <points
      ref={groupRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      aria-hidden="true"
    />
  );
}

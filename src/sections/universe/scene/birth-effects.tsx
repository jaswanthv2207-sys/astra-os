"use client";

import * as React from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { getSceneData } from "@/data/scene-data";
import { playCue } from "@/lib/audio";

import { cameraState, type CameraMode } from "./camera-state";
import { readPlanetPosition } from "./planet-registry";
import { birthState, finishBirth, useBirth } from "../birth/birth-state";
import { BEAT, BIRTH_END, bump, kf, ramp } from "../birth/birth-timeline";

/* ────────────────────────────────────────────────────────────────────────── *
 * BirthEffects — the WebGL half of the Planet Birth Experience.
 *
 * Self-gating on `useBirth()`: inactive it mounts nothing at all (zero
 * geometry, zero draw calls — stock scenes and revisited universes never pay
 * for it), active it layers a small, pooled set of cinematic systems over
 * the existing scene without touching a single one of them:
 *
 *   • EnergyWave   — a soft expanding shell across the galaxy (Phase 2)
 *   • Meteor       — plasma head, ring-buffered trail, drifting sparks (P3)
 *   • Formation    — converging swirl, impact burst, core energy sphere (P4)
 *   • BirthCamera  — takes the frame at meteor launch, pushes in through the
 *                    formation, holds for the scan, orbits for the reveal,
 *                    then glides home and hands control back untouched (P3–7)
 *
 * Everything reads the `birthState` singleton in `useFrame` — no React
 * re-render ever happens inside the cinematic, and every buffer is
 * preallocated (no per-frame allocation).
 * ────────────────────────────────────────────────────────────────────────── */

const UP = new THREE.Vector3(0, 1, 0);
const SCRATCH_A = new THREE.Vector3();
const SCRATCH_B = new THREE.Vector3();
const SCRATCH_C = new THREE.Vector3();
const HERO = new THREE.Vector3();
/* Meteor path internals — dedicated so callers may pass any scratch as the
   output without aliasing the Bézier intermediates. */
const MP_START = new THREE.Vector3();
const MP_MID = new THREE.Vector3();
const MP_SPAN = new THREE.Vector3();
const MP_SIDE = new THREE.Vector3();
const MP_TARGET = new THREE.Vector3();
const MP_RESULT = new THREE.Vector3();

/* ── Meteor path (shared by the meteor mesh and the camera) ──────────────── */

/** Publish the entry point once — off-frame on the camera's right shoulder. */
function ensureMeteorPath(camera: THREE.Camera): void {
  if (birthState.meteorStart) return;
  const hero = birthState.heroId ? readPlanetPosition(birthState.heroId) : null;
  if (!hero) return;
  const towardCamera = SCRATCH_A.copy(camera.position).sub(hero);
  if (towardCamera.lengthSq() < 1e-6) towardCamera.set(0, 0, 1);
  towardCamera.normalize();
  const right = SCRATCH_B.crossVectors(towardCamera, UP);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
  right.normalize();
  const lift = SCRATCH_C.crossVectors(right, towardCamera).normalize();
  const start = towardCamera
    .multiplyScalar(70)
    .addScaledVector(right, 54)
    .addScaledVector(lift, 26)
    .add(hero);
  birthState.meteorStart = [start.x, start.y, start.z];
}

/** Quadratic Bézier from the entry point to the world — bowed like a beam. */
function meteorPoint(
  progress: number,
  out: THREE.Vector3,
): THREE.Vector3 | null {
  const startTuple = birthState.meteorStart;
  const hero = heroWorld(MP_TARGET);
  if (!startTuple || !hero) return null;
  const start = MP_START.set(startTuple[0], startTuple[1], startTuple[2]);
  const target = hero;

  /* Control point: midpoint bowed sideways + up by a fixed fraction of the
     span — the same organic arc the knowledge beams use. */
  const mid = MP_MID.copy(start).add(target).multiplyScalar(0.5);
  const span = MP_SPAN.copy(target).sub(start);
  const length = span.length();
  if (length > 1e-4) {
    const side = MP_SIDE.crossVectors(span, UP);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    mid.addScaledVector(side, length * 0.14);
    mid.y += length * 0.06;
  }

  const s = progress;
  const inv = 1 - s;
  MP_RESULT.copy(start).multiplyScalar(inv * inv);
  MP_RESULT.addScaledVector(mid, 2 * inv * s);
  MP_RESULT.addScaledVector(target, s * s);
  return out.copy(MP_RESULT);
}

/** Resolve the born world's live world position (registry is written first). */
function heroWorld(out: THREE.Vector3): THREE.Vector3 | null {
  if (!birthState.heroId) return null;
  const position = readPlanetPosition(birthState.heroId);
  if (!position) return null;
  return out.copy(position);
}

/* ── Component ───────────────────────────────────────────────────────────── */

export function BirthEffects() {
  const snapshot = useBirth();
  if (snapshot === "off") return null;
  return (
    <group>
      <EnergyWave />
      <Meteor />
      <Formation />
      {/* Last child = last subscriber = its camera writes land after the rig. */}
      <BirthCamera />
    </group>
  );
}

/* ── Phase 2 — the energy wave ───────────────────────────────────────────── */

function EnergyWave() {
  const group = React.useRef<THREE.Group>(null);

  const material = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec3 vNormalW;
          varying vec3 vWorldPos;
          void main() {
            vNormalW = normalize(mat3(modelMatrix) * normal);
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uAlpha;
          varying vec3 vNormalW;
          varying vec3 vWorldPos;
          void main() {
            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            /* Thin luminous band at the shell's limb, soft everywhere else. */
            float rim = pow(1.0 - abs(dot(normalize(vNormalW), viewDir)), 2.4);
            gl_FragColor = vec4(uColor * rim * 1.6, (0.12 + rim) * uAlpha);
          }
        `,
        uniforms: {
          uColor: { value: new THREE.Color("#7dd3fc") },
          uAlpha: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  React.useEffect(() => () => material.dispose(), [material]);

  React.useLayoutEffect(() => {
    const centres = getSceneData().centres;
    const mean = new THREE.Vector3();
    for (const centre of centres) mean.add(new THREE.Vector3(...centre));
    mean.divideScalar(Math.max(1, centres.length));
    if (group.current) group.current.position.copy(mean);
    const hero = birthState.heroId
      ? readPlanetPosition(birthState.heroId)
      : null;
    if (hero && group.current) group.current.position.lerp(hero, 0.35);
  }, []);

  useFrame(() => {
    const progress = birthState.v.wave;
    const visible = birthState.active && progress >= 0;
    if (group.current) group.current.visible = visible;
    if (!visible) return;
    const scale = 8 + progress * 150;
    if (group.current) group.current.scale.setScalar(scale);
    material.uniforms.uAlpha.value =
      Math.sin(Math.min(1, progress) * Math.PI) * 0.5 * birthState.v.relax;
    const hero = birthState.heroId
      ? readPlanetPosition(birthState.heroId)
      : null;
    if (hero && group.current) group.current.position.lerp(hero, 0.04);
  });

  return (
    <group ref={group} visible={false}>
      <mesh material={material} frustumCulled={false}>
        <sphereGeometry args={[1, 48, 32]} />
      </mesh>
    </group>
  );
}

/* ── Phase 3 — the meteor ────────────────────────────────────────────────── */

const TRAIL_POINTS = 42;
const SPARK_POINTS = 26;

function Meteor() {
  const group = React.useRef<THREE.Group>(null);
  const head = React.useRef<THREE.Group>(null);
  const camera = useThree((state) => state.camera);

  /* Ring-buffered trail — one preallocated buffer, written in place. */
  const trail = React.useMemo(() => {
    const positions = new Float32Array(TRAIL_POINTS * 3);
    const colors = new Float32Array(TRAIL_POINTS * 3);
    const alphas = new Float32Array(TRAIL_POINTS);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aAlpha;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 34.0 * uPixelRatio * aAlpha * (60.0 / max(1.0, -mv.z)) + 2.0;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float core = 1.0 - smoothstep(0.0, 0.5, d);
          gl_FragColor = vec4(vColor * (0.7 + 1.6 * core), pow(core, 1.8) * vAlpha);
        }
      `,
      uniforms: { uPixelRatio: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material, positions, colors, alphas, head: 0 };
  }, []);

  /* Sparks — spawned along the flight, ballistic and short-lived. */
  const sparks = React.useMemo(() => {
    const positions = new Float32Array(SPARK_POINTS * 3);
    const alphas = new Float32Array(SPARK_POINTS);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aAlpha;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 8.0 * uPixelRatio * (60.0 / max(1.0, -mv.z)) + 1.0;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float core = 1.0 - smoothstep(0.0, 0.5, d);
          gl_FragColor = vec4(mix(vec3(1.0), uColor, 0.55) * (0.6 + core), pow(core, 2.0) * vAlpha);
        }
      `,
      uniforms: {
        uPixelRatio: { value: 1 },
        uColor: { value: new THREE.Color("#7dd3fc") },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const velocity = new Float32Array(SPARK_POINTS * 3);
    const life = new Float32Array(SPARK_POINTS);
    return { geometry, material, positions, alphas, velocity, life, cursor: 0 };
  }, []);

  React.useEffect(
    () => () => {
      trail.geometry.dispose();
      trail.material.dispose();
      sparks.geometry.dispose();
      sparks.material.dispose();
    },
    [trail, sparks],
  );

  const accent = React.useMemo(
    () => new THREE.Color(birthState.hero?.accent ?? "#7dd3fc"),
    [],
  );
  const colorScratch = React.useMemo(() => new THREE.Color(), []);
  const accum = React.useRef(0);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const progress = birthState.v.meteor;
    const live = birthState.active && progress >= 0;
    if (group.current) group.current.visible = live;
    if (!live) {
      trail.alphas.fill(0);
      (
        trail.geometry.getAttribute("aAlpha") as THREE.BufferAttribute
      ).needsUpdate = true;
      return;
    }

    ensureMeteorPath(camera);
    const eased = progress * progress * (3 - 2 * progress);
    const point = meteorPoint(eased, HERO);
    if (!point) return;
    if (head.current) head.current.position.copy(point);

    /* Trail: write the head position into the ring, restage alphas/colors. */
    const slot = trail.head;
    trail.positions[slot * 3] = point.x;
    trail.positions[slot * 3 + 1] = point.y;
    trail.positions[slot * 3 + 2] = point.z;
    trail.head = (slot + 1) % TRAIL_POINTS;
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const age = (trail.head - 1 - i + TRAIL_POINTS * 2) % TRAIL_POINTS;
      const fade = Math.pow(1 - age / TRAIL_POINTS, 1.6);
      trail.alphas[i] = fade;
      colorScratch.copy(accent).lerp(WHITE, age / TRAIL_POINTS);
      trail.colors[i * 3] = colorScratch.r;
      trail.colors[i * 3 + 1] = colorScratch.g;
      trail.colors[i * 3 + 2] = colorScratch.b;
    }
    (
      trail.geometry.getAttribute("position") as THREE.BufferAttribute
    ).needsUpdate = true;
    (
      trail.geometry.getAttribute("aColor") as THREE.BufferAttribute
    ).needsUpdate = true;
    (
      trail.geometry.getAttribute("aAlpha") as THREE.BufferAttribute
    ).needsUpdate = true;
    trail.material.uniforms.uPixelRatio.value = state.viewport.dpr;

    /* Sparks: spawn a few per second from the trail tail, drift, die. */
    accum.current += dt;
    while (accum.current > 0.024) {
      accum.current -= 0.024;
      const index = sparks.cursor;
      sparks.cursor = (index + 1) % SPARK_POINTS;
      sparks.positions[index * 3] = point.x;
      sparks.positions[index * 3 + 1] = point.y;
      sparks.positions[index * 3 + 2] = point.z;
      sparks.velocity[index * 3] = (Math.random() - 0.5) * 5;
      sparks.velocity[index * 3 + 1] = (Math.random() - 0.5) * 5;
      sparks.velocity[index * 3 + 2] = (Math.random() - 0.5) * 5;
      sparks.life[index] = 0.55;
    }
    for (let i = 0; i < SPARK_POINTS; i++) {
      if (sparks.life[i] <= 0) {
        sparks.alphas[i] = 0;
        continue;
      }
      sparks.life[i] -= dt;
      sparks.positions[i * 3] += sparks.velocity[i * 3] * dt;
      sparks.positions[i * 3 + 1] += sparks.velocity[i * 3 + 1] * dt;
      sparks.positions[i * 3 + 2] += sparks.velocity[i * 3 + 2] * dt;
      sparks.alphas[i] = Math.max(0, sparks.life[i] / 0.55);
    }
    (
      sparks.geometry.getAttribute("position") as THREE.BufferAttribute
    ).needsUpdate = true;
    (
      sparks.geometry.getAttribute("aAlpha") as THREE.BufferAttribute
    ).needsUpdate = true;
    sparks.material.uniforms.uPixelRatio.value = state.viewport.dpr;
    (sparks.material.uniforms.uColor.value as THREE.Color).copy(accent);
  });

  return (
    <group ref={group} visible={false}>
      <points
        geometry={trail.geometry}
        material={trail.material}
        frustumCulled={false}
      />
      <points
        geometry={sparks.geometry}
        material={sparks.material}
        frustumCulled={false}
      />
      <group ref={head}>
        {/* White-hot core … */}
        <mesh>
          <sphereGeometry args={[0.5, 16, 12]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        {/* … wrapped in a plasma sheath the bloom pass catches. */}
        <mesh>
          <sphereGeometry args={[1.25, 20, 14]} />
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={0.4}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

const WHITE = new THREE.Color("#ffffff");

/* ── Phase 4 — swirl, impact burst, core energy sphere ───────────────────── */

const SWIRL_POINTS = 900;

function Formation() {
  const group = React.useRef<THREE.Group>(null);
  const swirlMesh = React.useRef<THREE.Points>(null);
  const burstMesh = React.useRef<THREE.Mesh>(null);
  const coreMesh = React.useRef<THREE.Mesh>(null);
  const clock = React.useRef(0);

  const swirl = React.useMemo(() => {
    const positions = new Float32Array(SWIRL_POINTS * 3); // shader computes
    const seeds = new Float32Array(SWIRL_POINTS * 4); // angle, radius, height, speed
    for (let i = 0; i < SWIRL_POINTS; i++) {
      seeds[i * 4] = Math.random() * Math.PI * 2;
      seeds[i * 4 + 1] = 5 + Math.random() * 9;
      seeds[i * 4 + 2] = (Math.random() - 0.5) * 3.4;
      seeds[i * 4 + 3] = (Math.random() - 0.5) * 2.4;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 4));
    const material = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uProgress;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          float e = clamp(uProgress, 0.0, 1.0);
          float radius = aSeed.y * (1.0 - pow(e, 1.35)) + 0.45;
          float angle = aSeed.x + uTime * (1.4 + aSeed.w * 0.6) + e * 5.0;
          vec3 p = vec3(cos(angle) * radius, aSeed.z * (1.0 - e), sin(angle) * radius);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float size = mix(7.0, 2.2, e) * uPixelRatio * (60.0 / max(1.0, -mv.z));
          gl_PointSize = size + 1.0;
          vAlpha = (1.0 - e * 0.9) * (0.35 + 0.65 * fract(aSeed.x * 7.31));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uAlpha;
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float core = 1.0 - smoothstep(0.0, 0.5, d);
          gl_FragColor = vec4(uColor * (0.8 + core), pow(core, 1.7) * vAlpha * uAlpha);
        }
      `,
      uniforms: {
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uAlpha: { value: 0 },
        uPixelRatio: { value: 1 },
        uColor: { value: new THREE.Color("#7dd3fc") },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material };
  }, []);

  const burstMaterial = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BURST_VERT,
        fragmentShader: BURST_FRAG,
        uniforms: {
          uColor: { value: new THREE.Color("#dbeafe") },
          uAlpha: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  const coreMaterial = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uIntensity;
          varying vec2 vUv;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            float glow = pow(max(0.0, 1.0 - d), 2.3);
            vec3 color = mix(vec3(1.0), uColor, smoothstep(0.0, 0.9, d));
            gl_FragColor = vec4(color * (0.8 + 1.4 * glow), glow * uIntensity);
          }
        `,
        uniforms: {
          uColor: { value: new THREE.Color("#7dd3fc") },
          uIntensity: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  React.useEffect(
    () => () => {
      swirl.geometry.dispose();
      swirl.material.dispose();
      burstMaterial.dispose();
      coreMaterial.dispose();
    },
    [swirl, burstMaterial, coreMaterial],
  );

  const accent = React.useMemo(
    () => new THREE.Color(birthState.hero?.accent ?? "#7dd3fc"),
    [],
  );

  /* The born world's radius — sampled once; the scene remounts per record,
     so this is always the hero of *this* scene. */
  const heroRadius = React.useMemo(
    () =>
      getSceneData().projects.find((p) => p.id === birthState.heroId)?.planet
        .radius ?? 1.55,
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const active = birthState.active;
    const formation = birthState.v.formation;
    const hero = heroWorld(HERO);
    const t = birthState.t;

    if (group.current) {
      group.current.visible =
        active && (formation >= 0 || birthState.v.core > 0.001);
      if (hero) group.current.position.copy(hero);
    }

    /* Swirl — GPU-computed convergence, one buffer for the whole flight. */
    const swirlLive = active && formation >= 0;
    if (swirlMesh.current) swirlMesh.current.visible = swirlLive;
    if (swirlLive) {
      clock.current += dt;
      const uniforms = swirl.material.uniforms;
      uniforms.uProgress.value = Math.min(1, formation * 1.4);
      uniforms.uTime.value = clock.current;
      uniforms.uAlpha.value =
        Math.min(1, (1 - Math.max(0, formation - 0.72) / 0.28) * 1.4) *
        birthState.v.relax;
      uniforms.uPixelRatio.value = state.viewport.dpr;
      (uniforms.uColor.value as THREE.Color).copy(accent);
    }

    /* Impact burst — one shell, flash in, flash out. */
    const burst = bump(t, BEAT.impact, BEAT.impact + 0.06, BEAT.impact + 0.55);
    if (burstMesh.current) {
      burstMesh.current.visible = active && burst > 0.001;
      burstMesh.current.scale.setScalar(0.6 + burst * 7.5);
      burstMaterial.uniforms.uAlpha.value = burst * 0.85 * birthState.v.relax;
    }

    /* Core energy sphere — billboarded radial glow that the surface eats. */
    const coreIntensity = birthState.v.core;
    if (coreMesh.current) {
      coreMesh.current.visible = active && coreIntensity > 0.005;
      coreMesh.current.scale.setScalar(
        heroRadius * (1.6 + coreIntensity * 2.6),
      );
      coreMesh.current.quaternion.copy(state.camera.quaternion);
      coreMaterial.uniforms.uIntensity.value = coreIntensity;
    }
    (coreMaterial.uniforms.uColor.value as THREE.Color).copy(accent);
  });

  return (
    <group ref={group} visible={false}>
      <points
        ref={swirlMesh}
        geometry={swirl.geometry}
        material={swirl.material}
        frustumCulled={false}
        visible={false}
      />
      <mesh
        ref={burstMesh}
        material={burstMaterial}
        visible={false}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 32, 24]} />
      </mesh>
      <mesh
        ref={coreMesh}
        material={coreMaterial}
        visible={false}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  );
}

const BURST_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const BURST_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;
  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float rim = pow(1.0 - abs(dot(normalize(vNormalW), viewDir)), 1.6);
    gl_FragColor = vec4(uColor * (rim * 1.8 + 0.25), uAlpha * (0.3 + rim));
  }
`;

/* ── Phases 3–7 — the camera ─────────────────────────────────────────────── */

interface ControlsLike {
  target: THREE.Vector3;
  enabled: boolean;
  update(): void;
}

function BirthCamera() {
  const camera = useThree((state) => state.camera);
  const controls = useThree(
    (state) => state.controls,
  ) as unknown as ControlsLike | null;

  /** Capture bookkeeping — mode/target at hijack, plus flight-local state. */
  const rig = React.useRef<{
    mode: CameraMode;
    enabled: boolean;
    homePos: THREE.Vector3;
    homeTarget: THREE.Vector3;
    look: THREE.Vector3;
    vantageDir: THREE.Vector3;
    returnFromPos: THREE.Vector3;
    returnFromLook: THREE.Vector3;
    /** Camera → world distance when the meteor strikes (push-in start). */
    impactDist: number;
    returning: boolean;
    impactFired: boolean;
    focusCue: boolean;
    started: boolean;
  }>({
    mode: "auto",
    enabled: true,
    homePos: new THREE.Vector3(),
    homeTarget: new THREE.Vector3(),
    look: new THREE.Vector3(),
    vantageDir: new THREE.Vector3(),
    returnFromPos: new THREE.Vector3(),
    returnFromLook: new THREE.Vector3(),
    impactDist: 70,
    returning: false,
    impactFired: false,
    focusCue: false,
    started: false,
  });

  /* A scene remount (or a second creation mid-sequence) starts the camera
     story fresh — capture happens at hijack, never before. */
  React.useEffect(() => {
    const r = rig.current;
    r.returning = false;
    r.impactFired = false;
    r.focusCue = false;
    r.started = false;
    birthState.camera.hijacked = false;
    birthState.camera.home = null;
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const state = birthState;
    if (!state.active) return;
    const t = state.t;
    const r = rig.current;

    /* ── take the frame at meteor launch ──────────────────────────────── */
    if (!state.camera.hijacked && !state.skipping && t >= BEAT.meteorStart) {
      r.homePos.copy(camera.position);
      r.homeTarget.copy(controls ? controls.target : SCRATCH_A.set(0, 0, -60));
      r.look.copy(r.homeTarget);
      r.mode = cameraState.mode;
      r.enabled = controls ? controls.enabled : true;
      state.camera.hijacked = true;
      state.camera.prevMode = r.mode;
      state.camera.prevEnabled = r.enabled;
      state.camera.home = {
        px: r.homePos.x,
        py: r.homePos.y,
        pz: r.homePos.z,
        tx: r.homeTarget.x,
        ty: r.homeTarget.y,
        tz: r.homeTarget.z,
      };
      cameraState.mode = "flying";
      if (controls) controls.enabled = false;
      playCue("warp");
      ensureMeteorPath(camera);
    }
    if (!state.camera.hijacked) return;

    const hero = heroWorld(HERO);

    /* ── skip / natural end: glide home, then hand everything back ────── */
    const ending = state.skipping || t >= BIRTH_END;
    if (ending) {
      if (!r.returning) {
        r.returning = true;
        r.returnFromPos.copy(camera.position);
        r.returnFromLook.copy(r.look);
      }
      const progress = state.skipping
        ? Math.min(1, (t - state.skippedAt) / 0.5)
        : 1; /* the score's own return already landed at home */
      const eased = progress * progress * (3 - 2 * progress);
      camera.position.lerpVectors(r.returnFromPos, r.homePos, eased);
      r.look.lerpVectors(r.returnFromLook, r.homeTarget, eased);
      camera.lookAt(r.look);
      const done = state.skipping ? progress >= 1 : t >= BIRTH_END;
      if (done) {
        camera.position.copy(r.homePos);
        if (controls) {
          controls.target.copy(r.homeTarget);
          controls.enabled = r.enabled;
          controls.update();
        }
        cameraState.mode = r.mode;
        finishBirth();
      }
      return;
    }

    if (!hero) return;

    /* ── meteor flight: the frame drifts toward the incoming streak ───── */
    if (t < BEAT.meteorEnd) {
      const progress = Math.max(0, state.v.meteor);
      const eased = progress * progress * (3 - 2 * progress);
      const streak = meteorPoint(eased, SCRATCH_B);
      if (streak) {
        r.look.lerp(streak, 1 - Math.exp(-dt * 2.4));
        /* Bounded dolly — the camera leans, it never swings. */
        SCRATCH_C.copy(streak)
          .sub(r.homePos)
          .multiplyScalar(0.1)
          .add(r.homePos);
        camera.position.lerp(SCRATCH_C, 1 - Math.exp(-dt * 1.5));
        camera.lookAt(r.look);
      }
      return;
    }

    /* ── impact → scan → connections: push in, then hold the hero frame ─ */
    if (!r.started) {
      r.started = true;
      r.vantageDir.copy(camera.position).sub(hero);
      if (r.vantageDir.lengthSq() < 1e-6) r.vantageDir.set(0, 0.2, 1);
      r.vantageDir.normalize();
      r.impactDist = camera.position.distanceTo(hero);
    }
    if (!r.impactFired && t >= BEAT.impact) {
      r.impactFired = true;
      cameraState.flash = 1;
    }
    if (!r.focusCue && t >= 4.82) {
      r.focusCue = true;
      playCue("focus");
    }

    const orbitting = t >= 6.4;
    let dist: number;
    let lift: number;
    SCRATCH_A.copy(r.vantageDir);
    if (orbitting) {
      const sweep = ramp(t, 6.4, 7.5);
      const eased = sweep * sweep * (3 - 2 * sweep);
      SCRATCH_A.applyAxisAngle(UP, eased * 3.3);
      dist = kf(t, [
        [6.4, 21],
        [7.0, 17.5],
        [7.5, 21],
      ]);
      lift = kf(t, [
        [6.4, 5.5],
        [7.0, 8],
        [7.5, 5.5],
      ]);
    } else {
      dist = kf(t, [
        [BEAT.impact, r.impactDist ?? 70],
        [4.5, 26],
        [4.9, 21],
      ]);
      lift = kf(t, [
        [BEAT.impact, 0],
        [4.5, 4],
        [4.9, 5.5],
      ]);
    }
    /* A whisper of drift keeps the held frame alive. */
    dist += Math.sin(t * 0.5) * 0.3;
    lift += Math.cos(t * 0.42) * 0.25;

    SCRATCH_B.copy(hero).addScaledVector(SCRATCH_A, dist);
    SCRATCH_B.y += lift;
    camera.position.lerp(SCRATCH_B, 1 - Math.exp(-dt * 2.6));
    r.look.lerp(hero, 1 - Math.exp(-dt * 3.2));
    camera.lookAt(r.look);

    /* ── the score's own return (7.5 → 8.0) ───────────────────────────── */
    if (t >= 7.5) {
      if (!r.returning) {
        r.returning = true;
        r.returnFromPos.copy(camera.position);
        r.returnFromLook.copy(r.look);
      }
      const eased = ramp(t, 7.5, BIRTH_END);
      camera.position.lerpVectors(r.returnFromPos, r.homePos, eased);
      r.look.lerpVectors(r.returnFromLook, r.homeTarget, eased);
      camera.lookAt(r.look);
    }
  });

  return null;
}

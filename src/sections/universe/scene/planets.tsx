"use client";

import * as React from "react";
import { Html } from "@react-three/drei";
import { invalidate, useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { ORBIT_CENTRES, PROJECTS, type Project } from "@/data";
import { useSearchMatches } from "@/hooks/use-search";
import {
  readTimelineDate,
  readTimelineNow,
  useTimeline,
} from "@/hooks/use-timeline";
import { useUniverse } from "@/hooks/use-universe";

import {
  arrivalFactor,
  createdAt,
  phaseOffsetAt,
  radiusFactorAt,
  worldScaleAt,
} from "../timeline";
import { labelPortalRef } from "./label-overlay";
import { ProjectCard } from "./planet-card";
import { writePlanetPosition } from "./planet-registry";

/** Scratch vector for per-frame world-position publishing (no allocation). */
const WORLD_POSITION = new THREE.Vector3();

/** Glow amount a search match eases to — brighter than a plain hover. */
const MATCH_GLOW = 1.15;
/** Visibility floor for worlds outside the active result set. */
const FADE_FLOOR = 0.22;

/* ────────────────────────────────────────────────────────────────────────── *
 * Planets — every project in Astra OS rendered as a unique floating world.
 *
 * Layout safety (numbers live in `data/projects.ts`): planets sharing an
 * orbit centre sit 8 units apart in orbit radius while their sphere radii
 * sum to ≤ 4.3 — by the triangle inequality the surfaces can never touch,
 * whatever the plane or phase, and the guaranteed 3D gap is what keeps them
 * from looking merged when a system is seen edge-on. The three centres are
 * 55–61 units apart against a max system reach of 24.5, so whole systems
 * stay clear too.
 *
 * Each world = opaque procedural sphere (value-noise continents or warped
 * gas bands evaluated in object space, so the texture spins with the mesh)
 * + additive fresnel atmosphere shell + a glass DOM label. Orbits are
 * invisible pivots: a tilted plane group holding a Y-spinning arm with the
 * planet hung off its end. Each orbit publishes its world position to
 * `planet-registry.ts` so the neural connections can hang off moving planets.
 * Everything crawls — an orbit takes 2–4 minutes, self-rotation 30–90s.
 *
 * Every world is also a small ecosystem, all of it driven off ONE
 * per-planet clock (`lifeRef`) whose rates are derived from the planet
 * seed — no extra data files: a ~1.5% breathing swell in scale, a glow
 * that rises and settles across the atmosphere shell and the surface rim
 * (`uPulse`), one or two tiny moons on inclined tracks (the second moon is
 * retrograde) lapping in 15–26s, and a satellite on a faster, steeper
 * orbit with a blinking nav beacon. Moons and the satellite hang inside
 * the breathing group, so they inherit timeline growth and dissolve with
 * the world — an unborn or search-dimmed planet takes its ecosystem with
 * it. A whisper of manual exponential fog seats the far system into the
 * void (custom shaders ignore scene fog). The asteroid belts live in
 * `asteroid-belt.tsx`; the labels' holographic treatment is pure CSS.
 * ────────────────────────────────────────────────────────────────────────── */

const vertexShader = /* glsl */ `
  varying vec3 vObjPos;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;

  void main() {
    vObjPos = normalize(position);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uAccent;
  uniform vec3 uAtmosphere;
  uniform vec3 uLightDir;
  uniform vec3 uFogColor;
  uniform float uBands;
  uniform float uSeed;
  uniform float uFogDensity;
  uniform float uHover;
  uniform float uPulse;
  uniform float uFade;

  varying vec3 vObjPos;
  varying vec3 vNormalW;
  varying vec3 vWorldPos;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
          f.y),
      mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
          f.y),
      f.z);
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p = p * 2.03 + vec3(1.7);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 dir = normalize(vObjPos);
    float detail = fbm(dir * 6.0 + vec3(uSeed * 1.7));

    /* Rocky: threshold noise into oceans / continents, ridge the highlands,
       frost the poles. */
    float base = fbm(dir * 2.2 + vec3(uSeed));
    float land = smoothstep(0.46, 0.6, base + detail * 0.14);
    vec3 rocky = mix(uDeep, uMid, land);
    rocky = mix(rocky, uAccent, smoothstep(0.64, 0.8, base) * 0.7);
    float polar = smoothstep(0.76, 0.93, abs(dir.y) + detail * 0.07);
    rocky = mix(rocky, mix(uAccent, vec3(1.0), 0.45), polar * 0.85);

    /* Gas giant: latitude bands warped by noise, plus a drifting storm. */
    float warp = fbm(dir * 2.4 + vec3(uSeed)) - 0.5;
    float band = sin((dir.y + warp * 0.4) * 17.0) * 0.5 + 0.5;
    vec3 gas = mix(uDeep, uMid, smoothstep(0.2, 0.8, band));
    float storm = smoothstep(0.5, 0.85, fbm(dir * 3.2 + vec3(uSeed * 2.0)) * (0.5 + band));
    gas = mix(gas, uAccent, storm * 0.55);

    vec3 albedo = mix(rocky, gas, uBands);

    /* Soft key with a wrapped terminator + atmosphere fresnel. */
    vec3 normal = normalize(vNormalW);
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float ndl = dot(normal, normalize(uLightDir));
    float lit = 0.34 + 0.78 * smoothstep(-0.3, 0.75, ndl);
    vec3 color = albedo * lit;

    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);
    /* uPulse breathes the rim light; parked at 0.5 it multiplies by exactly
       1.0, so reduced motion renders the historical baseline. */
    color += uAtmosphere * fresnel * (0.5 + 0.8 * uHover) * (0.78 + 0.44 * uPulse);

    /* Hover energy — a gentle overall lift while the world is inspected. */
    color *= 1.0 + 0.15 * uHover;

    /* Manual exp² fog (scene fog doesn't reach custom shaders). */
    float depth = length(cameraPosition - vWorldPos);
    float fogAmount = 1.0 - exp(-uFogDensity * uFogDensity * depth * depth);
    color = mix(color, uFogColor, fogAmount);

    /* Search fade: worlds outside the result set dissolve into the void. */
    gl_FragColor = vec4(color, uFade);
  }
`;

const atmosphereVertex = /* glsl */ `
  varying vec3 vViewNormal;
  void main() {
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uHover;
  uniform float uPulse;
  uniform float uFade;
  varying vec3 vViewNormal;
  void main() {
    /* Back-side halo: zero exactly at the shell's silhouette (edge-on normal,
       no hard cut) and brightening inward toward the planet's limb, where the
       opaque sphere occludes it — so only a smooth rim glow survives. uPulse
       breathes the halo (0.5 = the historical level, and reduced motion
       parks there). */
    float rim = max(0.0, -dot(vViewNormal, vec3(0.0, 0.0, 1.0)));
    float glow = pow(rim, 2.2) * 1.5 * (1.0 + 0.95 * uHover) * (0.75 + 0.5 * uPulse);
    gl_FragColor = vec4(uColor * glow, glow * uFade);
  }
`;

/* ── Ecosystem shading (moons + satellite hulls) ─────────────────────────── *
 * One shared look per world: the same wrapped key direction and manual
 * exp² fog as the planet it circles, tinted halfway to white from the
 * world's mid tone so the whole family reads as one palette. Alpha carries
 * the world's fade, so satellites dissolve with their planet. */
const ecosystemVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vWorldPos;

  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const ecosystemFragment = /* glsl */ `
  uniform vec3 uTint;
  uniform vec3 uLightDir;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uFade;

  varying vec3 vNormalW;
  varying vec3 vWorldPos;

  void main() {
    vec3 normal = normalize(vNormalW);
    float ndl = dot(normal, normalize(uLightDir));
    float lit = 0.42 + 0.75 * smoothstep(-0.35, 0.8, ndl);
    vec3 color = uTint * lit;

    float depth = length(cameraPosition - vWorldPos);
    float fogAmount = 1.0 - exp(-uFogDensity * uFogDensity * depth * depth);
    color = mix(color, uFogColor, fogAmount);

    gl_FragColor = vec4(color, uFade);
  }
`;

/* Satellite nav beacon — a sharp additive blink on the shared clock, so it
   freezes at a dim constant under reduced motion. */
const beaconVertex = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const beaconFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uRate;
  uniform float uPhase;
  uniform float uFade;

  void main() {
    float wave = 0.5 + 0.5 * sin(uTime * uRate + uPhase);
    float pulse = pow(wave, 6.0);
    vec3 color = uColor * (0.9 + 2.6 * pulse);
    gl_FragColor = vec4(color, (0.16 + 0.84 * pulse) * uFade);
  }
`;

/** Deterministic fractional part — the seed-derivation helper for rates. */
const frac = (x: number) => x - Math.floor(x);

/**
 * Everything that circles a world, derived from its existing seed (adding
 * no data): breathing/glow rhythms, its tiny moons — large worlds (r ≥ 1.8)
 * get two, the second one retrograde — and one satellite on a faster,
 * steeper track. Rates keep motion always perceptible but unhurried: moons
 * lap in 15–26s, the satellite in 10–16s, the breath swells every 5–13s,
 * the glow every 9–21s.
 */
function ecosystemOf(project: Project) {
  const { radius, seed } = project.planet;
  const f = (k: number) => frac(seed * k);
  return {
    breathe: { rate: 0.5 + f(3.7) * 0.7, phase: seed * 2.4 },
    glow: { rate: 0.3 + f(9.1) * 0.4, phase: seed * 5.1 },
    moons: Array.from({ length: radius >= 1.8 ? 2 : 1 }, (_, i) => ({
      orbit: radius * (1.78 + 0.3 * f(2.3 + i * 4.1)),
      size: radius * (0.1 + 0.05 * f(5.9 + i * 3.3)),
      speed: (0.24 + f(7.7 + i * 2.9) * 0.14) * (i === 1 ? -1 : 1),
      phase: f(1.1 + i * 6.7) * Math.PI * 2,
      tiltX: (f(8.3 + i) - 0.5) * 1.1,
      tiltZ: (f(4.9 + i) - 0.5) * 1.1,
    })),
    sat: {
      orbit: radius * 2.6 + 0.6,
      speed: 0.4 + f(6.1) * 0.2,
      phase: f(3.3) * Math.PI * 2,
      tiltX: (f(2.7) - 0.5) * 1.2,
      tiltZ: (f(9.9) - 0.5) * 1.2,
      size: Math.max(0.06, radius * 0.05),
      blink: 1.8 + f(4.4) * 1.6,
      blinkPhase: f(7.2) * Math.PI * 2,
    },
  };
}

/** Fixed key direction — upper-right-front, echoing the scene's violet key. */
const LIGHT_DIR = new THREE.Vector3(0.55, 0.5, 0.55);
/** Matches the scene's fogExp2 colour; density is gentler for depth without mush. */
const FOG_COLOR = new THREE.Color("#070512");
const FOG_DENSITY = 0.005;

function PlanetBody({
  project,
  hoverRef,
  fadeRef,
  timeScaleRef,
  timeFadeRef,
  reduced = false,
}: {
  project: Project;
  hoverRef: React.RefObject<number>;
  /** 1 = fully visible, eases toward the fade floor off the search radar. */
  fadeRef: React.RefObject<number>;
  /** Timeline growth — the world's scale at the viewed date (exactly 1 now). */
  timeScaleRef: React.RefObject<number>;
  /** Timeline existence — 0 while unborn, 1 once the world has arrived. */
  timeFadeRef: React.RefObject<number>;
  reduced?: boolean;
}) {
  const { radius, deep, mid, accent, atmosphere, bands, seed, spin, tilt } =
    project.planet;
  const tiltGroup = React.useRef<THREE.Group>(null);

  /** Breathing / glow / moon / satellite rhythms for this world. */
  const eco = React.useMemo(() => ecosystemOf(project), [project]);
  /** ONE clock per world — advances only when motion is allowed. */
  const lifeRef = React.useRef(0);
  const ecosystemGroup = React.useRef<THREE.Group>(null);
  const moonPivots = React.useRef<(THREE.Group | null)[]>([]);
  const satPivot = React.useRef<THREE.Group>(null);
  const satBody = React.useRef<THREE.Group>(null);

  const surfaceMaterial = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uDeep: { value: new THREE.Color(deep) },
          uMid: { value: new THREE.Color(mid) },
          uAccent: { value: new THREE.Color(accent) },
          uAtmosphere: { value: new THREE.Color(atmosphere) },
          uLightDir: { value: LIGHT_DIR.clone() },
          uFogColor: { value: FOG_COLOR.clone() },
          uFogDensity: { value: FOG_DENSITY },
          uBands: { value: bands },
          uSeed: { value: seed },
          uHover: { value: 0 },
          uPulse: { value: 0.5 },
          uFade: { value: 1 },
        },
      }),
    [deep, mid, accent, atmosphere, bands, seed],
  );

  const atmosphereMaterial = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVertex,
        fragmentShader: atmosphereFragment,
        uniforms: {
          uColor: { value: new THREE.Color(atmosphere) },
          uHover: { value: 0 },
          uPulse: { value: 0.5 },
          uFade: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
      }),
    [atmosphere],
  );

  /** Moons + satellite hull: world-tinted lambert, fading with the world. */
  const craftMaterial = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ecosystemVertex,
        fragmentShader: ecosystemFragment,
        uniforms: {
          uTint: {
            value: new THREE.Color(mid).lerp(new THREE.Color("#f0f4ff"), 0.55),
          },
          uLightDir: { value: LIGHT_DIR.clone() },
          uFogColor: { value: FOG_COLOR.clone() },
          uFogDensity: { value: FOG_DENSITY },
          uFade: { value: 1 },
        },
      }),
    [mid],
  );

  /** Satellite nav beacon — additive, blinking on the shared clock. */
  const beaconMaterial = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: beaconVertex,
        fragmentShader: beaconFragment,
        uniforms: {
          uColor: { value: new THREE.Color(atmosphere) },
          uTime: { value: 0 },
          uRate: { value: eco.sat.blink },
          uPhase: { value: eco.sat.blinkPhase },
          uFade: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [atmosphere, eco.sat.blink, eco.sat.blinkPhase],
  );

  React.useEffect(
    () => () => {
      surfaceMaterial.dispose();
      atmosphereMaterial.dispose();
      craftMaterial.dispose();
      beaconMaterial.dispose();
    },
    [surfaceMaterial, atmosphereMaterial, craftMaterial, beaconMaterial],
  );

  /* Hover response: the smoothed 0→1 amount lives in the parent ref, so
     scale and glow always move in lockstep with the spin boost. The fade
     amount (search results) rides the same pass: once a world drops below
     fully opaque it stops writing depth, so stars and beams read through it
     and it truly sinks into the background. The same pass also advances the
     world's one clock — breathing scale, glow pulse, moon and satellite
     orbits, beacon blink — everything frozen under reduced motion (where
     `life` never advances, so every derived value parks at its baseline). */
  useFrame((_, delta) => {
    const hover = hoverRef.current;
    /* Search dim and timeline existence stack: a world outside both the
       result set and the present dissolves completely. */
    const fade = Math.min(fadeRef.current, timeFadeRef.current);
    if (!reduced) lifeRef.current += Math.min(delta, 0.1);
    const life = lifeRef.current;
    const breathe = reduced
      ? 1
      : 1 + 0.016 * Math.sin(life * eco.breathe.rate + eco.breathe.phase);
    const pulse = reduced
      ? 0.5
      : 0.5 + 0.5 * Math.sin(life * eco.glow.rate + eco.glow.phase);
    if (tiltGroup.current) {
      tiltGroup.current.scale.setScalar(
        (1 + 0.1 * hover) *
          (0.94 + 0.06 * fade) *
          timeScaleRef.current *
          breathe,
      );
    }
    surfaceMaterial.uniforms.uHover.value = hover;
    surfaceMaterial.uniforms.uPulse.value = pulse;
    atmosphereMaterial.uniforms.uHover.value = hover;
    atmosphereMaterial.uniforms.uPulse.value = pulse;
    surfaceMaterial.uniforms.uFade.value = fade;
    atmosphereMaterial.uniforms.uFade.value = fade;
    craftMaterial.uniforms.uFade.value = fade;
    beaconMaterial.uniforms.uTime.value = life;
    beaconMaterial.uniforms.uFade.value = fade;
    const fading = fade < 0.97;
    for (const material of [surfaceMaterial, craftMaterial]) {
      if (material.transparent !== fading) {
        material.transparent = fading;
        material.depthWrite = !fading;
        material.needsUpdate = true;
      }
    }
    /* An unborn or dissolved world takes its ecosystem with it. */
    if (ecosystemGroup.current) {
      ecosystemGroup.current.visible = fade > 0.02;
    }
    for (let i = 0; i < eco.moons.length; i++) {
      const moon = eco.moons[i];
      const pivot = moonPivots.current[i];
      if (pivot) pivot.rotation.y = moon.phase + life * moon.speed;
    }
    if (satPivot.current) {
      satPivot.current.rotation.y = eco.sat.phase + life * eco.sat.speed;
    }
    if (satBody.current) {
      satBody.current.rotation.y = life * 0.5;
      satBody.current.rotation.x = life * 0.16;
    }
  });

  return (
    <group ref={tiltGroup} rotation={[0, 0, tilt]}>
      <PlanetSphere
        radius={radius}
        material={surfaceMaterial}
        spin={spin}
        startAngle={seed}
        hoverRef={hoverRef}
        reduced={reduced}
      />
      <mesh
        scale={radius * 1.3}
        frustumCulled={false}
        material={atmosphereMaterial}
      >
        <sphereGeometry args={[1, 32, 24]} />
      </mesh>
      {/* ── The living ecosystem: tiny moons on inclined tracks (world two
          retrograde) and a satellite — hull, wing, blinking nav beacon —
          on a faster, steeper orbit. All of it breathes with the world
          above, and all of it dissolves when the world does. ──────────── */}
      <group ref={ecosystemGroup}>
        {eco.moons.map((moon, moonIndex) => (
          <group
            key={`${moon.orbit}-${moonIndex}`}
            rotation={[moon.tiltX, 0, moon.tiltZ]}
          >
            <group
              ref={(element) => {
                moonPivots.current[moonIndex] = element;
              }}
            >
              <mesh
                position={[moon.orbit, 0, 0]}
                scale={moon.size}
                material={craftMaterial}
              >
                <sphereGeometry args={[1, 14, 10]} />
              </mesh>
            </group>
          </group>
        ))}
        <group rotation={[eco.sat.tiltX, 0, eco.sat.tiltZ]}>
          <group ref={satPivot}>
            <group ref={satBody} position={[eco.sat.orbit, 0, 0]}>
              <mesh material={craftMaterial}>
                <boxGeometry
                  args={[
                    eco.sat.size * 2.4,
                    eco.sat.size * 0.9,
                    eco.sat.size * 0.9,
                  ]}
                />
              </mesh>
              <mesh material={craftMaterial}>
                <boxGeometry
                  args={[
                    eco.sat.size * 0.4,
                    eco.sat.size * 0.16,
                    eco.sat.size * 3.4,
                  ]}
                />
              </mesh>
              <mesh
                position={[eco.sat.size * 1.5, 0, 0]}
                scale={eco.sat.size * 0.5}
                material={beaconMaterial}
              >
                <sphereGeometry args={[1, 10, 8]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

/** The spinning sphere itself — separated so axial tilt wraps the spin axis. */
function PlanetSphere({
  radius,
  material,
  spin,
  startAngle,
  hoverRef,
  reduced = false,
}: {
  radius: number;
  material: THREE.Material;
  spin: number;
  startAngle: number;
  hoverRef: React.RefObject<number>;
  reduced?: boolean;
}) {
  const mesh = React.useRef<THREE.Mesh>(null);

  React.useLayoutEffect(() => {
    // Deterministic starting face — also the frozen pose under reduced motion.
    if (mesh.current) mesh.current.rotation.y = startAngle;
  }, [startAngle]);

  useFrame((_, delta) => {
    if (reduced || !mesh.current) return;
    // Clamp against tab-switch delta spikes so planets don't whip around.
    // Hovering eases the spin up to 3.5× while the world is inspected.
    mesh.current.rotation.y +=
      Math.min(delta, 0.1) * spin * (1 + 2.5 * hoverRef.current);
  });

  return (
    <mesh ref={mesh} material={material}>
      <sphereGeometry args={[radius, 48, 32]} />
    </mesh>
  );
}

/**
 * Per-slot label placement: above / below / above-and-further-out.
 * Systems hold ≤ 3 planets and are listed sequentially, so `index % 3` is the
 * planet's slot inside its system. Direction alone isn't enough — two pills can
 * still land at the same height when their spheres project close together — so
 * the third slot also stands further clear of the sphere.
 */
const LABEL_STANDOFF = [1.5, 1.5, 3.4];

function PlanetLabel({
  project,
  slot,
  hovered = false,
  searching = false,
  dimmed = false,
  focused = false,
  reduced = false,
}: {
  project: Project;
  slot: number;
  hovered?: boolean;
  /** A search is live — the pill keeps its resting pose (no card swap). */
  searching?: boolean;
  /** This world fell outside the result set — sink the pill back. */
  dimmed?: boolean;
  /** This world's dossier is open — it presents as it is today. */
  focused?: boolean;
  reduced?: boolean;
}) {
  const { radius, atmosphere } = project.planet;
  /* Leaf subscription: only this pill re-renders while the timeline is
     scrubbed — the planet, its materials and the scene stay untouched. */
  const { date, now } = useTimeline();
  const offset = radius + (LABEL_STANDOFF[slot] ?? LABEL_STANDOFF[0]);
  const above = slot % 2 === 0;
  const anchor = above ? offset : -offset;
  /* Same easing family as the HUD's glass motion. */
  const ease = "cubic-bezier(0.16, 1, 0.3, 1)";
  /* During a search the pill stays up: matches blaze, others fade back.
     A world that doesn't exist yet at the viewed date stays invisible. */
  const born = arrivalFactor(focused ? now : date, createdAt(project));
  const resting = (searching ? (dimmed ? 0.22 : 1) : hovered ? 0 : 1) * born;

  return (
    <>
      {/* Resting pill — crossfades away while the card is up. drei derives
          each Html node's z-index from its camera distance inside the given
          `zIndexRange`, so pills live in band [0, 6] and the card below in
          the constant band above it (9) — cards always paint over pills. */}
      <Html
        position={[0, anchor, 0]}
        center
        pointerEvents="none"
        zIndexRange={[6, 0]}
        className="pointer-events-none"
        portal={labelPortalRef}
      >
        <div
          className="glass holo-label flex items-center gap-1.5 rounded-full px-2.5 py-1 whitespace-nowrap"
          style={{
            opacity: resting,
            transform:
              !searching && hovered
                ? `scale(0.9) translateY(${above ? -6 : 6}px)`
                : "scale(1) translateY(0)",
            transition: reduced
              ? "none"
              : `opacity 0.25s ${ease}, transform 0.25s ${ease}`,
          }}
        >
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full"
            style={{
              backgroundColor: atmosphere,
              boxShadow: `0 0 8px ${atmosphere}`,
            }}
          />
          <span className="text-ink text-micro tracking-caps font-mono">
            {project.name}
          </span>
        </div>
      </Html>

      {/* Hover dossier — centred on the same anchor, then clamped inside
          the viewport by the card itself, so it never runs off-screen even
          when a drifting world sits near an edge. Fixed z-band 9 keeps it
          above every resting pill (max 6). */}
      <Html
        position={[0, anchor, 0]}
        center
        pointerEvents="none"
        zIndexRange={[9, 9]}
        className="pointer-events-none"
        portal={labelPortalRef}
      >
        <ProjectCard project={project} visible={hovered} reduced={reduced} />
      </Html>
    </>
  );
}

function OrbitingPlanet({
  project,
  index,
  reduced,
}: {
  project: Project;
  index: number;
  reduced: boolean;
}) {
  const { centre, radius, phase, speed, plane } = project.orbit;
  const pivot = React.useRef<THREE.Group>(null);
  const body = React.useRef<THREE.Group>(null);
  const position = ORBIT_CENTRES[centre];
  const { focus: focusOn, focusedId } = useUniverse();
  const matchedIds = useSearchMatches();
  const [hovered, setHovered] = React.useState(false);
  /** Smoothed 0→1 hover amount — drives scale, glow and spin in lockstep. */
  const hoverRef = React.useRef(0);
  /** Smoothed 1→floor visibility — matches blaze, the rest sink back. */
  const fadeRef = React.useRef(1);
  /** Smoothed *viewed date* — the single value every time-travel factor
   *  reads, so a scrub glides through the scene instead of stepping. */
  const timeRef = React.useRef<number | null>(null);
  /** Accumulated orbital crawl (the JSX `phase` seeds it). */
  const orbitAngle = React.useRef(phase);
  /** Timeline scale/fade handed to `PlanetBody` each frame (exactly 1 now). */
  const timeScaleRef = React.useRef(1);
  const timeFadeRef = React.useRef(1);
  /** Invisible click target — grows with the world so an unborn world
   *  can't be clicked out of the void. */
  const hitRef = React.useRef<THREE.Mesh>(null);
  const hitBase = Math.max(project.planet.radius * 2.4, 2.6);
  const focused = focusedId === project.id;
  /* Search radar: a live query overrides hover — matched worlds glow on their
     own, everything else dims (and swaps its card for the results panel). */
  const searching = matchedIds !== null;
  const isMatch =
    searching && matchedIds !== null && matchedIds.includes(project.id);
  /* While a world is focused the dossier panel owns the stage — keep the
     hover card out of the way, but still answer the pointer with glow. */
  const showCard = hovered && !focused && !searching;
  /** Screen position the current press started at — click vs. drag. */
  const pressedAt = React.useRef<{ x: number; y: number } | null>(null);

  /* Kick the renderer so a hover/search ease can run to completion even when
     the scene is idling under frameloop="demand" (reduced motion). */
  React.useEffect(() => {
    invalidate();
  }, [hovered, isMatch, searching]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const nowMs = readTimelineNow();
    const targetDate = readTimelineDate();

    /* Smooth the viewed date itself — arrival, growth, radius and phase all
       derive from this one damped value, so dragging the timeline (or a
       marker jump, or auto-play) reads as continuous travel through time. */
    const from = timeRef.current ?? targetDate;
    let travel: number;
    if (reduced) {
      travel = targetDate;
    } else {
      const eased = THREE.MathUtils.damp(from, targetDate, 6, dt);
      travel = Math.abs(eased - targetDate) < 0.05 ? targetDate : eased;
    }
    timeRef.current = travel;
    /* A focused world always presents as it is today — the dossier shows
       its real state, so flying to a world never lands on an invisible one
       while the viewer is parked in the past. */
    const view = focused ? nowMs : travel;

    timeScaleRef.current = worldScaleAt(view, createdAt(project), nowMs);
    timeFadeRef.current = arrivalFactor(view, createdAt(project));

    if (!reduced && pivot.current) {
      // Clamp against tab-switch delta spikes so planets don't whip around.
      orbitAngle.current += dt * speed;
    }
    if (pivot.current) {
      // Timeline phase rides on top of the crawl — exactly native at now.
      pivot.current.rotation.y =
        orbitAngle.current + phaseOffsetAt(travel, nowMs);
    }
    if (body.current) {
      // Young worlds circle further out, tightening inward as they arrive.
      body.current.position.x =
        radius * radiusFactorAt(view, createdAt(project));
    }
    if (hitRef.current) {
      const scale = timeScaleRef.current;
      hitRef.current.visible = scale > 0.05;
      hitRef.current.scale.setScalar(hitBase * Math.min(1, scale));
    }

    /* Ease the hover amount toward its target; keep requesting frames while
       it settles so the transition also completes in demand mode. Matches
       ease past 1 for an extra-bright "found" glow. */
    const glowTarget = searching ? (isMatch ? MATCH_GLOW : 0) : hovered ? 1 : 0;
    const fadeTarget = searching && !isMatch ? FADE_FLOOR : 1;
    let settled = true;
    for (const [ref, target] of [
      [hoverRef, glowTarget],
      [fadeRef, fadeTarget],
    ] as const) {
      const eased = THREE.MathUtils.damp(ref.current, target, 7.5, dt);
      if (Math.abs(eased - target) < 0.001) {
        ref.current = target;
      } else {
        ref.current = eased;
        settled = false;
      }
    }
    if (!settled) invalidate();

    // Publish the world position for the connection beams — done even under
    // reduced motion so static beams still anchor to the planets.
    if (body.current) {
      body.current.getWorldPosition(WORLD_POSITION);
      writePlanetPosition(project.id, WORLD_POSITION);
    }
  });

  return (
    <group position={[position[0], position[1], position[2]]} rotation={plane}>
      <group ref={pivot} rotation={[0, phase, 0]}>
        <group ref={body} position={[radius, 0, 0]}>
          <PlanetBody
            project={project}
            hoverRef={hoverRef}
            fadeRef={fadeRef}
            timeScaleRef={timeScaleRef}
            timeFadeRef={timeFadeRef}
            reduced={reduced}
          />
          <PlanetLabel
            project={project}
            slot={index % 3}
            hovered={showCard}
            searching={searching}
            dimmed={searching && !isMatch}
            focused={focused}
            reduced={reduced}
          />
          {/* Generous invisible hit target — a click (no drag) selects the
              world and opens its dossier panel; double-click does the same.
              Hover glows the world and opens the floating card. Drawn fully
              transparent so it never touches the frame, but still raycastable.
              Scale + visibility track the timeline each frame (an unborn
              world can't be selected out of the void). */}
          <mesh
            ref={hitRef}
            onPointerDown={(event) => {
              pressedAt.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerUp={(event) => {
              const down = pressedAt.current;
              pressedAt.current = null;
              if (!down) return;
              // Ignore orbit drags that happen to end on the proxy.
              if (
                Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6
              )
                return;
              event.stopPropagation();
              focusOn(project.id);
            }}
            onPointerCancel={() => {
              pressedAt.current = null;
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              focusOn(project.id);
            }}
            onPointerOver={(event) => {
              event.stopPropagation();
              setHovered(true);
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              setHovered(false);
              document.body.style.cursor = "";
            }}
          >
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial
              transparent
              opacity={0}
              depthWrite={false}
              colorWrite={false}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export interface PlanetsProps {
  /** Freeze orbits and self-rotation (prefers-reduced-motion). */
  reduced?: boolean;
}

export function Planets({ reduced = false }: PlanetsProps) {
  /* If we unmount while the pointer hovers a hit target, drop the cursor. */
  React.useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    [],
  );

  return (
    <>
      {PROJECTS.map((project, index) => (
        <OrbitingPlanet
          key={project.id}
          project={project}
          index={index}
          reduced={reduced}
        />
      ))}
    </>
  );
}

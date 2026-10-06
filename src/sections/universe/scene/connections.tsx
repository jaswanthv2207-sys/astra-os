"use client";

import * as React from "react";
import { invalidate, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { PROJECTS, PROJECT_LINKS, type Project } from "@/data";
import { useSearchMatches } from "@/hooks/use-search";
import { readTimelineDate } from "@/hooks/use-timeline";

import { arrivalFactor, createdAt } from "../timeline";
import { readPlanetPosition } from "./planet-registry";

/* ────────────────────────────────────────────────────────────────────────── *
 * Connections — animated neural energy beams between related planets.
 *
 * Each `PROJECT_LINKS` pair becomes a curved filament that tracks both
 * planets as they orbit, drawn as three superimposed layers:
 *
 *   1. core line   — bright travelling pulse wavefronts (sharp head, long
 *                    tail) plus a flare where the beam meets a planet,
 *   2. glow points — static soft sprites laid densely along the curve so the
 *                    beam has volumetric body for the bloom pass to catch,
 *   3. flow points — particles sliding along the curve in both directions,
 *                    colour-graded between the two planets' atmosphere
 *                    tones so every beam reads as energy shared by its
 *                    endpoints.
 *
 * The curve is a quadratic Bézier whose control point bows sideways and up
 * by a fixed fraction of the link length — organic, deterministic, and it
 * keeps beams from hiding exactly behind the line between two planets.
 *
 * Performance: the control points (A/M/B) are per-vertex attributes written
 * from live planet positions each frame (no geometry rebuild, no
 * allocation), everything renders additively with `depthWrite: false` in two
 * draw calls, and `uTime` freezes under reduced motion so the network holds
 * a static lit pose inside the canvas's `frameloop="demand"`.
 * ────────────────────────────────────────────────────────────────────────── */

/** Polyline resolution per beam (points; drawn as line segments). */
const LINE_SAMPLES = 40;
/** Static soft sprites that give each beam its volumetric glow. */
const GLOW_POINTS = 40;
/** Travelling particles per beam. */
const FLOW_POINTS = 14;
/** Point sizes in CSS px at ~90 units of depth (attenuated in the shader). */
const GLOW_SIZE = 7;
const FLOW_SIZE = 4.2;
/** Pulse wavefronts: `t` advances this fraction per second (→ ~14s traversal). */
const PULSE_SPEED = 0.14;
/** Particle traversal speed range in curve-fractions per second (11–20s). */
const FLOW_SPEED_MIN = 0.05;
const FLOW_SPEED_RANGE = 0.04;
/** exp² distance fade — gentle, so cross-system beams still read. */
const BEAM_FOG = 0.0028;
/** Side/up bow as a fraction of link length, alternating per link. */
const BOW_SIDE = 0.16;
const BOW_UP = 0.08;

const UP = new THREE.Vector3(0, 1, 0);

/* ── Shaders ─────────────────────────────────────────────────────────────── */

const lineVertex = /* glsl */ `
  attribute vec3 aA;
  attribute vec3 aM;
  attribute vec3 aB;
  attribute float aT;
  attribute float aSeed;
  attribute float aMatch;
  attribute float aBirth;
  attribute vec3 aColA;
  attribute vec3 aColB;

  varying float vT;
  varying float vSeed;
  varying float vMatch;
  varying float vBirth;
  varying vec3 vColA;
  varying vec3 vColB;
  varying float vDist;

  void main() {
    float inv = 1.0 - aT;
    vec3 p = inv * inv * aA + 2.0 * inv * aT * aM + aT * aT * aB;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vT = aT;
    vSeed = aSeed;
    vMatch = aMatch;
    vBirth = aBirth;
    vColA = aColA;
    vColB = aColB;
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const lineFragment = /* glsl */ `
  uniform float uTime;
  uniform float uFogDensity;
  uniform float uSearch;

  varying float vT;
  varying float vSeed;
  varying float vMatch;
  varying float vBirth;
  varying vec3 vColA;
  varying vec3 vColB;
  varying float vDist;

  void main() {
    vec3 col = mix(vColA, vColB, vT);

    /* Synapse flares where the beam plugs into a planet. */
    float nodes = pow(1.0 - vT, 10.0) + pow(vT, 10.0);

    /* Travelling energy: a sharp head with a long tail behind it, so the
       wavefront visibly flows from one planet toward the other. */
    float head = fract(vT * 2.0 - uTime * ${PULSE_SPEED} + vSeed);
    float energy = pow(head, 7.0);
    float shimmer = 0.86 + 0.14 * sin(uTime * 2.3 + vSeed * 41.0);

    float fog = exp(-uFogDensity * uFogDensity * vDist * vDist);
    float intensity = (0.34 + nodes * 1.5 + energy * 1.9) * shimmer;

    /* Timeline: a beam only exists once both worlds have arrived — until
       then it burns itself out to black (additive blend → invisible). */
    intensity *= vBirth;

    /* Search highlight: with a result set live, connections touching the
       matches blaze (both endpoints = strongest) and the rest recede. */
    float matched = step(0.01, vMatch);
    intensity *= (1.0 + uSearch * vMatch * 1.5)
      * (1.0 - uSearch * 0.8 * (1.0 - matched));

    vec3 c = col * intensity + vec3(1.0) * energy * 0.35;

    gl_FragColor = vec4(c * fog, 1.0);
  }
`;

const pointVertex = /* glsl */ `
  attribute vec3 aA;
  attribute vec3 aM;
  attribute vec3 aB;
  attribute float aT;
  attribute float aPhase;
  attribute float aFlow;
  attribute float aSize;
  attribute float aSeed;
  attribute float aMatch;
  attribute float aBirth;
  attribute vec3 aColA;
  attribute vec3 aColB;

  uniform float uTime;
  uniform float uDpr;
  uniform float uFogDensity;
  uniform float uSearch;

  varying vec3 vCol;
  varying float vAlpha;
  varying float vCore;

  void main() {
    float t;
    if (aFlow > 0.5) {
      /* Particle: slides along the curve, mostly A→B, each with its own
         speed and a twinkle so the stream never moves in lockstep. */
      float rnd = fract(sin(aSeed * 91.7 + aPhase * 43.13) * 43758.5453);
      float speed = ${FLOW_SPEED_MIN} + rnd * ${FLOW_SPEED_RANGE};
      t = rnd < 0.62
        ? fract(aPhase + uTime * speed)
        : fract(aPhase - uTime * speed);
      vAlpha = 0.35 + 0.65 * (0.55 + 0.45 * sin(uTime * 2.1 + rnd * 37.0));
      vCore = 1.0;
    } else {
      /* Static glow sprite: the beam's volumetric body. */
      t = aT;
      vAlpha = 0.15;
      vCore = 0.0;
    }

    float inv = 1.0 - t;
    vec3 p = inv * inv * aA + 2.0 * inv * t * aM + t * t * aB;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;

    float fog = exp(-uFogDensity * uFogDensity * dist * dist);
    vAlpha *= fog;
    /* Timeline: no beam body until both worlds exist at the viewed date. */
    vAlpha *= aBirth;
    /* Search highlight — mirrors the core line's blaze/dim curve. */
    float matched = step(0.01, aMatch);
    vAlpha *= (1.0 + uSearch * aMatch * 1.4)
      * (1.0 - uSearch * 0.75 * (1.0 - matched));
    vCol = mix(aColA, aColB, t);

    gl_PointSize = min(aSize * uDpr * (300.0 / max(dist, 1.0)), 64.0 * uDpr);
    gl_Position = projectionMatrix * mv;
  }
`;

const pointFragment = /* glsl */ `
  varying vec3 vCol;
  varying float vAlpha;
  varying float vCore;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
    if (d > 1.0) discard;
    float halo = pow(1.0 - d, 2.4);
    float core = smoothstep(0.5, 0.0, d) * vCore;
    vec3 c = mix(vCol, vec3(1.0), core * 0.8);
    float a = halo * vAlpha * (0.55 + 0.45 * vCore);
    gl_FragColor = vec4(c * (1.0 + core * 1.6), a);
  }
`;

/* ── Geometry ────────────────────────────────────────────────────────────── */

interface BeamPair {
  a: Project;
  b: Project;
}

interface BeamScene {
  lineGeometry: THREE.BufferGeometry;
  pointGeometry: THREE.BufferGeometry;
  lineMaterial: THREE.ShaderMaterial;
  pointMaterial: THREE.ShaderMaterial;
}

/** Deterministic 0..1 seed per link (keeps pulses out of sync). */
function linkSeed(index: number): number {
  return ((index * 9301 + 49297) % 233280) / 233280;
}

/** Write one control point into every vertex slot of a dynamic buffer. */
function fillSpan(
  array: Float32Array,
  start: number,
  count: number,
  value: THREE.Vector3,
): void {
  for (let v = start; v < start + count; v++) {
    const o = v * 3;
    array[o] = value.x;
    array[o + 1] = value.y;
    array[o + 2] = value.z;
  }
}

/** Write one scalar (search-match weight) into every vertex of a span. */
function fillScalar(
  array: Float32Array,
  start: number,
  count: number,
  value: number,
): void {
  array.fill(value, start, start + count);
}

function dynamicAttr(array: Float32Array, itemSize: number) {
  const attr = new THREE.BufferAttribute(array, itemSize);
  attr.setUsage(THREE.DynamicDrawUsage);
  return attr;
}

function buildScene(links: readonly BeamPair[]): BeamScene {
  const linkCount = links.length;
  const lineVerts = linkCount * (LINE_SAMPLES - 1) * 2;
  const pointVerts = linkCount * (GLOW_POINTS + FLOW_POINTS);

  /* Dynamic control-point buffers (per vertex: A, M, B). */
  const lineA = new Float32Array(lineVerts * 3);
  const lineM = new Float32Array(lineVerts * 3);
  const lineB = new Float32Array(lineVerts * 3);
  const pointA = new Float32Array(pointVerts * 3);
  const pointM = new Float32Array(pointVerts * 3);
  const pointB = new Float32Array(pointVerts * 3);

  /* Static per-vertex attributes. */
  const lineT = new Float32Array(lineVerts);
  const lineSeed = new Float32Array(lineVerts);
  const lineColA = new Float32Array(lineVerts * 3);
  const lineColB = new Float32Array(lineVerts * 3);
  const pointT = new Float32Array(pointVerts);
  const pointPhase = new Float32Array(pointVerts);
  const pointFlow = new Float32Array(pointVerts);
  const pointSize = new Float32Array(pointVerts);
  const pointSeed = new Float32Array(pointVerts);
  const pointColA = new Float32Array(pointVerts * 3);
  const pointColB = new Float32Array(pointVerts * 3);

  /* Search-match weight per vertex (0 = unrelated, 0.5 = one endpoint,
     1 = both) — a dynamic attribute so the highlight crossfades in-shader. */
  const lineMatch = new Float32Array(lineVerts);
  const pointMatch = new Float32Array(pointVerts);

  /* Timeline arrival per vertex (0 until both worlds exist at the viewed
     date, 1 at the present) — dynamic for the same crossfade reason. */
  const lineBirth = new Float32Array(lineVerts);
  const pointBirth = new Float32Array(pointVerts);

  let lv = 0;
  let pv = 0;

  const putCols = (
    colA: Float32Array,
    colB: Float32Array,
    v: number,
    a: THREE.Color,
    b: THREE.Color,
  ) => {
    colA[v * 3] = a.r;
    colA[v * 3 + 1] = a.g;
    colA[v * 3 + 2] = a.b;
    colB[v * 3] = b.r;
    colB[v * 3 + 1] = b.g;
    colB[v * 3 + 2] = b.b;
  };

  links.forEach((link, i) => {
    const seed = linkSeed(i);
    const colA = new THREE.Color(link.a.planet.atmosphere);
    const colB = new THREE.Color(link.b.planet.atmosphere);

    /* Line: pairs of vertices per segment, t stepping along the curve. */
    for (let s = 0; s < LINE_SAMPLES - 1; s++) {
      for (const t of [s / (LINE_SAMPLES - 1), (s + 1) / (LINE_SAMPLES - 1)]) {
        lineT[lv] = t;
        lineSeed[lv] = seed;
        putCols(lineColA, lineColB, lv, colA, colB);
        lv++;
      }
    }

    /* Points: dense static glow, then flowing particles. */
    for (let g = 0; g < GLOW_POINTS; g++) {
      pointT[pv] = g / (GLOW_POINTS - 1);
      pointPhase[pv] = 0;
      pointFlow[pv] = 0;
      pointSize[pv] = GLOW_SIZE;
      pointSeed[pv] = seed;
      putCols(pointColA, pointColB, pv, colA, colB);
      pv++;
    }
    for (let f = 0; f < FLOW_POINTS; f++) {
      pointT[pv] = 0;
      pointPhase[pv] = (f * 0.618034 + i * 0.17) % 1;
      pointFlow[pv] = 1;
      pointSize[pv] = FLOW_SIZE;
      pointSeed[pv] = seed;
      putCols(pointColA, pointColB, pv, colA, colB);
      pv++;
    }
  });

  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(lineVerts * 3), 3),
  );
  lineGeometry.setAttribute("aA", dynamicAttr(lineA, 3));
  lineGeometry.setAttribute("aM", dynamicAttr(lineM, 3));
  lineGeometry.setAttribute("aB", dynamicAttr(lineB, 3));
  lineGeometry.setAttribute("aT", new THREE.BufferAttribute(lineT, 1));
  lineGeometry.setAttribute("aSeed", new THREE.BufferAttribute(lineSeed, 1));
  lineGeometry.setAttribute("aMatch", dynamicAttr(lineMatch, 1));
  lineGeometry.setAttribute("aBirth", dynamicAttr(lineBirth, 1));
  lineGeometry.setAttribute("aColA", new THREE.BufferAttribute(lineColA, 3));
  lineGeometry.setAttribute("aColB", new THREE.BufferAttribute(lineColB, 3));

  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(pointVerts * 3), 3),
  );
  pointGeometry.setAttribute("aA", dynamicAttr(pointA, 3));
  pointGeometry.setAttribute("aM", dynamicAttr(pointM, 3));
  pointGeometry.setAttribute("aB", dynamicAttr(pointB, 3));
  pointGeometry.setAttribute("aT", new THREE.BufferAttribute(pointT, 1));
  pointGeometry.setAttribute(
    "aPhase",
    new THREE.BufferAttribute(pointPhase, 1),
  );
  pointGeometry.setAttribute("aFlow", new THREE.BufferAttribute(pointFlow, 1));
  pointGeometry.setAttribute("aSize", new THREE.BufferAttribute(pointSize, 1));
  pointGeometry.setAttribute("aSeed", new THREE.BufferAttribute(pointSeed, 1));
  pointGeometry.setAttribute("aMatch", dynamicAttr(pointMatch, 1));
  pointGeometry.setAttribute("aBirth", dynamicAttr(pointBirth, 1));
  pointGeometry.setAttribute("aColA", new THREE.BufferAttribute(pointColA, 3));
  pointGeometry.setAttribute("aColB", new THREE.BufferAttribute(pointColB, 3));

  const lineMaterial = new THREE.ShaderMaterial({
    vertexShader: lineVertex,
    fragmentShader: lineFragment,
    uniforms: {
      uTime: { value: 0 },
      uFogDensity: { value: BEAM_FOG },
      uSearch: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const pointMaterial = new THREE.ShaderMaterial({
    vertexShader: pointVertex,
    fragmentShader: pointFragment,
    uniforms: {
      uTime: { value: 0 },
      uDpr: { value: 1 },
      uFogDensity: { value: BEAM_FOG },
      uSearch: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return { lineGeometry, pointGeometry, lineMaterial, pointMaterial };
}

/* ── Component ───────────────────────────────────────────────────────────── */

export interface ConnectionsProps {
  /** Freeze the pulse/particle animation (prefers-reduced-motion). */
  reduced?: boolean;
}

export function Connections({ reduced = false }: ConnectionsProps) {
  const dpr = useThree((state) => state.viewport.dpr);
  const matchedIds = useSearchMatches();

  const links = React.useMemo<BeamPair[]>(() => {
    const byId = new Map(PROJECTS.map((project) => [project.id, project]));
    const pairs: BeamPair[] = [];
    for (const link of PROJECT_LINKS) {
      const a = byId.get(link.from);
      const b = byId.get(link.to);
      if (a && b && a !== b) pairs.push({ a, b });
    }
    return pairs;
  }, []);

  const scene = React.useMemo(
    () => (links.length > 0 ? buildScene(links) : null),
    [links],
  );

  React.useEffect(
    () => () => {
      scene?.lineGeometry.dispose();
      scene?.pointGeometry.dispose();
      scene?.lineMaterial.dispose();
      scene?.pointMaterial.dispose();
    },
    [scene],
  );

  const midpoint = React.useRef(new THREE.Vector3()).current;
  const direction = React.useRef(new THREE.Vector3()).current;
  const side = React.useRef(new THREE.Vector3()).current;
  /** Eased search weight per link (0 = unrelated, 1 = both endpoints hit). */
  const matchValues = React.useMemo(
    () => new Float32Array(links.length),
    [links],
  );
  /** Smoothed *viewed date* — damped exactly like the planets so beams and
   *  worlds arrive in lockstep during a scrub. */
  const travelRef = React.useRef<number | null>(null);

  useFrame((state, delta) => {
    if (!scene) return;

    const { lineGeometry, pointGeometry, lineMaterial, pointMaterial } = scene;
    lineMaterial.uniforms.uTime.value = reduced ? 0 : state.clock.elapsedTime;
    pointMaterial.uniforms.uTime.value = reduced ? 0 : state.clock.elapsedTime;
    pointMaterial.uniforms.uDpr.value = dpr;

    const lineA = lineGeometry.getAttribute("aA") as THREE.BufferAttribute;
    const lineM = lineGeometry.getAttribute("aM") as THREE.BufferAttribute;
    const lineB = lineGeometry.getAttribute("aB") as THREE.BufferAttribute;
    const pointA = pointGeometry.getAttribute("aA") as THREE.BufferAttribute;
    const pointM = pointGeometry.getAttribute("aM") as THREE.BufferAttribute;
    const pointB = pointGeometry.getAttribute("aB") as THREE.BufferAttribute;
    const lineMatch = lineGeometry.getAttribute(
      "aMatch",
    ) as THREE.BufferAttribute;
    const pointMatch = pointGeometry.getAttribute(
      "aMatch",
    ) as THREE.BufferAttribute;
    const lineBirth = lineGeometry.getAttribute(
      "aBirth",
    ) as THREE.BufferAttribute;
    const pointBirth = pointGeometry.getAttribute(
      "aBirth",
    ) as THREE.BufferAttribute;

    /* ── search highlight ────────────────────────────────────────────────
       A global gate ramps the shader's blaze/dim curve in and out while each
       link's weight eases toward "how many endpoints are results" — so
       switching queries crossfades the whole network, never snaps it, and
       keeps flowing under frameloop="demand" (invalidate while settling). */
    const dt = Math.min(delta, 0.1);
    const searchTarget = matchedIds ? 1 : 0;
    const searchEased = THREE.MathUtils.damp(
      lineMaterial.uniforms.uSearch.value as number,
      searchTarget,
      4.5,
      dt,
    );
    lineMaterial.uniforms.uSearch.value = searchEased;
    pointMaterial.uniforms.uSearch.value = searchEased;
    let moving = Math.abs(searchEased - searchTarget) > 0.001;

    /* Smooth the viewed date, then let each link burn out until both of
       its worlds have arrived at that date (timeline travel). */
    const targetDate = readTimelineDate();
    const fromDate = travelRef.current ?? targetDate;
    let travel: number;
    if (reduced) {
      travel = targetDate;
    } else {
      const eased = THREE.MathUtils.damp(fromDate, targetDate, 6, dt);
      travel = Math.abs(eased - targetDate) < 0.05 ? targetDate : eased;
    }
    travelRef.current = travel;
    if (travel !== targetDate) moving = true;

    links.forEach((link, i) => {
      const weightTarget = !matchedIds
        ? 0
        : (matchedIds.includes(link.a.id) ? 0.5 : 0) +
          (matchedIds.includes(link.b.id) ? 0.5 : 0);
      const eased = THREE.MathUtils.damp(matchValues[i], weightTarget, 6, dt);
      if (Math.abs(eased - weightTarget) < 0.001) {
        matchValues[i] = weightTarget;
      } else {
        matchValues[i] = eased;
        moving = true;
      }
      const weight = matchValues[i];
      fillScalar(
        lineMatch.array as Float32Array,
        i * (LINE_SAMPLES - 1) * 2,
        (LINE_SAMPLES - 1) * 2,
        weight,
      );
      fillScalar(
        pointMatch.array as Float32Array,
        i * (GLOW_POINTS + FLOW_POINTS),
        GLOW_POINTS + FLOW_POINTS,
        weight,
      );
      /* A beam exists only when both worlds do — min() of the two arrivals. */
      const birth = Math.min(
        arrivalFactor(travel, createdAt(link.a)),
        arrivalFactor(travel, createdAt(link.b)),
      );
      fillScalar(
        lineBirth.array as Float32Array,
        i * (LINE_SAMPLES - 1) * 2,
        (LINE_SAMPLES - 1) * 2,
        birth,
      );
      fillScalar(
        pointBirth.array as Float32Array,
        i * (GLOW_POINTS + FLOW_POINTS),
        GLOW_POINTS + FLOW_POINTS,
        birth,
      );
    });

    if (moving) invalidate();

    links.forEach((link, i) => {
      const from = readPlanetPosition(link.a.id);
      const to = readPlanetPosition(link.b.id);
      if (!from || !to) return;

      /* Bow the curve: sideways (alternating) + a lift toward world up. */
      midpoint.copy(from).add(to).multiplyScalar(0.5);
      direction.copy(to).sub(from);
      const dist = direction.length();
      if (dist > 1e-4) {
        direction.divideScalar(dist);
        side.crossVectors(direction, UP);
        if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
        else side.normalize();
        const sign = i % 2 === 0 ? 1 : -1;
        midpoint.addScaledVector(side, dist * BOW_SIDE * sign);
        midpoint.y += dist * BOW_UP;
      }

      const lineStart = i * (LINE_SAMPLES - 1) * 2;
      const lineCount = (LINE_SAMPLES - 1) * 2;
      fillSpan(lineA.array as Float32Array, lineStart, lineCount, from);
      fillSpan(lineM.array as Float32Array, lineStart, lineCount, midpoint);
      fillSpan(lineB.array as Float32Array, lineStart, lineCount, to);

      const pointStart = i * (GLOW_POINTS + FLOW_POINTS);
      const pointCount = GLOW_POINTS + FLOW_POINTS;
      fillSpan(pointA.array as Float32Array, pointStart, pointCount, from);
      fillSpan(pointM.array as Float32Array, pointStart, pointCount, midpoint);
      fillSpan(pointB.array as Float32Array, pointStart, pointCount, to);
    });

    lineA.needsUpdate = true;
    lineM.needsUpdate = true;
    lineB.needsUpdate = true;
    pointA.needsUpdate = true;
    pointM.needsUpdate = true;
    pointB.needsUpdate = true;
    lineMatch.needsUpdate = true;
    pointMatch.needsUpdate = true;
    lineBirth.needsUpdate = true;
    pointBirth.needsUpdate = true;
  });

  if (!scene) return null;

  return (
    <group>
      <lineSegments
        geometry={scene.lineGeometry}
        material={scene.lineMaterial}
        frustumCulled={false}
      />
      <points
        geometry={scene.pointGeometry}
        material={scene.pointMaterial}
        frustumCulled={false}
      />
    </group>
  );
}

export default Connections;

/**
 * birth-timeline — the clock of the Planet Birth Experience.
 *
 * One deterministic 8.0-second score drives every layer: the DOM overlays
 * (Phase 1 hologram, Phase 5 scan cards, Phase 6 connection chips), the
 * scene-side effects (energy wave, meteor, formation swirl, core glow) and
 * the camera choreography. Phase boundaries are absolute seconds so the
 * director, the state singleton and the WebGL components can never drift
 * apart — the director only ever advances `birthState.t`, everyone else
 * reads it.
 *
 *   init        0.0 – 1.8   holographic boot, nine steps ticking
 *   awaken      1.8 – 2.5   universe dims, stars brighten, energy wave
 *   meteor      2.5 – 3.6   plasma meteor flights to the orbit slot
 *   formation   3.6 – 4.9   burst → swirl → staged planet assembly
 *   scan        4.9 – 5.7   holographic scan + metadata cards
 *   connections 5.7 – 6.4   neural beams light to related worlds
 *   reveal      6.4 – 8.0   camera orbits the new world, returns home
 *
 * Reduced motion never starts the sequence (see `startBirth`), so everything
 * here is opt-in motion.
 */

export type BirthPhase =
  | "init"
  | "awaken"
  | "meteor"
  | "formation"
  | "scan"
  | "connections"
  | "reveal"
  | "ending";

/** Seconds. */
export const BIRTH_END = 8;

/** Phase boundaries — the only timing authority. */
const BOUNDS: readonly (readonly [number, BirthPhase])[] = [
  [0, "init"],
  [1.8, "awaken"],
  [2.5, "meteor"],
  [3.6, "formation"],
  [4.9, "scan"],
  [5.7, "connections"],
  [6.4, "reveal"],
  [BIRTH_END, "ending"],
];

/** Which phase owns `t` (skip pins everything to "ending"). */
export function phaseAt(t: number, skipping: boolean): BirthPhase {
  if (skipping) return "ending";
  let phase: BirthPhase = "init";
  for (const [start, name] of BOUNDS) {
    if (t >= start) phase = name;
  }
  return phase;
}

/* ── Phase 1 — the nine initialization steps (exact copy) ────────────────── */

export const INIT_STEPS = [
  "Initializing Knowledge Engine",
  "Understanding Project Context",
  "Analyzing Description",
  "Detecting Technologies",
  "Generating Planet Identity",
  "Calculating Orbit Position",
  "Finding Related Knowledge",
  "Building Neural Relationships",
  "Preparing New World",
] as const;

/** First step lands after the panel has risen; steps then tick every 170ms. */
export const STEP_FIRST = 0.34;
export const STEP_INTERVAL = 0.17;
/** All nine are ticked by t = 1.66 — comfortably inside the init phase. */
export const STEP_LAST_AT =
  STEP_FIRST + (INIT_STEPS.length - 1) * STEP_INTERVAL;

/** How many steps are done at time `t` (0 → 9). */
export function stepsDoneAt(t: number): number {
  if (t < STEP_FIRST) return 0;
  return Math.min(
    INIT_STEPS.length,
    1 + Math.floor((t - STEP_FIRST) / STEP_INTERVAL),
  );
}

/* ── Phase 5 — scan card rows ────────────────────────────────────────────── */

export const SCAN_ROWS = [
  "Project Name",
  "Project Category",
  "Detected Technologies",
  "AI Generated Summary",
  "Planet Type",
  "Creation Date",
  "Status",
] as const;

/* ── Named beats (seconds) — shared by director, state and effects ──────── */

export const BEAT = {
  /** Energy wave leaves the scene centre. */
  waveStart: 1.95,
  waveEnd: 3.7,
  /** Meteor flight window (progress 0 → 1). */
  meteorStart: 2.5,
  meteorEnd: 3.6,
  /** Impact burst. */
  impact: 3.6,
  /** Formation master window (progress 0 → 1). */
  formationStart: 3.6,
  formationEnd: 4.9,
  /** Staged planet assembly (see `computeRuntime` in birth-state). */
  corePop: 3.6,
  surfaceIn: [3.66, 4.5] as const,
  atmosphereIn: [4.12, 4.55] as const,
  cloudsIn: [4.3, 4.68] as const,
  ringPulse: [4.5, 4.78] as const,
  labelIn: [4.66, 4.92] as const,
  /** Scan sweep + cards + the closing message. */
  scanLine: [4.95, 5.72] as const,
  cardsStart: 5.02,
  message: 5.55,
  /** Neural beams + contextual chips. */
  beamIn: [5.75, 6.35] as const,
  chipsStart: 5.78,
  /** Camera reveal: orbit sweep, then the eased return home. */
  orbitEnd: 7.5,
  returnEnd: BIRTH_END,
} as const;

/* ── Easing primitives (plain math — usable in DOM, state and shaders) ───── */

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

/** Smoothstep ramp — 0 before `a`, 1 after `b`, S-curve between. */
export function ramp(t: number, a: number, b: number): number {
  if (b <= a) return t >= b ? 1 : 0;
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

/** Piecewise keyframes — each segment eases with smoothstep (staged feel). */
export function kf(
  t: number,
  keys: readonly (readonly [number, number])[],
): number {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return lerp(v0, v1, ramp(t, t0, t1));
    }
  }
  return last[1];
}

/** Rise-and-fall bump — used for transient pulses (ring flash, glow). */
export function bump(t: number, a: number, peak: number, b: number): number {
  if (t <= a || t >= b) return 0;
  return t < peak ? ramp(t, a, peak) : 1 - ramp(t, peak, b);
}

"use client";

/**
 * birth-state — the singleton clock behind the Planet Birth Experience.
 *
 * One module-level record owns the sequence: the director's `requestAnimationFrame`
 * loop advances `t` and calls `advanceBirth()`; the WebGL layer reads the
 * precomputed runtime values (`birthState.v`) straight off the singleton in
 * `useFrame` without subscribing, so a planet, a beam or a star shader never
 * re-renders React mid-cinematic. React consumers (the overlays, the scene's
 * self-gating `<BirthEffects />`) subscribe through `useBirth()`, whose
 * snapshot is a bare string — eight phase flips for the whole sequence.
 *
 * Contract:
 *   • `startBirth(record)` — called by the create form's `onCreated` (the
 *     /universe "+"). Returns false under reduced motion, where the core
 *     planet simply exists from the first frame instead.
 *   • `skipBirth()` — Escape or the Skip button: relax the universe, reveal
 *     the completed world, ease the camera home, then `finishBirth()`.
 *   • `finishBirth()` — active flips false, every gate reverts to baseline;
 *     the core world is now an ordinary planet of the scene.
 *
 * Nothing here imports three.js — this file rides the shell chunk, not the
 * WebGL one. Camera math lives in `scene/birth-effects.tsx`.
 */

import { useSyncExternalStore } from "react";

import { buildUniverseScene } from "@/data/scene-data";
import {
  relatedKnowledge,
  type KnowledgeConnection,
} from "@/lib/knowledge-links";
import { classifyUniverse } from "@/lib/planet-category";
import type { UniverseRecord } from "@/types/workspace";

import {
  BEAT,
  BIRTH_END,
  bump,
  kf,
  phaseAt,
  ramp,
  type BirthPhase,
} from "./birth-timeline";

export type { BirthPhase };

/* ── Static facts the overlays render from ────────────────────────────────── */

export interface BirthHero {
  id: string;
  name: string;
  /** Scan card: "Artificial Intelligence". */
  categoryLabel: string;
  /** Scan card: "Neural World". */
  planetType: string;
  /** Similarity chips — also the meteor/swirl/core-glow palette source. */
  stack: readonly string[];
  /** Scan card summary (the record's description). */
  summary: string;
  /** Scan card: "Oct 8, 2026". */
  createdAtLabel: string;
  /** Scan card status — the world has finished forming. */
  status: string;
  /** Hex accent (category atmosphere) — drives every birth effect's colour. */
  accent: string;
}

/* ── Per-frame runtime values (single writer: `advanceBirth`) ─────────────── */

interface HeroGate {
  /** Surface existence — 0 until the formation burst. */
  fade: number;
  /** Timeline-free scale staging (core pop → settle). */
  scale: number;
  /** Atmosphere halo reveal. */
  atm: number;
  /** Cloud-shell reveal (core worlds only). */
  cloud: number;
  /** Label pill reveal. */
  label: number;
  /** Extra glow — `Math.max`ed over the natural breathing pulse. */
  pulse: number;
}

interface BirthRuntime {
  /** Backdrop dim, 0 → 0.44. */
  dim: number;
  /** Star brightness multiplier. */
  star: number;
  /** Nebula intensity multiplier (gentle sine during the awaken). */
  nebulaMul: number;
  /** Extra orbit-ring opacity above the resting level. */
  ring: number;
  /** Orbit/spin slow-down — 1 → 0.55 while the universe notices. */
  slow: number;
  /** Skip/natural relaxation — 1 normally, eases to 0 on skip. */
  relax: number;
  /** Energy wave progress, -1 = not flying. */
  wave: number;
  /** Meteor flight progress, -1 = not flying. */
  meteor: number;
  /** Formation master progress, -1 = not started. */
  formation: number;
  /** Core energy-sphere intensity (impact → fade as surface emerges). */
  core: number;
  /** Phase-6 beam reveal gate. */
  beam: number;
  /** Staged gates for the born world. */
  hero: HeroGate;
}

const INITIAL_RUNTIME: BirthRuntime = {
  dim: 0,
  star: 1,
  nebulaMul: 1,
  ring: 0,
  slow: 1,
  relax: 1,
  wave: -1,
  meteor: -1,
  formation: -1,
  core: 0,
  beam: 0,
  hero: { fade: 0, scale: 0.06, atm: 0, cloud: 0, label: 0, pulse: 0 },
};

/* ── The singleton ───────────────────────────────────────────────────────── */

export interface CameraHandoff {
  hijacked: boolean;
  /** Capture point at hijack — where the reveal returns to. */
  home: {
    px: number;
    py: number;
    pz: number;
    tx: number;
    ty: number;
    tz: number;
  } | null;
  prevMode: string;
  prevEnabled: boolean;
}

const INITIAL_CAMERA: CameraHandoff = {
  hijacked: false,
  home: null,
  prevMode: "auto",
  prevEnabled: true,
};

export const birthState = {
  active: false,
  phase: "init" as BirthPhase,
  /** Seconds since `startBirth`. */
  t: 0,
  heroId: null as string | null,
  hero: null as BirthHero | null,
  links: [] as readonly KnowledgeConnection[],
  /** World-space entry point of the meteor, published by the scene. */
  meteorStart: null as [number, number, number] | null,
  skipping: false,
  skippedAt: 0,
  /* Annotated (not just `satisfies`) so the handoff fields stay mutable
     under their interface types — the scene writes them at hijack/restore. */
  camera: INITIAL_CAMERA,
  v: { ...INITIAL_RUNTIME, hero: { ...INITIAL_RUNTIME.hero } },
};

/* ── Subscriptions (React) ────────────────────────────────────────────────── */

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeBirth(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot is a bare string — the whole sequence re-renders React ≤ 8×. */
export function birthSnapshot(): BirthPhase | "off" {
  return birthState.active ? birthState.phase : "off";
}

export function useBirth(): BirthPhase | "off" {
  return useSyncExternalStore(subscribeBirth, birthSnapshot, birthSnapshot);
}

/* ── Lifecycle ───────────────────────────────────────────────────────────── */

/**
 * Begin the sequence for a freshly created universe. Called from the create
 * form's `onCreated` — i.e. in the same tick the workspace switches the
 * active record, so the freshly keyed scene mounts with the core world gated
 * from its very first frame (no pop, no stale-stock frame).
 *
 * Returns false (and touches nothing) under prefers-reduced-motion: the core
 * planet then simply exists, fully formed, and no animation ever plays.
 */
export function startBirth(record: UniverseRecord): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }

  /* Build (or fetch, cache-hot) the exact scene the shell is about to
     publish — identical object, so the beams and the gate agree. */
  const scene = buildUniverseScene(record);
  const core = scene.projects.find((project) => project.isCore);
  if (!core) return false;

  const identity = classifyUniverse(record);
  const created = new Date(record.createdAt);

  birthState.heroId = core.id;
  birthState.hero = {
    id: core.id,
    name: record.name,
    categoryLabel: identity.profile.label,
    planetType: identity.profile.planetType,
    stack: identity.stack,
    summary:
      record.description.trim() ||
      `${record.name} — the knowledge core seeding every world in this universe.`,
    createdAtLabel: created.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    status: "Stable",
    accent: identity.profile.atmosphere,
  };
  birthState.links = relatedKnowledge(core, scene.projects);
  birthState.t = 0;
  birthState.phase = "init";
  birthState.skipping = false;
  birthState.skippedAt = 0;
  birthState.meteorStart = null;
  birthState.camera.hijacked = false;
  birthState.camera.home = null;
  birthState.v = {
    ...INITIAL_RUNTIME,
    hero: { ...INITIAL_RUNTIME.hero },
  };
  birthState.active = true;
  notify();
  return true;
}

/** Escape / Skip button — relax everything, reveal, ease the camera home. */
export function skipBirth(): void {
  if (!birthState.active || birthState.skipping) return;
  birthState.skipping = true;
  birthState.skippedAt = birthState.t;
  if (birthState.phase !== "ending") {
    birthState.phase = "ending";
    notify();
  }
}

/**
 * Terminal — called by the camera once it is back home (or instantly when it
 * never left). Every gate reads `active` first, so this single flip restores
 * the whole scene to baseline in one frame.
 */
export function finishBirth(): void {
  if (!birthState.active) return;
  birthState.active = false;
  birthState.camera.hijacked = false;
  birthState.camera.home = null;
  notify();
}

export function isBirthActive(): boolean {
  return birthState.active;
}

/**
 * Advance the clock — called exactly once per frame by the director while
 * active. Phase flips notify React; all runtime easing lands in
 * `birthState.v` for the scene to read without re-rendering.
 */
export function advanceBirth(dt: number): void {
  if (!birthState.active) return;
  /* Clamp only against genuine stalls (tab hidden, long GC): down to ~1fps
     the score still tracks wall-clock, so slow machines get the same 8s
     cut as fast ones — and a tab-switch resume skips at most one second
     instead of jumping to the ending. */
  birthState.t += Math.min(dt, 1);
  const t = birthState.t;

  const phase = phaseAt(t, birthState.skipping);
  if (phase !== birthState.phase) {
    birthState.phase = phase;
    notify();
  }
  computeRuntime(t);
}

/** Natural completion (the score reached its end) — the camera takes over. */
export function birthElapsed(): number {
  return birthState.t;
}

function computeRuntime(t: number): void {
  const state = birthState;
  const v = state.v;

  /* Relaxation: on skip (or the natural tail) everything eases back to the
     baseline while the camera glides home — the universe re-opens smoothly. */
  const relax = state.skipping
    ? 1 - ramp(t, state.skippedAt, state.skippedAt + 0.4)
    : 1;
  v.relax = relax;

  /* Phase 2 — the universe awakens. */
  const awaken = ramp(t, 1.8, 2.45) * relax;
  v.dim = 0.44 * awaken;
  v.star = 1 + 0.75 * ramp(t, 1.85, 2.6) * relax;
  v.slow = 1 - 0.45 * ramp(t, 1.8, 2.5) * relax;
  v.nebulaMul = 1 + 0.22 * Math.sin(t * 2.4) * ramp(t, 1.85, 2.7) * relax;
  v.ring =
    (0.3 * ramp(t, 1.8, 2.5) +
      0.3 * bump(t, BEAT.ringPulse[0], 4.64, BEAT.ringPulse[1])) *
    relax;

  /* Phase 2→3 — energy wave + meteor flight. */
  v.wave =
    t >= BEAT.waveStart && t < BEAT.waveEnd
      ? (t - BEAT.waveStart) / (BEAT.waveEnd - BEAT.waveStart)
      : -1;
  v.meteor =
    t >= BEAT.meteorStart && t < BEAT.meteorEnd
      ? (t - BEAT.meteorStart) / (BEAT.meteorEnd - BEAT.meteorStart)
      : -1;

  /* Phase 4 — formation. */
  v.formation =
    t >= BEAT.formationStart
      ? Math.min(
          1,
          (t - BEAT.formationStart) / (BEAT.formationEnd - BEAT.formationStart),
        )
      : -1;
  v.core = kf(t, [
    [BEAT.impact - 0.08, 0],
    [BEAT.impact, 1],
    [4.15, 1],
    [4.5, 0],
  ]);

  /* A skip jumps to the finished world: transient effects retire at once,
     formation reads complete, the core glow is gone — only the relaxation
     (dim, slow-down, beams) eases out over the camera's return flight. */
  if (state.skipping) {
    v.wave = -1;
    v.meteor = -1;
    v.formation = Math.max(v.formation, 1);
    v.core = 0;
  }

  /* Phase 6 — beams (or an instant lift when skipped, so the finished world
     lands fully connected). */
  v.beam = Math.max(
    ramp(t, BEAT.beamIn[0], BEAT.beamIn[1]),
    state.skipping ? ramp(t, state.skippedAt, state.skippedAt + 0.3) : 0,
  );

  /* Staged assembly of the born world — core pop, surface emergence,
     atmosphere, clouds, label, glow settling back to the natural breath. */
  const skipIn = state.skipping
    ? ramp(t, state.skippedAt, state.skippedAt + 0.3)
    : 0;
  const hero = v.hero;
  hero.fade = Math.max(
    kf(t, [
      [BEAT.surfaceIn[0], 0],
      [4.05, 0.4],
      [BEAT.surfaceIn[1], 1],
    ]),
    skipIn,
  );
  hero.scale = Math.max(
    kf(t, [
      [BEAT.corePop, 0.06],
      [BEAT.corePop + 0.18, 0.52],
      [4.6, 0.9],
      [4.78, 1.04],
      [4.95, 1],
    ]),
    skipIn,
  );
  hero.atm = Math.max(
    kf(t, [
      [BEAT.atmosphereIn[0], 0],
      [BEAT.atmosphereIn[1], 1],
    ]),
    skipIn,
  );
  hero.cloud = Math.max(
    kf(t, [
      [BEAT.cloudsIn[0], 0],
      [BEAT.cloudsIn[1], 1],
    ]),
    skipIn,
  );
  hero.label = Math.max(
    kf(t, [
      [BEAT.labelIn[0], 0],
      [BEAT.labelIn[1], 1],
    ]),
    skipIn,
  );
  hero.pulse =
    kf(t, [
      [BEAT.corePop, 1.6],
      [4.1, 2.1],
      [4.5, 1.1],
      [4.9, 0],
    ]) * relax;
}

/* ── Derived gates — O(1) reads for the WebGL layer ──────────────────────── */

/** Staged gates for the born world, or null for every other planet. */
export function birthHeroGate(id: string): HeroGate | null {
  if (!birthState.active || birthState.heroId !== id) return null;
  return birthState.v.hero;
}

/**
 * Label pill gate — the born world's name waits behind the formation
 * (the phase flip to "scan" eases it in through the label's own CSS
 * transition); everything else, and every other world, is simply visible.
 */
export function birthLabelGate(id: string, phase: BirthPhase | "off"): number {
  if (phase === "off" || birthState.heroId !== id || birthState.skipping) {
    return 1;
  }
  return phase === "scan" ||
    phase === "connections" ||
    phase === "reveal" ||
    phase === "ending"
    ? 1
    : 0;
}

export function birthSlowFactor(): number {
  return birthState.active ? birthState.v.slow : 1;
}

export function birthStarBoost(): number {
  return birthState.active ? birthState.v.star : 1;
}

export function birthNebulaMul(): number {
  return birthState.active ? birthState.v.nebulaMul : 1;
}

export function birthRingGlow(): number {
  return birthState.active ? birthState.v.ring : 0;
}

/** `false` for unrelated links → their beams keep their timeline arrival. */
export function birthBeamGate(isCoreLink: boolean): number {
  if (!birthState.active || !isCoreLink) return 1;
  return birthState.v.beam;
}

/** True while the cinematic owns the camera (silences rig + controls). */
export function birthCameraOwned(): boolean {
  return birthState.active && birthState.camera.hijacked;
}

/** The score has reached its natural end — director hands over to ending. */
export function birthPastEnd(): boolean {
  return birthState.active && birthState.t >= BIRTH_END;
}

import { type Project } from "@/data";
import { sceneProjects } from "@/data/scene-data";

/* ────────────────────────────────────────────────────────────────────────── *
 * Timeline — pure time-travel maths for the knowledge timeline.
 *
 * Every function is a total, clock-free mapping from `(date, project, now)`
 * to a 0–1 factor, which is what makes scrubbing feel like travel: the
 * scene evaluates these per frame against a *smoothed* date, so dragging
 * the control forward or backward plays the same cinematic states in both
 * directions — worlds arriving, growing, drifting into their orbits — with
 * no event bookkeeping to desync.
 *
 * Exactness contract (relied on by search/beam probes): at `date === now`
 * every factor returns EXACTLY 1 (or the phase offset EXACTLY 0), so the
 * present looks byte-for-byte like a timeline-less universe.
 *
 * Timeline semantics:
 *   arrival  — a world materialises over `BIRTH_SPAN_MS`: scale pops from
 *              0 → ~45% and its orbit tightens from 1.4× → 1.0× radius,
 *   growth   — after arrival it keeps growing across its own lifetime to
 *              reach full scale exactly at the present,
 *   phase    — the whole system slowly rotates as time moves (0 at now).
 * ────────────────────────────────────────────────────────────────────────── */

export const DAY_MS = 86_400_000;
/** One "month" of keyboard scrubbing (calendar-ish — the readout shows the
 *  real date either way). */
export const MONTH_MS = 30 * DAY_MS;
/** One "year" of keyboard scrubbing (Shift+Arrow). */
export const YEAR_MS = 365 * DAY_MS;

/** How long a world takes to materialise: the appearance pop and the
 *  inward orbital drift both complete inside this window. */
export const BIRTH_SPAN_MS = 90 * DAY_MS;

/** Orbital phase advance per millisecond of travel — the whole system
 *  turns ~16° across a two-year scrub (exactly 0 at the present). */
export const TIME_OMEGA = 0.0004;

/** How far out (× radius) a world orbits while still unborn — it drifts
 *  inward to its true orbit as it arrives. Small enough (0.4) that a young
 *  world can never graze an older sibling's sphere in the same system. */
const ARRIVAL_RADIUS = 0.4;

const MONTH_LABELS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

/** Parse-once cache — arrival/growth are evaluated per frame. */
const createdCache = new WeakMap<Project, number>();

/** Epoch ms of a project's creation (parsed once per project). */
export function createdAt(project: Project): number {
  let cached = createdCache.get(project);
  if (cached === undefined) {
    cached = Date.parse(project.createdAt);
    createdCache.set(project, cached);
  }
  return cached;
}

function clamp01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

/** Hermite ease — flat at both ends, so factors settle rather than snap. */
function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

/** 0 → 1 as the world materialises over `BIRTH_SPAN_MS` (exact at both
 *  ends — the present is exactly 1, an unborn world exactly 0). */
export function arrivalFactor(date: number, createdMs: number): number {
  const age = date - createdMs;
  if (age <= 0) return 0;
  if (age >= BIRTH_SPAN_MS) return 1;
  return smoothstep(age / BIRTH_SPAN_MS);
}

/** 0 → 1 across the world's lifetime, reaching full growth exactly at the
 *  present — so every planet is exactly full-sized at `date === now`. */
export function growthFactor(
  date: number,
  createdMs: number,
  now: number,
): number {
  const age = date - createdMs;
  if (age <= 0) return 0;
  if (age >= now - createdMs) return 1;
  return smoothstep(age / (now - createdMs));
}

/** Visible scale of a world at `date`: the arrival pop blended with the
 *  lifetime growth curve (0 while unborn, exactly 1 at the present). */
export function worldScaleAt(
  date: number,
  createdMs: number,
  now: number,
): number {
  if (date <= createdMs) return 0;
  const arrival = arrivalFactor(date, createdMs);
  const growth = growthFactor(date, createdMs, now);
  if (arrival === 1 && growth === 1) return 1;
  return arrival * (0.45 + 0.55 * growth);
}

/** Orbit-radius multiplier: young worlds circle 1.4× further out and ease
 *  inward to their true orbit as they arrive (exactly 1 at the present). */
export function radiusFactorAt(date: number, createdMs: number): number {
  const arrival = arrivalFactor(date, createdMs);
  if (arrival === 1) return 1;
  return 1 + ARRIVAL_RADIUS * (1 - arrival);
}

/** Static orbital phase offset for `date` — the system slowly rotates while
 *  you scrub, and is exactly back at its native phase at the present. */
export function phaseOffsetAt(date: number, now: number): number {
  return TIME_OMEGA * (date - now);
}

/** Completion percent a project had reached at `date` — what the dossier's
 *  progress row reports while the viewer is parked in the past. */
export function progressAt(
  date: number,
  project: Project,
  now: number,
): number {
  const growth = growthFactor(date, createdAt(project), now);
  if (growth === 1) return project.progress;
  return project.progress * growth;
}

/** How many worlds exist at `date` (the control's "n / 8" readout). */
export function bornCount(date: number): number {
  let count = 0;
  for (const project of sceneProjects()) {
    if (date > createdAt(project)) count++;
  }
  return count;
}

/** 0–1 position of `date` between the floor and the present. */
export function timelineFraction(
  date: number,
  floor: number,
  now: number,
): number {
  if (now <= floor) return 1;
  return clamp01((date - floor) / (now - floor));
}

/** Clamp to the scrubbable range (the store also clamps — belt and braces
 *  for pure callers like keyboard steps and marker jumps). */
export function clampDate(date: number, floor: number, now: number): number {
  return date < floor ? floor : date > now ? now : date;
}

export interface TimelineTick {
  /** Epoch ms of the tick (a quarter start inside the range). */
  at: number;
  /** "2025" on January ticks, null for the quieter quarters. */
  label: string | null;
  /** 0–1 track fraction, for absolute positioning. */
  fraction: number;
}

/** Quarter ticks across the range, labelled by year — the track's calendar. */
export function timelineTicks(floor: number, now: number): TimelineTick[] {
  const span = now - floor;
  if (span <= 0) return [];
  const ticks: TimelineTick[] = [];
  const startYear = new Date(floor).getUTCFullYear();
  const endYear = new Date(now).getUTCFullYear();
  for (let year = startYear; year <= endYear; year++) {
    for (const month of [0, 3, 6, 9]) {
      const at = Date.UTC(year, month, 1);
      if (at <= floor) continue;
      if (at > now) return ticks;
      ticks.push({
        at,
        label: month === 0 ? String(year) : null,
        fraction: (at - floor) / span,
      });
    }
  }
  return ticks;
}

/** "08 OCT 2024" — UTC so the readout is deterministic in any timezone. */
export function formatTimelineDate(date: number): string {
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day} ${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

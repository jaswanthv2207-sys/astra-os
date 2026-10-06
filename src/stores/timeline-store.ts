import { create } from "zustand";

import { PROJECTS } from "@/data";

/* ────────────────────────────────────────────────────────────────────────── *
 * Timeline store — the /universe knowledge timeline's intent.
 *
 * Holds one thing: the date currently being viewed, clamped to the honest
 * range of the graph (the earliest project's creation → the present). The
 * scene never subscribes to it — planets and beams read `date` per frame
 * through `hooks/use-timeline` module readers and smooth it themselves, so
 * a scrub costs zero React renders outside the timeline UI.
 *
 * `now` is captured once at module init (not re-read per call) so "reset to
 * present" and every "am I in the past?" comparison agree to the same tick.
 * Pure time-travel maths lives in `sections/universe/timeline.ts`.
 * ────────────────────────────────────────────────────────────────────────── */

/** Earliest creation in the graph — the beginning of the knowledge story. */
const FLOOR = Math.min(
  ...PROJECTS.map((project) => Date.parse(project.createdAt)),
);

/** The present, captured once (module init runs on both server and client;
 * only client-side consumers ever render it, so there's no hydration risk). */
const NOW = Date.now();

export interface TimelineState {
  /** Presented "present" — frozen at store init. */
  now: number;
  /** Scrub floor: the first world's creation date (empty universe there). */
  floor: number;
  /** Currently viewed date — always clamped to `[floor, now]`. */
  date: number;
  /** Move the viewed date (clamped internally — callers can't overshoot). */
  setDate: (date: number) => void;
  /** Snap back to the present. */
  resetToNow: () => void;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  now: NOW,
  floor: FLOOR,
  date: NOW,
  setDate: (date) => {
    const { floor, now } = get();
    const next = date < floor ? floor : date > now ? now : date;
    if (next !== get().date) set({ date: next });
  },
  resetToNow: () => {
    if (get().date !== get().now) set({ date: get().now });
  },
}));

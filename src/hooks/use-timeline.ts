"use client";

import { useTimelineStore, type TimelineState } from "@/stores";

/* ────────────────────────────────────────────────────────────────────────── *
 * Timeline hooks — the only sanctioned way for sections/scene components to
 * reach the timeline store (dependency rule: never import `stores/`).
 *
 * Two access shapes on purpose:
 *   - `useTimeline()` / `useTimelineDate()` subscribe (the timeline control
 *     and the dossier's leaf progress row need reactive renders);
 *   - `readTimelineDate()` / `readTimelineNow()` are module readers for
 *     `useFrame` and event handlers — a scrub must never re-render the 3D
 *     scene, so the planets and beams pull the date per frame instead.
 * ────────────────────────────────────────────────────────────────────────── */

export interface UseTimelineResult {
  date: TimelineState["date"];
  now: TimelineState["now"];
  floor: TimelineState["floor"];
  setDate: TimelineState["setDate"];
  resetToNow: TimelineState["resetToNow"];
}

/** Everything in one view — for the timeline control itself. */
export function useTimeline(): UseTimelineResult {
  const date = useTimelineStore((state) => state.date);
  const now = useTimelineStore((state) => state.now);
  const floor = useTimelineStore((state) => state.floor);
  const setDate = useTimelineStore((state) => state.setDate);
  const resetToNow = useTimelineStore((state) => state.resetToNow);
  return { date, now, floor, setDate, resetToNow };
}

/** Just the viewed date — for the planet pills and the dossier progress row. */
export function useTimelineDate(): TimelineState["date"] {
  return useTimelineStore((state) => state.date);
}

/** The viewed date, read without subscribing (useFrame / key handlers). */
export function readTimelineDate(): number {
  return useTimelineStore.getState().date;
}

/** The frozen present, read without subscribing. */
export function readTimelineNow(): number {
  return useTimelineStore.getState().now;
}

/** True when the viewer has travelled into the past (Escape layer check). */
export function timelineIsPast(): boolean {
  const state = useTimelineStore.getState();
  return state.date < state.now;
}

/** Snap back to the present (Escape chain / remount guard). */
export function resetTimeline(): void {
  useTimelineStore.getState().resetToNow();
}

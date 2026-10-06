"use client";

import { useLaunchStore, type LaunchPhase } from "@/stores";

export interface UseLaunchResult {
  /** Current phase of the cinematic transition. */
  phase: LaunchPhase;
  /** True while the overlay owns the screen. */
  launching: boolean;
  /** Begins the warp — safe to call repeatedly (no-op mid-sequence). */
  launch: () => void;
}

/**
 * Internal accessor for the transition overlay itself (phase driver). Not
 * exported through the barrel — only `useLaunch` is public API.
 */
export function useLaunchTransition(): {
  phase: LaunchPhase;
  setPhase: (phase: LaunchPhase) => void;
  reset: () => void;
} {
  const phase = useLaunchStore((state) => state.phase);
  const setPhase = useLaunchStore((state) => state.setPhase);
  const reset = useLaunchStore((state) => state.reset);

  return { phase, setPhase, reset };
}

/**
 * useLaunch — the only sanctioned way for components/sections to reach the
 * launch-transition store (dependency rule: never import `stores/` directly
 * from a component).
 *
 * @example
 * const { launch, launching } = useLaunch();
 * <Button onClick={launch} disabled={launching}>Launch Universe</Button>
 */
export function useLaunch(): UseLaunchResult {
  const phase = useLaunchStore((state) => state.phase);
  const launch = useLaunchStore((state) => state.launch);

  return { phase, launching: phase !== "idle", launch };
}

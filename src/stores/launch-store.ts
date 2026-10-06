import { create } from "zustand";

/**
 * Launch transition state machine behind the "Launch Universe" CTA.
 *
 * Phases:
 *   idle     → no transition on screen (normal page interaction)
 *   engaging → overlay closes over the current page, jump sequence boots
 *   warp     → hyperspace streaks accelerate; the route swap happens here,
 *              hidden underneath the overlay
 *   reveal   → overlay lifts away, revealing the live 3D universe
 *
 * The overlay (`components/shared/launch-transition.tsx`) owns the timing;
 * the CTA only ever calls `launch()`. Read it through
 * `hooks/use-launch.ts` — components and sections must not import stores
 * directly (see STRUCTURE.md dependency rules).
 */
export type LaunchPhase = "idle" | "engaging" | "warp" | "reveal";

export interface LaunchState {
  phase: LaunchPhase;
  /** Begins the cinematic sequence (no-op while one is running). */
  launch: () => void;
  setPhase: (phase: LaunchPhase) => void;
  /** Returns to `idle` — end of the sequence or an early abort. */
  reset: () => void;
}

export const useLaunchStore = create<LaunchState>((set) => ({
  phase: "idle",
  launch: () =>
    set((state) => (state.phase === "idle" ? { phase: "engaging" } : state)),
  setPhase: (phase) => set({ phase }),
  reset: () => set({ phase: "idle" }),
}));

/** True while the cinematic overlay owns the screen. */
export const selectLaunching = (state: LaunchState) => state.phase !== "idle";

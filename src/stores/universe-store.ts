import { create } from "zustand";

/**
 * Which world the cinematic camera should fly to — the single source of
 * truth for "focus mode" in the `/universe` scene.
 *
 * The store only says *where* the camera wants to be; animation state lives
 * in `sections/universe/scene/camera-rig.tsx`, which reacts to `focusedId`.
 * Focus is set by clicking a planet (canvas) or the HUD's
 * screen-reader list, and cleared by Escape / the HUD's return control.
 */
export interface UniverseState {
  /** Project id currently in focus, or `null` for the orbit overview. */
  focusedId: string | null;
  /** Fly the camera to a planet (no-op if it is already focused). */
  focus: (id: string) => void;
  /** Fly back out to the view captured when focus began. */
  release: () => void;
}

export const useUniverseStore = create<UniverseState>((set) => ({
  focusedId: null,
  focus: (id) => set({ focusedId: id }),
  release: () => set({ focusedId: null }),
}));

export const selectFocusedId = (state: UniverseState) => state.focusedId;

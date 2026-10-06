"use client";

import { useUniverseStore, type UniverseState } from "@/stores";

export interface UseUniverseResult {
  /** Project id the camera is flying to / holding, or null for overview. */
  focusedId: UniverseState["focusedId"];
  /** Fly the camera to a world. */
  focus: UniverseState["focus"];
  /** Fly back out to the captured overview. */
  release: UniverseState["release"];
}

/**
 * useUniverse — the only sanctioned way for sections/components to reach the
 * universe focus store (dependency rule: never import `stores/` directly).
 *
 * @example
 * const { focusedId, focus, release } = useUniverse();
 */
export function useUniverse(): UseUniverseResult {
  const focusedId = useUniverseStore((state) => state.focusedId);
  const focus = useUniverseStore((state) => state.focus);
  const release = useUniverseStore((state) => state.release);
  return { focusedId, focus, release };
}

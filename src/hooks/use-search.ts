"use client";

import { useSearchStore, type SearchState } from "@/stores";

/* ────────────────────────────────────────────────────────────────────────── *
 * Search hooks — the only sanctioned way for sections/scene components to
 * reach the search store (dependency rule: never import `stores/` directly).
 *
 * The four views are selector-granular on purpose: the scene systems and the
 * shell subscribe only to what they render, so a keystroke never re-renders
 * the camera rig or the whole page.
 * ────────────────────────────────────────────────────────────────────────── */

/** Mutation actions — for surfaces that drive intents and camera moves. */
export interface UseSearchQueryResult {
  setMatches: SearchState["setMatches"];
  frame: SearchState["frame"];
  clearFrame: SearchState["clearFrame"];
  clear: SearchState["clear"];
}

/**
 * Everything in one view — Astra's panel runs its focus/frame reveals off
 * this.
 *
 * @example
 * const { setMatches, frame, clear } = useSearch();
 */
export function useSearch(): UseSearchQueryResult & {
  frameIds: SearchState["frameIds"];
} {
  const frameIds = useSearchStore((state) => state.frameIds);
  const setMatches = useSearchStore((state) => state.setMatches);
  const frame = useSearchStore((state) => state.frame);
  const clearFrame = useSearchStore((state) => state.clearFrame);
  const clear = useSearchStore((state) => state.clear);
  return { frameIds, setMatches, frame, clearFrame, clear };
}

/** Clear action — for the shell's Escape ordering + remount guard. */
export function useSearchClear(): SearchState["clear"] {
  return useSearchStore((state) => state.clear);
}

/** Matched world ids — for the planets' glow/fade and the beam highlight. */
export function useSearchMatches(): string[] | null {
  return useSearchStore((state) => state.matchedIds);
}

/** Committed result set — for the camera's results fly-through. */
export function useSearchFrame(): string[] | null {
  return useSearchStore((state) => state.frameIds);
}

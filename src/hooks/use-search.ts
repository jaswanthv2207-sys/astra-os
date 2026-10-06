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

/** Raw text + mutation actions — for the search bar itself. */
export interface UseSearchQueryResult {
  query: SearchState["query"];
  setQuery: SearchState["setQuery"];
  setMatches: SearchState["setMatches"];
  frame: SearchState["frame"];
  clearFrame: SearchState["clearFrame"];
  clear: SearchState["clear"];
}

/**
 * Everything in one view — for `UniverseSearch`, which drives all fields.
 *
 * @example
 * const { query, setQuery, frame, clear } = useSearch();
 */
export function useSearch(): UseSearchQueryResult & {
  frameIds: SearchState["frameIds"];
} {
  const query = useSearchStore((state) => state.query);
  const frameIds = useSearchStore((state) => state.frameIds);
  const setQuery = useSearchStore((state) => state.setQuery);
  const setMatches = useSearchStore((state) => state.setMatches);
  const frame = useSearchStore((state) => state.frame);
  const clearFrame = useSearchStore((state) => state.clearFrame);
  const clear = useSearchStore((state) => state.clear);
  return { query, frameIds, setQuery, setMatches, frame, clearFrame, clear };
}

/** Read-only text view — for the shell's Escape ordering + remount guard. */
export function useSearchText(): {
  query: string;
  clear: SearchState["clear"];
} {
  const query = useSearchStore((state) => state.query);
  const clear = useSearchStore((state) => state.clear);
  return { query, clear };
}

/** Matched world ids — for the planets' glow/fade and the beam highlight. */
export function useSearchMatches(): string[] | null {
  return useSearchStore((state) => state.matchedIds);
}

/** Committed result set — for the camera's results fly-through. */
export function useSearchFrame(): string[] | null {
  return useSearchStore((state) => state.frameIds);
}

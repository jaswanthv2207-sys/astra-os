import { create } from "zustand";

/**
 * What the floating AI search currently knows — the single source of truth
 * connecting the search bar, the planets, the connection beams and the
 * camera's results fly-through.
 *
 * The store holds raw state only; the parser lives in
 * `sections/universe/search-query.ts` (the UI computes intents and pushes
 * results here, so this file never imports data or parsing).
 *
 *   • `query`      — the raw text in the search bar,
 *   • `matchedIds` — worlds the parser matched (live glow / fade target),
 *   • `frameIds`   — the committed result set the camera should frame
 *                    (set on commit only, so typing never moves the camera).
 */
export interface SearchState {
  /** Raw search-bar text. */
  query: string;
  /** Matched world ids, or `null` when no query is active. */
  matchedIds: string[] | null;
  /** Committed ids the camera frames as a set, or `null`. */
  frameIds: string[] | null;
  /** Replace the raw query text. */
  setQuery: (query: string) => void;
  /** Publish the parser's matches (no-op when the set is unchanged). */
  setMatches: (ids: string[] | null) => void;
  /** Commit a result set: the camera flies to frame all of them. */
  frame: (ids: string[]) => void;
  /** Drop the committed frame without touching the query or matches. */
  clearFrame: () => void;
  /** Escape/clear — reset every field at once. */
  clear: () => void;
}

function sameIds(a: string[] | null, b: string[] | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  matchedIds: null,
  frameIds: null,
  setQuery: (query) => set({ query }),
  setMatches: (ids) =>
    set((state) =>
      sameIds(state.matchedIds, ids) ? state : { matchedIds: ids },
    ),
  frame: (ids) =>
    set((state) => (sameIds(state.frameIds, ids) ? state : { frameIds: ids })),
  clearFrame: () =>
    set((state) => (state.frameIds ? { frameIds: null } : state)),
  clear: () =>
    set((state) =>
      state.query || state.matchedIds || state.frameIds
        ? { query: "", matchedIds: null, frameIds: null }
        : state,
    ),
}));

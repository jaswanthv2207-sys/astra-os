import { create } from "zustand";

/**
 * What an ask currently reveals — the single source of truth connecting
 * Astra's replies, the planets, the connection beams and the camera's
 * results fly-through.
 *
 * The store holds raw state only; the parser lives in
 * `sections/universe/search-query.ts` (the reply engine computes intents
 * and pushes results here, so this file never imports data or parsing).
 *
 *   • `matchedIds` — worlds the parser matched (live glow / fade target),
 *   • `frameIds`   — the committed result set the camera should frame
 *                    (committed once per reveal, so glow changes never
 *                    move the camera).
 */
export interface SearchState {
  /** Matched world ids, or `null` when no ask is active. */
  matchedIds: string[] | null;
  /** Committed ids the camera frames as a set, or `null`. */
  frameIds: string[] | null;
  /** Publish the parser's matches (no-op when the set is unchanged). */
  setMatches: (ids: string[] | null) => void;
  /** Commit a result set: the camera flies to frame all of them. */
  frame: (ids: string[]) => void;
  /** Drop the committed frame without touching the matches. */
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
  matchedIds: null,
  frameIds: null,
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
      state.matchedIds || state.frameIds
        ? { matchedIds: null, frameIds: null }
        : state,
    ),
}));

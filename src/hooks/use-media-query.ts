"use client";

import * as React from "react";

/**
 * useMediaQuery — subscribe to a CSS media query on the client.
 *
 * SSR-safe (renders `false` until the effect syncs) and change-aware, so
 * layout decisions like "the dossier is a side rail, not a bottom sheet"
 * follow live viewport resizes — not just the first paint.
 *
 * @example
 * const isDesktop = useMediaQuery("(min-width: 1024px)");
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const sync = () => setMatches(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, [query]);

  return matches;
}

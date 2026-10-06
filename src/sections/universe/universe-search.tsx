"use client";

import * as React from "react";

import { Icon } from "@/components";
import { useSearch } from "@/hooks/use-search";
import { useUniverse } from "@/hooks/use-universe";
import { cn } from "@/lib/utils";

import { formatDate } from "./scene/planet-card";
import { parseQuery, type SearchIntent } from "./search-query";

/* ────────────────────────────────────────────────────────────────────────── *
 * UniverseSearch — the AI search bar floating at the top of the universe.
 *
 * Natural phrasings ("Show all AI projects", "Find projects using Fast API",
 * "Open my latest hackathon project") are parsed locally by
 * `search-query.ts`. As you type, the parsed match set is published to the
 * scene: matching worlds blaze, unrelated ones sink into the background and
 * their knowledge connections dim. Committing with Enter either opens the
 * single best match (open/singular asks) or eases the camera to a vantage
 * that frames every result at once — and Escape (handled by the shell)
 * unwinds the search before it unwinds the universe.
 *
 * Interaction model: ArrowDown/Up moves a virtual selection inside the
 * listbox (`aria-activedescendant`), Enter opens the selected world or
 * commits the ask, "/" focuses the bar from anywhere, Escape clears.
 * ────────────────────────────────────────────────────────────────────────── */

/** The three canonical asks — discoverability for the whole feature. */
const SUGGESTIONS = [
  "Show all AI projects",
  "Find projects using Fast API",
  "Open my latest hackathon project",
] as const;

/** One assistant-style line under the bar — mirrors the parser's reasoning. */
function responseLine(intent: SearchIntent, raw: string): string {
  const n = intent.results.length;
  const worlds = `${n} world${n === 1 ? "" : "s"}`;
  switch (intent.reason) {
    case "stack":
      return `${worlds} using ${intent.detail}`;
    case "tag":
      return `${worlds} tagged ${intent.detail}`;
    case "mixed":
      return `${worlds} · ${intent.detail}`;
    case "recent":
      return `${worlds} — freshest first`;
    case "text":
      return `${worlds} matching “${intent.detail}”`;
    default:
      return `No worlds match “${raw.trim()}” — try a tag, stack or “latest”`;
  }
}

export function UniverseSearch() {
  const { query, setQuery, setMatches, frame, clearFrame, clear } = useSearch();
  const { focus, release } = useUniverse();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [selected, setSelected] = React.useState<number | null>(null);
  /* Committing collapses the list so the camera reveal (or the dossier) owns
     the stage; typing or ArrowDown brings the rows back. */
  const [listOpen, setListOpen] = React.useState(true);

  const intent = React.useMemo(() => parseQuery(query), [query]);
  const results = intent?.results ?? [];

  /* Publish the parsed matches so the scene can glow/fade while typing. */
  React.useEffect(() => {
    setMatches(
      intent && intent.results.length > 0
        ? intent.results.map((project) => project.id)
        : null,
    );
  }, [intent, setMatches]);

  /* A new result set invalidates the virtual selection. */
  React.useEffect(() => {
    setSelected(null);
  }, [intent]);

  /* "/" focuses the bar from anywhere (unless already typing somewhere). */
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey)
        return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Commit: singular/open asks open their best match; list asks frame the
     whole result set (the camera eases to it — see `camera-rig.tsx`). */
  const commit = React.useCallback(
    (parsed: SearchIntent | null) => {
      if (!parsed || parsed.results.length === 0) return;
      setListOpen(false);
      if (parsed.open || parsed.results.length === 1) {
        clearFrame();
        focus(parsed.results[0].id);
      } else {
        release();
        frame(parsed.results.map((project) => project.id));
      }
    },
    [clearFrame, focus, frame, release],
  );

  const openWorld = React.useCallback(
    (id: string) => {
      setListOpen(false);
      setSelected(null);
      clearFrame();
      focus(id);
    },
    [clearFrame, focus],
  );

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setListOpen(true);
    // Editing the query invalidates a committed frame — the camera eases back.
    clearFrame();
  };

  const runSuggestion = (text: string) => {
    setQuery(text);
    commit(parseQuery(text));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length === 0) return;
      setListOpen(true);
      setSelected((current) =>
        current === null ? 0 : Math.min(current + 1, results.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      setSelected((current) =>
        current === null ? null : Math.max(current - 1, 0),
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const picked = selected !== null ? results[selected] : undefined;
      if (picked) openWorld(picked.id);
      else commit(intent);
    }
  };

  const willOpen =
    intent !== null &&
    results.length > 0 &&
    (intent.open || results.length === 1);
  const showList = listOpen && results.length > 0;

  return (
    <div className="z-popover pointer-events-none absolute top-16 left-1/2 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 sm:top-20">
      <div
        role="search"
        aria-label="Ask Astra — search the universe"
        className="pointer-events-auto"
      >
        {/* ── the bar ─────────────────────────────────────────────────── */}
        <div className="glass-strong flex items-center gap-3 rounded-2xl px-4 py-3 shadow-[0_12px_48px_rgba(0,0,0,0.5)]">
          <Icon
            name="sparkles"
            label=""
            className="text-aura-violet-soft shrink-0"
          />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls="astra-search-results"
            aria-activedescendant={
              showList && selected !== null && results[selected]
                ? `astra-option-${results[selected].id}`
                : undefined
            }
            aria-autocomplete="list"
            aria-label="Ask Astra — natural language search"
            value={query}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onFocus={() => {
              if (results.length > 0) setListOpen(true);
            }}
            placeholder={'Ask Astra… "Show all AI projects"'}
            autoComplete="off"
            spellCheck={false}
            className="text-ink placeholder:text-ink-ghost w-full min-w-0 bg-transparent text-sm outline-none"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                clear();
                inputRef.current?.focus();
              }}
              className="text-ink-muted hover:text-ink shrink-0 transition-colors"
            >
              <Icon name="close" label="" />
            </button>
          ) : (
            <kbd
              aria-hidden="true"
              className="glass text-ink-ghost shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]"
            >
              /
            </kbd>
          )}
        </div>

        {/* ── canonical suggestions (only while empty) ──────────────────── */}
        {!query && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => runSuggestion(suggestion)}
                className="glass text-ink-muted hover:text-ink rounded-full px-3 py-1.5 text-xs transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* ── assistant response line (polite live region) ──────────────── */}
        {intent && (
          <p
            aria-live="polite"
            className="mt-2 flex items-center justify-center gap-2 text-center text-xs"
          >
            <span aria-hidden="true" className="text-aura-cyan">
              ✦
            </span>
            <span
              className={
                intent.reason === "empty" ? "text-ink-muted" : "text-ink"
              }
            >
              {responseLine(intent, query)}
            </span>
            {results.length > 0 && (
              <kbd
                aria-hidden="true"
                className="glass text-ink-ghost rounded px-1.5 py-0.5 font-mono text-[10px]"
              >
                {willOpen
                  ? listOpen
                    ? "↵ open"
                    : "✓ open"
                  : listOpen
                    ? "↵ frame"
                    : "↓ results"}
              </kbd>
            )}
          </p>
        )}

        {/* ── result worlds ─────────────────────────────────────────────── */}
        {showList && (
          <ul
            id="astra-search-results"
            role="listbox"
            aria-label="Matching worlds"
            className="glass-strong mt-2 max-h-[min(50vh,20rem)] overflow-y-auto rounded-2xl p-1.5"
          >
            {results.map((project, index) => (
              <li
                key={project.id}
                id={`astra-option-${project.id}`}
                role="option"
                aria-selected={selected === index}
                onClick={() => openWorld(project.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                  selected === index
                    ? "bg-white/[0.07]"
                    : "hover:bg-white/[0.04]",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: project.planet.atmosphere,
                    boxShadow: `0 0 10px ${project.planet.atmosphere}`,
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-ink block truncate text-sm font-medium">
                    {project.name}
                  </span>
                  <span className="text-ink-muted block truncate text-xs">
                    {project.summary}
                  </span>
                </span>
                <span className="text-ink-faint shrink-0 font-mono text-[10px] tabular-nums">
                  {formatDate(project.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

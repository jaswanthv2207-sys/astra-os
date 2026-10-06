"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Icon } from "./icon";

export interface SearchBarProps extends Omit<
  React.FormHTMLAttributes<HTMLFormElement>,
  "onSubmit"
> {
  /** Controlled query. */
  value: string;
  onValueChange: (value: string) => void;
  /** Fires on submit (Enter) — receives the trimmed query. */
  onSubmit?: (value: string) => void;
  placeholder?: string;
  /**
   * Input id. Derived from `srLabel` by default (deterministic across
   * server/client — `useId` has been known to drift during hydration here).
   * Pass your own when two bars share a label.
   */
  id?: string;
  /** Show the ⌘K / Ctrl+K hint. Hidden on small screens. */
  showShortcut?: boolean;
  /** Registers a global ⌘K (and `/`) shortcut that focuses this field. */
  enableGlobalShortcut?: boolean;
  size?: "sm" | "md";
  /** Screen-reader label for the search landmark. */
  srLabel?: string;
}

/**
 * SearchBar — a `role="search"` landmark with command-palette styling.
 *
 * Micro-interactions: aura focus glow on the wrapper, the icon lights up on
 * focus, the clear button fades in only when there's something to clear, and
 * the kbd hint highlights while focused.
 *
 * A11y:
 * • real `<form role="search">` + `<label class="sr-only">` landmark
 * • `aria-keyshortcuts` advertises ⌘K / Ctrl+K to assistive tech
 * • clear button is a labelled `<button type="button">` (keyboard reachable)
 * • the decorative kbd hint is `aria-hidden` — the shortcut is announced
 *   via `aria-keyshortcuts` instead of being read twice
 *
 * @example
 * <SearchBar value={q} onValueChange={setQ} onSubmit={run} placeholder="Search docs…" />
 */
export function SearchBar({
  value,
  onValueChange,
  onSubmit,
  placeholder = "Search…",
  showShortcut = true,
  enableGlobalShortcut = true,
  size = "md",
  srLabel = "Search",
  className,
  id: idProp,
  ...props
}: SearchBarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inputId = idProp ?? srLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const isMac = React.useRef(
    typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform || ""),
  );

  React.useEffect(() => {
    if (!enableGlobalShortcut) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;

      const isK = event.key.toLowerCase() === "k";
      const combo = isK && (event.metaKey || event.ctrlKey);
      const isSlash = event.key === "/" && !typing;

      if (combo || isSlash) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enableGlobalShortcut]);

  return (
    <form
      role="search"
      aria-label={srLabel}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(value.trim());
      }}
      className={cn("w-full", className)}
      {...props}
    >
      <label htmlFor={inputId} className="sr-only">
        {srLabel}
      </label>

      <div
        className={cn(
          "group/search backdrop-blur-glass flex w-full items-center gap-2.5 rounded-full border bg-white/[0.04]",
          "duration-base ease-out-expo transition-all",
          "border-line hover:border-line-strong hover:bg-white/[0.06]",
          "focus-within:border-aura-violet/70 focus-within:shadow-glow-violet focus-within:bg-white/[0.07]",
          size === "sm" ? "h-9 px-3.5" : "h-11 px-4",
        )}
      >
        <Icon
          name="search"
          size={size === "sm" ? "sm" : "md"}
          className="text-ink-faint duration-base group-focus-within/search:text-aura-violet transition-colors"
        />

        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          spellCheck={false}
          aria-keyshortcuts="Meta+K Control+K"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={placeholder}
          className="text-ink placeholder:text-ink-ghost h-full w-full min-w-0 bg-transparent text-sm outline-none focus-visible:outline-none"
        />

        {value.length > 0 && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onValueChange("");
              inputRef.current?.focus();
            }}
            className={cn(
              "text-ink-faint rounded-full p-1 outline-none",
              "duration-fast ease-out-expo transition-all",
              "hover:text-ink focus-visible:outline-aura-violet hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2",
            )}
          >
            <Icon name="close" size="xs" />
          </button>
        )}

        {showShortcut && value.length === 0 && (
          <kbd
            aria-hidden="true"
            className={cn(
              "border-line hidden shrink-0 items-center gap-0.5 rounded-md border bg-white/[0.05] px-1.5 py-0.5",
              "text-ink-faint text-micro font-sans font-medium",
              "duration-base group-focus-within/search:border-aura-violet/50 group-focus-within/search:text-aura-violet-soft transition-colors",
              "sm:inline-flex",
            )}
          >
            {isMac.current ? "⌘" : "Ctrl"}
            <span className="text-ink-ghost group-focus-within/search:text-aura-violet-soft">
              K
            </span>
          </kbd>
        )}

        {value.length > 0 && (
          <Icon
            name="enter"
            className="text-ink-faint hidden shrink-0 sm:block"
          />
        )}
      </div>
    </form>
  );
}

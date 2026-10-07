"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Icon } from "@/components";
import { useAssistant } from "@/hooks/use-assistant";
import { useSceneProjects } from "@/hooks/use-scene-data";
import { useSettings, settingsActions } from "@/hooks/use-settings";
import { useTimeline } from "@/hooks/use-timeline";
import { useUniverse } from "@/hooks/use-universe";
import {
  useActiveUniverseId,
  useUniverses,
  workspaceActions,
} from "@/hooks/use-workspace";
import { playCue } from "@/lib/audio";
import { promptInstall } from "@/lib/install";
import type { IconName } from "@/lib/icons";
import { openSettings } from "@/lib/settings-event";
import { cn } from "@/lib/utils";
import { timelineEngaged } from "@/sections/universe/timeline";

/* ────────────────────────────────────────────────────────────────────────── *
 * CommandPalette — the app-wide ⌘K surface.
 *
 * One always-mounted portal serves every route: universe actions while the
 * scene is up (galaxy map, Astra, time travel, creation), navigation, the
 * active scene's worlds (focus one — deep-linking via `?world=` when the
 * palette is invoked from another page) and every saved universe (switch).
 *
 * Keyboard ownership:
 *   • a capture-phase window listener owns ⌘K/Ctrl+K — it calls
 *     `stopImmediatePropagation` before anything else can see the chord, so
 *     every `SearchBar` on the site yields its own ⌘K handler to the
 *     palette (their `/` shortcut keeps working);
 *   • Escape is captured the same way while open — the shell's window-bubble
 *     Escape chain, Radix dismissables and the galaxy map's layer all stay
 *     untouched, so closing the palette closes *only* the palette;
 *   • opening yields to modal dialogs (Radix focus guards would fight for
 *     focus) but not to the galaxy map or Astra's panel — hand-rolled
 *     overlays stack under it, and Escape unwinds topmost-first because the
 *     palette's capture listener registers at page load, before any
 *     open-time listener.
 *
 * The list is a proper ARIA combobox: arrows move `aria-activedescendant`,
 * Enter runs, Tab hands focus back (the panel is arrow-driven), and the
 * dialog restores focus to whatever opened it.
 * ────────────────────────────────────────────────────────────────────────── */

const EASE = [0.16, 1, 0.3, 1] as const;

type CommandGroup = "actions" | "go" | "worlds" | "universes";

interface Command {
  id: string;
  group: CommandGroup;
  icon: IconName;
  /** Command title — what the user reads first. */
  label: string;
  /** Right-aligned mono detail (route, repo, state). */
  hint?: string;
  /** Extra haystack for matching (stack words, tags). */
  keywords?: string;
  run: () => void;
}

const GROUPS: Record<CommandGroup, string> = {
  actions: "Actions",
  go: "Go to",
  worlds: "Worlds",
  universes: "Universes",
};

/**
 * Best score of `query` inside `text`: exact > prefix > word-boundary >
 * substring > subsequence, so typing "um" ranks "Universe Manager" above
 * an incidental mid-word hit. `null` = no match at all; 0 = empty query.
 */
function matchScore(query: string, text: string): number | null {
  if (!query) return 0;
  const haystack = text.toLowerCase();
  if (haystack === query) return 1000;
  const index = haystack.indexOf(query);
  if (index >= 0) {
    if (index === 0) return 900;
    const previous = haystack[index - 1];
    const boundary =
      previous === " " ||
      previous === "-" ||
      previous === "/" ||
      previous === ":";
    return (boundary ? 800 : 700) - Math.min(index, 99);
  }
  /* Subsequence fallback — "unmgr" finds "Universe Manager". */
  let cursor = 0;
  let gaps = 0;
  for (const character of query) {
    const found = haystack.indexOf(character, cursor);
    if (found === -1) return null;
    gaps += found - cursor;
    cursor = found + 1;
  }
  return 400 - Math.min(gaps, 99);
}

function scoreCommand(query: string, command: Command): number | null {
  const scores = [command.label, command.keywords, command.hint]
    .filter((part): part is string => Boolean(part))
    .map((part) => matchScore(query, part));
  let best: number | null = null;
  for (const score of scores) {
    if (score !== null && (best === null || score > best)) best = score;
  }
  return best;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border-line rounded border bg-white/[0.05] px-1.5 py-0.5 font-sans normal-case">
      {children}
    </kbd>
  );
}

export function CommandPalette() {
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);

  const openRef = React.useRef(false);
  openRef.current = open;
  const inputRef = React.useRef<HTMLInputElement>(null);
  /** Element focused before the last open — restored on close. */
  const openerRef = React.useRef<HTMLElement | null>(null);
  const wasOpen = React.useRef(false);

  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const projects = useSceneProjects();
  const universes = useUniverses();
  const activeUniverseId = useActiveUniverseId();
  const { focus } = useUniverse();
  const { setOpen: setAssistantOpen } = useAssistant();
  const { date, now, resetToNow } = useTimeline();

  React.useEffect(() => setMounted(true), []);

  const engaged = timelineEngaged(date, now);
  const { sound } = useSettings();

  /* ── keyboard ownership ──────────────────────────────────────────────── */
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        /* SearchBar yields: no bubble-phase handler ever sees the chord. */
        event.stopImmediatePropagation();
        if (!openRef.current) {
          /* A modal dialog (Radix focus guard) owns the screen — let it.
             The dashboard is hand-rolled with no focus guards of its own,
             so ⌘K deliberately opens over it (`:not([data-insights])`). */
          if (
            document.querySelector(
              '[role="dialog"][aria-modal="true"]:not([data-minimap]):not([data-insights]):not([data-command-palette])',
            )
          ) {
            return;
          }
        }
        setOpen((isOpen) => !isOpen);
        return;
      }
      if (event.key === "Escape" && openRef.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, []);

  /* ── open/close lifecycle ────────────────────────────────────────────── */
  React.useEffect(() => {
    if (open) {
      playCue("open");
      wasOpen.current = true;
      openerRef.current = document.activeElement as HTMLElement | null;
      setQuery("");
      setActive(0);
      inputRef.current?.focus({ preventScroll: true });
      return;
    }
    if (!wasOpen.current) return;
    const opener = openerRef.current;
    if (opener && document.contains(opener)) {
      opener.focus({ preventScroll: true });
    }
  }, [open]);

  /* Any navigation (command or otherwise) leaves the palette behind. */
  React.useEffect(() => setOpen(false), [pathname]);

  /* ── command set ─────────────────────────────────────────────────────── */
  const commands = React.useMemo<Command[]>(() => {
    const list: Command[] = [];
    const onUniverse = pathname === "/universe";

    if (onUniverse) {
      list.push(
        {
          id: "toggle-map",
          group: "actions",
          icon: "map",
          label: "Toggle galaxy map",
          hint: "M",
          run: () => window.dispatchEvent(new Event("astra:map-toggle")),
        },
        {
          id: "open-insights",
          group: "actions",
          icon: "zap",
          label: "Open AI insights",
          hint: "forecast",
          run: () => window.dispatchEvent(new Event("astra:insights-toggle")),
        },
        {
          id: "ask-astra",
          group: "actions",
          icon: "sparkles",
          label: "Ask Astra",
          hint: "assistant",
          run: () => setAssistantOpen(true),
        },
      );
    }
    if (engaged) {
      list.push({
        id: "timeline-now",
        group: "actions",
        icon: "clock",
        label: "Return timeline to now",
        hint: "present",
        run: resetToNow,
      });
    }
    if (onUniverse || pathname === "/universes") {
      list.push(
        {
          id: "create-universe",
          group: "actions",
          icon: "plus",
          label: "Create a new universe",
          run: () => window.dispatchEvent(new Event("astra:new-universe")),
        },
        {
          id: "start-tour",
          group: "actions",
          icon: "rocket",
          label: "Start the guided tour",
          hint: "onboarding",
          run: () => window.dispatchEvent(new Event("astra:tour-start")),
        },
      );
    }

    list.push(
      {
        id: "open-settings",
        group: "actions",
        icon: "settings",
        label: "Open settings",
        hint: "AI · GitHub · sound",
        run: () => openSettings(),
      },
      {
        id: "toggle-sound",
        group: "actions",
        icon: "activity",
        label: "Toggle sound",
        hint: sound.on ? "mute" : "unmute",
        run: () => settingsActions().setSound({ on: !sound.on }),
      },
      {
        id: "install-app",
        group: "actions",
        icon: "download",
        label: "Install Astra OS",
        hint: "app",
        run: () => {
          void promptInstall().then((outcome) => {
            if (outcome === "unavailable") openSettings("app");
          });
        },
      },
      {
        id: "go-universe",
        group: "go",
        icon: "orbit",
        label: "Universe",
        hint: "/universe",
        run: () => router.push("/universe"),
      },
      {
        id: "go-manager",
        group: "go",
        icon: "grid",
        label: "Universe Manager",
        hint: "/universes",
        run: () => router.push("/universes"),
      },
      {
        id: "go-home",
        group: "go",
        icon: "home",
        label: "Home",
        hint: "/",
        run: () => router.push("/"),
      },
      {
        id: "go-design",
        group: "go",
        icon: "palette",
        label: "Design system",
        hint: "/design-system",
        run: () => router.push("/design-system"),
      },
      {
        id: "go-components",
        group: "go",
        icon: "boxes",
        label: "Components",
        hint: "/components",
        run: () => router.push("/components"),
      },
      {
        id: "go-shortcuts",
        group: "go",
        icon: "command",
        label: "Keyboard shortcuts",
        hint: "/shortcuts",
        run: () => router.push("/shortcuts"),
      },
    );

    for (const project of projects) {
      list.push({
        id: `focus:${project.id}`,
        group: "worlds",
        icon: "target",
        label: `Focus ${project.name}`,
        hint: project.status,
        keywords: project.stack.join(" "),
        run: () => {
          if (pathname === "/universe") focus(project.id);
          else router.push(`/universe?world=${project.id}`);
        },
      });
    }

    for (const universe of universes) {
      list.push({
        id: `universe:${universe.id}`,
        group: "universes",
        icon: "rocket",
        label: universe.name,
        hint:
          universe.id === activeUniverseId ? "current" : universe.githubRepo,
        keywords: universe.tags.join(" "),
        run: () => {
          workspaceActions().setActiveUniverse(universe.id);
          router.push("/universe");
        },
      });
    }

    return list;
  }, [
    activeUniverseId,
    engaged,
    focus,
    pathname,
    projects,
    resetToNow,
    router,
    setAssistantOpen,
    sound.on,
    universes,
  ]);

  /* ── filtering ───────────────────────────────────────────────────────── */
  const trimmed = query.trim().toLowerCase();
  const flat = React.useMemo<Command[]>(() => {
    if (!trimmed) return commands;
    return commands
      .map((command) => ({ command, score: scoreCommand(trimmed, command) }))
      .filter(
        (entry): entry is { command: Command; score: number } =>
          entry.score !== null,
      )
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.command);
  }, [commands, trimmed]);

  /* Keep the cursor inside the results when the set shrinks under typing. */
  React.useEffect(() => {
    setActive((index) =>
      index < flat.length ? index : Math.max(0, flat.length - 1),
    );
  }, [flat.length]);

  /* The active option stays in view while arrowing (list-scoped scroll). */
  React.useEffect(() => {
    if (!open) return;
    document
      .getElementById(`command-option-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open, trimmed]);

  const runCommand = React.useCallback((command: Command) => {
    setOpen(false);
    setQuery("");
    setActive(0);
    command.run();
  }, []);

  if (!mounted) return null;

  const activeId =
    flat.length > 0
      ? `command-option-${Math.min(active, flat.length - 1)}`
      : undefined;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="palette-overlay"
          className="z-toast fixed inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.16, ease: EASE } }}
          transition={{ duration: 0.18, ease: EASE }}
        >
          {/* Backdrop — click anywhere outside the panel to dismiss. */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />

          <div className="pointer-events-none absolute inset-0 flex items-start justify-center overflow-y-auto px-4 py-[10vh]">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              data-command-palette=""
              initial={reduce ? false : { opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={
                reduce
                  ? { opacity: 0, transition: { duration: 0.12 } }
                  : {
                      opacity: 0,
                      scale: 0.97,
                      y: 8,
                      transition: { duration: 0.18, ease: EASE },
                    }
              }
              transition={{ duration: 0.32, ease: EASE }}
              className="border-line shadow-glass backdrop-blur-glass-xl pointer-events-auto w-full max-w-[38rem] overflow-hidden rounded-2xl border bg-[rgba(9,7,18,0.94)]"
            >
              {/* ── query row ─────────────────────────────────────────── */}
              <div className="border-line/70 flex items-center gap-3 border-b px-4 py-3">
                <Icon
                  name="command"
                  size="sm"
                  className="text-aura-violet shrink-0"
                />
                <input
                  ref={inputRef}
                  type="text"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="command-palette-list"
                  aria-activedescendant={activeId}
                  aria-autocomplete="list"
                  aria-label="Command palette search"
                  autoComplete="off"
                  spellCheck={false}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setActive((index) =>
                        flat.length ? (index + 1) % flat.length : 0,
                      );
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setActive((index) =>
                        flat.length
                          ? (index - 1 + flat.length) % flat.length
                          : 0,
                      );
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      const command = flat[active];
                      if (command) runCommand(command);
                    } else if (event.key === "Tab") {
                      /* Arrow-driven panel: Tab hands focus back rather
                         than trapping it in a one-field dialog. */
                      event.preventDefault();
                      setOpen(false);
                    }
                  }}
                  placeholder="Type a command or search worlds…"
                  className="text-ink placeholder:text-ink-ghost h-8 w-full min-w-0 bg-transparent text-sm outline-none"
                />
                <span
                  aria-hidden="true"
                  className="border-line text-ink-ghost text-micro hidden shrink-0 items-center gap-0.5 rounded-md border bg-white/[0.05] px-1.5 py-0.5 font-sans sm:flex"
                >
                  esc
                </span>
              </div>

              {/* ── results ───────────────────────────────────────────── */}
              <div
                role="listbox"
                id="command-palette-list"
                aria-label="Commands"
                className="max-h-[min(58vh,24rem)] overflow-y-auto overscroll-contain p-2"
              >
                {flat.length === 0 ? (
                  <div className="text-ink-muted flex flex-col items-center gap-2 px-4 py-10 text-center">
                    <Icon name="search" size="md" className="text-ink-ghost" />
                    <p className="text-sm">
                      No commands match{" "}
                      <span className="text-ink font-medium">“{query}”</span>
                    </p>
                    <p className="text-ink-ghost text-micro">
                      Try a world name, a route, or “map”.
                    </p>
                  </div>
                ) : (
                  flat.map((command, index) => {
                    const isActive =
                      index === Math.min(active, flat.length - 1);
                    const showHeader =
                      !trimmed &&
                      (index === 0 || flat[index - 1].group !== command.group);
                    return (
                      <React.Fragment key={command.id}>
                        {showHeader && (
                          <p
                            role="presentation"
                            className="eyebrow text-ink-ghost px-2.5 pt-3 pb-1.5"
                            style={{ color: "var(--ink-ghost)" }}
                          >
                            {GROUPS[command.group]}
                          </p>
                        )}
                        <button
                          type="button"
                          role="option"
                          id={`command-option-${index}`}
                          aria-selected={isActive}
                          tabIndex={-1}
                          onMouseMove={() => setActive(index)}
                          onClick={() => runCommand(command)}
                          className={cn(
                            "group/cmd flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left",
                            "duration-fast ease-out-expo transition-colors",
                            isActive
                              ? "ring-aura-violet/40 bg-white/[0.08] ring-1 ring-inset"
                              : "hover:bg-white/[0.04]",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-7 shrink-0 items-center justify-center rounded-md border",
                              isActive
                                ? "border-aura-violet/50 bg-aura-violet/15 text-aura-violet"
                                : "border-line text-ink-muted group-hover/cmd:text-ink-secondary bg-white/[0.03]",
                            )}
                          >
                            <Icon name={command.icon} size="xs" />
                          </span>
                          <span className="text-ink min-w-0 flex-1 truncate text-sm font-medium">
                            {command.label}
                          </span>
                          {command.hint && (
                            <span className="text-ink-ghost text-micro shrink-0 font-mono">
                              {command.hint}
                            </span>
                          )}
                        </button>
                      </React.Fragment>
                    );
                  })
                )}
              </div>

              {/* ── key legend ────────────────────────────────────────── */}
              <div className="border-line/70 text-ink-ghost text-micro flex items-center justify-between border-t px-4 py-2.5">
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Kbd>↑↓</Kbd> navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <Kbd>↵</Kbd> run
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>esc</Kbd> close
                </span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

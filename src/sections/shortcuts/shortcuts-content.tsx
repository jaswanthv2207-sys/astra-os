"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";

import { Button, Icon, Reveal } from "@/components";
import type { IconName } from "@/lib/icons";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────── *
 * ShortcutsContent — the keyboard reference for every surface. Groups are
 * data, rows are `keys` (rendered as caps; `+` and `/` render dimmed) plus
 * a plain-English description, so adding a shortcut later is one line.
 * Everything here mirrors real handlers: palette (window capture), minimap
 * keys, the timeline's ARIA slider switch, the dossier tablist and the
 * manager's inline-edit keys.
 * ────────────────────────────────────────────────────────────────────────── */

interface ShortcutRow {
  /** Cap labels, e.g. ["⌘", "+", "K"] — `+` / `/` render as dim separators. */
  keys: string[];
  desc: string;
}

interface ShortcutGroup {
  icon: IconName;
  title: string;
  rows: ShortcutRow[];
  note?: string;
}

const GROUPS: ShortcutGroup[] = [
  {
    icon: "command",
    title: "Global",
    note: "Ctrl stands in for ⌘ on Windows.",
    rows: [
      {
        keys: ["⌘", "+", "K"],
        desc: "Open the command palette — on every page",
      },
      { keys: ["/"], desc: "Jump straight to search (home)" },
      { keys: ["Esc"], desc: "Back out — unwinds the topmost layer first" },
    ],
  },
  {
    icon: "search",
    title: "Command palette",
    note: "An open dialog keeps ⌘K until it closes.",
    rows: [
      { keys: ["↑", "↓"], desc: "Move through results" },
      { keys: ["Enter"], desc: "Run the highlighted command" },
      { keys: ["Esc"], desc: "Close and restore focus" },
    ],
  },
  {
    icon: "map",
    title: "Galaxy map",
    note: "Universe view.",
    rows: [
      { keys: ["M"], desc: "Open or close the map" },
      { keys: ["+", "/", "−"], desc: "Zoom the system in or out" },
      { keys: ["0"], desc: "Reset the view" },
      { keys: ["←", "↑", "→", "↓"], desc: "Spatial-hop between worlds" },
      { keys: ["Tab"], desc: "Cycle the world dots" },
    ],
  },
  {
    icon: "clock",
    title: "Timeline",
    note: "Focus the bar first.",
    rows: [
      { keys: ["←", "→"], desc: "Step one month (↑ ↓ too)" },
      { keys: ["⇧", "+", "←", "→"], desc: "Step a whole year" },
      { keys: ["Page Up", "/", "Page Down"], desc: "Jump a year at a time" },
      { keys: ["Home"], desc: "Back to the universe's first day" },
      { keys: ["End"], desc: "Snap back to now" },
      { keys: ["Space"], desc: "Play or pause (button focused)" },
    ],
  },
  {
    icon: "layers",
    title: "World dossier",
    note: "Open a planet first.",
    rows: [
      { keys: ["←", "→"], desc: "Switch tabs (tab strip focused)" },
      { keys: ["Home", "/", "End"], desc: "First / last tab" },
      { keys: ["Esc"], desc: "Close the dossier or revealed frame" },
    ],
  },
  {
    icon: "grid",
    title: "Universe Manager",
    rows: [
      {
        keys: ["⌘", "+", "K"],
        desc: "Jump to any universe from the palette",
      },
      { keys: ["Enter"], desc: "Activate the focused action" },
      { keys: ["Esc"], desc: "Cancel a rename, close a dialog" },
      { keys: ["Drag"], desc: "Reorder cards — the order persists" },
    ],
  },
];

/** Escape releases one layer per press, topmost first. */
const ESCAPE_ORDER = [
  "Palette",
  "Assistant",
  "Panels & frames",
  "Scene controls",
];

function Kbd({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <kbd
      className={cn(
        "min-w-6 rounded-md border px-1.5 py-0.5 text-center font-mono text-[11px] leading-5",
        dim
          ? "text-ink-ghost border-transparent bg-transparent px-0.5"
          : "border-line-strong text-ink bg-white/[0.06]",
      )}
    >
      {children}
    </kbd>
  );
}

function GroupCard({ group, index }: { group: ShortcutGroup; index: number }) {
  return (
    <Reveal delay={Math.min(index * 0.06, 0.3)} className="h-full">
      <section className="glass border-line/70 flex h-full flex-col rounded-2xl border p-5 sm:p-6">
        <p className="eyebrow mb-4 flex items-center gap-1.5">
          <Icon name={group.icon} size="xs" label="" />
          {group.title}
        </p>
        <dl className="space-y-3.5">
          {group.rows.map((row) => (
            <div
              key={row.desc}
              className="flex items-baseline justify-between gap-4"
            >
              <dt className="text-ink-muted text-sm">{row.desc}</dt>
              <dd className="flex shrink-0 items-center gap-1">
                {row.keys.map((cap, capIndex) => (
                  <Kbd
                    key={`${row.desc}-${capIndex}`}
                    dim={cap === "+" || cap === "/"}
                  >
                    {cap}
                  </Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        {group.note && (
          <p className="text-ink-ghost border-line/70 mt-auto border-t pt-3.5 text-xs">
            {group.note}
          </p>
        )}
      </section>
    </Reveal>
  );
}

/**
 * ShortcutsContent — hero + grouped reference + Escape-order callout +
 * tour CTA. Mounted by `/shortcuts` inside the landing chrome (Navbar,
 * Aurora, Footer).
 */
export function ShortcutsContent() {
  const router = useRouter();
  const reduce = useReducedMotion();

  const startTour = () => {
    window.dispatchEvent(new Event("astra:tour-start"));
    void router.push("/universes");
  };

  return (
    <div className="container-page gap-section pb-section relative z-10 flex flex-col pt-32">
      {/* ── hero ─────────────────────────────────────────────────────── */}
      <header className="max-w-2xl">
        <Reveal>
          <p className="eyebrow flex items-center gap-1.5">
            <Icon name="command" size="xs" label="" />
            Keyboard reference
          </p>
          <h1 className="tracking-title text-ink mt-4 text-3xl font-semibold sm:text-4xl lg:text-5xl">
            Every move,{" "}
            <span className="text-aura-violet-soft">one keypress</span>
          </h1>
          <p className="text-ink-muted mt-4 text-base leading-relaxed sm:text-lg">
            Palette, map, timeline and dossier all speak the same keyboard.
            Learn a handful and Astra OS never needs the mouse.
          </p>
          <div className="mt-6 flex items-center gap-2.5">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
            <span className="text-ink-faint text-xs">
              opens everything — on every page
            </span>
          </div>
        </Reveal>
      </header>

      {/* ── groups ───────────────────────────────────────────────────── */}
      <div className="grid items-start gap-4 md:grid-cols-2">
        {GROUPS.map((group, index) => (
          <GroupCard key={group.title} group={group} index={index} />
        ))}
      </div>

      {/* ── escape order ─────────────────────────────────────────────── */}
      <Reveal>
        <section className="glass-strong border-line/70 rounded-2xl border p-5 sm:p-6">
          <p className="eyebrow mb-4 flex items-center gap-1.5">
            <Icon name="layers" size="xs" label="" />
            The Escape order
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {ESCAPE_ORDER.map((layer, index) => (
              <React.Fragment key={layer}>
                {index > 0 && (
                  <Icon
                    name="chevron-right"
                    size="xs"
                    label=""
                    className="text-ink-ghost"
                  />
                )}
                <motion.span
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: reduce ? 0 : 0.45,
                    delay: reduce ? 0 : index * 0.1,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="border-line-strong text-ink rounded-full border bg-white/[0.06] px-3 py-1.5 font-mono text-xs"
                >
                  {index + 1}. {layer}
                </motion.span>
              </React.Fragment>
            ))}
          </div>
          <p className="text-ink-muted mt-4 max-w-3xl text-sm leading-relaxed">
            One press, one layer. Escape lets go of the top of the stack first —
            the command palette before the assistant, open panels (map,
            insights, dialogs) and revealed frames before the scene itself.
            Nothing ever closes behind your back.
          </p>
        </section>
      </Reveal>

      {/* ── tour CTA ─────────────────────────────────────────────────── */}
      <Reveal>
        <section className="glass-strong border-line/70 flex flex-col gap-5 rounded-2xl border p-5 sm:p-7 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">First time here?</p>
            <h2 className="tracking-title text-ink mt-2 text-xl font-semibold">
              See the workspace in motion
            </h2>
            <p className="text-ink-muted mt-1.5 max-w-xl text-sm leading-relaxed">
              A short guided tour walks the Universe Manager — views, cards,
              controls — then the scene itself is one click away.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="primary"
              size="md"
              iconLeft={<Icon name="rocket" />}
              onClick={startTour}
            >
              Take the tour
            </Button>
            <Button variant="glass" size="md" asChild>
              <Link href="/universe">Enter the universe</Link>
            </Button>
          </div>
        </section>
      </Reveal>
    </div>
  );
}

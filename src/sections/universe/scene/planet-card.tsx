"use client";

import * as React from "react";

import type { Project, ProjectStatus } from "@/data";

/* ────────────────────────────────────────────────────────────────────────── *
 * ProjectCard — the premium glass dossier that floats beside a planet while
 * it is hovered: name + status, AI summary, technology chips, an animated
 * completion bar and the last-updated date.
 *
 * Purely presentational: it never takes pointer events (the invisible raycast
 * proxy in `planets.tsx` owns hover), and visibility is a pure CSS
 * reveal — the card is always mounted so hovering crossfades instead of
 * paying a React mount on every pointer entry.
 * ────────────────────────────────────────────────────────────────────────── */

export const STATUS_META: Record<
  ProjectStatus,
  { label: string; dot: string; text: string }
> = {
  active: { label: "Active", dot: "bg-success", text: "text-success" },
  building: { label: "Building", dot: "bg-warning", text: "text-warning" },
  idle: { label: "Idle", dot: "bg-ink-faint", text: "text-ink-faint" },
};

/** Shared entrance easing — same family as the HUD's glass transitions. */
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

/** `YYYY-MM-DD` → `28 Sep 2026` (locale-constructed, no timezone drift). */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "short", year: "numeric" },
  );
}

export interface ProjectCardProps {
  project: Project;
  /** Crossfaded in/out by the planet's hover state. */
  visible: boolean;
  /** Collapse all transitions to instant (prefers-reduced-motion). */
  reduced?: boolean;
}

export function ProjectCard({
  project,
  visible,
  reduced = false,
}: ProjectCardProps) {
  const status = STATUS_META[project.status];
  const { atmosphere } = project.planet;
  const shown = visible;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [corr, setCorr] = React.useState({ x: 0, y: 0 });

  /* Viewport clamp — the world keeps orbiting while the card is open (and
     zoom grows the anchor's screen offset), so re-measure after the
     entrance settles and nudge occasionally; corrections ride the card's
     own transform transition, so they glide instead of jumping. */
  React.useEffect(() => {
    if (!visible) {
      setCorr({ x: 0, y: 0 });
      return;
    }
    const measure = () => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const marginX = 16;
      const marginTop = 76; // clears the HUD's top rail
      const marginBottom = 16;
      let dx = 0;
      let dy = 0;
      if (rect.left < marginX) dx = marginX - rect.left;
      else if (rect.right > window.innerWidth - marginX)
        dx = window.innerWidth - marginX - rect.right;
      if (rect.top < marginTop) dy = marginTop - rect.top;
      else if (rect.bottom > window.innerHeight - marginBottom)
        dy = window.innerHeight - marginBottom - rect.bottom;
      if (dx !== 0 || dy !== 0)
        setCorr((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    };
    const start = window.setTimeout(measure, 360);
    const timer = window.setInterval(measure, 400);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
    };
  }, [visible]);

  return (
    <div
      ref={rootRef}
      aria-hidden={!shown}
      className="glass-strong text-ink border-line/70 w-80 rounded-2xl border p-4"
      style={{
        boxShadow: "0 24px 70px -28px rgb(0 0 0 / 0.85)",
        opacity: shown ? 1 : 0,
        filter: shown || reduced ? "blur(0px)" : "blur(6px)",
        transform: `translate(${corr.x}px, ${corr.y}px) ${
          shown
            ? "translateY(0) scale(1)"
            : reduced
              ? ""
              : "translateY(10px) scale(0.96)"
        }`,
        transition: reduced
          ? "none"
          : `opacity 0.32s ${EASE}, transform 0.32s ${EASE}, filter 0.32s ${EASE}`,
      }}
    >
      {/* Header — planet beacon + name, status chip on the right */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{
              backgroundColor: atmosphere,
              boxShadow: `0 0 10px ${atmosphere}`,
            }}
          />
          <span className="text-sm font-semibold tracking-tight">
            {project.name}
          </span>
        </div>
        <span
          className={`text-micro tracking-caps shrink-0 font-mono uppercase ${status.text}`}
        >
          <span
            className={`mr-1.5 inline-block size-1.5 rounded-full align-middle ${status.dot}`}
          />
          {status.label}
        </span>
      </div>

      {/* AI summary */}
      <p className="text-ink-muted mt-2.5 text-xs leading-relaxed">
        {project.summary}
      </p>

      {/* Technology stack */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {project.stack.map((tech) => (
          <span
            key={tech}
            className="border-line/80 text-ink-faint rounded-full border bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] tracking-wide"
          >
            {tech}
          </span>
        ))}
      </div>

      {/* Completion bar */}
      <div className="mt-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-ink-ghost text-micro tracking-caps font-mono">
            Completion
          </span>
          <span className="text-micro text-ink font-mono tabular-nums">
            {project.progress}%
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="from-aura-violet to-aura-cyan h-full rounded-full bg-gradient-to-r"
            style={{
              width: shown ? `${project.progress}%` : "0%",
              transition: reduced ? "none" : `width 0.9s ${EASE} 0.06s`,
            }}
          />
        </div>
      </div>

      {/* Footer — last updated */}
      <div className="border-line/70 mt-3 flex items-center justify-between border-t pt-2.5">
        <span className="text-ink-ghost text-micro tracking-caps font-mono">
          Last updated
        </span>
        <span className="text-ink-muted text-micro font-mono tabular-nums">
          {formatDate(project.updatedAt)}
        </span>
      </div>
    </div>
  );
}

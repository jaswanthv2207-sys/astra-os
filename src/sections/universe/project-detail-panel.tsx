"use client";

import * as React from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";

import { Badge, Button, Icon } from "@/components";
import { PROJECTS, type Project, type ProjectStatus } from "@/data";
import { useTimeline } from "@/hooks/use-timeline";
import { useUniverse } from "@/hooks/use-universe";
import type { IconName } from "@/lib/icons";
import { cn } from "@/lib/utils";

import { formatDate, STATUS_META } from "./scene/planet-card";
import { formatTimelineDate, progressAt } from "./timeline";

/* ────────────────────────────────────────────────────────────────────────── *
 * ProjectDetailPanel — the immersive project dossier.
 *
 * Selecting a world (click / double-click / the HUD's screen-reader twin)
 * flies the camera in and slides this glass panel into the free half of the
 * screen — the camera keeps the planet framed beside it (see the view-offset
 * framing in `scene/camera-rig.tsx`), so the detail experience never leaves
 * the universe. It replaces a traditional modal: non-blocking, dismissible
 * with Escape, and the world keeps orbiting (and stays clickable) behind it.
 *
 * Sections: overview + completion, AI summary, data statistics,
 * technologies, screenshot gallery (procedural art), architecture layers,
 * ship timeline, related worlds (fly there directly) and quick actions.
 * ────────────────────────────────────────────────────────────────────────── */

const BADGE_VARIANT: Record<ProjectStatus, "success" | "warning" | "default"> =
  {
    active: "success",
    building: "warning",
    idle: "default",
  };

const MILESTONE_META: Record<
  "done" | "active" | "planned",
  { label: string; dot: string; text: string }
> = {
  done: {
    label: "Shipped",
    dot: "border border-background bg-success",
    text: "text-success",
  },
  active: {
    label: "In progress",
    dot: "border border-background bg-aura-violet animate-pulse-glow",
    text: "text-aura-violet-soft",
  },
  planned: {
    label: "Planned",
    dot: "border-2 border-line-strong bg-transparent",
    text: "text-ink-ghost",
  },
};

/** Shared entrance easing — same family as the HUD's glass transitions. */
const EASE = [0.16, 1, 0.3, 1] as const;

/** Staggered reveal for the panel's sections. */
const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.12 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/* ── procedural screenshot art ──────────────────────────────────────────── *
 * The gallery captions are data (`shots`); the artwork is drawn here from
 * the planet's own palette so every world's screenshots feel like its own
 * product — no binary assets, no dead image URLs.
 * ------------------------------------------------------------------------ */
function ShotArt({ project, variant }: { project: Project; variant: number }) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const { deep, mid, accent, atmosphere } = project.planet;
  const kind = variant % 3;

  return (
    <svg
      viewBox="0 0 320 180"
      className="block aspect-video w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={deep} />
          <stop offset="100%" stopColor="#05030e" />
        </linearGradient>
        <linearGradient id={`bar-${uid}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={accent} stopOpacity="0.4" />
          <stop offset="100%" stopColor={atmosphere} stopOpacity="0.95" />
        </linearGradient>
      </defs>

      <rect width="320" height="180" fill={`url(#bg-${uid})`} />
      <ellipse cx="160" cy="110" rx="150" ry="80" fill={mid} opacity="0.18" />

      {/* window chrome */}
      <rect width="320" height="24" fill="rgba(255,255,255,0.06)" />
      <circle cx="13" cy="12" r="3" fill={atmosphere} opacity="0.9" />
      <circle cx="24" cy="12" r="3" fill="rgba(255,255,255,0.28)" />
      <circle cx="35" cy="12" r="3" fill="rgba(255,255,255,0.16)" />
      <rect
        x="50"
        y="7"
        width="120"
        height="10"
        rx="5"
        fill="rgba(255,255,255,0.08)"
      />

      {kind === 0 && (
        /* graph view — nodes + edges, hub highlighted */
        <g>
          <g stroke={atmosphere} strokeWidth="1" opacity="0.5" fill="none">
            <path d="M58 66 L132 96 M132 96 L214 60 M132 96 L198 134 M214 60 L272 92 M198 134 L272 92 M58 66 L88 136 M88 136 L198 134" />
          </g>
          <circle
            cx="132"
            cy="96"
            r="14"
            fill="none"
            stroke={atmosphere}
            opacity="0.4"
          />
          {[
            [58, 66],
            [132, 96],
            [214, 60],
            [198, 134],
            [272, 92],
            [88, 136],
          ].map(([x, y], i) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r={i === 1 ? 7 : 4.5}
              fill={i === 1 ? accent : mid}
              opacity={i === 1 ? 1 : 0.9}
            />
          ))}
        </g>
      )}

      {kind === 1 && (
        /* analytics view — gradient bars over a baseline */
        <g>
          {[30, 48, 38, 66, 52, 78, 42, 60, 70, 36, 50, 72].map((h, i) => (
            <rect
              key={i}
              x={16 + i * 25}
              y={154 - h}
              width="13"
              height={h}
              rx="3"
              fill={`url(#bar-${uid})`}
            />
          ))}
          <line
            x1="12"
            y1="156"
            x2="308"
            y2="156"
            stroke="rgba(255,255,255,0.14)"
          />
        </g>
      )}

      {kind === 2 && (
        /* code view — tokenised lines with a live cursor */
        <g>
          {[150, 236, 196, 262, 168, 220, 116].map((w, i) => (
            <rect
              key={i}
              x="18"
              y={42 + i * 17}
              width={w}
              height="7"
              rx="3.5"
              fill={i === 1 || i === 4 ? accent : "rgba(255,255,255,0.14)"}
              opacity={i === 1 || i === 4 ? 0.9 : 1}
            />
          ))}
          <rect x="18" y="161" width="9" height="11" fill={atmosphere} />
        </g>
      )}
    </svg>
  );
}

function Section({
  label,
  icon,
  children,
}: {
  label: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <motion.section variants={itemVariants}>
      <p
        className="eyebrow mb-2.5 flex items-center gap-1.5"
        /* Inline so it beats `.eyebrow`'s tertiary ink — section labels must
           stay readable over whatever passes behind the glass. */
        style={{ color: "var(--ink-secondary)" }}
      >
        <Icon name={icon} size="xs" />
        {label}
      </p>
      {children}
    </motion.section>
  );
}

/**
 * Completion as it stands at the *viewed* timeline date — parked in the
 * past, the row reports what had been achieved by then (and the bar eases
 * to that height). A leaf subscription on the timeline store, so opening
 * the dossier or scrubbing never re-renders the sections around it.
 */
function Completion({
  project,
  reduce,
}: {
  project: Project;
  reduce: boolean;
}) {
  const { date, now } = useTimeline();
  const past = date < now;
  const progress = Math.round(progressAt(date, project, now));

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between">
        <span className="text-ink-muted text-micro tracking-caps font-mono">
          Completion
        </span>
        <span className="text-ink text-micro font-mono tabular-nums">
          {progress}%{past ? ` · ${formatTimelineDate(date)}` : null}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="from-aura-violet to-aura-cyan h-full rounded-full bg-gradient-to-r"
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{
            duration: reduce ? 0 : 0.9,
            ease: EASE,
            delay: reduce ? 0 : 0.3,
          }}
        />
      </div>
    </div>
  );
}

export interface ProjectDetailPanelProps {
  /** Collapse every transition to instant (prefers-reduced-motion). */
  reduce?: boolean;
}

export function ProjectDetailPanel({
  reduce = false,
}: ProjectDetailPanelProps) {
  const { focusedId } = useUniverse();
  const project = PROJECTS.find((entry) => entry.id === focusedId);

  /* Keyed by world so switching planets replays the entrance — the camera
     glide and the panel slide read as one continuous move. */
  return (
    <AnimatePresence mode="wait">
      {project && (
        <Dossier key={project.id} project={project} reduce={reduce} />
      )}
    </AnimatePresence>
  );
}

function Dossier({ project, reduce }: { project: Project; reduce: boolean }) {
  const { focus, release } = useUniverse();
  const panelRef = React.useRef<HTMLElement>(null);
  const [copied, setCopied] = React.useState(false);
  const copyTimer = React.useRef<number | undefined>(undefined);

  const status = STATUS_META[project.status];
  const { atmosphere } = project.planet;
  const index = PROJECTS.findIndex((entry) => entry.id === project.id);
  const related = project.related
    .map((id) => PROJECTS.find((entry) => entry.id === id))
    .filter((entry): entry is Project => Boolean(entry));

  /* Take focus on open so screen readers announce the dossier, and give it
     back to nothing on close (the world was clicked, not a form field). */
  React.useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
    return () => window.clearTimeout(copyTimer.current);
  }, []);

  const step = React.useCallback(
    (delta: number) => {
      if (index < 0) return;
      const next = (index + delta + PROJECTS.length) % PROJECTS.length;
      const target = PROJECTS[next];
      if (target) focus(target.id);
    },
    [focus, index],
  );

  const copyBrief = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        `${project.name} — ${project.summary}`,
      );
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* Clipboard unavailable (permissions / insecure context) — no-op. */
    }
  }, [project.name, project.summary]);

  return (
    <motion.aside
      ref={panelRef}
      tabIndex={-1}
      role="region"
      aria-label={`${project.name} dossier`}
      initial={
        reduce ? { opacity: 1 } : { opacity: 0, x: 56, filter: "blur(10px)" }
      }
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      exit={
        reduce ? { opacity: 0 } : { opacity: 0, x: 36, filter: "blur(10px)" }
      }
      transition={{ duration: reduce ? 0 : 0.55, ease: EASE }}
      className={cn(
        "glass-strong border-line/70 text-ink z-modal pointer-events-auto fixed inset-x-0 bottom-0 flex max-h-[64svh] flex-col overflow-hidden rounded-t-3xl border-t outline-none",
        "lg:inset-x-auto lg:top-6 lg:right-6 lg:bottom-6 lg:max-h-none lg:w-[440px] lg:rounded-2xl lg:border",
      )}
      style={{
        boxShadow: "0 -30px 80px -40px rgb(0 0 0 / 0.95)",
        /* Smoked dark glass: the frosted backdrop stays (class), but the
           fill is darkened so micro-labels stay legible when a bright
           nebula drifts behind the panel. */
        background:
          "linear-gradient(160deg, rgb(10 9 22 / 0.72), rgb(6 5 15 / 0.86))",
      }}
    >
      {/* ── header ─────────────────────────────────────────────────────── */}
      <header className="border-line/70 shrink-0 border-b px-5 pt-4 pb-3.5">
        <div className="mb-3 flex justify-center lg:hidden" aria-hidden="true">
          <span className="bg-line-strong h-1 w-10 rounded-full" />
        </div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="mt-1 size-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor: atmosphere,
                boxShadow: `0 0 14px ${atmosphere}`,
              }}
            />
            <div className="min-w-0">
              <p className="text-ink-muted text-micro tracking-caps font-mono">
                Dossier · {index + 1} / {PROJECTS.length}
              </p>
              <h2 className="text-ink truncate text-lg font-semibold tracking-tight">
                {project.name}
              </h2>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous world"
              onClick={() => step(-1)}
              iconLeft={<Icon name="arrow-left" />}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next world"
              onClick={() => step(1)}
              iconLeft={<Icon name="arrow-right" />}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close dossier (Escape)"
              onClick={release}
              iconLeft={<Icon name="close" />}
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={BADGE_VARIANT[project.status]} dot>
            {status.label}
          </Badge>
          <span className="text-ink-muted text-micro font-mono">
            Born {formatDate(project.createdAt)} · Updated{" "}
            {formatDate(project.updatedAt)}
          </span>
        </div>
      </header>

      {/* ── body ───────────────────────────────────────────────────────── */}
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4"
        style={{ scrollbarWidth: "thin" }}
      >
        <motion.div
          variants={listVariants}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="space-y-6"
        >
          {/* Overview */}
          <Section label="Overview" icon="box">
            <p className="text-ink-muted text-sm leading-relaxed">
              {project.overview}
            </p>
            <Completion project={project} reduce={reduce} />
          </Section>

          {/* AI summary */}
          <Section label="AI summary" icon="sparkles">
            <div className="border-aura-violet/30 bg-aura-violet/10 rounded-xl border p-3.5">
              <p className="text-ink text-sm leading-relaxed">
                {project.summary}
              </p>
              <p className="text-ink-muted mt-2.5 font-mono text-[10px] tracking-wider uppercase">
                Astra synthesis · {formatDate(project.updatedAt)}
              </p>
            </div>
          </Section>

          {/* Data statistics */}
          <Section label="Data statistics" icon="activity">
            <dl className="grid grid-cols-2 gap-2.5">
              {project.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="border-line/70 rounded-xl border bg-white/[0.03] p-3"
                >
                  <dt className="text-ink-muted text-micro tracking-caps font-mono">
                    {stat.label}
                  </dt>
                  <dd className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-ink font-mono text-lg leading-none tabular-nums">
                      {stat.value}
                    </span>
                    {stat.delta && (
                      <span
                        className={cn(
                          "font-mono text-[10px]",
                          stat.delta.startsWith("+")
                            ? "text-success"
                            : "text-info",
                        )}
                      >
                        {stat.delta}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          {/* Technologies */}
          <Section label="Technologies" icon="boxes">
            <div className="flex flex-wrap gap-1.5">
              {project.stack.map((tech) => (
                <span
                  key={tech}
                  className="border-line/80 text-ink-muted rounded-full border bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] tracking-wide"
                >
                  {tech}
                </span>
              ))}
            </div>
          </Section>

          {/* Screenshots */}
          <Section label="Screenshots" icon="palette">
            <ul className="flex snap-x gap-3 overflow-x-auto pb-1">
              {project.shots.map((shot, shotIndex) => (
                <li key={shot.title} className="w-56 shrink-0 snap-start">
                  <figure className="border-line/70 overflow-hidden rounded-xl border bg-white/[0.02]">
                    <ShotArt project={project} variant={shotIndex} />
                    <figcaption className="border-line/60 border-t px-3 py-2">
                      <p className="text-ink text-xs font-medium">
                        {shot.title}
                      </p>
                      <p className="text-ink-muted mt-0.5 text-[10px] leading-snug">
                        {shot.caption}
                      </p>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </Section>

          {/* Architecture overview */}
          <Section label="Architecture" icon="layers">
            <ol className="relative space-y-3.5 pl-5">
              <span
                aria-hidden="true"
                className="bg-line-strong absolute top-1.5 bottom-1.5 left-[3px] w-px"
              />
              {project.architecture.map((layer) => (
                <li key={layer.name} className="relative">
                  <span
                    aria-hidden="true"
                    className="shadow-glow-dot-current text-aura-violet absolute top-1 -left-5 size-[7px] rounded-full bg-current"
                  />
                  <p className="text-aura-violet-soft text-micro tracking-caps font-mono">
                    {layer.name}
                  </p>
                  <p className="text-ink-muted mt-0.5 text-xs leading-snug">
                    {layer.detail}
                  </p>
                </li>
              ))}
            </ol>
          </Section>

          {/* Timeline */}
          <Section label="Timeline" icon="clock">
            <ol>
              {project.timeline.map((milestone, msIndex) => {
                const meta = MILESTONE_META[milestone.status];
                const last = msIndex === project.timeline.length - 1;
                return (
                  <li key={milestone.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          meta.dot,
                        )}
                      />
                      {!last && <span className="bg-line w-px flex-1" />}
                    </div>
                    <div className={cn("min-w-0 pb-4", last && "pb-0")}>
                      <p className="text-ink text-xs font-medium">
                        {milestone.label}
                      </p>
                      <p className="text-ink-muted mt-0.5 font-mono text-[10px]">
                        {formatDate(milestone.date)} ·{" "}
                        <span className={meta.text}>{meta.label}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Section>

          {/* Related projects — select one to fly straight there */}
          <Section label="Related worlds" icon="network">
            <ul className="grid gap-2">
              {related.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => focus(entry.id)}
                    className="border-line/70 hover:border-aura-violet/50 group flex w-full items-center gap-3 rounded-xl border bg-white/[0.03] p-3 text-left transition-colors hover:bg-white/[0.06]"
                  >
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: entry.planet.atmosphere,
                        boxShadow: `0 0 10px ${entry.planet.atmosphere}`,
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-ink block truncate text-sm font-medium">
                        {entry.name}
                      </span>
                      <span className="text-ink-muted block truncate font-mono text-[10px]">
                        {entry.stack.slice(0, 2).join(" · ")}
                      </span>
                    </span>
                    <Icon
                      name="arrow-right"
                      size="xs"
                      className="text-ink-ghost group-hover:text-aura-violet-soft transition-colors"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </Section>

          {/* Quick actions */}
          <Section label="Quick actions" icon="zap">
            <div className="grid grid-cols-2 gap-2.5">
              <Button asChild variant="glass" size="sm">
                <a
                  href={project.links.demo}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="external" size="xs" />
                  <span>Live demo</span>
                </a>
              </Button>
              <Button asChild variant="glass" size="sm">
                <a
                  href={project.links.repo}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="github" size="xs" />
                  <span>Repository</span>
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={copyBrief}
                iconLeft={<Icon name={copied ? "check" : "copy"} />}
              >
                {copied ? "Copied" : "Copy AI brief"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={release}
                iconLeft={<Icon name="orbit" />}
              >
                Back to orbit
              </Button>
            </div>
          </Section>
        </motion.div>
      </div>

      {/* ── footer ─────────────────────────────────────────────────────── */}
      <footer className="border-line/70 shrink-0 border-t px-5 py-3">
        <p className="text-ink-muted text-micro text-center font-mono">
          <span className="text-aura-violet-soft">Esc</span> · return to orbit
        </p>
      </footer>
    </motion.aside>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import { Badge, Button, GlassCard, Icon } from "@/components";
import { useSceneData, useSceneProjects } from "@/hooks/use-scene-data";
import { useRepoFeed } from "@/hooks/use-github";
import { useUniverse } from "@/hooks/use-universe";
import { openSettings } from "@/lib/settings-event";
import { aggregateRepoFeed } from "@/lib/universe-generator";
import { cn, relativeTime } from "@/lib/utils";

import { CreateUniverse, CreateUniverseButton } from "./create-universe";
import { InsightsDashboard } from "./insights-dashboard";
import { UniverseMinimap } from "./universe-minimap";

/* ────────────────────────────────────────────────────────────────────────── *
 * UniverseHud — the futuristic-OS overlay floating over the 3D scene.
 *
 * Four anchored zones (top bar, left telemetry, right logs, bottom dock)
 * around an open centre so the universe itself stays the hero. Everything is
 * glass over motion — panels drift in on mount, values tick live, and the
 * reticle breathes. Pointer-events pass through the empty frame; only the
 * interactive chips opt back in.
 * ────────────────────────────────────────────────────────────────────────── */

/** Telemetry rows for a scene — counts track the active graph + ambient. */
function telemetry(bodyCount: number, starCount: number) {
  return [
    {
      label: "Stars mapped",
      value: starCount,
      format: (n: number) => n.toLocaleString(),
    },
    { label: "Nebulae", value: 5, format: (n: number) => `0${n}` },
    {
      label: "Bodies in orbit",
      value: bodyCount,
      format: (n: number) => n.toString().padStart(2, "0"),
    },
    { label: "Drift", value: 0.42, format: (n: number) => `${n.toFixed(2)}°` },
  ] as const;
}

const LOG_LINES = [
  "kernel.sync() → graph aligned",
  "warp.field stable at 0.98c",
  "memory lattice: 14.2 TB warm",
  "orbit.telemetry stream nominal",
  "aria.listen() idle, awaiting input",
] as const;

/** Live clock — one state tick per second, nothing re-renders between. */
function useClock(reduced: boolean) {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [reduced]);

  return now;
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export interface UniverseHudProps {
  /** Returns to the landing page. */
  onExit: () => void;
  /** Renders the pre-boot loading state (values hidden until ready). */
  ready?: boolean;
  className?: string;
}

export function UniverseHud({
  onExit,
  ready = true,
  className,
}: UniverseHudProps) {
  const reduce = useReducedMotion();
  const clock = useClock(Boolean(reduce));
  const [logIndex, setLogIndex] = React.useState(0);
  const { focusedId, focus: focusOn, release } = useUniverse();
  const projects = useSceneProjects();
  const scene = useSceneData();
  const focusedProject = projects.find((project) => project.id === focusedId);
  /* One GitHub pulse across every world's repo — live REST data when a
     token is configured, the seeded simulation otherwise (memoised so the
     ticking clock and open states never re-run the simulations). */
  const {
    live,
    loading: repoLoading,
    refresh: refreshRepos,
  } = useRepoFeed(projects);
  const repoFeed = React.useMemo(
    () => aggregateRepoFeed(projects, live),
    [projects, live],
  );
  const [creating, setCreating] = React.useState(false);
  const [mapOpen, setMapOpen] = React.useState(false);
  const [insightsOpen, setInsightsOpen] = React.useState(false);
  const mapTriggerRef = React.useRef<HTMLButtonElement>(null);
  const insightsTriggerRef = React.useRef<HTMLButtonElement>(null);

  /* The two overlays are mutually exclusive — opening one closes the other —
     so their topmost-layer Escape interception never overlaps and only one
     can ever own the screen. */
  const toggleMap = React.useCallback(() => {
    setInsightsOpen(false);
    setMapOpen((current) => !current);
  }, []);
  const toggleInsights = React.useCallback(() => {
    setMapOpen(false);
    setInsightsOpen((current) => !current);
  }, []);

  /* The command palette (and anything else on the page) flips the galaxy
     map with one custom event — the HUD owns the open state so the trigger
     can report `aria-expanded`. */
  React.useEffect(() => {
    window.addEventListener("astra:map-toggle", toggleMap);
    return () => window.removeEventListener("astra:map-toggle", toggleMap);
  }, [toggleMap]);

  /* …and the insights dashboard the same way (`astra:insights-toggle`). */
  React.useEffect(() => {
    window.addEventListener("astra:insights-toggle", toggleInsights);
    return () =>
      window.removeEventListener("astra:insights-toggle", toggleInsights);
  }, [toggleInsights]);

  /* …and asks for the creation flow the same way (palette → "Create a new
     universe"). The manager listens for the identical event on its route. */
  React.useEffect(() => {
    const onCreate = () => setCreating(true);
    window.addEventListener("astra:new-universe", onCreate);
    return () => window.removeEventListener("astra:new-universe", onCreate);
  }, []);

  /* Rotate the signal log — one line swaps every 2.6s. */
  React.useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(
      () => setLogIndex((i) => (i + 1) % LOG_LINES.length),
      2600,
    );
    return () => window.clearInterval(id);
  }, [reduce]);

  const time = `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`;

  const rise = (delay: number) =>
    reduce
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: 0.7,
            delay,
            ease: [0.16, 1, 0.3, 1] as const,
          },
        };

  return (
    <div
      className={cn(
        "z-raised pointer-events-none absolute inset-0 select-none",
        "flex flex-col justify-between p-4 sm:p-6",
        className,
      )}
    >
      {/* ── top bar ──────────────────────────────────────────────────── */}
      <motion.header
        {...rise(0.1)}
        className="flex items-start justify-between gap-4"
      >
        <div className="glass-strong flex items-center gap-3 rounded-xl px-4 py-2.5">
          <span
            aria-hidden="true"
            className="from-aura-violet via-aura-indigo to-aura-cyan size-2 rounded-full bg-gradient-to-br shadow-[0_0_12px_var(--palette-violet)]"
          />
          <span className="text-ink text-micro tracking-caps font-mono">
            ASTRA&nbsp;OS
          </span>
          <span aria-hidden="true" className="bg-line-strong h-4 w-px" />
          <span className="text-ink-faint text-micro tracking-caps font-mono">
            {scene.universe ? scene.name.toUpperCase() : "UNIVERSE / LAYER 0"}
          </span>
        </div>

        <div data-tour="hud-actions" className="flex items-center gap-2">
          <Button
            ref={mapTriggerRef}
            variant="glass"
            size="sm"
            aria-label="Open galaxy map"
            aria-expanded={mapOpen}
            aria-haspopup="dialog"
            aria-keyshortcuts="M"
            className="pointer-events-auto"
            iconLeft={<Icon name="map" size="sm" label="" />}
            onClick={toggleMap}
          >
            <span className="hidden md:inline">Map</span>
          </Button>
          <Button
            ref={insightsTriggerRef}
            variant="glass"
            size="sm"
            aria-label="Open AI insights"
            aria-expanded={insightsOpen}
            aria-haspopup="dialog"
            className="pointer-events-auto"
            iconLeft={<Icon name="zap" size="sm" label="" />}
            onClick={toggleInsights}
          >
            <span className="hidden md:inline">Insights</span>
          </Button>
          <Button
            variant="glass"
            size="sm"
            aria-label="Open Universe Manager"
            className="pointer-events-auto"
            asChild
          >
            <Link href="/universes" className="inline-flex items-center gap-2">
              <Icon name="grid" size="sm" label="" />
              <span className="hidden md:inline">Manager</span>
            </Link>
          </Button>
          <CreateUniverseButton onClick={() => setCreating(true)} />
          <Badge
            variant={ready ? "success" : "warning"}
            dot
            pulse={!reduce}
            className="hidden sm:inline-flex"
          >
            {ready ? "Systems nominal" : "Synchronising"}
          </Badge>
          <div className="glass-strong pointer-events-auto rounded-xl px-3 py-2">
            <span className="text-ink text-micro tracking-caps font-mono tabular-nums">
              {time}
            </span>
          </div>
        </div>
      </motion.header>

      <CreateUniverse open={creating} onOpenChange={setCreating} />
      <UniverseMinimap
        open={mapOpen}
        onOpenChange={setMapOpen}
        returnFocusRef={mapTriggerRef}
      />
      <InsightsDashboard
        open={insightsOpen}
        onOpenChange={setInsightsOpen}
        returnFocusRef={insightsTriggerRef}
      />

      {/* ── side rails ───────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 items-center justify-between gap-4 py-4">
        {/* left: telemetry */}
        <motion.aside
          {...rise(0.25)}
          className="hidden w-56 shrink-0 md:block"
          aria-label="Scene telemetry"
        >
          <GlassCard tone="strong" padding="md" className="pointer-events-auto">
            <p className="eyebrow mb-4">Telemetry</p>
            <dl className="space-y-3">
              {telemetry(
                projects.length,
                scene.ambient?.starCount ?? 9_000,
              ).map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-3"
                >
                  <dt className="text-ink-muted text-xs">{row.label}</dt>
                  <dd className="text-ink font-mono text-xs tabular-nums">
                    {row.format(row.value)}
                  </dd>
                </div>
              ))}
            </dl>
            {/* signal meter */}
            <div
              aria-hidden="true"
              className="bg-line relative mt-4 h-1 overflow-hidden rounded-full"
            >
              <div className="from-aura-violet via-aura-indigo to-aura-cyan absolute inset-y-0 left-0 w-[68%] rounded-full bg-gradient-to-r" />
            </div>
          </GlassCard>
        </motion.aside>

        {/* centre: reticle */}
        <div
          data-tour="scene-center"
          className="flex flex-1 flex-col items-center justify-center gap-3"
        >
          <motion.div
            {...(reduce
              ? { initial: false as const }
              : {
                  initial: { opacity: 0, scale: 0.85 },
                  animate: { opacity: 1, scale: 1 },
                  transition: { duration: 0.9, delay: 0.4, ease: "easeOut" },
                })}
            aria-hidden="true"
            className="relative size-16 sm:size-20"
          >
            <span className="border-ink-faint/50 absolute inset-0 rounded-full border border-dashed" />
            <span className="from-aura-cyan to-aura-violet absolute inset-3 rounded-full bg-gradient-to-br opacity-25 blur-[2px]" />
            <span className="bg-aura-cyan absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_10px_var(--palette-cyan)]" />
            {!reduce && (
              <span className="animate-spin-slow border-t-aura-violet-soft/70 absolute inset-0 rounded-full border border-transparent" />
            )}
          </motion.div>
          <p className="text-ink-faint text-micro tracking-caps font-mono">
            {scene.ambient?.sectorLabel ?? "Sector 00 · Orion Rim"}
          </p>
        </div>

        {/* right: signal log + GitHub pulse */}
        <motion.aside
          {...rise(0.35)}
          className="hidden max-h-full min-h-0 w-60 shrink-0 flex-col gap-4 overflow-y-auto lg:flex"
          aria-label="System log"
        >
          <GlassCard
            tone="strong"
            padding="md"
            className="pointer-events-auto shrink-0"
          >
            <p className="eyebrow mb-4">Signal log</p>
            <ul className="text-micro space-y-2.5 font-mono">
              {LOG_LINES.map((line, index) => (
                <li
                  key={line}
                  className={cn(
                    "duration-base flex items-start gap-2 transition-opacity",
                    index === logIndex
                      ? "text-ink opacity-100"
                      : "text-ink-faint opacity-45",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1 size-1 shrink-0 rounded-full",
                      index === logIndex
                        ? "bg-aura-cyan shadow-[0_0_6px_var(--palette-cyan)]"
                        : "bg-line-strong",
                    )}
                  />
                  <span className="leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>
          </GlassCard>

          {/* GitHub pulse — commits / PRs / issues / CI across every repo */}
          <GlassCard
            tone="strong"
            padding="md"
            className="pointer-events-auto shrink-0"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="eyebrow mb-0 flex items-center gap-1.5">
                <Icon name="github" size="xs" />
                GitHub
              </p>
              <div className="flex items-center gap-1.5">
                {/* live ⇄ sim: refetch when connected, jump to Settings when not */}
                <button
                  type="button"
                  onClick={() =>
                    live ? refreshRepos() : openSettings("github")
                  }
                  title={
                    live
                      ? "Live GitHub data — click to refetch"
                      : "Simulated activity — click to connect GitHub"
                  }
                  className={cn(
                    "flex cursor-pointer items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase transition-colors outline-none",
                    "focus-visible:outline-aura-violet",
                    live
                      ? "border-aura-cyan/40 text-aura-cyan hover:bg-aura-cyan/10"
                      : "border-line-strong text-ink-faint hover:text-ink-muted",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-1 rounded-full",
                      live ? "bg-aura-cyan" : "bg-ink-faint",
                      repoLoading && "animate-pulse",
                    )}
                  />
                  {repoLoading ? "sync" : live ? "live" : "sim"}
                </button>
                <span className="text-ink-faint text-micro font-mono tabular-nums">
                  {repoFeed.repos} repos
                </span>
              </div>
            </div>
            <Badge
              variant={repoFeed.ci.passing ? "success" : "danger"}
              dot
              pulse={!reduce}
            >
              CI {repoFeed.ci.passRate}%
            </Badge>
            <dl className="text-micro mt-3 space-y-1.5 font-mono">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Pull requests</dt>
                <dd className="text-ink tabular-nums">
                  {repoFeed.prsOpen} open · {repoFeed.prsMerged} merged
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Issues</dt>
                <dd className="text-ink tabular-nums">
                  {repoFeed.issuesOpen} open
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Branches</dt>
                <dd className="text-ink tabular-nums">
                  {repoFeed.branches} tracked
                </dd>
              </div>
            </dl>
            <p className="text-ink-faint text-micro tracking-caps mt-4 mb-2 font-mono">
              Fresh commits
            </p>
            <ul className="space-y-2.5">
              {repoFeed.activity.map((item) => (
                <li
                  key={`${item.repo}-${item.sha}-${item.at}`}
                  title={`${item.repo} — ${item.author}: ${item.message}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-aura-violet-soft font-mono">
                      {item.sha}
                    </span>
                    <span className="text-ink-faint shrink-0 font-mono">
                      {relativeTime(item.at)}
                    </span>
                  </div>
                  <p className="text-ink-muted truncate text-xs leading-relaxed">
                    {item.message}
                  </p>
                </li>
              ))}
            </ul>
          </GlassCard>
        </motion.aside>
      </div>

      {/* ── bottom dock ──────────────────────────────────────────────── */}
      <motion.footer
        {...rise(0.5)}
        /* pr-20 reserves the lower-right corner for Astra's orb (the HUD
           and the orb live in the same padded corner — see
           sections/universe/universe-assistant.tsx). */
        className="flex items-end justify-between gap-4 pr-20"
      >
        <div className="glass-strong hidden rounded-xl px-4 py-2.5 sm:block">
          <p className="text-ink-faint text-micro font-mono">
            <span className="text-aura-violet-soft">ESC</span>{" "}
            {focusedProject ? "return to orbit" : "return to surface"}
          </p>
          <p className="text-ink-faint text-micro font-mono opacity-70">
            drag · scroll · click a world
          </p>
          <p className="text-ink-faint text-micro font-mono opacity-70">
            <span className="text-aura-violet-soft">✦</span> ask Astra — bottom
            right
          </p>
        </div>

        <Button
          variant="cosmic"
          size="sm"
          onClick={onExit}
          className="pointer-events-auto"
          iconLeft={<Icon name="home" />}
        >
          Return to surface
        </Button>
      </motion.footer>

      {/* ── accessible focus controls (the canvas is aria-hidden) ─────── */}
      {/* pointer-events-auto: coordinate-based assistive tech (switch control,
          eye gaze) hit-test this 1px target — it must not fall through. */}
      <nav aria-label="Fly to a world" className="pointer-events-auto sr-only">
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              <button type="button" onClick={() => focusOn(project.id)}>
                Fly to {project.name}
                {focusedId === project.id ? " (currently focused)" : ""}
              </button>
            </li>
          ))}
          {focusedProject && (
            <li>
              <button type="button" onClick={release}>
                Return to the orbit overview
              </button>
            </li>
          )}
        </ul>
      </nav>
      <p aria-live="polite" className="sr-only">
        {focusedProject
          ? `${focusedProject.name} is in focus. Press Escape to return to the orbit view.`
          : ""}
      </p>
    </div>
  );
}

"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Button, Icon } from "@/components";
import { useUniverseBriefing } from "@/hooks/use-insights";
import { useUniverse } from "@/hooks/use-universe";
import { cn } from "@/lib/utils";

import { EASE, itemVariants, listVariants, Section } from "./dossier-section";
import { formatTimelineDate } from "./timeline";

/* ────────────────────────────────────────────────────────────────────────── *
 * InsightsDashboard — the universe's forecast, on one glass screen.
 *
 * A modal rolled straight off `useUniverseBriefing()`: four headline stats
 * (health, risk, predicted completion, productivity), the bottleneck worth
 * clearing first, Astra's recommended actions, dated deadlines, and a card
 * per world that flies the camera there. Same shell contract as the galaxy
 * map — HUD owns `open`, the panel intercepts topmost-layer Escape, traps
 * Tab, and hands focus back to its trigger on close — so the two overlays
 * can never be on screen together (the HUD closes one when the other
 * opens), and Escape unwinds palette → dashboard → scene in that order.
 *
 * Everything is computed on-device from deterministic seeds; nothing here
 * talks to a network.
 * ────────────────────────────────────────────────────────────────────────── */

/* ── presentation pieces ─────────────────────────────────────────────────── */

/** Risk tone — danger ≥ 60, warning ≥ 35, success below (dossier parity). */
function riskToneClass(risk: number): string {
  return risk >= 60
    ? "text-danger"
    : risk >= 35
      ? "text-warning"
      : "text-success";
}

/** The same thresholds as a gradient for the gauge bars. */
function riskBarClass(risk: number): string {
  return risk >= 60
    ? "from-warning to-danger"
    : risk >= 35
      ? "from-warning/70 to-warning"
      : "from-success/70 to-success";
}

/** Label + value + gradient bar — the dossier's Gauge, restated here so the
 *  dashboard doesn't have to import the tab-bodies module for one widget. */
function Gauge({
  label,
  value,
  barClass,
}: {
  label: string;
  value: number;
  barClass: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-ink-muted text-micro tracking-caps truncate font-mono">
          {label}
        </span>
        <span className="text-ink text-micro font-mono tabular-nums">
          {value}%
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={cn("h-full rounded-full bg-gradient-to-r", barClass)}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{
            duration: reduce ? 0 : 0.8,
            ease: EASE,
            delay: reduce ? 0 : 0.2,
          }}
        />
      </div>
    </div>
  );
}

/** One headline stat — big tabular number over its own gauge. */
function StatCard({
  label,
  value,
  barClass,
  toneClass,
}: {
  label: string;
  value: number;
  barClass: string;
  toneClass?: string;
}) {
  return (
    <div className="border-line/70 rounded-xl border bg-white/[0.03] p-3.5">
      <p className="text-ink-muted text-micro tracking-caps font-mono">
        {label}
      </p>
      <p
        className={cn(
          "text-ink mt-1.5 font-mono text-2xl leading-none tabular-nums",
          toneClass,
        )}
      >
        {value}
        <span className="text-ink-faint ml-0.5 text-sm">%</span>
      </p>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/10">
        <GaugeBar value={value} barClass={barClass} />
      </div>
    </div>
  );
}

/** The bar half of `StatCard` (Gauge shows its own label row — this one
 *  doesn't, because StatCard already prints the number big). */
function GaugeBar({ value, barClass }: { value: number; barClass: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("h-full rounded-full bg-gradient-to-r", barClass)}
      initial={reduce ? false : { width: 0 }}
      animate={{ width: `${value}%` }}
      transition={{
        duration: reduce ? 0 : 0.8,
        ease: EASE,
        delay: reduce ? 0 : 0.2,
      }}
    />
  );
}

/* ── panel ───────────────────────────────────────────────────────────────── */

function InsightsPanel({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const reduce = useReducedMotion();
  const briefing = useUniverseBriefing();
  const { focus } = useUniverse();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const { insights, name, worldCount, openTasks, doneTasks } = briefing;
  const now = Date.now();

  /* Focus lands in the dialog the moment it exists — one frame out, so a
     command that opened us from the palette (whose own focus restore runs
     synchronously during the same commit) can't win the race back to the
     trigger and strand focus outside the modal. */
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  /** Wrap Tab inside the panel — first ↔ last, Shift+Tab included. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const nodes = Array.from(
      panel.querySelectorAll<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      ),
    ).filter((node) => !node.hasAttribute("disabled"));
    if (nodes.length === 0) {
      event.preventDefault();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    const inside = active instanceof Node && panel.contains(active);
    if (event.shiftKey) {
      if (!inside || active === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (!inside || active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const flyTo = (planetId: string) => {
    focus(planetId);
    onOpenChange(false);
  };

  return (
    <div className="z-toast fixed inset-0">
      {/* backdrop — click away to close */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduce ? 0.12 : 0.3, ease: "easeOut" }}
        onClick={() => onOpenChange(false)}
      />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3 sm:p-6">
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={`AI insights — ${name}`}
          data-insights=""
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className="glass-strong border-line/70 pointer-events-auto flex max-h-[min(86vh,760px)] w-[min(94vw,56rem)] flex-col overflow-hidden rounded-2xl border shadow-[0_30px_90px_-25px_rgb(0_0_0/0.9)] outline-none"
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={
            reduce
              ? { opacity: 0, transition: { duration: 0.14 } }
              : {
                  opacity: 0,
                  scale: 1.08,
                  transition: { duration: 0.3, ease: EASE },
                }
          }
          transition={{ duration: reduce ? 0.14 : 0.4, ease: EASE }}
        >
          {/* ── header ────────────────────────────────────────────────── */}
          <div className="border-line/60 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="border-aura-violet/40 text-aura-violet bg-aura-violet/10 flex size-8 shrink-0 items-center justify-center rounded-lg border"
              >
                <Icon name="zap" size="sm" />
              </span>
              <div className="min-w-0">
                <p className="eyebrow mb-0.5">AI insights</p>
                <p className="text-ink truncate text-sm font-medium">{name}</p>
              </div>
              <p className="text-ink-faint text-micro tracking-caps hidden font-mono tabular-nums sm:block">
                {worldCount} worlds · {openTasks} open · {doneTasks} done
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close AI insights"
              onClick={() => onOpenChange(false)}
            >
              <Icon name="close" />
            </Button>
          </div>

          {/* ── body ──────────────────────────────────────────────────── */}
          <motion.div
            variants={listVariants}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
            style={{ scrollbarWidth: "thin" }}
          >
            {/* headline stats */}
            <motion.div variants={itemVariants}>
              <Section label="Universe forecast" icon="activity">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard
                    label="Health"
                    value={insights.health}
                    barClass="from-aura-cyan to-aura-violet"
                  />
                  <StatCard
                    label="Risk"
                    value={insights.riskScore}
                    barClass={riskBarClass(insights.riskScore)}
                    toneClass={riskToneClass(insights.riskScore)}
                  />
                  <StatCard
                    label="Predicted completion"
                    value={insights.completionPrediction}
                    barClass="from-aura-violet to-aura-blue"
                  />
                  <StatCard
                    label="Productivity"
                    value={insights.productivity}
                    barClass="from-aura-indigo to-aura-cyan"
                  />
                </div>
              </Section>
            </motion.div>

            {/* bottleneck callout */}
            <motion.div
              variants={itemVariants}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3",
                insights.bottleneck
                  ? "border-warning/30 bg-warning/10"
                  : "border-success/30 bg-success/10",
              )}
            >
              <Icon
                name={insights.bottleneck ? "zap" : "check"}
                size="sm"
                className={cn(
                  "mt-0.5 shrink-0",
                  insights.bottleneck ? "text-warning" : "text-success",
                )}
              />
              <div className="min-w-0">
                <p className="text-ink text-sm">
                  {insights.bottleneck ?? "No bottleneck on the board."}
                </p>
                <p className="text-ink-muted mt-0.5 text-xs leading-relaxed">
                  {insights.bottleneck
                    ? "Top blocker on the riskiest world — worth clearing first."
                    : "Risk is spread evenly — nothing is jamming the works."}
                </p>
              </div>
            </motion.div>

            {/* actions + deadlines */}
            <div className="grid gap-5 lg:grid-cols-2">
              <Section label="Recommended actions" icon="target">
                <ul className="space-y-2">
                  {insights.actions.map((action) => (
                    <li
                      key={action}
                      className="text-ink-muted flex gap-2.5 text-sm leading-relaxed"
                    >
                      <span
                        aria-hidden="true"
                        className="bg-aura-violet/70 mt-1.5 size-1.5 shrink-0 rounded-full"
                      />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section label="Deadlines" icon="clock">
                {insights.deadlines.length === 0 ? (
                  <p className="text-ink-muted text-sm leading-relaxed">
                    No dated milestones on the board — everything&apos;s
                    open-ended.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {insights.deadlines.map((deadline) => {
                      const overdue = deadline.dueAt < now;
                      return (
                        <li
                          key={`${deadline.name}-${deadline.dueAt}`}
                          className="border-line/60 flex items-center justify-between gap-3 rounded-lg border bg-white/[0.03] px-3 py-2"
                        >
                          <span className="text-ink truncate text-sm">
                            {deadline.name}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 font-mono text-xs tabular-nums",
                              overdue ? "text-danger" : "text-ink-muted",
                            )}
                          >
                            {formatTimelineDate(deadline.dueAt)}
                            {overdue && (
                              <span className="text-ink-faint"> · overdue</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Section>
            </div>

            {/* per-world grid — a card flies the camera to that world */}
            {worldCount > 0 && (
              <Section label="Worlds" icon="orbit">
                <div className="grid gap-3 sm:grid-cols-2">
                  {insights.planets.map((world) => (
                    <button
                      key={world.planetId}
                      type="button"
                      onClick={() => flyTo(world.planetId)}
                      className={cn(
                        "group border-line/70 rounded-xl border bg-white/[0.03] p-3.5 text-left transition-colors outline-none",
                        "hover:border-aura-violet/60 hover:bg-white/[0.05]",
                        "focus-visible:border-aura-violet/60 focus-visible:ring-aura-violet/70 focus-visible:ring-2",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-ink truncate text-sm font-medium">
                          {world.name}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 font-mono text-xs tabular-nums",
                            riskToneClass(world.risk),
                          )}
                        >
                          risk {world.risk}
                        </span>
                      </div>
                      <div className="mt-2.5 space-y-2">
                        <Gauge
                          label="Health"
                          value={world.health}
                          barClass="from-aura-cyan to-aura-violet"
                        />
                        <Gauge
                          label="Forecast"
                          value={world.completionPrediction}
                          barClass="from-aura-violet to-aura-blue"
                        />
                      </div>
                      <div className="text-ink-faint mt-2.5 flex items-center justify-between gap-2 font-mono text-[10px] tracking-wider uppercase">
                        <span className="shrink-0">
                          {world.workload} task{world.workload === 1 ? "" : "s"}
                        </span>
                        <span className="truncate">
                          {world.bottlenecks[0] ?? "no blockers"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </Section>
            )}
          </motion.div>

          {/* ── footer ────────────────────────────────────────────────── */}
          <div className="border-line/60 flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 sm:px-5">
            <p className="text-ink-faint font-mono text-[10px] tracking-wider uppercase">
              Astra forecast · seeded locally · no network
            </p>
            <p className="text-ink-faint flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase">
              <kbd className="border-line/70 rounded border px-1.5 py-0.5">
                Esc
              </kbd>
              to close · click outside to dismiss
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* Shell ------------------------------------------------------------------- */

export interface InsightsDashboardProps {
  /** Whether the dashboard is on screen (owned by the HUD). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Focused when the dashboard closes — the trigger that opened it. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * InsightsDashboard — the overlay half of the AI insights screen. Stays
 * mounted (the portal is empty while closed so nothing paints and no probe
 * can see it), owns its own topmost-layer Escape interception (same
 * capture-phase contract as the galaxy map), and hands focus back to the
 * trigger on close — but never on first mount.
 *
 * @example
 * const [insightsOpen, setInsightsOpen] = React.useState(false);
 * <Button ref={triggerRef} aria-expanded={insightsOpen}>Insights</Button>
 * <InsightsDashboard open={insightsOpen} onOpenChange={setInsightsOpen} returnFocusRef={triggerRef} />
 */
export function InsightsDashboard({
  open,
  onOpenChange,
  returnFocusRef,
}: InsightsDashboardProps) {
  const [mounted, setMounted] = React.useState(false);
  const wasOpen = React.useRef(false);

  React.useEffect(() => setMounted(true), []);

  /* Topmost-layer Escape: capture on `window` (the earliest possible phase)
     and stopImmediatePropagation so neither the shell's window-bubble chain
     nor Radix's document-capture dismissables ever see the key. Runs only
     while open, so with the palette open its always-on listener (registered
     at load) unwinds first — palette → dashboard → scene. */
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onOpenChange(false);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, onOpenChange]);

  /* Focus returns to whatever opened the dashboard — only after a real
     open, so the first mount never steals focus from the scene. */
  React.useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    returnFocusRef?.current?.focus?.();
  }, [open, returnFocusRef]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && <InsightsPanel key="insights" onOpenChange={onOpenChange} />}
    </AnimatePresence>,
    document.body,
  );
}

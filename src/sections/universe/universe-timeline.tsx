"use client";

import * as React from "react";
import { invalidate } from "@react-three/fiber";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Button, Icon } from "@/components";
import { PROJECTS } from "@/data";
import { useAssistantOpen } from "@/hooks/use-assistant";
import { readTimelineDate, useTimeline } from "@/hooks/use-timeline";
import { useUniverse } from "@/hooks/use-universe";
import { cn } from "@/lib/utils";

import {
  MONTH_MS,
  YEAR_MS,
  clampDate,
  createdAt,
  formatTimelineDate,
  timelineFraction,
  timelineTicks,
} from "./timeline";

/* ────────────────────────────────────────────────────────────────────────── *
 * UniverseTimeline — the knowledge timeline control.
 *
 * A glass bar pinned bottom-centre (it yields to the dossier and Astra's
 * panel: whichever owns the right half of the screen hides it). Scrubbing
 * it time-travels the universe: worlds arrive, grow, tighten into their
 * orbits and the whole system slowly rotates — see `timeline.ts` for the
 * pure factors and `scene/planets.tsx` for how the scene consumes them.
 *
 * While the viewer is moving through time a warp veil (vignette + drifting
 * light streaks) washes over the scene. Every date write also calls
 * `invalidate()` so the scene answers immediately even under
 * `frameloop="demand"` (reduced motion). The control itself is the only
 * React surface that subscribes to the date — the 3D scene reads it per
 * frame instead, so a 60fps drag never re-renders the canvas tree.
 *
 * Escape unwinds *into* the present: with no other layer pending, a past
 * timeline returns to now before the shell exits (wired in
 * `universe-experience.tsx`).
 * ────────────────────────────────────────────────────────────────────────── */

/** Full-range auto-play duration — one calm sweep through the whole story. */
const PLAY_MS = 9_000;
/** Idle hold before the warp veil fades after a keyboard step. */
const PULSE_HOLD_MS = 750;
/** Grace before the veil fades after the pointer leaves the track. */
const RELEASE_HOLD_MS = 350;

const EASE = [0.16, 1, 0.3, 1] as const;

/** Traveling light-streak positions (top %) + their animation offsets. */
const WARP_STREAKS = [0, 0.38, 0.76, 1.14] as const;

/* ── Warp veil ──────────────────────────────────────────────────────────── */

function TimeWarp({ active, reduce }: { active: boolean; reduce: boolean }) {
  return (
    <motion.div
      aria-hidden="true"
      data-time-warp=""
      initial={false}
      animate={{ opacity: active ? 1 : 0 }}
      transition={{ duration: reduce ? 0 : 0.4, ease: "easeOut" }}
      className="z-popover pointer-events-none fixed inset-0"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_36%,rgb(7_5_18_/_0.62)_100%)]" />
      {!reduce && (
        <div className="absolute inset-0 overflow-hidden">
          {WARP_STREAKS.map((delay, index) => (
            <span
              key={delay}
              className="animate-time-drift via-aura-cyan/50 absolute inset-x-[-12%] h-px bg-gradient-to-r from-transparent to-transparent"
              style={{
                top: `${12 + index * 24}%`,
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ── Control ────────────────────────────────────────────────────────────── */

export function UniverseTimeline() {
  const reduce = Boolean(useReducedMotion());
  const { date, now, floor, setDate } = useTimeline();
  const { focusedId } = useUniverse();
  const { open: assistantOpen } = useAssistantOpen();

  /* The dossier (or Astra's panel) owns the stage — the control steps
     aside; closing it brings the bar back at the same date. */
  const hidden = focusedId !== null || assistantOpen;

  const [scrubbing, setScrubbing] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const active = scrubbing || playing;

  const past = date < now;
  const fraction = timelineFraction(date, floor, now);
  const ticks = React.useMemo(() => timelineTicks(floor, now), [floor, now]);
  const worlds = React.useMemo(
    () => PROJECTS.filter((project) => date > createdAt(project)).length,
    [date],
  );

  const trackRef = React.useRef<HTMLDivElement>(null);
  const idleTimer = React.useRef(0);
  const rafRef = React.useRef(0);

  /* ── helpers ────────────────────────────────────────────────────────── */

  const clearIdle = React.useCallback(() => {
    window.clearTimeout(idleTimer.current);
  }, []);

  /** Fade the warp veil after `holdMs` of quiet. */
  const settleScrub = React.useCallback(
    (holdMs: number) => {
      clearIdle();
      idleTimer.current = window.setTimeout(() => setScrubbing(false), holdMs);
    },
    [clearIdle],
  );

  /** The single write path: clamp into range, wake the scene, keep the veil. */
  const commit = React.useCallback(
    (next: number) => {
      clearIdle();
      setScrubbing(true);
      setDate(next);
      invalidate();
    },
    [clearIdle, setDate],
  );

  const dateAt = React.useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track) return date;
      const rect = track.getBoundingClientRect();
      const ratio = (clientX - rect.left) / Math.max(rect.width, 1);
      return clampDate(floor + ratio * (now - floor), floor, now);
    },
    [date, floor, now],
  );

  const stopPlay = React.useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setPlaying(false);
  }, []);

  /* ── pointer scrubbing ──────────────────────────────────────────────── */

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    stopPlay();
    commit(dateAt(event.clientX));
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    commit(dateAt(event.clientX));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    settleScrub(RELEASE_HOLD_MS);
  };

  /* ── keyboard scrubbing (the slider is a real ARIA slider) ──────────── */

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const stepSize = event.shiftKey ? YEAR_MS : MONTH_MS;
    let next: number;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowDown":
        next = date - stepSize;
        break;
      case "ArrowRight":
      case "ArrowUp":
        next = date + stepSize;
        break;
      case "PageDown":
        next = date - YEAR_MS;
        break;
      case "PageUp":
        next = date + YEAR_MS;
        break;
      case "Home":
        next = floor;
        break;
      case "End":
        next = now;
        break;
      default:
        return;
    }
    event.preventDefault();
    stopPlay();
    commit(next);
    settleScrub(PULSE_HOLD_MS);
  };

  /* ── auto-play: one cinematic sweep from the beginning to the present ── */

  const togglePlay = () => {
    if (reduce) return;
    if (playing) {
      stopPlay();
      settleScrub(RELEASE_HOLD_MS);
      return;
    }
    // Already at the present? Restart the journey from the first world.
    if (date >= now - 1) setDate(floor);
    setPlaying(true);
    /* Constant full-range speed — the whole story in one calm sweep; the
       scene's damped date gives it a cinematic ease-in/ease-out tail. */
    const perMs = (now - floor) / PLAY_MS;
    let last = performance.now();
    const tick = (time: number) => {
      const delta = time - last;
      last = time;
      const next = Math.min(now, readTimelineDate() + perMs * delta);
      setDate(next);
      invalidate();
      if (next >= now) {
        setPlaying(false);
        setScrubbing(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const jumpToNow = () => {
    stopPlay();
    commit(now);
    settleScrub(PULSE_HOLD_MS);
  };

  /* ── lifecycle ──────────────────────────────────────────────────────── */

  React.useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(idleTimer.current);
    },
    [],
  );

  /* A hidden control can't keep travelling — closing into a dossier or
     Astra's panel pauses auto-play and drops the veil. */
  React.useEffect(() => {
    if (!hidden) return;
    cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    setScrubbing(false);
  }, [hidden]);

  return (
    <>
      <TimeWarp active={active} reduce={reduce} />

      <div
        data-timeline-anchor=""
        className="z-popover pointer-events-none fixed inset-x-0 bottom-28 flex justify-center px-4 lg:bottom-6 lg:px-0"
      >
        <AnimatePresence>
          {!hidden && (
            <motion.div
              key="bar"
              data-timeline-bar=""
              initial={reduce ? false : { opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={
                reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.97 }
              }
              transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}
              className="glass-strong shadow-glass pointer-events-auto flex w-full max-w-[min(34rem,calc(100vw_-_2rem))] items-center gap-2.5 rounded-2xl px-3 py-2.5 sm:gap-3 lg:max-w-[min(34rem,calc(100vw_-_35rem))]"
            >
              {/* ── auto-play ───────────────────────────────────────────── */}
              <Button
                variant="ghost"
                size="icon-sm"
                data-timeline-play=""
                className="shrink-0"
                disabled={reduce}
                aria-label={playing ? "Pause time travel" : "Play time travel"}
                title={
                  reduce
                    ? "Auto-play is unavailable under reduced motion"
                    : playing
                      ? "Pause"
                      : "Play from the beginning"
                }
                onClick={togglePlay}
                iconLeft={<Icon name={playing ? "pause" : "play"} />}
              />

              {/* ── viewed date ────────────────────────────────────────── */}
              <div className="w-[6.5rem] shrink-0">
                <p
                  data-timeline-date=""
                  className={cn(
                    "truncate font-mono text-sm leading-none font-semibold tabular-nums",
                    past ? "text-aura-violet-soft" : "text-ink",
                  )}
                >
                  {formatTimelineDate(date)}
                </p>
                <p className="text-ink-faint tracking-caps mt-1.5 font-mono text-[9px] leading-none">
                  {worlds} / {PROJECTS.length} WORLDS
                </p>
              </div>

              {/* ── track ──────────────────────────────────────────────── */}
              <div className="relative h-7 min-w-0 flex-1">
                <div
                  ref={trackRef}
                  role="slider"
                  tabIndex={0}
                  aria-label="Knowledge timeline"
                  aria-orientation="horizontal"
                  aria-valuemin={floor}
                  aria-valuemax={now}
                  aria-valuenow={date}
                  aria-valuetext={formatTimelineDate(date)}
                  data-timeline-track=""
                  className="focus-visible:outline-aura-violet absolute inset-0 cursor-ew-resize touch-none rounded-md outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onKeyDown={onKeyDown}
                >
                  {/* rail + travelled fill */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10"
                  />
                  <span
                    aria-hidden="true"
                    className="from-aura-violet to-aura-cyan absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r"
                    style={{ width: `${fraction * 100}%` }}
                  />

                  {/* quarter ticks, years labelled */}
                  {ticks.map((tick) => (
                    <React.Fragment key={tick.at}>
                      <span
                        aria-hidden="true"
                        className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-white/40"
                        style={{ left: `${tick.fraction * 100}%` }}
                      />
                      {tick.label !== null && (
                        <span
                          aria-hidden="true"
                          className="text-ink-faint absolute top-[17px] -translate-x-1/2 font-mono text-[9px] leading-none tabular-nums"
                          style={{ left: `${tick.fraction * 100}%` }}
                        >
                          {tick.label}
                        </span>
                      )}
                    </React.Fragment>
                  ))}

                  {/* scrub handle */}
                  <span
                    aria-hidden="true"
                    className="bg-void shadow-glow-violet pointer-events-none absolute top-1/2 size-4 rounded-full border border-white/40"
                    style={{
                      left: `${fraction * 100}%`,
                      transform: `translate(-50%, -50%) scale(${active ? 1.15 : 1})`,
                      transition: reduce
                        ? "none"
                        : "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  >
                    <span className="from-aura-violet to-aura-cyan absolute inset-[3px] rounded-full bg-gradient-to-br" />
                  </span>
                </div>

                {/* creation markers — decorative calendar marks showing each
                    world's birth position. Deliberately NOT interactive: at
                    any real track width the two closest births sit ~19px
                    apart, so 24px WCAG targets would overlap — the slider
                    itself owns navigation for pointer and keyboard alike. */}
                {PROJECTS.map((project) => {
                  const born = createdAt(project);
                  return (
                    <span
                      key={project.id}
                      data-timeline-marker=""
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        left: `${timelineFraction(born, floor, now) * 100}%`,
                        backgroundColor: project.planet.atmosphere,
                        boxShadow: `0 0 6px ${project.planet.atmosphere}`,
                      }}
                    />
                  );
                })}
              </div>

              {/* ── return to the present ──────────────────────────────── */}
              <Button
                variant="ghost"
                size="xs"
                data-timeline-now=""
                className={cn(
                  "tracking-caps shrink-0 font-mono",
                  past && "text-aura-cyan",
                )}
                disabled={!past}
                onClick={jumpToNow}
              >
                NOW
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

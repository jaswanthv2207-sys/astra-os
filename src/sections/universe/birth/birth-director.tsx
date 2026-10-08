"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Button, Icon } from "@/components";
import { cn } from "@/lib/utils";

import {
  advanceBirth,
  birthState,
  finishBirth,
  skipBirth,
  useBirth,
} from "./birth-state";
import { BEAT, INIT_STEPS, SCAN_ROWS, stepsDoneAt } from "./birth-timeline";

/* ────────────────────────────────────────────────────────────────────────── *
 * BirthDirector — the DOM half of the Planet Birth Experience.
 *
 * Mounted by the /universe shell (after every scene-scoped panel, so it
 * paints above the HUD and timeline but below the palette and dialogs, which
 * live at z-toast). While the sequence is active it:
 *
 *   • owns the clock — one rAF loop advances `birthState.t`, precomputes the
 *     runtime easing for the WebGL layer, and flips phases (React re-renders
 *     only on the eight phase boundaries),
 *   • renders Phase 1's holographic step panel, Phase 5's scan sweep +
 *     metadata cards + closing message, Phase 6's connection chips, and the
 *     always-visible Skip action,
 *   • holds a full-screen catcher so no click reaches the scene mid-flight,
 *   • finishes the sequence if the route unmounts under it.
 *
 * Everything is gated on `useBirth()` — inactive, this renders nothing at
 * all, and under reduced motion `startBirth` never activates it in the first
 * place.
 * ────────────────────────────────────────────────────────────────────────── */

/** Matches the glass easing family used across the product (framer takes
 *  the cubic-bezier control points as a tuple). */
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Live director mounts — lets unmount defer through StrictMode re-mounts. */
let liveDirectors = 0;

export interface BirthDirectorProps {
  /** Mirrors the shell's reduced-motion flag (belt to `startBirth`'s gate). */
  reduce: boolean;
}

export function BirthDirector({ reduce }: BirthDirectorProps) {
  const phase = useBirth();
  const active = phase !== "off";
  const shellReduce = useReducedMotion();
  const reduced = reduce || Boolean(shellReduce);

  const [steps, setSteps] = React.useState(0);
  const [showMessage, setShowMessage] = React.useState(false);
  const dimRef = React.useRef<HTMLDivElement>(null);
  /* Ref mirrors avoid sixty setState bail-outs per second — the rAF writes
     only when a value actually crosses a threshold. */
  const stepsRef = React.useRef(0);
  const messageRef = React.useRef(false);

  /* ── the clock ───────────────────────────────────────────────────────── */
  React.useEffect(() => {
    if (!active) return;
    if (reduced) {
      /* Belt: reduced motion requested after activation lands instantly —
         the world exists, no animation plays (matches `startBirth`). */
      finishBirth();
      return;
    }
    /* A fresh sequence always starts its overlay at step zero. */
    stepsRef.current = 0;
    messageRef.current = false;
    setSteps(0);
    setShowMessage(false);

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      advanceBirth(dt);

      const t = birthState.t;
      if (dimRef.current) {
        const value = birthState.v.dim;
        dimRef.current.style.opacity = value.toFixed(3);
      }
      const done = stepsDoneAt(t);
      if (done !== stepsRef.current) {
        stepsRef.current = done;
        setSteps(done);
      }
      const message = t >= BEAT.message;
      if (message !== messageRef.current) {
        messageRef.current = message;
        setShowMessage(message);
      }

      /* A skip before the camera was taken needs no return flight. */
      if (birthState.skipping && !birthState.camera.hijacked) {
        finishBirth();
      }
      if (birthState.active) raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active, reduced]);

  /* Safety: leaving /universe mid-sequence must not strand the singleton
     active. Counted live mounts so a StrictMode re-mount (dev) cancels the
     deferred finish. */
  React.useEffect(() => {
    liveDirectors += 1;
    return () => {
      liveDirectors -= 1;
      window.setTimeout(() => {
        if (liveDirectors === 0 && birthState.active) finishBirth();
      }, 0);
    };
  }, []);

  const hero = birthState.hero;
  const links = birthState.links;

  return (
    <AnimatePresence>
      {active && hero && (
        <motion.div
          key="birth"
          data-birth-root=""
          data-birth-phase={phase}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.35, ease: "easeInOut" }}
          className="z-popover pointer-events-auto fixed inset-0 select-none"
        >
          {/* Phase 2 dim — written per frame, never through React. */}
          <div
            ref={dimRef}
            aria-hidden="true"
            className="bg-void absolute inset-0"
            style={{ opacity: 0 }}
          />

          {/* ── Phase 1 — holographic initialization ───────────────────── */}
          <AnimatePresence>
            {phase === "init" && (
              <motion.div
                key="holo"
                initial={reduced ? false : { opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.45, ease: EASE }}
                className="absolute inset-0 grid place-items-center px-6"
              >
                <div className="border-line glass-strong shadow-glow-aura relative w-full max-w-[430px] overflow-hidden rounded-2xl border p-6">
                  <div
                    aria-hidden="true"
                    className="from-aura-violet via-aura-indigo to-aura-cyan absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-80"
                  />
                  <p className="text-aura-violet-soft text-micro tracking-caps font-mono">
                    ASTRA OS · KNOWLEDGE ENGINE
                  </p>
                  <h2 className="text-ink mt-1.5 text-base font-semibold">
                    {hero.name}
                  </h2>
                  <ul className="mt-5 space-y-2.5" data-birth-steps={steps}>
                    {INIT_STEPS.map((step, index) => {
                      const done = index < steps;
                      const current = index === steps;
                      return (
                        <li key={step} className="flex items-center gap-3">
                          <span className="grid size-4 shrink-0 place-items-center">
                            {done ? (
                              <motion.span
                                initial={
                                  reduced ? false : { scale: 0, opacity: 0 }
                                }
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.3, ease: EASE }}
                              >
                                <Icon
                                  name="check"
                                  size="sm"
                                  label=""
                                  className="text-aura-cyan"
                                />
                              </motion.span>
                            ) : current ? (
                              <span className="relative flex size-2.5">
                                <span className="bg-aura-violet absolute inline-flex size-full animate-ping rounded-full opacity-70" />
                                <span className="bg-aura-violet relative inline-flex size-2.5 rounded-full" />
                              </span>
                            ) : (
                              <span className="border-line size-1.5 rounded-full border" />
                            )}
                          </span>
                          <span
                            className={cn(
                              "font-mono text-[13px] transition-colors duration-300",
                              done
                                ? "text-ink"
                                : current
                                  ? "text-aura-violet-soft"
                                  : "text-ink-faint",
                            )}
                          >
                            {step}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="bg-line relative mt-5 h-px overflow-hidden rounded-full">
                    <motion.div
                      className="from-aura-violet via-aura-indigo to-aura-cyan absolute inset-y-0 left-0 bg-gradient-to-r"
                      animate={{
                        width: `${(steps / INIT_STEPS.length) * 100}%`,
                      }}
                      transition={{ duration: 0.28, ease: EASE }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Phase 5 — holographic scan + metadata cards ────────────── */}
          <AnimatePresence>
            {phase === "scan" && (
              <motion.div
                key="scan"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                {/* Sweep region — the camera holds the new world centred. */}
                <div className="absolute inset-0 grid place-items-center px-6">
                  <div className="relative aspect-square w-[min(64vmin,460px)]">
                    {[
                      "top-0 left-0 border-t border-l",
                      "top-0 right-0 border-t border-r",
                      "bottom-0 left-0 border-b border-l",
                      "bottom-0 right-0 border-b border-r",
                    ].map((corner) => (
                      <span
                        key={corner}
                        aria-hidden="true"
                        className={cn(
                          "border-aura-cyan/60 absolute size-7 rounded-[3px] border",
                          corner,
                        )}
                      />
                    ))}
                    <motion.div
                      aria-hidden="true"
                      className="absolute inset-x-[-6%]"
                      initial={{ top: "-4%" }}
                      animate={{ top: "104%" }}
                      transition={{ duration: 0.78, ease: "easeInOut" }}
                    >
                      <div className="from-aura-cyan/0 via-aura-cyan/12 to-aura-cyan/30 h-20 bg-gradient-to-b" />
                      <div className="from-aura-cyan/0 via-aura-cyan to-aura-cyan/0 shadow-glow-cyan h-[2px] bg-gradient-to-r" />
                    </motion.div>
                  </div>
                </div>

                {/* Floating glass cards — staggered, right column on desktop,
                    a compact stack above the timeline on phones. */}
                <ul className="absolute top-1/2 right-5 hidden w-[300px] -translate-y-1/2 flex-col gap-2 sm:flex">
                  {SCAN_ROWS.map((row, index) => (
                    <motion.li
                      key={row}
                      data-birth-card={row}
                      initial={reduced ? false : { opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.42,
                        delay: 0.1 + index * 0.07,
                        ease: EASE,
                      }}
                      className="border-line glass rounded-xl border px-3.5 py-2.5"
                    >
                      <p className="text-ink-tertiary text-micro tracking-caps font-mono">
                        {row}
                      </p>
                      <CardValue index={index} hero={hero} />
                    </motion.li>
                  ))}
                </ul>
                <ul className="absolute inset-x-4 bottom-24 flex flex-col gap-1.5 sm:hidden">
                  {SCAN_ROWS.map((row, index) =>
                    index === 3 ? null : (
                      <motion.li
                        key={row}
                        data-birth-card={row}
                        initial={reduced ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.4,
                          delay: 0.08 + index * 0.06,
                          ease: EASE,
                        }}
                        className="border-line glass rounded-lg border px-3 py-1.5"
                      >
                        <p className="text-ink-tertiary text-micro tracking-caps font-mono">
                          {row}
                        </p>
                        <CardValue index={index} hero={hero} />
                      </motion.li>
                    ),
                  )}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── The closing message — lives through the connection phase ─ */}
          <AnimatePresence>
            {showMessage && (phase === "scan" || phase === "connections") && (
              <motion.div
                key="message"
                data-birth-message=""
                initial={reduced ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="absolute bottom-[15%] left-1/2 -translate-x-1/2"
              >
                <div className="border-aura-cyan/40 shadow-glow-cyan glass-strong flex items-center gap-2 rounded-full border px-4 py-2">
                  <Icon
                    name="check"
                    size="sm"
                    label=""
                    className="text-aura-cyan"
                  />
                  <span className="text-ink text-sm whitespace-nowrap">
                    Knowledge Node Successfully Created.
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Phase 6 — contextual connection chips ──────────────────── */}
          <AnimatePresence>
            {phase === "connections" && (
              <motion.div
                key="chips"
                data-birth-chips=""
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="absolute bottom-24 left-4 flex flex-col items-start gap-2 sm:bottom-28 sm:left-6"
              >
                {links.map((link, index) => (
                  <motion.div
                    key={link.id}
                    initial={reduced ? false : { opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.45,
                      delay: index * 0.12,
                      ease: EASE,
                    }}
                    className="border-line shadow-glow-aura glass flex items-center gap-2 rounded-full border py-1.5 pr-3.5 pl-2.5"
                  >
                    <span
                      aria-hidden="true"
                      className="bg-aura-violet shadow-glow-dot size-1.5 rounded-full"
                    />
                    <span className="text-ink-muted font-mono text-xs">
                      {link.reason}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Skip — visible for the entire sequence ─────────────────── */}
          <motion.div
            data-birth-skip=""
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="absolute right-5 bottom-5 sm:right-8 sm:bottom-7"
          >
            <Button
              variant="glass"
              size="sm"
              aria-label="Skip animation"
              onClick={() => skipBirth()}
              className="shadow-glow-aura"
            >
              Skip Animation
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** One scan-card value — chips for the stack, clamped prose for the summary. */
function CardValue({
  index,
  hero,
}: {
  index: number;
  hero: NonNullable<(typeof birthState)["hero"]>;
}) {
  if (index === 2) {
    return (
      <div className="mt-1 flex flex-wrap gap-1.5">
        {hero.stack.slice(0, 4).map((tech) => (
          <span
            key={tech}
            className="border-line text-ink-muted rounded-full border px-2 py-0.5 font-mono text-[11px]"
          >
            {tech}
          </span>
        ))}
      </div>
    );
  }
  const value =
    index === 0
      ? hero.name
      : index === 1
        ? hero.categoryLabel
        : index === 3
          ? hero.summary
          : index === 4
            ? hero.planetType
            : index === 5
              ? hero.createdAtLabel
              : hero.status;
  return (
    <p
      className={cn(
        "text-ink mt-0.5 text-sm",
        index === 3 && "text-ink-muted line-clamp-2",
      )}
    >
      {value}
    </p>
  );
}

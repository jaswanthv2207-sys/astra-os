"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Button, Icon } from "@/components";
import {
  useTourSeen,
  useWorkspaceHydrated,
  workspaceActions,
} from "@/hooks/use-workspace";
import type { IconName } from "@/lib/icons";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ────────────────────────────────────────────────────────────────────────── *
 * OnboardingTour — the guided walk-through, mounted once in the root
 * layout beside the command palette.
 *
 * • AUTO: starts on the *first* visit to the Universe Manager (the
 *   workspace's natural entry point) and never on a direct /universe
 *   visit — the scene should greet, not ambush.
 * • MANUAL: `window.dispatchEvent(new Event("astra:tour-start"))` from the
 *   palette or the /shortcuts CTA. On a page without tour targets the
 *   request is held until navigation lands on one.
 * • On finish/skip/Escape the store's `tourSeen` is set — auto never
 *   fires again; the palette command stays available.
 *
 * Layer contract: the panel is `role="dialog" aria-modal="true"`, which
 * makes the palette's ⌘K guard and the map's `M` guard yield while the
 * tour is up (no extra wiring — both already defer to dialogs). Escape is
 * captured at the window level with `stopImmediatePropagation`, so the
 * tour unwinds first (the palette's load-time capture still runs ahead of
 * it when both are open).
 *
 * The spotlight is the classic box-shadow hole: one absolutely-positioned
 * div paints a 9999px shadow around the target, a transparent catcher
 * beneath it absorbs outside clicks (dismiss = seen), and the card sits
 * on top. Target rects are polled each frame (rAF) so floaty targets —
 * the bobbing Astra orb — stay lit.
 * ────────────────────────────────────────────────────────────────────────── */

interface TourStep {
  /** Element selector spotlighted for this step (card centres if absent). */
  selector: string;
  icon: IconName;
  title: string;
  body: string;
}

const MANAGER_STEPS: TourStep[] = [
  {
    selector: '[data-tour="manager-sidebar"]',
    icon: "layers",
    title: "Views & folders",
    body: "Favorites, recents and every folder live here — group universes your way without ever crowding the cards.",
  },
  {
    selector: '[data-tour="manager-grid"]',
    icon: "orbit",
    title: "Your universes",
    body: "Each card is a whole solar system. Open it, rename, duplicate or export from its action row, and drag tiles to reorder — the order persists.",
  },
  {
    selector: '[data-tour="manager-toolbar"]',
    icon: "target",
    title: "Search, notify, create",
    body: "Find anything instantly, watch notifications, and start a new universe. Export, local backups and workspace stats live just below.",
  },
];

/* Below `lg` the sidebar is `display: none` — spotlighting it would light
   nothing, so the compact tour leads with the grid and the toolbar. */
const MANAGER_STEPS_COMPACT: TourStep[] = [MANAGER_STEPS[1], MANAGER_STEPS[2]];

const UNIVERSE_STEPS: TourStep[] = [
  {
    selector: '[data-tour="hud-actions"]',
    icon: "zap",
    title: "Mission controls",
    body: "Galaxy map, AI insights and the Manager — the whole workspace from one bar. Press M for the map.",
  },
  {
    selector: '[data-tour="scene-center"]',
    icon: "rocket",
    title: "A living solar system",
    body: "Every planet is a project. Click one — or its label — to open the dossier: tasks, notes, progress, ten tabs deep.",
  },
  {
    selector: "[data-timeline-bar]",
    icon: "clock",
    title: "Scrub through time",
    body: "Drag the timeline or step it with the arrow keys; milestone rings on the orbits flag what's coming next.",
  },
  {
    selector: '[data-tour="orb"]',
    icon: "sparkles",
    title: "Ask Astra",
    body: "Your copilot knows every world — status, deadlines, insight. Press ⌘K anywhere for the command palette.",
  },
];

/** Gap between the target's edge and the spotlight (and card) offsets. */
const SPOT = 6;
const CARD_BASE_W = 336;
const EDGE = 16;

function isTourPage(pathname: string): boolean {
  return pathname === "/universe" || pathname === "/universes";
}

/**
 * OnboardingTour — spotlight + card, auto on first manager visit,
 * manual via `astra:tour-start` anywhere.
 *
 * @example
 * // in the root layout, beside <CommandPalette />
 * <OnboardingTour />
 */
export function OnboardingTour() {
  const pathname = usePathname();
  const hydrated = useWorkspaceHydrated();
  const tourSeen = useTourSeen();
  const reduce = Boolean(useReducedMotion());

  const [mounted, setMounted] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const [page, setPage] = React.useState<"manager" | "universe">("manager");
  const [compact, setCompact] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [cardH, setCardH] = React.useState(220);
  const [vp, setVp] = React.useState({ w: 0, h: 0 });

  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const openerRef = React.useRef<HTMLElement | null>(null);
  const activeRef = React.useRef(false);
  const pendingRef = React.useRef(false);
  const rectRef = React.useRef<DOMRect | null>(null);

  const steps =
    page === "manager"
      ? compact
        ? MANAGER_STEPS_COMPACT
        : MANAGER_STEPS
      : UNIVERSE_STEPS;
  const current = steps[step];
  const last = step === steps.length - 1;

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const start = React.useCallback((target: "manager" | "universe") => {
    openerRef.current = document.activeElement as HTMLElement | null;
    setPage(target);
    /* The sidebar only exists at ≥1024px (`hidden lg:flex`). */
    setCompact(target === "manager" && window.innerWidth < 1024);
    setStep(0);
    setActive(true);
  }, []);

  const finish = React.useCallback(() => {
    setActive(false);
    workspaceActions().setTourSeen(true);
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener && document.contains(opener)) {
      opener.focus({ preventScroll: true });
    }
  }, []);

  /* ── auto: first manager visit, never while a modal owns the screen ── */
  React.useEffect(() => {
    if (!mounted || !hydrated || tourSeen || pathname !== "/universes") return;
    const timer = window.setTimeout(() => {
      if (activeRef.current) return; /* manual start already ran */
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      start("manager");
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [mounted, hydrated, tourSeen, pathname, start]);

  /* ── manual: event now, or held until navigation reaches a tour page ── */
  React.useEffect(() => {
    const onTourStart = () => {
      if (activeRef.current) return;
      if (isTourPage(pathname)) {
        start(pathname === "/universe" ? "universe" : "manager");
      } else {
        pendingRef.current = true;
      }
    };
    window.addEventListener("astra:tour-start", onTourStart);
    return () => window.removeEventListener("astra:tour-start", onTourStart);
  }, [pathname, start]);

  React.useEffect(() => {
    if (!pendingRef.current || activeRef.current || !isTourPage(pathname))
      return;
    pendingRef.current = false;
    start(pathname === "/universe" ? "universe" : "manager");
  }, [pathname, start]);

  /* ── spotlight rect: one gBCR per frame while active (orb floats).
     Never pre-clear on step change: the old rect holds until the next
     sample lands, so the spotlight glides across instead of flashing the
     fallback dim for a frame. ─────────────────────────────────────────── */
  React.useLayoutEffect(() => {
    if (!active || !current) return;
    let raf = 0;
    const sample = () => {
      const el = document.querySelector(current.selector);
      const raw = el ? el.getBoundingClientRect() : null;
      /* A `display: none` target measures 0×0 — treat it as absent so the
         card centres on the flat-dim fallback instead of pinning to 0,0. */
      const next = raw && (raw.width > 0 || raw.height > 0) ? raw : null;
      const prev = rectRef.current;
      const moved =
        !prev || !next
          ? prev !== next
          : Math.abs(prev.left - next.left) > 0.5 ||
            Math.abs(prev.top - next.top) > 0.5 ||
            Math.abs(prev.width - next.width) > 0.5 ||
            Math.abs(prev.height - next.height) > 0.5;
      if (moved) {
        rectRef.current = next;
        setRect(next);
      }
      setVp((old) =>
        old.w === window.innerWidth && old.h === window.innerHeight
          ? old
          : { w: window.innerWidth, h: window.innerHeight },
      );
      raf = window.requestAnimationFrame(sample);
    };
    /* Sample synchronously first: the spotlight is placed before the first
       painted frame (no fallback-dim flash on activation). */
    sample();
    return () => window.cancelAnimationFrame(raf);
  }, [active, current]);

  /* ── card height (per-step copy differs) + focus per step ──────────── */
  React.useLayoutEffect(() => {
    if (active && panelRef.current) {
      setCardH(panelRef.current.offsetHeight);
    }
  }, [active, step]);

  React.useEffect(() => {
    if (active) panelRef.current?.focus({ preventScroll: true });
  }, [active, step]);

  /* ── keyboard: tour owns the top of the Escape chain while active ──── */
  React.useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        finish();
        return;
      }
      if (event.key === "ArrowRight" && steps[step + 1]) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setStep(step + 1);
        return;
      }
      if (event.key === "ArrowLeft" && step > 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setStep(step - 1);
        return;
      }
      if (event.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const items = Array.from(
          panel.querySelectorAll<HTMLElement>("button, a[href]"),
        );
        if (items.length === 0) return;
        const first = items[0];
        const lastItem = items[items.length - 1];
        const focused = document.activeElement as HTMLElement | null;
        const inside = focused ? panel.contains(focused) : false;
        const atStart = focused === first || focused === panel;
        const atEnd = focused === lastItem;
        if (event.shiftKey && (atStart || !inside)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          lastItem.focus();
        } else if (!event.shiftKey && (atEnd || !inside)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [active, step, steps, finish]);

  /* ── card placement: below the target, above it when space runs out ── */
  const pos = React.useMemo(() => {
    if (typeof window === "undefined") {
      return { left: 0, top: 0, w: CARD_BASE_W };
    }
    const vw = vp.w || window.innerWidth;
    const vh = vp.h || window.innerHeight;
    const w = Math.min(CARD_BASE_W, vw - EDGE * 2);
    if (!rect) {
      return {
        left: Math.round((vw - w) / 2),
        top: Math.max(EDGE, Math.round((vh - cardH) / 2)),
        w,
      };
    }
    let left = rect.left + rect.width / 2 - w / 2;
    left = Math.max(EDGE, Math.min(vw - EDGE - w, left));
    const below = rect.bottom + SPOT + 12;
    const above = rect.top - SPOT - 12 - cardH;
    const top =
      below + cardH + EDGE <= vh
        ? below
        : above >= EDGE
          ? above
          : Math.max(EDGE, Math.min(vh - EDGE - cardH, rect.bottom + 10));
    return { left: Math.round(left), top: Math.round(top), w };
  }, [rect, cardH, vp]);

  /* Only light targets that are actually on screen. */
  const visible =
    rect !== null &&
    rect.bottom > 0 &&
    rect.top < (vp.h || window.innerHeight) &&
    rect.right > 0 &&
    rect.left < (vp.w || window.innerWidth);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {active && current && (
        <motion.div
          key="astra-tour"
          className="z-toast fixed inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.25, ease: EASE }}
        >
          {/* transparent catcher — clicking away dismisses (and is seen) */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            onClick={finish}
          />

          {/* spotlight: box-shadow dims the world, the hole stays lit */}
          {rect && visible ? (
            <motion.div
              aria-hidden="true"
              className="border-aura-violet-soft/70 pointer-events-auto absolute rounded-xl border"
              style={{ boxShadow: "0 0 0 9999px rgba(2, 3, 7, 0.74)" }}
              initial={false}
              animate={{
                left: rect.left - SPOT,
                top: rect.top - SPOT,
                width: rect.width + SPOT * 2,
                height: rect.height + SPOT * 2,
              }}
              transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-black/70"
              onClick={finish}
            />
          )}

          {/* the card */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="astra-tour-title"
            data-tour-panel
            tabIndex={-1}
            className="border-line/70 glass-strong pointer-events-auto absolute rounded-2xl border p-5 transition-[left,top] duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] outline-none"
            style={{ left: pos.left, top: pos.top, width: pos.w }}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}
          >
            <div className="flex items-start gap-3">
              <span className="border-line-strong/60 from-aura-violet/35 to-aura-cyan/20 text-aura-violet-soft grid size-9 shrink-0 place-items-center rounded-xl border bg-gradient-to-br">
                <Icon name={current.icon} size="sm" label="" />
              </span>
              <div className="min-w-0">
                <p className="text-ink-faint text-micro tracking-caps font-mono tabular-nums">
                  Step {step + 1} / {steps.length}
                </p>
                <h2
                  id="astra-tour-title"
                  className="text-ink mt-1 text-sm font-semibold"
                >
                  {current.title}
                </h2>
              </div>
            </div>

            <p className="text-ink-muted mt-3 text-sm leading-relaxed">
              {current.body}
            </p>

            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5" aria-hidden="true">
                {steps.map((item, index) => (
                  <span
                    key={item.title}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      index === step
                        ? "from-aura-violet to-aura-cyan w-4 bg-gradient-to-r"
                        : "w-1.5 bg-white/20",
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="xs" onClick={finish}>
                  Skip
                </Button>
                {step > 0 && (
                  <Button
                    variant="glass"
                    size="xs"
                    onClick={() => setStep(step - 1)}
                  >
                    Back
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => (last ? finish() : setStep(step + 1))}
                  iconRight={
                    <Icon name={last ? "check" : "arrow-right"} size="xs" />
                  }
                >
                  {last ? "Finish" : "Next"}
                </Button>
              </div>
            </div>

            <p className="text-ink-ghost mt-3 flex items-center gap-1.5 text-[11px]">
              <kbd className="border-line rounded border bg-white/[0.06] px-1.5 py-0.5 font-mono">
                ←
              </kbd>
              <kbd className="border-line rounded border bg-white/[0.06] px-1.5 py-0.5 font-mono">
                →
              </kbd>
              to step
              <span aria-hidden="true">·</span>
              <kbd className="border-line rounded border bg-white/[0.06] px-1.5 py-0.5 font-mono">
                Esc
              </kbd>
              to finish
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

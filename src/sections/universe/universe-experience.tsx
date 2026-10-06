"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Button, Icon } from "@/components";
import {
  buildActiveScene,
  getSceneData,
  setSceneData,
} from "@/data/scene-data";
import { useAssistantOpen } from "@/hooks/use-assistant";
import { useSearchClear, useSearchFrame } from "@/hooks/use-search";
import { useSceneData } from "@/hooks/use-scene-data";
import {
  readTimelineDate,
  readTimelineNow,
  resetTimeline,
  setTimelineWindow,
} from "@/hooks/use-timeline";
import { useUniverse } from "@/hooks/use-universe";
import { useActiveUniverseRecord } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";

import { syncPlanetRegistry } from "./scene/planet-registry";

import { UniverseHud } from "./universe-hud";
import { ProjectDetailPanel } from "./project-detail-panel";

/* ────────────────────────────────────────────────────────────────────────── *
 * UniverseExperience — the /universe shell.
 *
 * The heavy WebGL bundle is loaded with `ssr: false` behind this client
 * component (Next forbids `ssr: false` in Server Components), so the route
 * ships a tiny HTML boot screen first and hydrates the scene in a second
 * chunk. Sequence: boot lines type out → scene ready → panels rise in.
 *
 * Guards: a WebGL capability probe swaps in a designed fallback panel;
 * Escape unwinds one layer at a time — the Astra conversation (or an
 * active search), a results frame, a focused world, a timeline parked in
 * the past (back to the present), then the exit fade to the surface (the
 * dock button jumps straight out); reduced-motion gets an instant reveal
 * and a frozen scene.
 * ────────────────────────────────────────────────────────────────────────── */

const UniverseScene = dynamic(
  () => import("./scene/universe-scene").then((mod) => mod.UniverseScene),
  {
    ssr: false,
    loading: () => null,
  },
);

/* Astra's orb + panel mount at the end of the boot sequence, so the
 * conversation UI ships as its own chunk fetched while the boot lines type
 * out — keeps the initial /universe parse and paint as lean as before it
 * existed. */
const UniverseAssistant = dynamic(
  () => import("./universe-assistant").then((mod) => mod.UniverseAssistant),
  {
    ssr: false,
    loading: () => null,
  },
);

/* The knowledge timeline follows the same rule as Astra: its own chunk,
 * fetched while the boot lines type out, so the bar costs the initial
 * /universe payload nothing. */
const UniverseTimeline = dynamic(
  () => import("./universe-timeline").then((mod) => mod.UniverseTimeline),
  {
    ssr: false,
    loading: () => null,
  },
);

const BOOT_LINES = [
  "initialising astra kernel…",
  "mounting starfield (9,000 nodes)…",
  "charging nebula cores…",
  "charting orbital planes…",
  "handing over to renderer",
] as const;

/** Probe WebGL without throwing — some browsers only return null. */
function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}

/** Trim the starfield on small viewports so phones keep a smooth frame. */
function starCountForViewport(): number {
  if (typeof window === "undefined") return 9000;
  return window.innerWidth < 768 ? 4500 : 9000;
}

export function UniverseExperience() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const { focusedId, focus, release } = useUniverse();
  const clearSearch = useSearchClear();
  const frameIds = useSearchFrame();
  const hasFrame = frameIds !== null;
  const { open: assistantOpen, close: closeAssistant } = useAssistantOpen();

  const [webgl, setWebgl] = React.useState<boolean | null>(null);
  const [booted, setBooted] = React.useState(false);
  const [exiting, setExiting] = React.useState(false);
  const starCount = React.useRef(9000);

  /* ── active scene ──────────────────────────────────────────────────────
     The record → scene build is memoised and *published during render*
     (before children render), so every keyed child reads the right
     projects/links on its very first pass — no stale-stock frame. With no
     active universe this is `STOCK_SCENE`, the byte-identical default. */
  const record = useActiveUniverseRecord();
  const scene = React.useMemo(() => {
    const next = buildActiveScene(record);
    /* Publish + resync only on a real swap: `buildUniverseScene` returns the
       identical scene object for unrelated record edits (task toggles), so
       re-seeding the position registry never happens mid-session. */
    if (getSceneData() !== next) {
      setSceneData(next);
      syncPlanetRegistry();
    }
    return next;
  }, [record]);
  /* Re-read through the hook so a scene swap published elsewhere still
     re-renders the shell (and thus its keys). */
  useSceneData();

  /* Universe swap: retarget the timeline window and unwind every
     scene-scoped layer (focus, reveal, Astra, time travel) so nothing
     points at a planet that no longer exists. Runs in a layout effect —
     before paint — so the timeline never shows the previous universe's
     floor for a frame. */
  const lastSceneId = React.useRef(scene.id);
  React.useLayoutEffect(() => {
    setTimelineWindow(scene.floor);
    if (lastSceneId.current === scene.id) return;
    lastSceneId.current = scene.id;
    release();
    clearSearch();
    closeAssistant();
    resetTimeline();
  }, [scene.id, scene.floor, clearSearch, closeAssistant, release]);

  /* Capability probe + star budget run once on the client. */
  React.useEffect(() => {
    setWebgl(supportsWebGL());
    starCount.current = starCountForViewport();
  }, []);

  /* Boot sequence: walk the log lines, then lift the curtain. */
  React.useEffect(() => {
    if (webgl === null) return;
    if (reduce) {
      setBooted(true);
      return;
    }
    let cancelled = false;
    const step = 380;
    const timers = BOOT_LINES.map((_, i) =>
      window.setTimeout(
        () => {
          if (!cancelled) setBooted(i === BOOT_LINES.length - 1);
        },
        step * (i + 1),
      ),
    );
    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
    };
  }, [webgl, reduce]);

  /* Exit: fade the curtain, then return to the surface (mirror of the
     launch-overlay contract) — used by Escape, the dock and the fallback. */
  const exit = React.useCallback(() => {
    setExiting((current) => {
      if (current) return current;
      window.setTimeout(() => router.push("/"), reduce ? 0 : 420);
      return true;
    });
  }, [router, reduce]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Escape unwinds one layer at a time: the Astra conversation first,
      // then a results frame Astra revealed, then a focused world, then a
      // timeline parked in the past (back to the present) — and only an
      // untouched universe exits to the surface.
      if (assistantOpen) {
        closeAssistant();
        return;
      }
      if (hasFrame) {
        // Astra's reveal commits matches + frame together — clear both.
        clearSearch();
        return;
      }
      if (focusedId) {
        release();
        return;
      }
      if (readTimelineDate() < readTimelineNow()) {
        // Time travel is a layer of its own — first return to the present,
        // then (on the next press) leave the universe.
        resetTimeline();
        return;
      }
      exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    assistantOpen,
    clearSearch,
    closeAssistant,
    exit,
    focusedId,
    hasFrame,
    release,
  ]);

  /* A focus (or reveal) must never leak into a fresh visit of /universe
     (browser back/forward remounts this page without going through exit()).
     Guarded on mount — deliberately NOT an unmount cleanup: poking the store
     while React is deleting the subtree races the commit. */
  const firstVisit = React.useRef(true);
  React.useEffect(() => {
    if (!firstVisit.current) return;
    firstVisit.current = false;
    if (focusedId) release();
    if (hasFrame) clearSearch();
    if (assistantOpen) closeAssistant();
    if (readTimelineDate() < readTimelineNow()) resetTimeline();
    /* …unless the visit *asks* for a world: the command palette deep-links
       `?world=<id>` when it's invoked from another route. Applied after the
       reset above, then consumed with a same-route replace so back/forward
       and reloads never re-trigger the focus (the guard's intent stands). */
    const worldId = new URLSearchParams(window.location.search).get("world");
    if (worldId !== null && scene.projects.some((p) => p.id === worldId)) {
      focus(worldId);
      router.replace("/universe", { scroll: false });
    }
  }, [
    assistantOpen,
    clearSearch,
    closeAssistant,
    focusedId,
    focus,
    hasFrame,
    release,
    router,
    scene,
  ]);

  /* Lock scroll — the universe is a fixed viewport.
     NB: restore to `""`, NOT to the value captured at mount. We may mount
     while the launch overlay still holds its own lock ("hidden"), and
     restoring that would strand the landing page unscrollable. */
  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const showScene = webgl === true && booted;
  /* Generated universes tune their own star budget; stock keeps the plain
     viewport-derived number (byte-identical to the pre-workspace build). */
  const starBudget = scene.ambient
    ? Math.min(scene.ambient.starCount, starCount.current)
    : starCount.current;

  return (
    <div className="bg-void fixed inset-0 isolate overflow-hidden">
      <h1 className="sr-only">
        Astra OS Universe — an immersive starfield for your knowledge graph
      </h1>

      {/* ── 3D scene ───────────────────────────────────────────────────── */}
      {webgl && (
        <div
          aria-hidden="true"
          className={cn(
            "ease-out-expo absolute inset-0 transition-opacity duration-1000",
            showScene ? "opacity-100" : "opacity-0",
          )}
        >
          <UniverseScene
            key={scene.id}
            reduced={Boolean(reduce)}
            starCount={starBudget}
          />
        </div>
      )}

      {/* ── designed fallback when WebGL is unavailable ────────────────── */}
      {webgl === false && (
        <div className="absolute inset-0 grid place-items-center px-6">
          <div className="glass-strong max-w-md rounded-2xl p-8 text-center">
            <Icon
              name="shield"
              size="xl"
              label=""
              className="text-aura-violet mx-auto mb-4"
            />
            <h2 className="text-ink mb-2 text-lg font-semibold">
              Your browser can&apos;t render the universe
            </h2>
            <p className="text-ink-muted mb-6 text-sm leading-relaxed">
              The starfield needs WebGL. Enable hardware acceleration or try a
              modern browser to step inside Astra OS.
            </p>
            <Button
              variant="primary"
              onClick={exit}
              iconLeft={<Icon name="home" />}
            >
              Return to surface
            </Button>
          </div>
        </div>
      )}

      {/* ── boot screen ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {!booted && webgl !== false && (
          <motion.div
            key="boot"
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.6, ease: "easeInOut" }}
            className="z-overlay absolute inset-0 grid place-items-center px-6"
          >
            <div className="w-full max-w-sm">
              <p className="text-aura-violet-soft text-micro tracking-caps mb-6 font-mono">
                ASTRA OS · COLD BOOT
              </p>
              <ul className="text-micro space-y-2 font-mono">
                {BOOT_LINES.map((line, index) => (
                  <motion.li
                    key={line}
                    initial={reduce ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.3,
                      delay: reduce ? 0 : index * 0.38,
                    }}
                    className="text-ink-faint flex items-center gap-2"
                  >
                    <span className="text-aura-cyan">›</span>
                    {line}
                  </motion.li>
                ))}
              </ul>
              <div
                aria-hidden="true"
                className="bg-line relative mt-6 h-px overflow-hidden rounded-full"
              >
                <motion.div
                  initial={{ width: "5%" }}
                  animate={{ width: "100%" }}
                  transition={{
                    duration: reduce ? 0 : BOOT_LINES.length * 0.38,
                    ease: "easeOut",
                  }}
                  className="from-aura-violet via-aura-indigo to-aura-cyan absolute inset-y-0 left-0 bg-gradient-to-r"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HUD (stays mounted; the exit curtain covers it) ────────────── */}
      {showScene && <UniverseHud onExit={exit} ready={showScene} />}

      {/* ── Astra — the assistant orb + conversational panel ───────────── */}
      {showScene && <UniverseAssistant />}

      {/* ── knowledge timeline (bottom-centre; yields to dossier/Astra) ── */}
      {showScene && <UniverseTimeline />}

      {/* ── immersive project dossier (replaces a traditional modal) ───── */}
      {showScene && <ProjectDetailPanel reduce={reduce ?? false} />}

      {/* ── exit curtain ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {exiting && (
          <motion.div
            key="curtain"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 1 }}
            transition={{ duration: reduce ? 0 : 0.42, ease: "easeIn" }}
            aria-hidden="true"
            className="bg-void z-launch absolute inset-0"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

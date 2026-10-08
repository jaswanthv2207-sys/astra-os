"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Button, Icon } from "@/components";
import { useSceneData, useSceneProjects } from "@/hooks/use-scene-data";
import { useTimelineDate } from "@/hooks/use-timeline";
import { useUniverse } from "@/hooks/use-universe";
import { playCue } from "@/lib/audio";
import { cn } from "@/lib/utils";

import { readPlanetPosition } from "./scene/planet-registry";
import { arrivalOf, bornCount, radiusOf } from "./timeline";

/* ────────────────────────────────────────────────────────────────────────── *
 * UniverseMinimap — the full-galaxy map: a portal overlay that projects the
 * whole scene top-down (orbit rings, system crosshairs, link beams and every
 * world) into pixel space, with inertial panning, cursor-anchored zoom,
 * spatial keyboard navigation and click-to-warp.
 *
 * Layer contract (Escape chain): the panel registers a *capture* listener on
 * `window` while open and calls `stopImmediatePropagation()` on Escape — the
 * shell's Escape chain runs on `window` in the bubble phase and Radix's
 * dismissables run on `document` in capture, so capturing at the window is
 * the one place that can sit above both. The map therefore unwinds first,
 * then the assistant / reveal / focus / timeline chain continues to work
 * exactly as before.
 *
 * The portal renders at `z-toast` (700): above the assistant (`z-popover`
 * 600) and the HUD (`z-raised` 10) — both live inside the experience's
 * isolated stacking context, so a body-level layer outranks all of them —
 * yet below the grain (900) and launch (1000) overlays.
 *
 * Probe contract: closed by default (the portal renders nothing), the
 * trigger is a `button` (never `div.glass.rounded-full`), planet dots are
 * `<button>`s (never `div.glass.rounded-full`), and neither the footer ESC
 * pill nor the `Fly to a world` nav is touched.
 * ────────────────────────────────────────────────────────────────────────── */

/* Tunables ---------------------------------------------------------------- */
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.3;
const WARP_ZOOM = 1.7;
/** Breathing room kept between the projected bounds and the viewport edge. */
const MAP_PAD = 36;
/** Points sampled per orbit ring — enough to read as a circle at any zoom. */
const RING_SAMPLES = 64;
/** Live planet positions poll this often while the map is open. */
const POLL_MS = 200;
/** Click-to-warp: zoom toward the world, then fly. */
const WARP_MS = 320;
/** One keyboard pan step, in screen px. */
const PAN_STEP = 48;
/** Young worlds circle 1.4× out; +0.05 slack keeps their dot inside bounds. */
const ORBIT_LEAD = 1.45;
/** The planet registry seeds off-screen at z = −10000. */
const OFFSCREEN_Z = -5_000;
/** A gesture hands smoothing back this long after it ends. */
const SMOOTH_ARM_MS = 160;
/** Pointer travel before a press counts as a drag (and swallows the click). */
const DRAG_SLOP = 4;
const INERTIA_START = 0.15; // px/ms — below this a flick just stops
const INERTIA_STOP = 0.04; // px/ms — the flick is spent
const INERTIA_DECAY = 0.94; // per 16.67ms frame
const WHEEL_ZOOM = 0.0015;
const EASE = [0.16, 1, 0.3, 1] as const;

/* Types ------------------------------------------------------------------- */
interface View {
  /** Pan in screen px (layer origin, transform-origin 0 0). */
  x: number;
  y: number;
  /** Uniform zoom. */
  z: number;
  /** Whether the layer's transform transition is armed for this state. */
  smooth: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface WorldPoint {
  x: number;
  z: number;
}

interface DragState {
  id: number;
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
  vx: number;
  vy: number;
  at: number;
}

/* Projection maths --------------------------------------------------------- */

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * Clamp pan so the map always covers ≥ 40% of the viewport on each axis:
 * the content's centre may not drift further than `|content − viewport|/2
 * + 60px` from the viewport's centre. Wide enough to browse, tight enough
 * that a world can never be lost off-screen.
 */
function clampView(view: View, width: number, height: number): View {
  const z = clampZoom(view.z);
  const x = Math.min(0.6 * width, Math.max(0.4 * width - z * width, view.x));
  const y = Math.min(0.6 * height, Math.max(0.4 * height - z * height, view.y));
  return { x, y, z, smooth: view.smooth };
}

/** World-space box every orbit can reach (arrival orbit included). */
function computeBounds(
  projects: ReturnType<typeof useSceneProjects>,
  centres: readonly (readonly [number, number, number])[],
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const project of projects) {
    const centre = centres[project.orbit.centre] ?? centres[0];
    if (!centre) continue;
    const reach = project.orbit.radius * ORBIT_LEAD + project.planet.radius;
    minX = Math.min(minX, centre[0] - reach);
    maxX = Math.max(maxX, centre[0] + reach);
    minZ = Math.min(minZ, centre[2] - reach);
    maxZ = Math.max(maxZ, centre[2] + reach);
  }
  if (!Number.isFinite(minX)) return { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
  return { minX, maxX, minZ, maxZ };
}

/**
 * World (x, z) → content pixel space: one uniform scale fitted inside the
 * measured viewport (with `MAP_PAD` slack), centred on the bounds. Content
 * pixels equal viewport pixels at zoom 1 / pan 0, which keeps the cursor-
 * anchored wheel maths and the pan clamps trivially simple.
 */
function makeProjector(
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  width: number,
  height: number,
): (x: number, z: number) => Point {
  const spanX = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const spanZ = Math.max(bounds.maxZ - bounds.minZ, 1e-6);
  const scale = Math.min(
    (width - MAP_PAD * 2) / spanX,
    (height - MAP_PAD * 2) / spanZ,
  );
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  return (x, z) => ({
    x: width / 2 + (x - cx) * scale,
    y: height / 2 + (z - cz) * scale,
  });
}

/**
 * A point on an orbit ring → world space. Mirrors the scene graph exactly:
 * `centre → rotation={plane} → pivot.rotation.y → body at (radius, 0, 0)`,
 * and three.js Euler's default XYZ order composes R = Rx·Ry·Rz (so Rz
 * applies first). Sampling `t` over a full turn with the local point
 * `(r·cos t, 0, −r·sin t)` (= Ry(t)·(r,0,0)) therefore traces the very ring
 * the planet rides, so a dot can never drift off its ring.
 */
function toWorld(
  centre: readonly [number, number, number],
  plane: readonly [number, number, number],
  localX: number,
  localZ: number,
): WorldPoint {
  const [px, py, pz] = plane;
  // Rz — the local point has y = 0, so this is a plain 2D rotation of (x, z).
  const cz = Math.cos(pz);
  const sz = Math.sin(pz);
  const x1 = localX * cz;
  const y1 = localX * sz;
  const z1 = localZ;
  // Ry
  const cy = Math.cos(py);
  const sy = Math.sin(py);
  const x2 = x1 * cy + z1 * sy;
  const y2 = y1;
  const z2 = -x1 * sy + z1 * cy;
  // Rx — the map projects (x, z) top-down, so world y is never read back.
  const cx = Math.cos(px);
  const sx = Math.sin(px);
  const z3 = y2 * sx + z2 * cx;
  return { x: centre[0] + x2, z: centre[2] + z3 };
}

/* Panel ------------------------------------------------------------------- */

interface MinimapPanelProps {
  onOpenChange: (open: boolean) => void;
}

function MinimapPanel({ onOpenChange }: MinimapPanelProps) {
  const reduce = Boolean(useReducedMotion());
  const projects = useSceneProjects();
  const scene = useSceneData();
  const viewedDate = useTimelineDate();
  const { focus, focusedId } = useUniverse();

  const panelRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const sizeRef = React.useRef({ w: 0, h: 0 });
  const dragRef = React.useRef<DragState | null>(null);
  const inertiaRef = React.useRef<number | null>(null);
  const armRef = React.useRef<number | null>(null);
  const warpRef = React.useRef<number | null>(null);
  const movedRef = React.useRef(false);

  const [size, setSize] = React.useState({ w: 0, h: 0 });
  const [view, setView] = React.useState<View>({
    x: 0,
    y: 0,
    z: 1,
    smooth: false,
  });
  const [positions, setPositions] = React.useState<Record<string, WorldPoint>>(
    {},
  );
  const [dragging, setDragging] = React.useState(false);

  const born = bornCount(viewedDate);
  const ringStroke = scene.ambient?.orbitRingColor ?? "rgb(255 255 255)";
  const ringOpacity = scene.ambient ? 0.4 : 0.16;

  /* Measure the viewport before paint and keep the pan clamped on resize. */
  React.useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const read = () => {
      const w = Math.round(element.clientWidth);
      const h = Math.round(element.clientHeight);
      sizeRef.current = { w, h };
      setSize((previous) =>
        previous.w === w && previous.h === h ? previous : { w, h },
      );
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!size.w || !size.h) return;
    setView((current) => clampView(current, size.w, size.h));
  }, [size]);

  /* Live world positions — the scene keeps orbiting behind the map, so the
     dots glide along their rings. Falls back to the system centre for the
     frames before the scene's first write (or under a frozen demand loop). */
  React.useLayoutEffect(() => {
    const read = () => {
      const next: Record<string, WorldPoint> = {};
      for (const project of projects) {
        const world = readPlanetPosition(project.id);
        if (world && world.z > OFFSCREEN_Z) {
          next[project.id] = { x: world.x, z: world.z };
        } else {
          const centre =
            scene.centres[project.orbit.centre] ?? scene.centres[0];
          next[project.id] = { x: centre[0], z: centre[2] };
        }
      }
      setPositions(next);
    };
    read();
    const timer = window.setInterval(read, POLL_MS);
    return () => window.clearInterval(timer);
  }, [projects, scene.centres]);

  /* Geometry: world → content pixels, sampled rings, system crosshairs.
     Recomputed only when the scene, the viewed date or the size changes. */
  const geometry = React.useMemo(() => {
    const { w, h } = size;
    if (!w || !h) return null;
    const bounds = computeBounds(projects, scene.centres);
    const projector = makeProjector(bounds, w, h);
    const rings = projects.map((project) => {
      const centre = scene.centres[project.orbit.centre] ?? scene.centres[0];
      const radius = project.orbit.radius * radiusOf(viewedDate, project);
      let points = "";
      for (let i = 0; i <= RING_SAMPLES; i += 1) {
        const t = (i / RING_SAMPLES) * Math.PI * 2;
        const world = toWorld(
          centre,
          project.orbit.plane,
          radius * Math.cos(t),
          -radius * Math.sin(t),
        );
        const pixel = projector(world.x, world.z);
        points += `${i === 0 ? "" : " "}${pixel.x.toFixed(1)},${pixel.y.toFixed(1)}`;
      }
      return { id: project.id, points };
    });
    const seen = new Set<number>();
    const centreMarks: Point[] = [];
    for (const project of projects) {
      if (seen.has(project.orbit.centre)) continue;
      seen.add(project.orbit.centre);
      const centre = scene.centres[project.orbit.centre] ?? scene.centres[0];
      centreMarks.push(projector(centre[0], centre[2]));
    }
    return { projector, rings, centreMarks };
  }, [projects, scene.centres, viewedDate, size]);

  /* ── gestures ───────────────────────────────────────────────────────── */

  const armSmooth = React.useCallback(() => {
    if (armRef.current !== null) window.clearTimeout(armRef.current);
    armRef.current = window.setTimeout(() => {
      armRef.current = null;
      setView((current) =>
        current.smooth ? current : { ...current, smooth: true },
      );
    }, SMOOTH_ARM_MS);
  }, []);

  const stopInertia = React.useCallback(() => {
    if (inertiaRef.current !== null) {
      cancelAnimationFrame(inertiaRef.current);
      inertiaRef.current = null;
    }
  }, []);

  /* Cursor-anchored zoom: the world point under the pointer stays put, so
     `pan' = cursor + (z'/z)·(pan − cursor)`. Native, non-passive listener so
     the page can never scroll or pinch-zoom underneath the map — except
     Ctrl+wheel, which we leave alone (it's the browser's own zoom). */
  React.useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
      const factor = Math.exp(-delta * WHEEL_ZOOM);
      setView((current) => {
        const z = clampZoom(current.z * factor);
        const k = z / current.z;
        const { w, h } = sizeRef.current;
        return clampView(
          {
            x: cursorX + k * (current.x - cursorX),
            y: cursorY + k * (current.y - cursorY),
            z,
            smooth: false,
          },
          w,
          h,
        );
      });
      armSmooth();
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [armSmooth]);

  /* A flick keeps gliding: velocity decays by INERTIA_DECAY every ~17ms
     until it drops under INERTIA_STOP. Disabled under reduced motion. */
  const startInertia = React.useCallback(
    (vx: number, vy: number) => {
      stopInertia();
      const initial = Math.hypot(vx, vy);
      if (initial < INERTIA_START) {
        armSmooth();
        return;
      }
      const ux = vx / initial;
      const uy = vy / initial;
      let speed = initial;
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(now - last, 64);
        last = now;
        speed *= Math.pow(INERTIA_DECAY, dt / 16.667);
        if (speed < INERTIA_STOP) {
          inertiaRef.current = null;
          armSmooth();
          return;
        }
        setView((current) => {
          const { w, h } = sizeRef.current;
          return clampView(
            {
              x: current.x + ux * speed * dt,
              y: current.y + uy * speed * dt,
              z: current.z,
              smooth: false,
            },
            w,
            h,
          );
        });
        inertiaRef.current = requestAnimationFrame(step);
      };
      inertiaRef.current = requestAnimationFrame(step);
    },
    [armSmooth, stopInertia],
  );

  /* Drag with window-level listeners rather than pointer capture: capture
     would retarget pointerup and break `click` on the planet buttons, and
     click-to-warp is the whole point of the map. */
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    stopInertia();
    movedRef.current = false;
    const state: DragState = {
      id: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      vx: 0,
      vy: 0,
      at: performance.now(),
    };
    dragRef.current = state;
    setDragging(true);
    setView((current) =>
      current.smooth ? { ...current, smooth: false } : current,
    );

    function finish() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      dragRef.current = null;
      setDragging(false);
      if (!reduce && Math.hypot(state.vx, state.vy) >= INERTIA_START) {
        startInertia(state.vx, state.vy);
      } else {
        armSmooth();
      }
    }

    function onMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== state.id) return;
      // Released outside the window — treat as the end of the gesture.
      if ((moveEvent.buttons & 1) === 0) {
        finish();
        return;
      }
      const now = performance.now();
      const dx = moveEvent.clientX - state.lastX;
      const dy = moveEvent.clientY - state.lastY;
      const dt = Math.max(now - state.at, 1);
      state.lastX = moveEvent.clientX;
      state.lastY = moveEvent.clientY;
      state.at = now;
      state.vx = 0.4 * (dx / dt) + 0.6 * state.vx;
      state.vy = 0.4 * (dy / dt) + 0.6 * state.vy;
      if (
        Math.abs(moveEvent.clientX - state.startX) > DRAG_SLOP ||
        Math.abs(moveEvent.clientY - state.startY) > DRAG_SLOP
      ) {
        movedRef.current = true;
      }
      if (dx === 0 && dy === 0) return;
      setView((current) => {
        const { w, h } = sizeRef.current;
        return clampView(
          { x: current.x + dx, y: current.y + dy, z: current.z, smooth: false },
          w,
          h,
        );
      });
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const zoomBy = React.useCallback((factor: number) => {
    setView((current) => {
      const z = clampZoom(current.z * factor);
      const k = z / current.z;
      const { w, h } = sizeRef.current;
      const cx = w / 2;
      const cy = h / 2;
      return clampView(
        {
          x: cx + k * (current.x - cx),
          y: cy + k * (current.y - cy),
          z,
          smooth: true,
        },
        w,
        h,
      );
    });
  }, []);

  const resetView = React.useCallback(() => {
    setView({ x: 0, y: 0, z: 1, smooth: true });
  }, []);

  /* ── actions ────────────────────────────────────────────────────────── */

  const pixelOf = (id: string): Point | null => {
    if (!geometry) return null;
    const world = positions[id];
    if (!world) return null;
    return geometry.projector(world.x, world.z);
  };

  const focusPlanet = (id: string) => {
    const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>(
      "[data-minimap-planet]",
    );
    buttons?.forEach((button) => {
      if (button.getAttribute("data-minimap-planet") === id) button.focus();
    });
  };

  /* Click-to-warp: ease the map onto the world (it reads as the camera
     already committing), then hand the flight to the scene. Unborn worlds
     are dimmed and inert — there is nothing to fly to yet. */
  const warp = (id: string) => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    const project = projects.find((candidate) => candidate.id === id);
    if (!project) return;
    if (arrivalOf(viewedDate, project) <= 0) return;
    playCue("warp");
    const pixel = pixelOf(id);
    if (reduce || !pixel) {
      focus(id);
      onOpenChange(false);
      return;
    }
    setView((current) => {
      const z = clampZoom(Math.max(current.z, WARP_ZOOM));
      const { w, h } = sizeRef.current;
      return {
        x: w / 2 - pixel.x * z,
        y: h / 2 - pixel.y * z,
        z,
        smooth: true,
      };
    });
    warpRef.current = window.setTimeout(() => {
      warpRef.current = null;
      focus(id);
      onOpenChange(false);
    }, WARP_MS);
  };

  /* ── keyboard ───────────────────────────────────────────────────────── */

  const trapTab = (event: React.KeyboardEvent<HTMLDivElement>) => {
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

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    if (key === "Tab") {
      trapTab(event);
      return;
    }
    if (key === "+" || key === "=") {
      event.preventDefault();
      zoomBy(ZOOM_STEP);
      return;
    }
    if (key === "-" || key === "_") {
      event.preventDefault();
      zoomBy(1 / ZOOM_STEP);
      return;
    }
    if (key === "0") {
      event.preventDefault();
      resetView();
      return;
    }
    if (!key.startsWith("Arrow")) return;

    event.preventDefault();
    const active = document.activeElement;
    const currentId =
      active instanceof HTMLElement
        ? active.getAttribute("data-minimap-planet")
        : null;

    if (currentId && geometry) {
      // Spatial hop: prefer worlds that lie ahead of us, penalise those
      // that sit far off the arrow's axis.
      const directions: Record<string, [number, number]> = {
        ArrowRight: [1, 0],
        ArrowLeft: [-1, 0],
        ArrowDown: [0, 1],
        ArrowUp: [0, -1],
      };
      const [ux, uy] = directions[key];
      const from = pixelOf(currentId);
      if (!from) return;
      let bestId: string | null = null;
      let bestScore = Infinity;
      for (const project of projects) {
        if (project.id === currentId) continue;
        const to = pixelOf(project.id);
        if (!to) continue;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const along = dx * ux + dy * uy;
        if (along <= 1) continue;
        const perp = Math.abs(dx * uy - dy * ux);
        const score = perp * 2 + along;
        if (score < bestScore) {
          bestScore = score;
          bestId = project.id;
        }
      }
      if (bestId) focusPlanet(bestId);
      return;
    }

    // No world focused — pan one keyboard step instead (reveals more of the
    // map in the arrow's direction).
    const pans: Record<string, [number, number]> = {
      ArrowRight: [PAN_STEP, 0],
      ArrowLeft: [-PAN_STEP, 0],
      ArrowDown: [0, PAN_STEP],
      ArrowUp: [0, -PAN_STEP],
    };
    const [dx, dy] = pans[key];
    setView((current) => {
      const { w, h } = sizeRef.current;
      return clampView(
        {
          x: current.x - dx,
          y: current.y - dy,
          z: current.z,
          smooth: !reduce,
        },
        w,
        h,
      );
    });
  };

  /* Focus lands in the dialog the moment it exists (screen readers announce
     it, and the Tab trap has an anchor). */
  React.useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  /* No timers outlive the panel. */
  React.useEffect(
    () => () => {
      if (inertiaRef.current !== null) {
        cancelAnimationFrame(inertiaRef.current);
      }
      if (armRef.current !== null) window.clearTimeout(armRef.current);
      if (warpRef.current !== null) window.clearTimeout(warpRef.current);
    },
    [],
  );

  const layerTransition = view.smooth
    ? "transform 320ms var(--motion-out-expo)"
    : "none";

  const isEmpty = projects.length === 0;

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
          aria-label="Galaxy map"
          data-minimap=""
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className="glass-strong border-line/70 pointer-events-auto w-[min(94vw,760px)] overflow-hidden rounded-2xl border shadow-[0_30px_90px_-25px_rgb(0_0_0/0.9)] outline-none"
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
          {/* ── header ──────────────────────────────────────────────────── */}
          <div className="border-line/60 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="eyebrow mb-0.5">Galaxy map</p>
              <p className="text-ink truncate text-sm font-medium">
                {scene.name}
              </p>
              <p className="text-ink-faint text-micro tracking-caps font-mono tabular-nums">
                {born} / {projects.length} worlds
              </p>
            </div>

            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom out"
                onClick={() => zoomBy(1 / ZOOM_STEP)}
              >
                <Icon name="minus" />
              </Button>
              <span
                aria-hidden="true"
                className="text-ink-faint text-micro w-11 text-center font-mono tabular-nums"
              >
                {Math.round(view.z * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom in"
                onClick={() => zoomBy(ZOOM_STEP)}
              >
                <Icon name="plus" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Reset the map view"
                onClick={resetView}
              >
                <Icon name="target" />
              </Button>
              <span
                aria-hidden="true"
                className="bg-line-strong mx-1 h-5 w-px"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close galaxy map"
                onClick={() => onOpenChange(false)}
              >
                <Icon name="close" />
              </Button>
            </div>
          </div>

          {/* ── viewport ────────────────────────────────────────────────── */}
          <div
            ref={viewportRef}
            className={cn(
              "relative h-[clamp(260px,56vh,520px)] touch-none overflow-hidden select-none",
              dragging ? "cursor-grabbing" : "cursor-grab",
            )}
            onPointerDown={onPointerDown}
          >
            {geometry && (
              <div
                className="absolute top-0 left-0 origin-top-left"
                style={{
                  width: size.w,
                  height: size.h,
                  transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
                  transition: layerTransition,
                }}
              >
                <svg
                  aria-hidden="true"
                  width={size.w}
                  height={size.h}
                  viewBox={`0 0 ${size.w} ${size.h}`}
                  className="absolute inset-0"
                >
                  <defs>
                    <pattern
                      id="minimap-grid"
                      width="56"
                      height="56"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M56 0H0V56"
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="1"
                        vectorEffect="non-scaling-stroke"
                      />
                    </pattern>
                  </defs>
                  <rect
                    width={size.w}
                    height={size.h}
                    fill="url(#minimap-grid)"
                  />

                  {/* orbit rings */}
                  {geometry.rings.map((ring) => (
                    <polyline
                      key={`ring-${ring.id}`}
                      points={ring.points}
                      fill="none"
                      stroke={ringStroke}
                      strokeOpacity={ringOpacity}
                      strokeWidth="1"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}

                  {/* link beams */}
                  {scene.links.map((link) => {
                    const from = pixelOf(link.from);
                    const to = pixelOf(link.to);
                    if (!from || !to) return null;
                    return (
                      <line
                        key={`${link.from}-${link.to}`}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke="rgba(167,139,250,0.55)"
                        strokeWidth="1"
                        strokeDasharray="4 8"
                        vectorEffect="non-scaling-stroke"
                        className={reduce ? undefined : "animate-link-flow"}
                      />
                    );
                  })}

                  {/* system crosshairs */}
                  {geometry.centreMarks.map((mark, index) => (
                    <g
                      key={`centre-${index}`}
                      stroke="rgba(255,255,255,0.35)"
                      strokeWidth="1"
                    >
                      <line
                        x1={mark.x - 7}
                        y1={mark.y}
                        x2={mark.x + 7}
                        y2={mark.y}
                        vectorEffect="non-scaling-stroke"
                      />
                      <line
                        x1={mark.x}
                        y1={mark.y - 7}
                        x2={mark.x}
                        y2={mark.y + 7}
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  ))}
                </svg>

                {/* worlds */}
                {projects.map((project) => {
                  const pixel = pixelOf(project.id);
                  if (!pixel) return null;
                  const arrived = arrivalOf(viewedDate, project) > 0;
                  return (
                    <button
                      key={project.id}
                      type="button"
                      data-minimap-planet={project.id}
                      aria-label={`Warp to ${project.name}`}
                      aria-disabled={!arrived || undefined}
                      onClick={() => warp(project.id)}
                      className={cn(
                        "group absolute flex size-[34px] cursor-pointer items-center justify-center rounded-full outline-none",
                        "focus-visible:ring-2 focus-visible:ring-white/80",
                      )}
                      style={{
                        left: pixel.x,
                        top: pixel.y,
                        transform: `translate(-50%, -50%) scale(${1 / view.z})`,
                        transition: layerTransition,
                        opacity: arrived ? 1 : 0.25,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "block size-2.5 rounded-full transition-transform duration-200 group-hover:scale-150 group-focus-visible:scale-150",
                          focusedId === project.id &&
                            "ring-2 ring-white/90 ring-offset-2 ring-offset-black/50",
                        )}
                        style={{
                          backgroundColor: project.planet.atmosphere,
                          boxShadow: `0 0 10px ${project.planet.atmosphere}`,
                        }}
                      />
                      {/* Labels reveal on hover/focus, and at zoom ≥125%
                          where the worlds have room to breathe — at fit
                          zoom (esp. mobile) they collide. */}
                      <span
                        className={cn(
                          "text-micro pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 rounded-md px-1.5 py-0.5 font-mono whitespace-nowrap transition-[opacity,background-color,color] duration-200",
                          "bg-black/40 text-white/70 opacity-[var(--label-o)] group-hover:bg-black/70 group-hover:text-white group-hover:opacity-100 group-focus-visible:opacity-100",
                        )}
                        style={
                          {
                            "--label-o":
                              view.z >= 1.25 || focusedId === project.id
                                ? "1"
                                : "0",
                          } as React.CSSProperties
                        }
                      >
                        {project.name}
                      </span>
                    </button>
                  );
                })}

                {isEmpty && (
                  <p className="text-ink-faint text-micro absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-mono">
                    No worlds mapped yet
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── legend ──────────────────────────────────────────────────── */}
          <div className="border-line/60 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-2.5 sm:px-5">
            <div className="flex items-center gap-4">
              <span className="text-ink-faint text-micro flex items-center gap-1.5 font-mono">
                <span
                  aria-hidden="true"
                  className="from-aura-violet to-aura-cyan size-1.5 rounded-full bg-gradient-to-br"
                />
                world
              </span>
              <span className="text-ink-faint text-micro flex items-center gap-1.5 font-mono">
                <span
                  aria-hidden="true"
                  className="bg-aura-violet/70 block h-px w-4"
                />
                link
              </span>
              <span className="text-ink-faint text-micro flex items-center gap-1.5 font-mono">
                <span aria-hidden="true" className="relative block size-2.5">
                  <span className="absolute top-1/2 left-0 h-px w-full bg-white/45" />
                  <span className="absolute top-0 left-1/2 h-full w-px bg-white/45" />
                </span>
                system
              </span>
            </div>
            <p className="text-ink-faint text-micro font-mono">
              drag · scroll to zoom ·{" "}
              <span className="text-aura-violet-soft">↑↓</span> hop worlds ·{" "}
              <span className="text-aura-violet-soft">M</span> to close
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* Shell ------------------------------------------------------------------- */

export interface UniverseMinimapProps {
  /** Whether the map is on screen (owned by the HUD). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Focused when the map closes — the trigger that opened it. */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * UniverseMinimap — the overlay half of the galaxy map. Stays mounted (the
 * portal is empty while closed so nothing paints and no probe can see it),
 * owns the layer's Escape interception and the `M` shortcut, and hands focus
 * back to the trigger on close — but never on first mount.
 *
 * @example
 * const [mapOpen, setMapOpen] = React.useState(false);
 * <Button ref={triggerRef} aria-expanded={mapOpen}>Map</Button>
 * <UniverseMinimap open={mapOpen} onOpenChange={setMapOpen} returnFocusRef={triggerRef} />
 */
export function UniverseMinimap({
  open,
  onOpenChange,
  returnFocusRef,
}: UniverseMinimapProps) {
  const [mounted, setMounted] = React.useState(false);
  const wasOpen = React.useRef(false);

  React.useEffect(() => setMounted(true), []);

  /* Topmost-layer Escape: capture on `window` (the earliest possible phase)
     and stopImmediatePropagation so neither the shell's window-bubble chain
     nor Radix's document-capture dismissables ever see the key. */
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

  /* `M` toggles the map: never while typing, never with a modifier, never on
     key-repeat, and never while another dialog already owns the screen. */
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "m" && event.key !== "M") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (
        !open &&
        document.querySelector('[role="dialog"]:not([data-minimap])')
      )
        return;
      event.preventDefault();
      onOpenChange(!open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  /* Focus returns to whatever opened the map — only after a real open, so
     the first mount never steals focus from the scene. */
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
      {open && <MinimapPanel key="minimap" onOpenChange={onOpenChange} />}
    </AnimatePresence>,
    document.body,
  );
}

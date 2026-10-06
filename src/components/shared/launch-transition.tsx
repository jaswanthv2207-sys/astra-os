"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useLaunchTransition } from "@/hooks/use-launch";

/* ── timeline (ms) ───────────────────────────────────────────────────────── */
const ENGAGE_MS = 700; // overlay closes over the page
const NAV_DELAY_MS = 650; // into the warp: swap the route underneath
const MIN_WARP_MS = 1500; // never reveal before the warp has played
const MAX_WARP_MS = 4000; // …but never hang on it either
const REVEAL_MS = 850; // overlay lifts off the universe

const STATUS: Record<string, string> = {
  engaging: "Aligning knowledge graph",
  warp: "Warp field engaged",
  reveal: "Arriving — sector 00",
};

/**
 * WarpStreaks — a canvas hyperspace tunnel.
 *
 * Streaks radiate from the centre and accelerate on a squared curve so the
 * first second reads as "drifting stars" and the warp as "jump". Pure rAF,
 * DPR-aware, no allocation inside the frame loop; unmounts with the overlay.
 */
function WarpStreaks() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const TINTS = ["#ffffff", "#ffffff", "#e9d5ff", "#c4b5fd", "#a5f3fc"];
    const COUNT = 360;

    let raf = 0;
    let width = 1;
    let height = 1;
    let maxR = 1;
    let last = performance.now();
    const start = last;

    const streaks = Array.from({ length: COUNT }, () => ({
      a: 0,
      r: 0,
      v: 0,
      w: 0,
      tint: "#ffffff",
    }));

    const seed = (s: (typeof streaks)[number], initial: boolean) => {
      s.a = Math.random() * Math.PI * 2;
      s.r = initial ? Math.random() : Math.random() * 0.06;
      s.v = 0.4 + Math.random() * 0.8;
      s.w = 0.6 + Math.random() * 1.7;
      s.tint = TINTS[Math.floor(Math.random() * TINTS.length)];
    };
    streaks.forEach((s) => seed(s, true));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth || 1;
      height = canvas.clientHeight || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      maxR = Math.hypot(width, height) * 0.55;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Squared ramp: gentle drift while the overlay closes, full jump in warp.
      const elapsed = now - start;
      const ramp = Math.min(1, elapsed / (ENGAGE_MS + MIN_WARP_MS));
      const accel = ramp * ramp * 26;
      const roll = elapsed * 0.00004;
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);

      // core bloom that intensifies with speed
      const core = Math.min(1, accel / 9);
      if (core > 0.01) {
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.28);
        glow.addColorStop(0, `rgba(167, 139, 250, ${0.34 * core})`);
        glow.addColorStop(0.4, `rgba(99, 102, 241, ${0.12 * core})`);
        glow.addColorStop(1, "rgba(5, 5, 7, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.lineCap = "round";
      for (const s of streaks) {
        s.r += 0.09 * (1 + accel) * (0.2 + s.r * 1.4) * s.v * dt;
        if (s.r > 1.05) seed(s, false);

        const ang = s.a + roll;
        const dist = s.r * maxR;
        const len = maxR * s.r * s.v * (0.04 + 0.06 * Math.min(1, accel / 10));
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);

        ctx.globalAlpha =
          Math.min(1, 0.25 + s.r * 0.9) * (0.28 + Math.min(0.72, accel * 0.03));
        ctx.strokeStyle = s.tint;
        ctx.lineWidth = s.w * (0.6 + s.r) * (1 + accel * 0.04);
        ctx.beginPath();
        ctx.moveTo(
          cx + cos * Math.max(0, dist - len),
          cy + sin * Math.max(0, dist - len),
        );
        ctx.lineTo(cx + cos * dist, cy + sin * dist);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 size-full"
    />
  );
}

/**
 * LaunchTransition — the cinematic overlay behind "Launch Universe".
 *
 * Mounted once in the root layout. Instead of a plain navigation the CTA
 * arms a small state machine (`stores/launch-store.ts`):
 *
 *   engaging → the screen closes in with a drifting starfield + status HUD
 *   warp     → streaks accelerate; `router.push('/universe')` fires under the
 *              cover of the overlay, a white flash marks the swap
 *   reveal   → the overlay lifts away and the live 3D universe is underneath
 *
 * A11y: `prefers-reduced-motion` collapses the whole sequence to a short
 * crossfade with no streaks; Escape aborts before the route swaps; scroll is
 * locked and an `aria-live` region narrates the jump.
 */
export function LaunchTransition() {
  const { phase, setPhase, reset } = useLaunchTransition();
  const reduce = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const warpStart = React.useRef(0);
  const [flash, setFlash] = React.useState(false);

  /* engaging → warp */
  React.useEffect(() => {
    if (phase !== "engaging") return;
    const timer = setTimeout(() => setPhase("warp"), reduce ? 80 : ENGAGE_MS);
    return () => clearTimeout(timer);
  }, [phase, reduce, setPhase]);

  /* warp → swap the route underneath the overlay */
  React.useEffect(() => {
    if (phase !== "warp") return;
    warpStart.current = performance.now();
    const timer = setTimeout(
      () => router.push("/universe"),
      reduce ? 40 : NAV_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [phase, reduce, router]);

  /* arrival → mark the swap with a flash, then reveal after the min warp */
  React.useEffect(() => {
    if (phase !== "warp" || pathname !== "/universe") return;
    setFlash(true);
    const flashTimer = setTimeout(() => setFlash(false), 480);
    const elapsed = performance.now() - warpStart.current;
    const revealTimer = setTimeout(
      () => setPhase("reveal"),
      Math.max(0, MIN_WARP_MS - elapsed) + 250,
    );
    return () => {
      clearTimeout(flashTimer);
      clearTimeout(revealTimer);
    };
  }, [phase, pathname, setPhase]);

  /* hard fallback: never hang on the warp if navigation stalls */
  React.useEffect(() => {
    if (phase !== "warp") return;
    const timer = setTimeout(() => setPhase("reveal"), MAX_WARP_MS);
    return () => clearTimeout(timer);
  }, [phase, setPhase]);

  /* reveal → idle */
  React.useEffect(() => {
    if (phase !== "reveal") return;
    const timer = setTimeout(reset, reduce ? 200 : REVEAL_MS);
    return () => clearTimeout(timer);
  }, [phase, reduce, reset]);

  /* scroll lock + Escape aborts while still on the source page */
  React.useEffect(() => {
    if (phase === "idle") return;
    document.body.style.overflow = "hidden";

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const inWarp =
        phase === "warp" &&
        performance.now() - warpStart.current < NAV_DELAY_MS;
      if (phase === "engaging" || inWarp) reset();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [phase, reset]);

  if (phase === "idle") return null;

  const status = STATUS[phase];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Entering the Astra OS universe"
      className="z-launch fixed inset-0 overflow-hidden"
    >
      <motion.div
        initial={{ opacity: reduce ? 1 : 0 }}
        animate={{ opacity: phase === "reveal" ? 0 : 1 }}
        transition={{
          duration:
            (phase === "reveal"
              ? REVEAL_MS
              : phase === "engaging"
                ? ENGAGE_MS
                : 250) / 1000,
          ease: "easeOut",
        }}
        className="bg-void absolute inset-0"
      >
        {/* ambient aura so the void still reads as Astra OS */}
        <div
          aria-hidden="true"
          className="from-aura-violet/25 via-aura-indigo/10 absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--surface-void)_78%)]"
        />
        <div
          aria-hidden="true"
          className="from-aura-violet/12 absolute inset-0 bg-gradient-to-b via-transparent to-transparent"
        />

        {!reduce && <WarpStreaks />}

        {/* jump HUD */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6">
          <span className="eyebrow text-aura-violet-soft">Jump sequence</span>

          <div className="h-6">
            <AnimatePresence mode="wait">
              <motion.p
                key={status}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="text-ink tracking-caps text-center font-mono text-sm"
              >
                {status.toUpperCase()}
              </motion.p>
            </AnimatePresence>
          </div>

          <div
            aria-hidden="true"
            className="bg-line relative h-px w-56 overflow-hidden rounded-full md:w-72"
          >
            <motion.div
              initial={{ width: "4%" }}
              animate={{
                width: phase === "engaging" ? "22%" : "100%",
              }}
              transition={{
                duration:
                  (phase === "engaging" ? ENGAGE_MS : MIN_WARP_MS) / 1000,
                ease: "easeOut",
              }}
              className="from-aura-violet via-aura-indigo to-aura-cyan absolute inset-y-0 left-0 bg-gradient-to-r"
            />
          </div>

          <p className="text-ink-faint text-micro font-mono">
            {phase === "engaging" ? "ESC TO ABORT" : "TRAVERSING LAYER 0"}
          </p>
        </div>

        {/* white-out flash marks the moment the route swaps */}
        <AnimatePresence>
          {flash && (
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.7, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.48, times: [0, 0.18, 1] }}
              className="from-aura-violet-soft to-aura-cyan absolute inset-0 bg-gradient-to-b via-white"
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

import * as React from "react";

import { cn } from "@/lib/utils";

/* ── Aurora ─────────────────────────────────────────────────────────────── */

type Intensity = "subtle" | "normal" | "vivid";

const orbOpacity: Record<Intensity, string> = {
  subtle: "opacity-40",
  normal: "opacity-70",
  vivid: "opacity-100",
};

export interface AuroraBackgroundProps {
  /** Overall strength of the colour wash. */
  intensity?: Intensity;
  className?: string;
}

/**
 * AuroraBackground — three slowly drifting aura blooms (violet / cyan /
 * fuchsia) layered behind content.
 *
 * Pure CSS: no JS, no layout work, composited on the GPU via transforms.
 * Decorative by design — the wrapper is `aria-hidden` and ignores pointers.
 *
 * @example
 * <div className="relative isolate">
 *   <AuroraBackground />
 *   …content…
 * </div>
 */
export function AuroraBackground({
  intensity = "normal",
  className,
}: AuroraBackgroundProps) {
  const strength = orbOpacity[intensity];

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      <span
        className={cn(
          "glow-blob animate-float -top-40 -left-32 size-[36rem]",
          strength,
        )}
      />
      <span
        className={cn(
          "glow-blob animate-float top-1/4 -right-40 size-[30rem]",
          strength,
        )}
        style={{
          backgroundImage:
            "radial-gradient(closest-side, rgb(34 211 238 / 0.32), transparent 72%)",
          animationDelay: "-2.4s",
        }}
      />
      <span
        className={cn(
          "glow-blob animate-float bottom-[-8rem] left-1/3 size-[28rem]",
          strength,
        )}
        style={{
          backgroundImage:
            "radial-gradient(closest-side, rgb(232 121 249 / 0.26), transparent 72%)",
          animationDelay: "-4.8s",
        }}
      />
    </div>
  );
}

/* ── Grid ───────────────────────────────────────────────────────────────── */

export interface GridBackgroundProps {
  /** Grid cell size in px. */
  size?: number;
  /** Fade the grid out towards the edges. */
  faded?: boolean;
  className?: string;
}

/**
 * GridBackground — perspective-free blueprint grid with an elliptical mask
 * so it dissolves into the canvas instead of ending on a hard edge.
 *
 * @example
 * <GridBackground size={72} />
 */
export function GridBackground({
  size = 64,
  faded = true,
  className,
}: GridBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 -z-10", className)}
      style={{
        backgroundImage: `linear-gradient(to right, rgb(255 255 255 / 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.05) 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
        maskImage: faded
          ? "radial-gradient(ellipse 90% 75% at 50% 35%, black 25%, transparent 78%)"
          : undefined,
        WebkitMaskImage: faded
          ? "radial-gradient(ellipse 90% 75% at 50% 35%, black 25%, transparent 78%)"
          : undefined,
      }}
    />
  );
}

/* ── Grain ──────────────────────────────────────────────────────────────── */

export interface NoiseOverlayProps {
  /** Grain strength (0–1). Keep it low — 0.03–0.06 reads as film grain. */
  opacity?: number;
  className?: string;
}

/**
 * NoiseOverlay — the film-grain layer from `tokens.css` (`--noise-texture`).
 * It sits at the top of the stacking order (`z-grain`) and hides scroll
 * banding in gradients.
 *
 * @example
 * <NoiseOverlay opacity={0.045} />
 */
export function NoiseOverlay({ opacity = 0.04, className }: NoiseOverlayProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "z-grain pointer-events-none fixed inset-0",
        "mix-blend-overlay motion-reduce:opacity-0",
        className,
      )}
      style={{
        opacity,
        backgroundImage: "var(--noise-texture)",
        backgroundRepeat: "repeat",
      }}
    />
  );
}

/* ── Composition ────────────────────────────────────────────────────────── */

export interface AnimatedBackgroundProps {
  aurora?: boolean | Intensity;
  grid?: boolean | { size?: number; faded?: boolean };
  noise?: boolean | { opacity?: number };
  className?: string;
}

/**
 * AnimatedBackground — the standard page backdrop: aurora + grid + grain,
 * stacked at `-z-10` inside a `relative isolate` parent.
 *
 * Composes the three wrappers above so a page gets the full atmosphere in
 * one line:
 *
 * @example
 * <div className="relative isolate min-h-dvh">
 *   <AnimatedBackground grid={{ size: 72 }} />
 *   …
 * </div>
 */
export function AnimatedBackground({
  aurora = true,
  grid = false,
  noise = true,
  className,
}: AnimatedBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      {grid && (
        <GridBackground
          size={typeof grid === "object" ? grid.size : undefined}
          faded={typeof grid === "object" ? grid.faded : undefined}
        />
      )}

      {aurora && (
        <AuroraBackground
          intensity={typeof aurora === "string" ? aurora : "normal"}
        />
      )}

      {noise && (
        <NoiseOverlay
          opacity={typeof noise === "object" ? noise.opacity : undefined}
        />
      )}
    </div>
  );
}

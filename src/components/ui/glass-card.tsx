"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

type Tone = "glass" | "subtle" | "strong" | "solid";
type Padding = "none" | "sm" | "md" | "lg" | "xl";

const toneClasses: Record<Tone, string> = {
  /** Default Vision Pro material. */
  glass: "glass",
  /** Quieter, nearly invisible fill for dense layouts. */
  subtle: "glass-subtle",
  /** Higher-contrast material for overlays/popovers. */
  strong: "glass-strong",
  /** Opaque card for content-heavy surfaces. */
  solid: "border border-line bg-raised shadow-md",
};

const paddingClasses: Record<Padding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
  xl: "p-10",
};

export interface GlassCardProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /** Renders the single child element instead of a `<div>` (link cards). */
  asChild?: boolean;
  /** Material: glass | subtle | strong | solid. */
  tone?: Tone;
  /** Content padding (ignored when `asChild` — style the child directly). */
  padding?: Padding;
  /** Hover lift + aura bloom (hover/focus-within). */
  interactive?: boolean;
  /** Cursor-tracked spotlight that follows the pointer across the surface. */
  spotlight?: boolean;
  children?: React.ReactNode;
}

/**
 * GlassCard — the canonical surface of Astra OS.
 *
 * Micro-interactions:
 * • `interactive` lifts the card, brightens the hairline and blooms the aura
 *   glow — also on `focus-within`, so keyboard users get the same feedback.
 * • `spotlight` paints a soft radial highlight under the pointer. It's driven
 *   through a ref (no re-render per pointer move) and is `aria-hidden`.
 *
 * A11y: focus is never suppressed — with `asChild` the card *is* the link and
 * inherits the global violet `:focus-visible` outline.
 *
 * Note: `asChild` hands its single child to Radix `Slot`, so it accepts
 * exactly one element (the spotlight layer and padding wrapper are skipped).
 *
 * @example
 * <GlassCard interactive spotlight padding="lg">…</GlassCard>
 * <GlassCard asChild><Link href="/docs">Docs</Link></GlassCard>
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      className,
      asChild = false,
      tone = "glass",
      padding = "md",
      interactive = false,
      spotlight = false,
      onPointerMove,
      onPointerLeave,
      children,
      ...props
    },
    ref,
  ) => {
    const spotlightRef = React.useRef<HTMLDivElement>(null);

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
      onPointerMove?.(event);
      const layer = spotlightRef.current;
      if (!layer) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      layer.style.background = `radial-gradient(340px circle at ${x}px ${y}px, rgb(255 255 255 / 0.08), transparent 65%)`;
    };

    const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
      onPointerLeave?.(event);
      if (spotlightRef.current) spotlightRef.current.style.background = "";
    };

    const classes = cn(
      "group relative isolate flex flex-col overflow-hidden rounded-glass text-ink outline-none transition-all duration-base ease-out-expo",
      toneClasses[tone],
      interactive &&
        "hover:-translate-y-1 hover:border-line-strong hover:shadow-glow-aura focus-within:-translate-y-1 focus-within:shadow-glow-aura motion-reduce:hover:transform-none",
      className,
    );

    const handlers = spotlight
      ? {
          onPointerMove: handlePointerMove,
          onPointerLeave: handlePointerLeave,
        }
      : { onPointerMove, onPointerLeave };

    if (asChild) {
      /* Radix Slot requires exactly one child node — `false`/`undefined`
         count towards React.Children.count, so this branch renders only it. */
      return (
        <Slot ref={ref} className={classes} {...handlers} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <div ref={ref} className={classes} {...handlers} {...props}>
        {spotlight && (
          <div
            ref={spotlightRef}
            aria-hidden="true"
            className="duration-base pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
          />
        )}
        <div className={cn("relative", paddingClasses[padding])}>
          {children}
        </div>
      </div>
    );
  },
);

GlassCard.displayName = "GlassCard";

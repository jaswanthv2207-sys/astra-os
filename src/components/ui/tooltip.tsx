"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

export type TooltipSide = "top" | "right" | "bottom" | "left";
export type TooltipAlign = "start" | "center" | "end";

export interface TooltipProps {
  /** Tooltip copy. Keep it short — it's a label, not a paragraph. */
  label: React.ReactNode;
  /** The trigger element (must accept a ref — buttons, links, inputs). */
  children: React.ReactNode;
  side?: TooltipSide;
  align?: TooltipAlign;
  /** Hover delay in ms. */
  delayDuration?: number;
  /** Disable entirely (e.g. touch-only breakpoints). */
  disabled?: boolean;
  className?: string;
}

/**
 * Tooltip — Radix Tooltip on the Astra OS overlay surface.
 *
 * Why Radix: correct `role="tooltip"` + `aria-describedby` wiring, opens on
 * focus *and* hover, waits for pointer-leave before hiding, and positions
 * itself with collision detection (never clipped by overflow-hidden
 * ancestors).
 *
 * Micro-interactions: fades + scales in from the anchored edge with a short
 * spring; a matching arrow points back at the trigger.
 *
 * A11y: the trigger keeps its own accessible name — the tooltip is
 * supplementary description, never the only source of information. Wrapped
 * in its own `Tooltip.Provider` so usage is one import, no setup.
 *
 * @example
 * <Tooltip label="⌘K to search" side="bottom"><IconButton /></Tooltip>
 */
export function Tooltip({
  label,
  children,
  side = "top",
  align = "center",
  delayDuration = 250,
  disabled = false,
  className,
}: TooltipProps) {
  if (disabled) return <>{children}</>;

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>

        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={8}
            collisionPadding={8}
            className={cn(
              "z-tooltip border-line-strong bg-overlay max-w-[16rem] rounded-md border px-2.5 py-1.5",
              "text-ink shadow-glass text-xs leading-snug font-medium",
              /* Radix emits `delayed-open` (after the wait) or `instant-open`
                 (within the skip-delay window) — animate both. */
              "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95",
              "data-[state=instant-open]:animate-in data-[state=instant-open]:fade-in-0 data-[state=instant-open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1",
              "motion-reduce:animate-none",
              className,
            )}
          >
            {label}
            <TooltipPrimitive.Arrow className="fill-overlay" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

/**
 * App-wide provider — only needed if you use the raw Radix parts
 * (`TooltipPrimitive.*`) and want one shared delay duration.
 */
export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export const TooltipContent = TooltipPrimitive.Content;

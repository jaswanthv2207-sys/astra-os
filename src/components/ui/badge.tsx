import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badge — status, counts and labels.
 *
 * Every variant renders real text (never colour alone) and pairs an optional
 * leading dot with a label so the state is legible for colour-blind users.
 *
 * @example
 * <Badge variant="success" dot>Operational</Badge>
 * <Badge variant="aura">v2.0</Badge>
 * <Badge variant="count">12<span className="sr-only"> unread items</span></Badge>
 */
const badgeVariants = cva(
  [
    "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full",
    "font-medium tabular-nums outline-none transition-all duration-base ease-out-expo",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aura-violet",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border border-line bg-white/[0.06] text-ink",
        /** Aura-tinted emphasis (releases, tags, brand chips). */
        aura: [
          "border border-aura-violet/40 bg-aura-violet/15 text-aura-violet-soft",
          "shadow-glow-soft",
        ].join(" "),
        outline: "border border-line-strong bg-transparent text-ink-muted",
        solid: "border border-transparent bg-ink text-ink-inverse",
        success: "border border-success/30 bg-success-dim text-success",
        warning: "border border-warning/30 bg-warning-dim text-warning",
        danger: "border border-danger/30 bg-danger-dim text-danger",
        info: "border border-info/30 bg-info-dim text-info",
        /** Pure count chip (pair with an `sr-only` description). */
        count: "border border-transparent bg-white/[0.1] text-ink",
      },
      size: {
        sm: "h-5 px-2 text-micro",
        md: "h-6 px-2.5 text-xs",
        lg: "h-7 px-3 text-sm",
      },
      shape: {
        pill: "rounded-full",
        rounded: "rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      shape: "pill",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Renders a leading status dot. Colour is supplementary — keep the label. */
  dot?: boolean;
  /** Pulses the dot (live/syncing states). Honours prefers-reduced-motion. */
  pulse?: boolean;
}

export function Badge({
  className,
  variant,
  size,
  shape,
  dot = false,
  pulse = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size, shape }), className)}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn(
            "shadow-glow-dot-current size-1.5 shrink-0 rounded-full bg-current",
            pulse && "animate-pulse-glow",
          )}
        />
      )}
      {children}
    </span>
  );
}

Badge.displayName = "Badge";

export { badgeVariants };

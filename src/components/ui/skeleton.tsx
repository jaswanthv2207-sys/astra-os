import * as React from "react";

import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Decorative skeletons are `aria-hidden` by default. Provide a `label`
   * (e.g. "Loading projects") to expose them as a polite live region —
   * use it once per loading block, not on every bar.
   */
  label?: string;
  /** Corner radius override. */
  radius?: "sm" | "md" | "lg" | "pill";
}

const radiusClasses = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  pill: "rounded-pill",
};

/**
 * Skeleton — shimmering placeholder for content that is loading.
 *
 * Micro-interactions: a single highlight band sweeps across the placeholder
 * (tokenised `--motion-smooth`, 1.8s loop). Under `prefers-reduced-motion`
 * the sweep freezes to a static tint — no flashing.
 *
 * A11y: by default `aria-hidden` (assistive tech gets your real `aria-busy`
 * status text instead). Pass `label` for a `role="status"` + `aria-live`
 * region so screen readers announce the wait.
 *
 * @example
 * <Skeleton className="h-8 w-48" />
 * <Skeleton label="Loading feed" className="h-40 w-full" />
 */
export function Skeleton({
  className,
  radius = "md",
  label,
  ...props
}: SkeletonProps) {
  return (
    <div
      role={label ? "status" : undefined}
      aria-live={label ? "polite" : undefined}
      aria-hidden={label ? undefined : true}
      className={cn(
        "shadow-inner-highlight relative overflow-hidden bg-white/[0.045]",
        radiusClasses[radius],
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="shimmer-band" />
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of text lines. */
  lines?: number;
  /** Width of the final line as a percentage (short last line reads as copy). */
  lastLineWidth?: string;
  label?: string;
}

/** Multi-line paragraph placeholder — the last line is deliberately shorter. */
export function SkeletonText({
  lines = 3,
  lastLineWidth = "62%",
  label,
  className,
  ...props
}: SkeletonTextProps) {
  return (
    <div
      role={label ? "status" : undefined}
      aria-live={label ? "polite" : undefined}
      aria-hidden={label ? undefined : true}
      className={cn("flex flex-col gap-2.5", className)}
      {...props}
    >
      {label && <span className="sr-only">{label}</span>}
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3.5 w-full")}
          style={
            index === lines - 1 && lines > 1
              ? { width: lastLineWidth }
              : undefined
          }
        />
      ))}
    </div>
  );
}

export interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
}

/** Card-shaped placeholder: media block, title, body lines. */
export function SkeletonCard({
  label,
  className,
  ...props
}: SkeletonCardProps) {
  return (
    <div
      role={label ? "status" : undefined}
      aria-live={label ? "polite" : undefined}
      aria-hidden={label ? undefined : true}
      className={cn(
        "rounded-glass border-hairline space-y-4 border bg-white/[0.02] p-6",
        className,
      )}
      {...props}
    >
      {label && <span className="sr-only">{label}</span>}
      <Skeleton className="h-36 w-full" radius="lg" />
      <Skeleton className="h-5 w-2/3" />
      <div className="space-y-2.5">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>
    </div>
  );
}

/** Circular placeholder (avatars). */
export function SkeletonAvatar({ className, label, ...props }: SkeletonProps) {
  return (
    <Skeleton
      label={label}
      radius="pill"
      className={cn("size-10", className)}
      {...props}
    />
  );
}

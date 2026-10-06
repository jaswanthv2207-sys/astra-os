"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

export interface DockItem {
  id: string;
  /** Visible tooltip label — also the link's accessible name. */
  label: string;
  /** Icon node (lucide/react-icons). Decorative — mark `aria-hidden`. */
  icon: React.ReactNode;
  /** Renders an `<a>` when present, otherwise a `<button>`. */
  href?: string;
  onClick?: () => void;
  /** Highlights the item (current page / active tool). */
  active?: boolean;
  /** Opens in a new tab (adds `target`/`rel` + an sr-only "opens in new tab"). */
  external?: boolean;
}

export interface FloatingDockProps {
  items: DockItem[];
  /** Pin to the viewport bottom centre (macOS dock). Default: inline. */
  floating?: boolean;
  /** Hide labels (icons only) — useful in tight rails. */
  hideLabels?: boolean;
  className?: string;
}

/**
 * FloatingDock — macOS-style magnifying dock.
 *
 * Micro-interactions: hovering (or keyboard-focusing) an item lifts it and
 * scales it up, while its neighbours scale down with a gaussian falloff —
 * driven by a single animated index, so the whole dock re-flows with one
 * spring. The label springs in above the hovered item only.
 *
 * A11y:
 * • real `<nav>` landmark with an accessible name
 * • every item is a focusable link/button with `aria-label` (the visual
 *   label is `aria-hidden` to avoid double announcement)
 * • keyboard focus triggers the same magnification as hover
 * • `aria-current="page"` marks the active item; external links announce
 *   that they open a new tab
 * • reduced motion swaps springs for instant state changes
 *
 * @example
 * <FloatingDock
 *   floating
 *   items={[
 *     { id: "home", label: "Home", icon: <Icon name="home" size="lg" />, href: "/" },
 *     { id: "search", label: "Search", icon: <Icon name="search" size="lg" />, onClick: openSearch },
 *   ]}
 * />
 */
export function FloatingDock({
  items,
  floating = false,
  hideLabels = false,
  className,
}: FloatingDockProps) {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  /* Gaussian falloff: hovered item blooms, neighbours taper away. */
  const scaleFor = (index: number) => {
    if (activeIndex === null || reduceMotion) return 1;
    const distance = index - activeIndex;
    return 1 + 0.5 * Math.exp(-(distance * distance) / 2.2);
  };

  return (
    <nav
      aria-label="Quick actions"
      className={cn(
        "z-sticky flex justify-center",
        floating && "pointer-events-none fixed inset-x-0 bottom-6",
        className,
      )}
    >
      <ul
        className={cn(
          "rounded-pill pointer-events-auto flex items-end gap-1.5 px-3 py-2",
          "glass shadow-glass",
          "duration-base transition-shadow",
        )}
        onPointerLeave={() => setActiveIndex(null)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setActiveIndex(null);
          }
        }}
      >
        {items.map((item, index) => {
          const isLink = Boolean(item.href);

          const itemProps = {
            "aria-label": item.label,
            onPointerEnter: () => setActiveIndex(index),
            onFocus: () => setActiveIndex(index),
            onBlur: () => setActiveIndex(null),
            className: cn(
              "relative flex size-11 items-center justify-center rounded-full outline-none",
              "transition-colors duration-base ease-out-expo",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aura-violet",
              item.active
                ? "bg-aura-violet/20 text-aura-violet-soft shadow-glow-soft"
                : "text-ink-muted hover:bg-white/[0.07] hover:text-ink",
            ),
          };

          const itemBody = (
            <>
              <span aria-hidden="true" className="flex">
                {item.icon}
              </span>
              {item.external && (
                <span className="sr-only"> (opens in new tab)</span>
              )}
            </>
          );

          return (
            <motion.li
              key={item.id}
              className="relative"
              animate={{ scale: scaleFor(index) }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 380, damping: 24, mass: 0.6 }
              }
              style={{ transformOrigin: "bottom center" }}
            >
              {isLink ? (
                <a
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer noopener" : undefined}
                  aria-current={item.active ? "page" : undefined}
                  {...itemProps}
                >
                  {itemBody}
                </a>
              ) : (
                <button type="button" onClick={item.onClick} {...itemProps}>
                  {itemBody}
                </button>
              )}

              {/* visual label — aria-hidden because the control already carries it */}
              {!hideLabels && (
                <AnimatePresence>
                  {activeIndex === index && (
                    <motion.span
                      aria-hidden="true"
                      initial={{ opacity: 0, y: 6, scale: 0.94 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.96 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className={cn(
                        "pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2",
                        "border-line-strong bg-overlay rounded-md border px-2 py-1 whitespace-nowrap",
                        "text-ink shadow-glass text-micro font-medium",
                      )}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              )}
            </motion.li>
          );
        })}
      </ul>
    </nav>
  );
}

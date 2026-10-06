"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

export interface RevealProps {
  children: React.ReactNode;
  /** Fade + rise distance in px. */
  y?: number;
  /** Stagger delay in seconds. */
  delay?: number;
  /** Animate only once (leave `true` for content that scrolls away). */
  once?: boolean;
  /** Duration in seconds. */
  duration?: number;
  /** Set `false` to render plain markup (static builds / SSR-first pages). */
  animate?: boolean;
  className?: string;
}

/**
 * Reveal — scroll-triggered entrance (fade + rise) built on Framer Motion.
 *
 * A11y: honours `prefers-reduced-motion` — when the user asks for less
 * motion the wrapper renders static, fully visible markup (never content
 * stuck at `opacity: 0`).
 *
 * @example
 * <Reveal delay={0.12}>…</Reveal>
 */
export function Reveal({
  children,
  y = 24,
  delay = 0,
  once = true,
  duration = 0.7,
  animate = true,
  className,
}: RevealProps) {
  const reduceMotion = useReducedMotion();

  if (!animate || reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-8% 0px -8% 0px" }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

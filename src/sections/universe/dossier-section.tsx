"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";

import { Icon } from "@/components";
import type { IconName } from "@/lib/icons";

/* ────────────────────────────────────────────────────────────────────────── *
 * Dossier section kit — the shared presentation layer behind the immersive
 * project dossier's tabbed bodies.
 *
 * `EASE` / the stagger variants / `Section` used to live inside
 * project-detail-panel; they moved here so the tab bodies (dossier-tabs)
 * and the panel shell can share them without importing each other.
 * The markup and timing are unchanged — the default Overview renders the
 * same elements it always did.
 * ────────────────────────────────────────────────────────────────────────── */

/** Shared entrance easing — same family as the HUD's glass transitions. */
export const EASE = [0.16, 1, 0.3, 1] as const;

/** Staggered reveal for the panel's sections. */
export const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.12 } },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

/** One labelled block inside a dossier tab (staggered like the rest). */
export function Section({
  label,
  icon,
  children,
}: {
  label: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <motion.section variants={itemVariants}>
      <p
        className="eyebrow mb-2.5 flex items-center gap-1.5"
        /* Inline so it beats `.eyebrow`'s tertiary ink — section labels must
           stay readable over whatever passes behind the glass. */
        style={{ color: "var(--ink-secondary)" }}
      >
        <Icon name={icon} size="xs" />
        {label}
      </p>
      {children}
    </motion.section>
  );
}

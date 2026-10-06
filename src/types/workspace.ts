/**
 * Workspace — the multi-universe layer that sits on top of the built-in
 * Astra graph.
 *
 * The stock `/universe` scene renders `PROJECTS` from `@/data` unchanged.
 * On top of that, a user may create any number of *universes*: each one is
 * a fully procedural solar system (planets derived from project modules,
 * stars, orbital paths, particles, labels and metadata) generated from a
 * small form + a seed. Everything persisted here lives in localStorage via
 * `stores/workspace-store.ts`; the 3D scene never imports this file — it
 * consumes the `Project[]` shape the generator emits.
 *
 * Design rules:
 *   • `UniverseRecord` is the *authoritative persisted form*: name, seed and
 *     the scene inputs the generator needs. The generated `Project[]` is
 *     derived deterministically from it (never stored twice).
 *   • Per-planet workspace data (tasks, notes, documents, meta) is keyed by
 *     planet id and overlaid onto the generated scene at read time.
 *   • Dates are epoch milliseconds; ISO strings only at the generator edge
 *     where `Project` requires them.
 */

import type { IconName } from "@/lib/icons";

/* ── Themes & styles ──────────────────────────────────────────────────────── */

export interface UniverseTheme {
  id: string;
  label: string;
  /** CSS custom-property overrides applied under `[data-theme="…"]`. */
  vars: Record<string, string>;
  /** Accent used by generated planet palettes (hex). */
  accent: string;
  /** Secondary accent (hex). */
  accent2: string;
}

export interface PlanetStyle {
  id: string;
  label: string;
  /** 0 = rocky worlds with continents, 1 = banded gas giants. */
  bands: number;
  /** Spin magnitude range (rad/s). */
  spin: [number, number];
  /** Seed noise scale — controls surface character. */
  noise: number;
}

/* ── Planet workspace data ────────────────────────────────────────────────── */

export interface PlanetMeta {
  /** Rename overlay — replaces the generated module name when set. */
  name?: string;
  /** Icon registry name shown in the panel header chip. */
  icon: IconName;
  /** Emoji fallback / thumbnail glyph. */
  emoji: string;
  /** Optional image URL for a thumbnail / project logo. */
  image?: string;
  /** Override completion % (null = derive from generated progress). */
  completion?: number | null;
  /** Explicit task count override (null = count of `tasks`). */
  taskCount?: number | null;
  /** User-authored AI summary override. */
  aiSummary?: string;
  /** Linked GitHub repository (overrides the generated one). */
  repo?: string;
  /** Due date, epoch ms. */
  dueAt?: number | null;
  /** Custom planet colour (hex) — overrides the generated palette. */
  color?: string;
}

export interface PlanetTask {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
  planetId: string;
}

export interface PlanetNote {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
  planetId: string;
}

export interface PlanetDocument {
  id: string;
  name: string;
  kind: string;
  sizeKb: number;
  updatedAt: number;
  planetId: string;
}

export interface PlanetActivity {
  id: string;
  planetId: string;
  text: string;
  at: number;
}

/* ── Universe record ──────────────────────────────────────────────────────── */

export type UniversePrivacy = "private" | "team" | "public";

/**
 * The persisted universe. `seed` + the form fields are enough to rebuild the
 * whole solar system deterministically, so the generated scene is never
 * duplicated in storage.
 */
export interface UniverseRecord {
  id: string;
  name: string;
  description: string;
  /** `UniverseTheme.id`. */
  themeId: string;
  /** `PlanetStyle.id`. */
  planetStyleId: string;
  /** Cover image URL (or data URI) for manager cards. */
  cover: string;
  teamMembers: string[];
  /** AI model label shown on the card + panel. */
  aiModel: string;
  privacy: UniversePrivacy;
  /** `owner/repo` (display only — no network). */
  githubRepo: string;
  /** Project deadline, epoch ms. */
  deadline: number | null;
  tags: string[];
  /** Procedural seed — the single source of visual uniqueness. */
  seed: number;
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
  archived: boolean;
  /** `Folder.id` or null. */
  folderId: string | null;
  /** Manual sort order (drag-and-drop in the manager). */
  order: number;
  /** Per-planet workspace overlays, keyed by planet id. */
  planetMeta: Record<string, PlanetMeta>;
  planetTasks: Record<string, PlanetTask[]>;
  planetNotes: Record<string, PlanetNote[]>;
  planetDocs: Record<string, PlanetDocument[]>;
  planetActivity: Record<string, PlanetActivity[]>;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export type NotificationKind = "info" | "success" | "warning" | "achievement";

export interface WorkspaceNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: number;
  read: boolean;
  /** Optional deep link (route). */
  href?: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  unlockedAt: number | null;
}

/* ── Form shapes (Create Universe modal) ──────────────────────────────────── */

export interface UniverseForm {
  name: string;
  description: string;
  themeId: string;
  planetStyleId: string;
  cover: string;
  teamMembers: string[];
  aiModel: string;
  privacy: UniversePrivacy;
  githubRepo: string;
  /** ISO date string from the date input, or "". */
  deadline: string;
  tags: string[];
}

/* ── Constants ────────────────────────────────────────────────────────────── */

export const THEMES: readonly UniverseTheme[] = [
  {
    id: "nebula",
    label: "Nebula Violet",
    accent: "#8b5cf6",
    accent2: "#22d3ee",
    vars: {},
  },
  {
    id: "aurora",
    label: "Aurora Cyan",
    accent: "#22d3ee",
    accent2: "#a78bfa",
    vars: {
      "--palette-violet": "#22d3ee",
      "--palette-violet-soft": "#67e8f9",
      "--palette-fuchsia": "#34d399",
      "--border-aura": "rgba(34,211,238,0.32)",
      "--shadow-glow-violet": "0 0 44px rgba(34,211,238,0.30)",
    },
  },
  {
    id: "ember",
    label: "Ember Rose",
    accent: "#f43f5e",
    accent2: "#fb923c",
    vars: {
      "--palette-violet": "#f43f5e",
      "--palette-violet-soft": "#fda4af",
      "--palette-fuchsia": "#fb923c",
      "--border-aura": "rgba(244,63,94,0.32)",
      "--shadow-glow-violet": "0 0 44px rgba(244,63,94,0.28)",
    },
  },
  {
    id: "verdant",
    label: "Verdant Teal",
    accent: "#2dd4bf",
    accent2: "#4ade80",
    vars: {
      "--palette-violet": "#2dd4bf",
      "--palette-violet-soft": "#5eead4",
      "--palette-fuchsia": "#4ade80",
      "--border-aura": "rgba(45,212,191,0.32)",
      "--shadow-glow-violet": "0 0 44px rgba(45,212,191,0.28)",
    },
  },
  {
    id: "solar",
    label: "Solar Gold",
    accent: "#fbbf24",
    accent2: "#f59e0b",
    vars: {
      "--palette-violet": "#fbbf24",
      "--palette-violet-soft": "#fcd34d",
      "--palette-fuchsia": "#f59e0b",
      "--border-aura": "rgba(251,191,36,0.30)",
      "--shadow-glow-violet": "0 0 44px rgba(251,191,36,0.26)",
    },
  },
];

export const PLANET_STYLES: readonly PlanetStyle[] = [
  {
    id: "terra",
    label: "Terra",
    bands: 0.15,
    spin: [0.04, 0.1],
    noise: 1.0,
  },
  {
    id: "gas",
    label: "Gas giant",
    bands: 0.92,
    spin: [0.06, 0.14],
    noise: 0.7,
  },
  {
    id: "crystal",
    label: "Crystal",
    bands: 0.35,
    spin: [0.03, 0.08],
    noise: 1.4,
  },
  {
    id: "molten",
    label: "Molten",
    bands: 0.55,
    spin: [0.05, 0.12],
    noise: 1.2,
  },
  {
    id: "ice",
    label: "Ice",
    bands: 0.45,
    spin: [0.02, 0.06],
    noise: 0.9,
  },
];

export const AI_MODELS = [
  "Astra-4 Ultra",
  "Astra-4 Pro",
  "Astra-4 Flash",
  "Orion Reasoner",
  "Quasar Code",
] as const;

export const COVER_PRESETS = [
  "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1200&q=60",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=60",
  "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1200&q=60",
  "https://images.unsplash.com/photo-1464802686167-b939a6910659?auto=format&fit=crop&w=1200&q=60",
  "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=60",
  "https://images.unsplash.com/photo-1543722530-d2c3201371e7?auto=format&fit=crop&w=1200&q=60",
] as const;

export const DEFAULT_AI_MODEL = "Astra-4 Pro";

/** Deterministic fallback cover when none is chosen (CSS gradient, no fetch). */
export function fallbackCover(seed: number): string {
  return `linear-gradient(${120 + (seed % 180)}deg, #0b0b16 0%, #14142b 45%, #1c1340 100%)`;
}

export function themeById(id: string): UniverseTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function styleById(id: string): PlanetStyle {
  return PLANET_STYLES.find((s) => s.id === id) ?? PLANET_STYLES[0];
}

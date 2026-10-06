"use client";

import * as React from "react";
import { useShallow } from "zustand/react/shallow";

import {
  useWorkspaceStore,
  type WorkspaceBackup,
  type WorkspaceState,
} from "@/stores";
import type {
  Achievement,
  Folder,
  PlanetActivity,
  PlanetDocument,
  PlanetMeta,
  PlanetNote,
  PlanetTask,
  UniverseRecord,
  WorkspaceNotification,
} from "@/types/workspace";

/* ────────────────────────────────────────────────────────────────────────── *
 * Workspace hooks — the only sanctioned path from sections/components to
 * `stores/workspace-store` (dependency rule: never import `stores/`).
 *
 * Two access shapes, mirroring the timeline hooks:
 *   - selectors (`useUniverses`, `useActiveUniverse`, …) subscribe, for
 *     lists and panels that render workspace state;
 *   - `workspaceActions()` is the imperative grab-bag for event handlers
 *     and non-React code (the shell's scene sync, the command palette).
 *
 * `useWorkspaceHydrated()` gates client-only UI so a fresh profile never
 * flashes the empty manager while localStorage is being read.
 * ────────────────────────────────────────────────────────────────────────── */

/** Every store action in one object — stable reference, call from handlers. */
export function workspaceActions() {
  return useWorkspaceStore.getState();
}

/** True once localStorage has been read (gate first-paint UI on this). */
export function useWorkspaceHydrated(): boolean {
  return useWorkspaceStore((state) => state.hydrated);
}

/* ── universes ─────────────────────────────────────────────────────────── */

export function useUniverses(options?: { includeArchived?: boolean }): UniverseRecord[] {
  const includeArchived = options?.includeArchived ?? false;
  /* Shallow-compares the derived array — a fresh filter result per call
     would otherwise trip useSyncExternalStore's snapshot loop guard. */
  return useWorkspaceStore(
    useShallow((state) =>
      includeArchived
        ? state.universes
        : state.universes.filter((universe) => !universe.archived),
    ),
  );
}

export function useUniverseRecord(
  id: string | null | undefined,
): UniverseRecord | null {
  return useWorkspaceStore((state) =>
    id ? (state.universes.find((universe) => universe.id === id) ?? null) : null,
  );
}

/**
 * The universe `/universe` renders — `null` means the built-in stock graph
 * (and a dangling id also resolves to `null`, so the scene always has a
 * record to show or the untouched default).
 */
export function useActiveUniverseRecord(): UniverseRecord | null {
  return useWorkspaceStore((state) => {
    if (!state.activeUniverseId) return null;
    return (
      state.universes.find((u) => u.id === state.activeUniverseId) ?? null
    );
  });
}

/** Raw selection — the shell keys its scene subtree off this. */
export function useActiveUniverseId(): string | null {
  return useWorkspaceStore((state) => state.activeUniverseId);
}

export function useUniverseCount(): number {
  return useWorkspaceStore((state) => state.universes.length);
}

/* ── chrome ────────────────────────────────────────────────────────────── */

export function useFolders(): Folder[] {
  return useWorkspaceStore((state) => state.folders);
}

export function useNotifications(): WorkspaceNotification[] {
  return useWorkspaceStore((state) => state.notifications);
}

export function useUnreadCount(): number {
  return useWorkspaceStore(
    (state) => state.notifications.reduce((n, item) => (item.read ? n : n + 1), 0),
  );
}

export function useAchievements(): Achievement[] {
  return useWorkspaceStore((state) => state.achievements);
}

export function useBackups(): WorkspaceBackup[] {
  return useWorkspaceStore((state) => state.backups);
}

export function useStreak(): { count: number; lastDay: string } {
  return useWorkspaceStore((state) => state.streak);
}

export function useTourSeen(): boolean {
  return useWorkspaceStore((state) => state.tourSeen);
}

/* ── per-planet workspace data ─────────────────────────────────────────── */

/**
 * Workspace overlays for one planet — tasks/notes/docs/meta/activity.
 * `null` until its universe record is hydrated (generated universes only;
 * the stock graph has no record and renders `null` everywhere too).
 */
export function usePlanetWorkspace(
  universeId: string | null,
  planetId: string | null,
): {
  meta: PlanetMeta | null;
  tasks: PlanetTask[];
  notes: PlanetNote[];
  documents: PlanetDocument[];
  activity: PlanetActivity[];
} | null {
  const select = React.useCallback(
    (state: WorkspaceState) => {
      if (!universeId || !planetId) return null;
      const record = state.universes.find((u) => u.id === universeId);
      if (!record) return null;
      return {
        meta: record.planetMeta[planetId] ?? null,
        tasks: record.planetTasks[planetId] ?? [],
        notes: record.planetNotes[planetId] ?? [],
        documents: record.planetDocs[planetId] ?? [],
        activity: record.planetActivity[planetId] ?? [],
      };
    },
    [universeId, planetId],
  );
  return useWorkspaceStore(useShallow(select));
}

/** Task counts per planet for one universe (manager cards + HUD badges). */
export function useTaskSummary(
  universeId: string | null,
): { total: number; done: number } {
  return useWorkspaceStore(
    useShallow((state) => {
      const record = universeId
        ? state.universes.find((u) => u.id === universeId)
        : undefined;
      if (!record) return { total: 0, done: 0 };
      let total = 0;
      let done = 0;
      for (const tasks of Object.values(record.planetTasks)) {
        total += tasks.length;
        done += tasks.filter((task) => task.done).length;
      }
      return { total, done };
    }),
  );
}

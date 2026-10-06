"use client";

import * as React from "react";
import { useShallow } from "zustand/react/shallow";

import { generatePlanetActivity } from "@/lib/universe-generator";
import {
  STOCK_SEED,
  useStockWorkspaceStore,
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

export function useUniverses(options?: {
  includeArchived?: boolean;
}): UniverseRecord[] {
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
    id
      ? (state.universes.find((universe) => universe.id === id) ?? null)
      : null,
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
    return state.universes.find((u) => u.id === state.activeUniverseId) ?? null;
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
  return useWorkspaceStore((state) =>
    state.notifications.reduce((n, item) => (item.read ? n : n + 1), 0),
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
export function useTaskSummary(universeId: string | null): {
  total: number;
  done: number;
} {
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

/* ── dossier workspace (stock + generated, one surface) ──────────────────── */

export interface DossierWorkspace {
  meta: PlanetMeta | null;
  tasks: PlanetTask[];
  notes: PlanetNote[];
  documents: PlanetDocument[];
  activity: PlanetActivity[];
  /** Universe seed for deterministic forecasts (`STOCK_SEED` on stock). */
  seedKey: string;
  addTask: (title: string) => void;
  toggleTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  addNote: (title: string, body: string) => void;
  updateNote: (
    noteId: string,
    patch: Partial<Pick<PlanetNote, "title" | "body">>,
  ) => void;
  deleteNote: (noteId: string) => void;
  addDocument: (name: string, kind: string) => void;
  deleteDocument: (documentId: string) => void;
}

/**
 * Per-planet workspace data *and bound actions* for the dossier — the one
 * surface where the stock graph and a generated universe must behave alike.
 *
 * • no active record → the built-in stock scene: data lives in
 *   `stock-workspace` (seeded once per planet from the same generators a
 *   fresh profile sees, then persisted with the user's edits).
 * • otherwise → the universe record's buckets via `usePlanetWorkspace`,
 *   with the workspace store's actions bound to this universe/planet.
 *
 * Dispatch keys off *record presence* — the same condition the shell uses
 * to pick the scene — so a not-yet-hydrated record never mis-seeds the
 * stock bucket or shows generated data over the stock worlds.
 */
export function useDossierWorkspace(planetId: string | null): DossierWorkspace {
  const record = useActiveUniverseRecord();
  const universeId = record?.id ?? null;
  const isStock = record === null;
  const generated = usePlanetWorkspace(universeId, planetId);
  const stockBucket = useStockWorkspaceStore((state) =>
    planetId ? state.planets[planetId] : undefined,
  );

  /* Seed the stock bucket once per planet (idempotent). */
  React.useEffect(() => {
    if (planetId && isStock) {
      useStockWorkspaceStore.getState().ensurePlanet(planetId);
    }
  }, [planetId, isStock]);

  /* Activity is display-only — regenerated per planet on the stock graph. */
  const stockActivity = React.useMemo<PlanetActivity[]>(
    () =>
      !isStock || !planetId
        ? []
        : generatePlanetActivity(
            { seed: STOCK_SEED } as UniverseRecord,
            planetId,
          ),
    [isStock, planetId],
  );

  const actions = React.useMemo(() => {
    /* Narrow once — the guards live in dispatch, so the closures below
       can't rely on TS narrowing of the nullable parameter. */
    const id = planetId ?? "";
    const uid = universeId ?? "";
    const workspace = workspaceActions();
    const stock = () => useStockWorkspaceStore.getState();
    /** Stock edits go to the sibling store; record edits to the workspace. */
    const dispatch = (runStock: () => void, runGenerated: () => void) => {
      if (!id) return;
      if (isStock) runStock();
      else runGenerated();
    };

    return {
      addTask: (title: string) =>
        dispatch(
          () => stock().addTask(id, title),
          () => workspace.addTask(uid, id, title),
        ),
      toggleTask: (taskId: string) =>
        dispatch(
          () => stock().toggleTask(id, taskId),
          () => workspace.toggleTask(uid, id, taskId),
        ),
      deleteTask: (taskId: string) =>
        dispatch(
          () => stock().deleteTask(id, taskId),
          () => workspace.deleteTask(uid, id, taskId),
        ),
      addNote: (title: string, body: string) =>
        dispatch(
          () => stock().addNote(id, title, body),
          () => workspace.addNote(uid, id, title, body),
        ),
      updateNote: (
        noteId: string,
        patch: Partial<Pick<PlanetNote, "title" | "body">>,
      ) =>
        dispatch(
          () => stock().updateNote(id, noteId, patch),
          () => workspace.updateNote(uid, id, noteId, patch),
        ),
      deleteNote: (noteId: string) =>
        dispatch(
          () => stock().deleteNote(id, noteId),
          () => workspace.deleteNote(uid, id, noteId),
        ),
      addDocument: (name: string, kind: string) =>
        dispatch(
          () => stock().addDocument(id, name, kind),
          () => workspace.addDocument(uid, id, name, kind),
        ),
      deleteDocument: (documentId: string) =>
        dispatch(
          () => stock().deleteDocument(id, documentId),
          () => workspace.deleteDocument(uid, id, documentId),
        ),
    };
  }, [isStock, planetId, universeId]);

  const seedKey = record ? String(record.seed) : String(STOCK_SEED);

  return {
    meta: isStock ? null : (generated?.meta ?? null),
    tasks: isStock ? (stockBucket?.tasks ?? []) : (generated?.tasks ?? []),
    notes: isStock ? (stockBucket?.notes ?? []) : (generated?.notes ?? []),
    documents: isStock
      ? (stockBucket?.docs ?? [])
      : (generated?.documents ?? []),
    activity: isStock ? stockActivity : (generated?.activity ?? []),
    seedKey,
    ...actions,
  };
}

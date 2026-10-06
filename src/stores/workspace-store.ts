import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { hashString, int, rngFrom } from "@/lib/prng";
import {
  generatePlanetActivity,
  generatePlanetDocs,
  generatePlanetMeta,
  generatePlanetNotes,
  generatePlanetTasks,
} from "@/lib/universe-generator";
import type {
  Achievement,
  Folder,
  PlanetActivity,
  PlanetDocument,
  PlanetMeta,
  PlanetNote,
  PlanetTask,
  UniverseForm,
  UniverseRecord,
  WorkspaceNotification,
} from "@/types/workspace";

/* ────────────────────────────────────────────────────────────────────────── *
 * Workspace store — every user-created universe, plus the workspace chrome
 * around them (folders, notifications, achievements, streak, backups).
 *
 * Persistence: localStorage through zustand `persist`, but the *write* is
 * debounced (400ms) — dragging a card or typing in a rename fires a state
 * change per keystroke, and 5MB of quota shouldn't be hammered for that.
 * `flushPending()` is registered on `pagehide` so a tab close never drops
 * the last edit; `backup()` snapshots the current universes into a
 * versioned slot, and `exportJson()`/`importJson()` are the portable
 * backup/restore path (download a file, load it back on any machine).
 *
 * Hydration: `persist` rehydrates synchronously from localStorage on the
 * client; `hydrated` flips true afterwards so client-only UI (the manager
 * cards, the tour) never flashes the empty state on first paint. The stock
 * `/universe` scene does not depend on this store at all.
 * ────────────────────────────────────────────────────────────────────────── */

const STORAGE_KEY = "astra.workspace.v1";
const MAX_BACKUPS = 3;
const AUTOSAVE_MS = 400;

export interface WorkspaceBackup {
  id: string;
  at: number;
  /** Universe count at snapshot time (for the backup row's caption). */
  count: number;
  universes: UniverseRecord[];
}

export interface WorkspaceState {
  /** Persisted universes, newest `order` first. */
  universes: UniverseRecord[];
  /**
   * Which universe `/universe` renders — `null` = the built-in stock graph.
   * Persisted so a revisit returns to the same world; a dangling id (the
   * record was deleted) falls back to stock via `useUniverseRecord`.
   */
  activeUniverseId: string | null;
  folders: Folder[];
  notifications: WorkspaceNotification[];
  achievements: Achievement[];
  /** Consecutive active days — incremented once per calendar day. */
  streak: { count: number; lastDay: string };
  backups: WorkspaceBackup[];
  /** Onboarding tour dismissed — never auto-open it again. */
  tourSeen: boolean;
  /** True once localStorage has been read (client-only UI gates on this). */
  hydrated: boolean;
  /** Flip `hydrated` after rehydration (called by `persist`). */
  markHydrated: () => void;

  /* ── universes ─────────────────────────────────────────────────────── */
  createUniverse: (form: UniverseForm) => UniverseRecord;
  /** Point `/universe` at a universe (or `null` for the stock graph). */
  setActiveUniverse: (id: string | null) => void;
  renameUniverse: (id: string, name: string) => void;
  updateUniverse: (id: string, patch: Partial<UniverseRecord>) => void;
  duplicateUniverse: (id: string) => UniverseRecord | null;
  deleteUniverse: (id: string) => void;
  setArchived: (id: string, archived: boolean) => void;
  setFavorite: (id: string, favorite: boolean) => void;
  setFolder: (id: string, folderId: string | null) => void;
  /** Drag-and-drop ordering — `ids` is the full desired order. */
  reorderUniverses: (ids: string[]) => void;

  /* ── folders ───────────────────────────────────────────────────────── */
  createFolder: (name: string, color: string) => Folder;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;

  /* ── per-planet workspace data ─────────────────────────────────────── */
  setPlanetMeta: (
    universeId: string,
    planetId: string,
    patch: Partial<PlanetMeta>,
  ) => void;
  addTask: (universeId: string, planetId: string, title: string) => void;
  toggleTask: (
    universeId: string,
    planetId: string,
    taskId: string,
    done?: boolean,
  ) => void;
  deleteTask: (universeId: string, planetId: string, taskId: string) => void;
  addNote: (
    universeId: string,
    planetId: string,
    title: string,
    body: string,
  ) => void;
  updateNote: (
    universeId: string,
    planetId: string,
    noteId: string,
    patch: Partial<Pick<PlanetNote, "title" | "body">>,
  ) => void;
  deleteNote: (universeId: string, planetId: string, noteId: string) => void;
  addDocument: (
    universeId: string,
    planetId: string,
    name: string,
    kind: string,
  ) => void;
  deleteDocument: (
    universeId: string,
    planetId: string,
    documentId: string,
  ) => void;

  /* ── chrome ────────────────────────────────────────────────────────── */
  notify: (
    notification: Omit<WorkspaceNotification, "id" | "at" | "read">,
  ) => void;
  markNotificationsRead: () => void;
  clearNotifications: () => void;
  unlockAchievement: (id: string) => void;
  /** Bump the daily streak (no-op if today is already counted). */
  touchStreak: () => void;
  setTourSeen: (seen: boolean) => void;

  /* ── backup / portability ──────────────────────────────────────────── */
  backup: () => WorkspaceBackup | null;
  restoreBackup: (id: string) => boolean;
  deleteBackup: (id: string) => void;
  exportJson: () => string;
  importJson: (json: string) => { ok: boolean; count: number; error?: string };
}

/* ── achievements (seeded; unlocked by workspace actions) ──────────────── */

function seedAchievements(): Achievement[] {
  return [
    {
      id: "first-universe",
      name: "First light",
      description: "Create your first universe.",
      icon: "rocket",
      unlockedAt: null,
    },
    {
      id: "curator",
      name: "Curator",
      description: "Hold five universes at once.",
      icon: "boxes",
      unlockedAt: null,
    },
    {
      id: "archivist",
      name: "Archivist",
      description: "Take a manual backup.",
      icon: "shield",
      unlockedAt: null,
    },
    {
      id: "explorer",
      name: "Explorer",
      description: "Open a universe from the manager.",
      icon: "orbit",
      unlockedAt: null,
    },
    {
      id: "streak-3",
      name: "Three suns",
      description: "Three consecutive active days.",
      icon: "zap",
      unlockedAt: null,
    },
    {
      id: "collector",
      name: "Collector",
      description: "Hold ten universes at once.",
      icon: "star",
      unlockedAt: null,
    },
  ];
}

/* ── helpers ───────────────────────────────────────────────────────────── */

const today = () => new Date().toISOString().slice(0, 10);

function slugBase(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return slug || "universe";
}

/** Deterministic seed from the form — same name + fields = same universe. */
function seedFor(form: UniverseForm): number {
  return hashString(
    `${form.name}|${form.description}|${form.tags.join(",")}|${form.themeId}|${form.planetStyleId}`,
  );
}

/** Fill every generated planet's workspace data (tasks/notes/docs/activity). */
function seedPlanetData(record: UniverseRecord): UniverseRecord {
  const meta = generatePlanetMeta(record);
  const planetTasks: Record<string, PlanetTask[]> = {};
  const planetNotes: Record<string, PlanetNote[]> = {};
  const planetDocs: Record<string, PlanetDocument[]> = {};
  const planetActivity: Record<string, PlanetActivity[]> = {};

  for (const planetId of Object.keys(meta)) {
    planetTasks[planetId] = generatePlanetTasks(record, planetId);
    planetNotes[planetId] = generatePlanetNotes(record, planetId);
    planetDocs[planetId] = generatePlanetDocs(record, planetId);
    planetActivity[planetId] = generatePlanetActivity(record, planetId);
  }

  return { ...record, planetMeta: meta, planetTasks, planetNotes, planetDocs, planetActivity };
}

/* ── debounced storage ─────────────────────────────────────────────────── */

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pendingValue: string | null = null;
let pendingKey: string | null = null;

/**
 * localStorage with a debounced `setItem`. `persist` calls `setItem` on
 * every state change; batching keeps typing/dragging cheap while the
 * `pagehide` flush below guarantees durability.
 */
const debouncedStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    pendingKey = key;
    pendingValue = value;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = undefined;
      if (pendingKey !== null && pendingValue !== null) {
        try {
          window.localStorage.setItem(pendingKey, pendingValue);
        } catch {
          /* Quota exceeded — the in-memory state stays authoritative. */
        }
        pendingKey = null;
        pendingValue = null;
      }
    }, AUTOSAVE_MS);
  },
  removeItem: (key: string): void => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  },
};

/** Write the debounced value immediately (tab close / route change). */
export function flushWorkspace(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  if (pendingKey !== null && pendingValue !== null) {
    try {
      window.localStorage.setItem(pendingKey, pendingValue);
    } catch {
      /* ignore */
    }
    pendingKey = null;
    pendingValue = null;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushWorkspace);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushWorkspace();
  });
}

/* ── store ─────────────────────────────────────────────────────────────── */

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => {
      /** Immutable in-place update of one universe. */
      const patchUniverse = (
        id: string,
        patch: Partial<UniverseRecord> | ((u: UniverseRecord) => Partial<UniverseRecord>),
      ) =>
        set((state) => ({
          universes: state.universes.map((universe) =>
            universe.id === id
              ? {
                  ...universe,
                  ...(typeof patch === "function" ? patch(universe) : patch),
                  updatedAt: Date.now(),
                }
              : universe,
          ),
        }));

      /** Append workspace data to one planet of one universe. */
      const appendPlanet = (
        universeId: string,
        planetId: string,
        key: "planetTasks" | "planetNotes" | "planetDocs",
        make: (
          record: UniverseRecord,
        ) => PlanetTask[] | PlanetNote[] | PlanetDocument[],
      ) =>
        set((state) => ({
          universes: state.universes.map((universe) => {
            if (universe.id !== universeId) return universe;
            const bucket = universe[key] as Record<
              string,
              PlanetTask[] | PlanetNote[] | PlanetDocument[]
            >;
            return {
              ...universe,
              [key]: { ...bucket, [planetId]: make(universe) },
              updatedAt: Date.now(),
            } as UniverseRecord;
          }),
        }));

      return {
        universes: [],
        activeUniverseId: null,
        folders: [],
        notifications: [],
        achievements: seedAchievements(),
        streak: { count: 0, lastDay: "" },
        backups: [],
        tourSeen: false,
        hydrated: false,

        markHydrated: () => set({ hydrated: true }),

        /* ── universes ───────────────────────────────────────────────── */

        createUniverse: (form) => {
          const now = Date.now();          const record: UniverseRecord = {
            id: `${slugBase(form.name)}-${now.toString(36)}`,
            name: form.name.trim() || "Untitled universe",
            description: form.description.trim(),
            themeId: form.themeId,
            planetStyleId: form.planetStyleId,
            cover: form.cover,
            teamMembers: form.teamMembers,
            aiModel: form.aiModel,
            privacy: form.privacy,
            githubRepo: form.githubRepo.trim(),
            deadline: form.deadline ? Date.parse(form.deadline) : null,
            tags: form.tags,
            seed: seedFor(form),
            createdAt: now,
            updatedAt: now,
            favorite: false,
            archived: false,
            folderId: null,
            order: -now,
            planetMeta: {},
            planetTasks: {},
            planetNotes: {},
            planetDocs: {},
            planetActivity: {},
          };
          const seeded = seedPlanetData(record);

          set((current) => ({
            universes: [seeded, ...current.universes],
            notifications: [
              {
                id: `n-${now}`,
                kind: "success" as const,
                title: "Universe created",
                body: `${seeded.name} is online — its solar system is generating.`,
                at: now,
                read: false,
              },
              ...current.notifications,
            ].slice(0, 40),
          }));

          const achievements = get().achievements;
          if (!achievements.find((a) => a.id === "first-universe")?.unlockedAt) {
            get().unlockAchievement("first-universe");
          }
          if (get().universes.length >= 5) get().unlockAchievement("curator");
          if (get().universes.length >= 10) get().unlockAchievement("collector");
          return seeded;
        },

        setActiveUniverse: (id) => {
          if (id !== null && !get().universes.some((u) => u.id === id)) return;
          if (get().activeUniverseId === id) return;
          set({ activeUniverseId: id });
          if (id !== null) get().unlockAchievement("explorer");
        },

        renameUniverse: (id, name) => {
          const trimmed = name.trim();
          if (!trimmed) return;
          patchUniverse(id, { name: trimmed });
        },

        updateUniverse: (id, patch) => patchUniverse(id, patch),

        duplicateUniverse: (id) => {
          const source = get().universes.find((u) => u.id === id);
          if (!source) return null;
          const now = Date.now();
          const copy: UniverseRecord = {
            ...source,
            id: `${slugBase(source.name)}-copy-${now.toString(36)}`,
            name: `${source.name} copy`,
            createdAt: now,
            updatedAt: now,
            favorite: false,
            order: -now,
          };
          set((state) => ({ universes: [copy, ...state.universes] }));
          return copy;
        },

        deleteUniverse: (id) =>
          set((state) => ({
            universes: state.universes.filter((u) => u.id !== id),
            /* Deleting the live universe drops `/universe` back to stock. */
            activeUniverseId:
              state.activeUniverseId === id ? null : state.activeUniverseId,
          })),

        setArchived: (id, archived) => patchUniverse(id, { archived }),

        setFavorite: (id, favorite) => patchUniverse(id, { favorite }),

        setFolder: (id, folderId) => patchUniverse(id, { folderId }),

        reorderUniverses: (ids) =>
          set((state) => {
            const byId = new Map(state.universes.map((u) => [u.id, u]));
            const ordered: UniverseRecord[] = [];
            for (const id of ids) {
              const universe = byId.get(id);
              if (universe) {
                ordered.push(universe);
                byId.delete(id);
              }
            }
            // Anything not mentioned keeps its relative tail position.
            for (const universe of byId.values()) ordered.push(universe);
            return { universes: ordered };
          }),

        /* ── folders ─────────────────────────────────────────────────── */

        createFolder: (name, color) => {
          const folder: Folder = {
            id: `f-${Date.now().toString(36)}`,
            name: name.trim() || "Untitled",
            color,
            createdAt: Date.now(),
          };
          set((state) => ({ folders: [...state.folders, folder] }));
          return folder;
        },

        renameFolder: (id, name) =>
          set((state) => ({
            folders: state.folders.map((folder) =>
              folder.id === id ? { ...folder, name: name.trim() } : folder,
            ),
          })),

        deleteFolder: (id) =>
          set((state) => ({
            folders: state.folders.filter((folder) => folder.id !== id),
            universes: state.universes.map((universe) =>
              universe.folderId === id ? { ...universe, folderId: null } : universe,
            ),
          })),

        /* ── per-planet workspace data ───────────────────────────────── */

        setPlanetMeta: (universeId, planetId, patch) =>
          set((state) => ({
            universes: state.universes.map((universe) =>
              universe.id === universeId
                ? {
                    ...universe,
                    planetMeta: {
                      ...universe.planetMeta,
                      [planetId]: {
                        ...universe.planetMeta[planetId],
                        ...patch,
                      },
                    },
                    updatedAt: Date.now(),
                  }
                : universe,
            ),
          })),

        addTask: (universeId, planetId, title) => {
          const trimmed = title.trim();
          if (!trimmed) return;
          appendPlanet(universeId, planetId, "planetTasks", (record) => [
            ...(record.planetTasks[planetId] ?? []),
            {
              id: `t-${Date.now().toString(36)}-${int(rngFrom(planetId), 0, 999)}`,
              planetId,
              title: trimmed,
              done: false,
              createdAt: Date.now(),
            },
          ]);
        },

        toggleTask: (universeId, planetId, taskId, done) =>
          set((state) => ({
            universes: state.universes.map((universe) =>
              universe.id === universeId
                ? {
                    ...universe,
                    planetTasks: {
                      ...universe.planetTasks,
                      [planetId]: (universe.planetTasks[planetId] ?? []).map(
                        (task) =>
                          task.id === taskId
                            ? { ...task, done: done ?? !task.done }
                            : task,
                      ),
                    },
                    updatedAt: Date.now(),
                  }
                : universe,
            ),
          })),

        deleteTask: (universeId, planetId, taskId) =>
          set((state) => ({
            universes: state.universes.map((universe) =>
              universe.id === universeId
                ? {
                    ...universe,
                    planetTasks: {
                      ...universe.planetTasks,
                      [planetId]: (universe.planetTasks[planetId] ?? []).filter(
                        (task) => task.id !== taskId,
                      ),
                    },
                    updatedAt: Date.now(),
                  }
                : universe,
            ),
          })),

        addNote: (universeId, planetId, title, body) => {
          if (!title.trim() && !body.trim()) return;
          appendPlanet(universeId, planetId, "planetNotes", (record) => [
            ...(record.planetNotes[planetId] ?? []),
            {
              id: `note-${Date.now().toString(36)}`,
              planetId,
              title: title.trim() || "Untitled note",
              body: body.trim(),
              updatedAt: Date.now(),
            },
          ]);
        },

        updateNote: (universeId, planetId, noteId, patch) =>
          set((state) => ({
            universes: state.universes.map((universe) =>
              universe.id === universeId
                ? {
                    ...universe,
                    planetNotes: {
                      ...universe.planetNotes,
                      [planetId]: (universe.planetNotes[planetId] ?? []).map(
                        (note) =>
                          note.id === noteId
                            ? { ...note, ...patch, updatedAt: Date.now() }
                            : note,
                      ),
                    },
                    updatedAt: Date.now(),
                  }
                : universe,
            ),
          })),

        deleteNote: (universeId, planetId, noteId) =>
          set((state) => ({
            universes: state.universes.map((universe) =>
              universe.id === universeId
                ? {
                    ...universe,
                    planetNotes: {
                      ...universe.planetNotes,
                      [planetId]: (universe.planetNotes[planetId] ?? []).filter(
                        (note) => note.id !== noteId,
                      ),
                    },
                    updatedAt: Date.now(),
                  }
                : universe,
            ),
          })),

        addDocument: (universeId, planetId, name, kind) => {
          const trimmed = name.trim();
          if (!trimmed) return;
          appendPlanet(universeId, planetId, "planetDocs", (record) => [
            ...(record.planetDocs[planetId] ?? []),
            {
              id: `doc-${Date.now().toString(36)}`,
              planetId,
              name: trimmed,
              kind,
              sizeKb: int(rngFrom(trimmed), 4, 940),
              updatedAt: Date.now(),
            },
          ]);
        },

        deleteDocument: (universeId, planetId, documentId) =>
          set((state) => ({
            universes: state.universes.map((universe) =>
              universe.id === universeId
                ? {
                    ...universe,
                    planetDocs: {
                      ...universe.planetDocs,
                      [planetId]: (universe.planetDocs[planetId] ?? []).filter(
                        (doc) => doc.id !== documentId,
                      ),
                    },
                    updatedAt: Date.now(),
                  }
                : universe,
            ),
          })),

        /* ── chrome ──────────────────────────────────────────────────── */

        notify: (notification) =>
          set((state) => ({
            notifications: [
              {
                ...notification,
                id: `n-${Date.now().toString(36)}`,
                at: Date.now(),
                read: false,
              },
              ...state.notifications,
            ].slice(0, 40),
          })),

        markNotificationsRead: () =>
          set((state) => ({
            notifications: state.notifications.map((n) =>
              n.read ? n : { ...n, read: true },
            ),
          })),

        clearNotifications: () => set({ notifications: [] }),

        unlockAchievement: (id) => {
          const existing = get().achievements.find((a) => a.id === id);
          if (!existing || existing.unlockedAt) return;
          const at = Date.now();
          set((state) => ({
            achievements: state.achievements.map((achievement) =>
              achievement.id === id ? { ...achievement, unlockedAt: at } : achievement,
            ),
            notifications: [
              {
                id: `n-${at}`,
                kind: "achievement" as const,
                title: `Achievement · ${existing.name}`,
                body: existing.description,
                at,
                read: false,
              },
              ...state.notifications,
            ].slice(0, 40),
          }));
        },

        touchStreak: () => {
          const day = today();
          const { count, lastDay } = get().streak;
          if (lastDay === day) return;
          const yesterday = new Date(Date.now() - 86_400_000)
            .toISOString()
            .slice(0, 10);
          const next = lastDay === yesterday ? count + 1 : 1;
          set({ streak: { count: next, lastDay: day } });
          if (next >= 3) get().unlockAchievement("streak-3");
        },

        setTourSeen: (seen) => set({ tourSeen: seen }),

        /* ── backup / portability ────────────────────────────────────── */

        backup: () => {
          const { universes, backups } = get();
          if (universes.length === 0) return null;
          const snapshot: WorkspaceBackup = {
            id: `b-${Date.now().toString(36)}`,
            at: Date.now(),
            count: universes.length,
            universes: structuredClone(universes),
          };
          set({
            backups: [snapshot, ...backups].slice(0, MAX_BACKUPS),
          });
          get().unlockAchievement("archivist");
          return snapshot;
        },

        restoreBackup: (id) => {
          const snapshot = get().backups.find((b) => b.id === id);
          if (!snapshot) return false;
          set({ universes: structuredClone(snapshot.universes) });
          return true;
        },

        deleteBackup: (id) =>
          set((state) => ({
            backups: state.backups.filter((b) => b.id !== id),
          })),

        exportJson: () => {
          const { universes, folders, achievements, streak } = get();
          return JSON.stringify(
            {
              app: "astra-os",
              kind: "workspace",
              version: 1,
              exportedAt: Date.now(),
              universes,
              folders,
              achievements,
              streak,
            },
            null,
            2,
          );
        },

        importJson: (json) => {
          try {
            const parsed = JSON.parse(json) as {
              app?: string;
              kind?: string;
              universes?: UniverseRecord[];
              folders?: Folder[];
            };
            if (parsed.kind !== "workspace" || !Array.isArray(parsed.universes)) {
              return { ok: false, count: 0, error: "Not an Astra workspace file." };
            }
            const existing = new Set(get().universes.map((u) => u.id));
            const incoming = parsed.universes.filter((u) => u && u.id && !existing.has(u.id));
            if (incoming.length === 0) {
              return { ok: false, count: 0, error: "Nothing new to import." };
            }
            set((state) => ({
              universes: [...state.universes, ...incoming],
              folders: [...state.folders, ...(parsed.folders ?? [])],
            }));
            return { ok: true, count: incoming.length };
          } catch {
            return { ok: false, count: 0, error: "Invalid JSON." };
          }
        },
      };
    },
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => debouncedStorage),
      /* `hydrated` is runtime, not persisted — flip it after rehydrate. */
      partialize: (state) => ({
        universes: state.universes,
        activeUniverseId: state.activeUniverseId,
        folders: state.folders,
        notifications: state.notifications,
        achievements: state.achievements,
        streak: state.streak,
        backups: state.backups,
        tourSeen: state.tourSeen,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);

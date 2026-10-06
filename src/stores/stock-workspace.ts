import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { hashString, int, rngFrom } from "@/lib/prng";
import {
  generatePlanetDocs,
  generatePlanetNotes,
  generatePlanetTasks,
} from "@/lib/universe-generator";
import type {
  PlanetDocument,
  PlanetNote,
  PlanetTask,
  UniverseRecord,
} from "@/types/workspace";

/* ────────────────────────────────────────────────────────────────────────── *
 * Stock-planet store — tasks / notes / documents for the *built-in* Astra OS
 * graph.
 *
 * The workspace store owns per-planet data for user-created universes (each
 * has an `UniverseRecord`); the stock scene deliberately has no record — the
 * scene must stay byte-identical to the shipped graph, and a record would
 * invite the generator to redraw it. But the dossier's Notes / Tasks /
 * Documents tabs work there too, so this sibling store gives the stock worlds
 * their own persisted bucket, seeded once from the same deterministic
 * generators (STOCK_SEED) a fresh profile would see on every machine.
 *
 * `ensurePlanet` is idempotent — the dossier hook calls it on mount; the
 * first visit seeds, later visits load what the user saved.
 * ────────────────────────────────────────────────────────────────────────── */

const STORAGE_KEY = "astra.stock-planets.v1";

/** Seed for the stock graph's generated planet data. */
export const STOCK_SEED = hashString("Astra OS|stock|scene");

/**
 * The generators only ever read `record.seed`, so a seed-only stand-in is
 * enough to reuse them for the stock worlds without fabricating a record.
 */
const STOCK_RECORD = { seed: STOCK_SEED } as UniverseRecord;

export interface StockPlanetBuckets {
  tasks: PlanetTask[];
  notes: PlanetNote[];
  docs: PlanetDocument[];
}

export interface StockWorkspaceState {
  /** Buckets keyed by stock planet id (`nebula-studio`, …). */
  planets: Record<string, StockPlanetBuckets>;
  /** Seed a planet's buckets once (no-op when already present). */
  ensurePlanet: (planetId: string) => void;
  addTask: (planetId: string, title: string) => void;
  toggleTask: (planetId: string, taskId: string) => void;
  deleteTask: (planetId: string, taskId: string) => void;
  addNote: (planetId: string, title: string, body: string) => void;
  updateNote: (
    planetId: string,
    noteId: string,
    patch: Partial<Pick<PlanetNote, "title" | "body">>,
  ) => void;
  deleteNote: (planetId: string, noteId: string) => void;
  addDocument: (planetId: string, name: string, kind: string) => void;
  deleteDocument: (planetId: string, documentId: string) => void;
}

/** localStorage with the SSR guard the workspace store uses. */
const guardedStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* Quota exceeded — in-memory state stays authoritative. */
    }
  },
  removeItem: (key: string): void => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  },
};

export const useStockWorkspaceStore = create<StockWorkspaceState>()(
  persist(
    (set, get) => ({
      planets: {},

      ensurePlanet: (planetId) => {
        if (get().planets[planetId]) return;
        set((state) => ({
          planets: {
            ...state.planets,
            [planetId]: {
              tasks: generatePlanetTasks(STOCK_RECORD, planetId),
              notes: generatePlanetNotes(STOCK_RECORD, planetId),
              docs: generatePlanetDocs(STOCK_RECORD, planetId),
            },
          },
        }));
      },

      addTask: (planetId, title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((state) => {
          const bucket = state.planets[planetId];
          if (!bucket) return state;
          return {
            planets: {
              ...state.planets,
              [planetId]: {
                ...bucket,
                tasks: [
                  ...bucket.tasks,
                  {
                    id: `t-${Date.now().toString(36)}-${int(rngFrom(planetId), 0, 999)}`,
                    planetId,
                    title: trimmed,
                    done: false,
                    createdAt: Date.now(),
                  },
                ],
              },
            },
          };
        });
      },

      toggleTask: (planetId, taskId) =>
        set((state) => {
          const bucket = state.planets[planetId];
          if (!bucket) return state;
          return {
            planets: {
              ...state.planets,
              [planetId]: {
                ...bucket,
                tasks: bucket.tasks.map((task) =>
                  task.id === taskId ? { ...task, done: !task.done } : task,
                ),
              },
            },
          };
        }),

      deleteTask: (planetId, taskId) =>
        set((state) => {
          const bucket = state.planets[planetId];
          if (!bucket) return state;
          return {
            planets: {
              ...state.planets,
              [planetId]: {
                ...bucket,
                tasks: bucket.tasks.filter((task) => task.id !== taskId),
              },
            },
          };
        }),

      addNote: (planetId, title, body) => {
        if (!title.trim() && !body.trim()) return;
        set((state) => {
          const bucket = state.planets[planetId];
          if (!bucket) return state;
          return {
            planets: {
              ...state.planets,
              [planetId]: {
                ...bucket,
                notes: [
                  ...bucket.notes,
                  {
                    id: `note-${Date.now().toString(36)}`,
                    planetId,
                    title: title.trim() || "Untitled note",
                    body: body.trim(),
                    updatedAt: Date.now(),
                  },
                ],
              },
            },
          };
        });
      },

      updateNote: (planetId, noteId, patch) =>
        set((state) => {
          const bucket = state.planets[planetId];
          if (!bucket) return state;
          return {
            planets: {
              ...state.planets,
              [planetId]: {
                ...bucket,
                notes: bucket.notes.map((note) =>
                  note.id === noteId
                    ? { ...note, ...patch, updatedAt: Date.now() }
                    : note,
                ),
              },
            },
          };
        }),

      deleteNote: (planetId, noteId) =>
        set((state) => {
          const bucket = state.planets[planetId];
          if (!bucket) return state;
          return {
            planets: {
              ...state.planets,
              [planetId]: {
                ...bucket,
                notes: bucket.notes.filter((note) => note.id !== noteId),
              },
            },
          };
        }),

      addDocument: (planetId, name, kind) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => {
          const bucket = state.planets[planetId];
          if (!bucket) return state;
          return {
            planets: {
              ...state.planets,
              [planetId]: {
                ...bucket,
                docs: [
                  ...bucket.docs,
                  {
                    id: `doc-${Date.now().toString(36)}`,
                    planetId,
                    name: trimmed,
                    kind,
                    sizeKb: int(rngFrom(trimmed), 4, 940),
                    updatedAt: Date.now(),
                  },
                ],
              },
            },
          };
        });
      },

      deleteDocument: (planetId, documentId) =>
        set((state) => {
          const bucket = state.planets[planetId];
          if (!bucket) return state;
          return {
            planets: {
              ...state.planets,
              [planetId]: {
                ...bucket,
                docs: bucket.docs.filter((doc) => doc.id !== documentId),
              },
            },
          };
        }),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => guardedStorage),
      partialize: (state) => ({ planets: state.planets }),
    },
  ),
);

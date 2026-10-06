"use client";

import * as React from "react";

import type { Project } from "@/data";
import {
  aggregateInsights,
  computeInsights,
  computePlanetInsight,
  type UniverseInsights,
} from "@/lib/universe-generator";
import { useStockWorkspaceStore, STOCK_SEED } from "@/stores/stock-workspace";
import type { PlanetTask } from "@/types/workspace";
import { useSceneProjects } from "./use-scene-data";
import { useActiveUniverseRecord } from "./use-workspace";

/* ────────────────────────────────────────────────────────────────────────── *
 * Briefing hook — one universe-wide health rollup for the AI surfaces
 * (assistant replies + the insights dashboard). The math lives in
 * `universe-generator` (deterministic, no network); this hook only picks
 * the data source: record → `computeInsights`, stock → per-planet
 * `computePlanetInsight` + `aggregateInsights`, both seeded identically.
 *
 * Components never import stores — this is the sanctioned bridge.
 * ────────────────────────────────────────────────────────────────────────── */

export interface UniverseBriefing {
  /** Scene display name — "Astra OS" on stock, the record's name otherwise. */
  name: string;
  /** Universe-wide rollup: health, risk, forecast, deadlines, actions. */
  insights: UniverseInsights;
  /** Worlds in the active scene. */
  worldCount: number;
  /** Open tasks across every world (0 until stock buckets are seeded). */
  openTasks: number;
  /** Completed tasks across every world. */
  doneTasks: number;
}

/** Sum open/done tasks over per-planet buckets. */
function countTasks(
  projects: readonly Project[],
  tasksFor: (planetId: string) => readonly PlanetTask[],
): { openTasks: number; doneTasks: number } {
  let openTasks = 0;
  let doneTasks = 0;
  for (const project of projects) {
    for (const task of tasksFor(project.id)) {
      if (task.done) doneTasks += 1;
      else openTasks += 1;
    }
  }
  return { openTasks, doneTasks };
}

/**
 * useUniverseBriefing — the live forecast for whatever scene is active.
 *
 * • record present → the record's own meta/tasks through `computeInsights`.
 *   The record comes straight from the workspace store (not `scene.universe`)
 *   so task toggles re-roll the numbers on the very next render — the scene
 *   cache deliberately ignores task edits.
 * • no record → the stock graph: every world's buckets are seeded once
 *   (idempotent, same generators the dossier uses) so task counts and health
 *   match what the dossier shows, then aggregated with `STOCK_SEED`.
 *
 * @example
 * const briefing = useUniverseBriefing();
 * // → { name, insights: { health, riskScore, … }, worldCount, openTasks, doneTasks }
 */
export function useUniverseBriefing(): UniverseBriefing {
  const record = useActiveUniverseRecord();
  const projects = useSceneProjects();
  const stockPlanets = useStockWorkspaceStore((state) => state.planets);

  /* Seed every stock world's buckets once — idempotent, so re-mounts and
     repeated briefings load what the user saved instead of re-rolling. */
  React.useEffect(() => {
    if (record) return;
    const store = useStockWorkspaceStore.getState();
    for (const project of projects) store.ensurePlanet(project.id);
  }, [record, projects]);

  return React.useMemo(() => {
    if (record) {
      const insights = computeInsights(record, { projects });
      return {
        name: record.name,
        insights,
        worldCount: projects.length,
        ...countTasks(projects, (id) => record.planetTasks[id] ?? []),
      };
    }

    const seedKey = String(STOCK_SEED);
    const planets = projects.map((project) =>
      computePlanetInsight(
        project,
        undefined,
        stockPlanets[project.id]?.tasks ?? [],
        seedKey,
      ),
    );
    return {
      name: "Astra OS",
      insights: aggregateInsights(planets, seedKey),
      worldCount: projects.length,
      ...countTasks(projects, (id) => stockPlanets[id]?.tasks ?? []),
    };
  }, [record, projects, stockPlanets]);
}

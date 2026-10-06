"use client";

import * as React from "react";

import type { Project } from "@/data";
import {
  getSceneData,
  sceneProjects,
  subscribeSceneData,
  type SceneData,
} from "@/data/scene-data";

/* ────────────────────────────────────────────────────────────────────────── *
 * Scene hooks — the sanctioned way for React renders to read the active
 * `/universe` scene (dependency rule: module code and `useFrame` read
 * `getSceneData()` directly; React components subscribe here).
 *
 * `useSyncExternalStore` gives tearing-free reads across the concurrent
 * renderer: snapshot on server / first paint, subscribe on the client.
 * Because the scene subtree is keyed by scene id, subscribers remount on a
 * universe swap anyway — the subscription is belt-and-braces for consumers
 * that outlive a switch (the shell itself).
 * ────────────────────────────────────────────────────────────────────────── */

/** The active scene — re-renders on a universe swap. */
export function useSceneData(): SceneData {
  return React.useSyncExternalStore(
    subscribeSceneData,
    getSceneData,
    getSceneData,
  );
}

/**
 * Just the project list — the common render case (`planets.map`, HUD nav,
 * dossier lookup). Narrower selector: components that only iterate worlds
 * don't re-render for ambient-only changes.
 */
export function useSceneProjects(): readonly Project[] {
  return React.useSyncExternalStore(
    subscribeSceneData,
    sceneProjects,
    sceneProjects,
  );
}

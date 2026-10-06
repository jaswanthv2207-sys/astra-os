/**
 * scene-data — the active-scene registry.
 *
 * The `/universe` scene was originally wired straight to `PROJECTS`. The
 * workspace layer turns that array into one instance of many: every universe
 * (the built-in stock graph, or any user-created one) publishes its
 * `{ projects, links, centres }` here before the scene mounts, and every
 * consumer reads `getSceneData()` (module code, effects, `useFrame`) or
 * `useSceneData()` (React renders).
 *
 * Stock parity: with no user universe the registry holds `STOCK_SCENE`,
 * whose `projects`/`links`/`centres` are the exact `PROJECTS`/
 * `PROJECT_LINKS`/`ORBIT_CENTRES` references — so every default path is
 * byte-identical to the pre-workspace build.
 *
 * Timing contract: `setSceneData()` is called during the shell's render
 * (the keyed scene subtree renders *after* the parent, so children read the
 * new scene in the same pass). Subscriber notification is therefore deferred
 * to a microtask — notifying synchronously would setState on live
 * subscribers mid-render. Subscribers live inside the keyed subtree anyway,
 * so they remount on a switch; the deferred notify is belt-and-braces for
 * consumers that outlive a switch.
 */

import type { Project, ProjectLink } from "@/data/projects";
import { ORBIT_CENTRES, PROJECTS, PROJECT_LINKS } from "@/data/projects";
import { generateScene } from "@/lib/universe-generator";
import type { UniverseRecord } from "@/types/workspace";

/** Ambient tuning for a generated universe; `null` = keep stock visuals. */
export interface SceneAmbient {
  /** Star budget the shell feeds `<StarField />`. */
  starCount: number;
  /** Theme-tinted star colour (stock shader colours when absent). */
  starTint: string;
  /** Theme-tinted orbit-ring colour. */
  orbitRingColor: string;
  /** Draw visible orbital rings — deliberately `false` for stock. */
  showOrbitRings: boolean;
  /** Procedural sector name for the HUD. */
  sectorLabel: string;
}

export interface SceneData {
  /** Stable remount key: `"stock"` or the universe id. */
  id: string;
  /** Display name (stock = "Astra OS"). */
  name: string;
  projects: readonly Project[];
  links: readonly ProjectLink[];
  /** Invisible orbit centres — shared geometry across every universe. */
  centres: readonly (readonly [number, number, number])[];
  /** Timeline scrub floor (earliest creation), epoch ms. */
  floor: number;
  /** `null` for stock: every existing visual path stays untouched. */
  ambient: SceneAmbient | null;
  /** The record backing this scene, or `null` for stock. */
  universe: UniverseRecord | null;
}

function floorOf(projects: readonly Project[]): number {
  if (projects.length === 0) return Date.now();
  return Math.min(...projects.map((project) => Date.parse(project.createdAt)));
}

/** The default scene — the pre-workspace universe, by reference. */
export const STOCK_SCENE: SceneData = Object.freeze({
  id: "stock",
  name: "Astra OS",
  projects: PROJECTS,
  links: PROJECT_LINKS,
  centres: ORBIT_CENTRES,
  floor: floorOf(PROJECTS),
  ambient: null,
  universe: null,
});

/* ── registry ─────────────────────────────────────────────────────────────── */

let active: SceneData = STOCK_SCENE;
const listeners = new Set<() => void>();

/** Imperative read — effects, `useFrame`, pure engines. */
export function getSceneData(): SceneData {
  return active;
}

/**
 * Publish the scene. Idempotent (same reference = no-op); safe to call
 * during render because notification is deferred to a microtask.
 */
export function setSceneData(next: SceneData): void {
  if (next === active) return;
  active = next;
  queueMicrotask(() => {
    for (const listener of listeners) listener();
  });
}

/** Subscribe to scene swaps — backing for `useSceneData()`. */
export function subscribeSceneData(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Convenience for engines: the current scene's project list. */
export function sceneProjects(): readonly Project[] {
  return active.projects;
}

/* ── scene building ───────────────────────────────────────────────────────── */

/**
 * Rebuild cache — one entry per universe *id*, holding the signature of the
 * last build. Record mutations (toggling a task, adding a note) produce a
 * new record object every time, but they don't change a single world's
 * orbit, name or overlay — so the cache only regenerates when something the
 * scene actually reads (seed, name, planet meta) has drifted. Without this,
 * every keystroke in a rename field would rebuild nine planets, re-seed the
 * position registry and drop the knowledge beams for a frame.
 */
const built = new Map<string, { signature: string; scene: SceneData }>();

/** Everything a generated scene derives from — nothing else matters. */
function sceneSignature(record: UniverseRecord): string {
  return `${record.seed}|${record.name}|${JSON.stringify(record.planetMeta)}`;
}

/**
 * Build (or fetch) the scene for a universe record — deterministic from the
 * record's seed, so a rebuild always yields the same solar system. User
 * overlays (renamed worlds, custom completion, repo overrides) are merged
 * onto the generated planets here, once, instead of in every consumer.
 */
export function buildUniverseScene(record: UniverseRecord): SceneData {
  const signature = sceneSignature(record);
  const cached = built.get(record.id);
  if (cached && cached.signature === signature) return cached.scene;

  const generated = generateScene(record);
  const projects: Project[] = generated.projects.map((project) => {
    const meta = record.planetMeta[project.id];
    if (!meta) return project;
    return {
      ...project,
      name: meta.name ?? project.name,
      progress:
        typeof meta.completion === "number"
          ? meta.completion
          : project.progress,
      links: {
        repo: meta.repo ?? project.links.repo,
        demo: project.links.demo,
      },
    };
  });

  const scene: SceneData = {
    id: record.id,
    name: record.name,
    projects,
    links: generated.links,
    centres: ORBIT_CENTRES,
    floor: floorOf(projects),
    ambient: {
      starCount: generated.starCount,
      starTint: generated.starTint,
      orbitRingColor: generated.orbitRingColor,
      showOrbitRings: true,
      sectorLabel: generated.sectorLabel,
    },
    universe: record,
  };
  built.set(record.id, { signature, scene });
  return scene;
}

/** Stock scene for `null`, generated scene for a record — the shell's entry. */
export function buildActiveScene(record: UniverseRecord | null): SceneData {
  return record ? buildUniverseScene(record) : STOCK_SCENE;
}

import { buildUniverseScene } from "@/data/scene-data";
import type { UniverseRecord } from "@/types/workspace";

/* ────────────────────────────────────────────────────────────────────────── *
 * Manager data helpers — pure, dependency-free functions behind the
 * Universe Manager's cards, sidebar stats and global search.
 *
 * Everything here is a *derived view* of persisted records: progress comes
 * from the generated scene (cached, deterministic), storage from the JSON
 * each record actually occupies, ordering from `order`/`updatedAt`/name.
 * Nothing mutates; nothing subscribes — components call these in `useMemo`.
 * ────────────────────────────────────────────────────────────────────────── */

/** Average completion across a universe's worlds (0–100). */
export function universeProgress(record: UniverseRecord): number {
  const projects = buildUniverseScene(record).projects;
  if (projects.length === 0) return 0;
  const total = projects.reduce((sum, project) => sum + project.progress, 0);
  return Math.round(total / projects.length);
}

/** Worlds in the generated system (cheap after the first scene build). */
export function universeWorlds(record: UniverseRecord): number {
  return buildUniverseScene(record).projects.length;
}

/** Bytes one record occupies when persisted (≈ what localStorage spends). */
export function recordBytes(record: UniverseRecord): number {
  try {
    return new TextEncoder().encode(JSON.stringify(record)).length;
  } catch {
    return 0;
  }
}

/** "12.4 MB" / "486 KB" — storage analytics formatting. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** localStorage gives ~5 MB; surface how much of it is spoken for. */
export const STORAGE_BUDGET = 5 * 1024 * 1024;

/** Fraction (0–1) of the localStorage budget these universes consume. */
export function storageFraction(records: readonly UniverseRecord[]): number {
  const used = records.reduce((sum, record) => sum + recordBytes(record), 0);
  return Math.min(1, used / STORAGE_BUDGET);
}

/** "just now" · "4m ago" · "3h ago" · "2d ago" · "12 Mar". */
export function relativeTime(at: number, now = Date.now()): string {
  const diff = Math.max(0, now - at);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(at).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/** Days until a deadline — negative = overdue. Null when unset. */
export function daysUntil(
  deadline: number | null,
  now = Date.now(),
): number | null {
  if (deadline === null) return null;
  return Math.ceil((deadline - now) / 86_400_000);
}

export type ManagerView =
  "all" | "favorites" | "recent" | "folders" | "archived";

export interface ManagerQuery {
  view: ManagerView;
  folderId: string | null;
  search: string;
}

/** Case-insensitive match across every field a user would remember. */
export function matchesSearch(record: UniverseRecord, raw: string): boolean {
  const needle = raw.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    record.name,
    record.description,
    record.githubRepo,
    record.aiModel,
    ...record.tags,
    ...record.teamMembers,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

/** Filter → sort in one pass; the sidebar/grid consume this directly. */
export function selectUniverses(
  records: readonly UniverseRecord[],
  query: ManagerQuery,
): UniverseRecord[] {
  let out = records.filter((record) => matchesSearch(record, query.search));

  if (query.folderId) {
    out = out.filter((record) => record.folderId === query.folderId);
  }

  switch (query.view) {
    case "favorites":
      out = out.filter((record) => record.favorite && !record.archived);
      break;
    case "archived":
      out = out.filter((record) => record.archived);
      break;
    case "recent":
      out = out
        .filter((record) => !record.archived)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 12);
      return out;
    case "folders":
      out = out.filter((record) => record.folderId && !record.archived);
      break;
    case "all":
    default:
      out = out.filter((record) => !record.archived);
      break;
  }

  return out;
}

/** Sidebar badge counts, computed once from the raw record list. */
export function viewCounts(
  records: readonly UniverseRecord[],
): Record<ManagerView, number> {
  const live = records.filter((record) => !record.archived);
  return {
    all: live.length,
    favorites: live.filter((record) => record.favorite).length,
    recent: live.length,
    folders: live.filter((record) => record.folderId).length,
    archived: records.length - live.length,
  };
}

/** Tasks done / total across a universe (0,0 when it has none). */
export function taskTotals(record: UniverseRecord): {
  done: number;
  total: number;
} {
  let done = 0;
  let total = 0;
  for (const tasks of Object.values(record.planetTasks)) {
    total += tasks.length;
    done += tasks.filter((task) => task.done).length;
  }
  return { done, total };
}

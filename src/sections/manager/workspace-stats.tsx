"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { Button, Icon, Modal } from "@/components";
import {
  useAchievements,
  useBackups,
  useFolders,
  useNotifications,
  useStreak,
  useUniverses,
  useUnreadCount,
  useWorkspaceHydrated,
} from "@/hooks/use-workspace";
import type { IconName } from "@/lib/icons";
import { cn } from "@/lib/utils";

import {
  formatBytes,
  relativeTime,
  STORAGE_BUDGET,
  taskTotals,
  universeWorlds,
} from "./manager-data";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ────────────────────────────────────────────────────────────────────────── *
 * WorkspaceStats — the manager's numbers screen: what the workspace holds
 * and what it costs in storage. Totals come from the deterministic scene
 * builder (cached, offline); storage is scanned straight out of
 * localStorage on every open so the bars reflect reality, not a guess.
 * ────────────────────────────────────────────────────────────────────────── */

/** Friendly labels for the keys we write — raw key shown when unknown. */
const STORAGE_LABELS: Record<string, string> = {
  "astra.workspace.v1": "Workspace",
  "astra.stock-planets.v1": "Stock planets",
};

interface StorageRow {
  key: string;
  bytes: number;
}

/** Every localStorage key's spend (UTF-16 code units × 2), biggest first. */
function scanStorage(): { rows: StorageRow[]; total: number } {
  if (typeof window === "undefined") return { rows: [], total: 0 };
  const rows: StorageRow[] = [];
  let total = 0;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    const value = window.localStorage.getItem(key) ?? "";
    const bytes = (key.length + value.length) * 2;
    total += bytes;
    rows.push({ key, bytes });
  }
  rows.sort((a, b) => b.bytes - a.bytes);
  return { rows, total };
}

/** One headline number (`dl > div > dt/dd` so screen readers group them). */
function Tile({
  label,
  value,
  caption,
}: {
  label: string;
  value: string | number;
  caption: string;
}) {
  return (
    <div className="border-line/70 rounded-xl border bg-white/[0.03] p-3.5">
      <dt className="text-ink-muted text-micro tracking-caps font-mono">
        {label}
      </dt>
      <dd className="text-ink mt-1.5 font-mono text-2xl leading-none tabular-nums">
        {value}
        <span className="text-ink-faint mt-1.5 block font-sans text-xs font-normal">
          {caption}
        </span>
      </dd>
    </div>
  );
}

/** One storage line: label, spend, share bar. */
function StorageLine({
  row,
  total,
  index,
  reduce,
}: {
  row: StorageRow;
  total: number;
  index: number;
  reduce: boolean;
}) {
  const share = total > 0 ? (row.bytes / total) * 100 : 0;
  return (
    <div title={row.key}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-ink truncate text-xs">
          {STORAGE_LABELS[row.key] ?? row.key}
        </span>
        <span className="text-ink-faint shrink-0 font-mono text-[11px] tabular-nums">
          {formatBytes(row.bytes)} · {share.toFixed(0)}%
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="from-aura-violet to-aura-cyan h-full rounded-full bg-gradient-to-r"
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${share}%` }}
          transition={{
            duration: reduce ? 0 : 0.6,
            ease: EASE,
            delay: reduce ? 0 : 0.1 + index * 0.06,
          }}
        />
      </div>
    </div>
  );
}

/** Compact mono pill for the secondary vitals. */
function Chip({ icon, label }: { icon: IconName; label: string }) {
  return (
    <span className="border-line text-ink-muted inline-flex items-center gap-1.5 rounded-full border bg-white/[0.04] px-2.5 py-1 font-mono text-[11px]">
      <Icon name={icon} size="xs" label="" />
      {label}
    </span>
  );
}

export interface WorkspaceStatsProps {
  /** Open state (owned by the manager toolbar). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The toolbar button — becomes Radix's trigger, so focus returns to it. */
  trigger?: React.ReactNode;
}

/**
 * WorkspaceStats — modal opened from the manager's portability toolbar.
 * Radix Modal gives it the focus trap, Escape and focus-restore contract
 * for free (and, being `role="dialog" aria-modal="true"`, it correctly
 * owns the screen: ⌘K and the map's `M` yield while it is up).
 *
 * @example
 * const [statsOpen, setStatsOpen] = React.useState(false);
 * <WorkspaceStats
 *   open={statsOpen}
 *   onOpenChange={setStatsOpen}
 *   trigger={<Button variant="glass" size="xs">Stats</Button>}
 * />
 */
export function WorkspaceStats({
  open,
  onOpenChange,
  trigger,
}: WorkspaceStatsProps) {
  const reduce = Boolean(useReducedMotion());
  const hydrated = useWorkspaceHydrated();
  const records = useUniverses({ includeArchived: true });
  const folders = useFolders();
  const streak = useStreak();
  const achievements = useAchievements();
  const backups = useBackups();
  const notifications = useNotifications();
  const unread = useUnreadCount();

  const totals = React.useMemo(() => {
    let worlds = 0;
    let tasks = 0;
    let done = 0;
    let lastEdit = 0;
    for (const record of records) {
      worlds += universeWorlds(record);
      const taskCount = taskTotals(record);
      tasks += taskCount.total;
      done += taskCount.done;
      lastEdit = Math.max(lastEdit, record.updatedAt);
    }
    return {
      worlds,
      tasks,
      done,
      lastEdit,
      archived: records.filter((record) => record.archived).length,
      unlocked: achievements.filter((item) => item.unlockedAt !== null).length,
    };
  }, [records, achievements]);

  /* Rescan whenever the dialog opens, so edits made since the last visit
     (or writes from another tab) show up — and nothing while it's shut. */
  const storage = React.useMemo(
    () => (open ? scanStorage() : { rows: [], total: 0 }),
    [open],
  );
  const budgetShare = Math.min(1, storage.total / STORAGE_BUDGET);
  const budgetTone =
    budgetShare >= 0.85
      ? "from-warning to-danger"
      : budgetShare >= 0.6
        ? "from-warning/70 to-warning"
        : "from-success/70 to-success";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      size="lg"
      title="Workspace stats"
      description="Storage analytics and workspace totals — everything computed on-device."
      footer={
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      {!hydrated ? (
        <p className="text-ink-faint font-mono text-xs">Reading storage…</p>
      ) : (
        <div className="space-y-6">
          {/* ── headline tiles ───────────────────────────────────────── */}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile
              label="Universes"
              value={records.length}
              caption={`${totals.archived} archived`}
            />
            <Tile
              label="Worlds"
              value={totals.worlds}
              caption="procedural planets"
            />
            <Tile
              label="Tasks"
              value={`${totals.done}/${totals.tasks}`}
              caption="completed"
            />
            <Tile
              label="Achievements"
              value={`${totals.unlocked}/${achievements.length}`}
              caption={`streak ${streak.count}d`}
            />
          </dl>

          {/* ── vitals ───────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2">
            <Chip
              icon="bell"
              label={`${unread} of ${notifications.length} unread`}
            />
            <Chip
              icon="shield"
              label={`${backups.length} local backup${backups.length === 1 ? "" : "s"}`}
            />
            <Chip
              icon="boxes"
              label={`${folders.length} folder${folders.length === 1 ? "" : "s"}`}
            />
            {totals.lastEdit > 0 && (
              <Chip
                icon="clock"
                label={`last edit ${relativeTime(totals.lastEdit)}`}
              />
            )}
          </div>

          {/* ── storage analytics ────────────────────────────────────── */}
          <section>
            <p className="eyebrow mb-2.5 flex items-center gap-1.5">
              <Icon name="chart" size="xs" />
              Storage analytics
            </p>

            <div className="border-line/70 rounded-xl border bg-white/[0.03] p-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-ink text-xs font-medium">
                  {formatBytes(storage.total)} used
                </span>
                <span className="text-ink-faint font-mono text-[11px] tabular-nums">
                  {formatBytes(STORAGE_BUDGET)} budget ·{" "}
                  {(budgetShare * 100).toFixed(1)}%
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className={cn(
                    "h-full rounded-full bg-gradient-to-r",
                    budgetTone,
                  )}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${Math.max(budgetShare * 100, 0.4)}%` }}
                  transition={{
                    duration: reduce ? 0 : 0.7,
                    ease: EASE,
                    delay: reduce ? 0 : 0.15,
                  }}
                />
              </div>
            </div>

            <div className="mt-3.5 space-y-3">
              {storage.rows.map((row, index) => (
                <StorageLine
                  key={row.key}
                  row={row}
                  total={storage.total}
                  index={index}
                  reduce={reduce}
                />
              ))}
              {storage.rows.length === 0 && (
                <p className="text-ink-faint font-mono text-xs">
                  No storage written yet.
                </p>
              )}
            </div>

            <p className="text-ink-ghost mt-3 text-[11px] leading-relaxed">
              Measured from this browser&apos;s localStorage (UTF-16 units × 2)
              — nothing leaves the device.
            </p>
          </section>
        </div>
      )}
    </Modal>
  );
}

"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { Button, GlassCard, Icon } from "@/components";
import type { IconName } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { Folder, UniverseRecord } from "@/types/workspace";

import {
  formatBytes,
  recordBytes,
  storageFraction,
  viewCounts,
  type ManagerView,
} from "./manager-data";

/* ────────────────────────────────────────────────────────────────────────── *
 * ManagerSidebar — the persistent left rail of /universes.
 *
 * Zones top→bottom: brand + back, view navigation with live counts,
 * folders (create/rename/delete, per-folder counts), then the workspace
 * vitals — storage bar, task totals, daily streak and the achievement
 * ticker. Everything is one click from anywhere in the manager, and the
 * rail collapses to an off-canvas sheet under `lg`.
 * ────────────────────────────────────────────────────────────────────────── */

const VIEW_ITEMS: readonly {
  id: ManagerView;
  label: string;
  icon: IconName;
}[] = [
  { id: "all", label: "All universes", icon: "boxes" },
  { id: "favorites", label: "Favorites", icon: "star" },
  { id: "recent", label: "Recently edited", icon: "clock" },
  { id: "folders", label: "In folders", icon: "folder" },
  { id: "archived", label: "Archive", icon: "archive" },
];

const FOLDER_SWATCHES = [
  "#8b5cf6",
  "#22d3ee",
  "#f43f5e",
  "#2dd4bf",
  "#fbbf24",
  "#a78bfa",
] as const;

export interface ManagerSidebarProps {
  view: ManagerView;
  onViewChange: (view: ManagerView) => void;
  folderId: string | null;
  onFolderChange: (folderId: string | null) => void;
  records: readonly UniverseRecord[];
  folders: readonly Folder[];
  onCreateFolder: (name: string, color: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  streak: { count: number; lastDay: string };
  unlocked: number;
  achievementTotal: number;
  onExit: () => void;
  className?: string;
}

function Row({
  active,
  onClick,
  icon,
  label,
  count,
  tint,
}: {
  active: boolean;
  onClick: () => void;
  icon: IconName;
  label: string;
  count?: number;
  tint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors outline-none",
        "focus-visible:outline-aura-violet focus-visible:outline-2 focus-visible:outline-offset-2",
        active
          ? "text-ink"
          : "text-ink-muted hover:text-ink hover:bg-white/[0.04]",
      )}
    >
      {active && (
        <motion.span
          layoutId="manager-active-row"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="border-aura-violet/40 absolute inset-0 rounded-lg border bg-white/[0.06]"
          aria-hidden="true"
        />
      )}
      <Icon
        name={icon}
        size="sm"
        label=""
        className={cn(
          "relative z-10 transition-colors",
          active
            ? "text-aura-violet"
            : "text-ink-faint group-hover:text-ink-muted",
        )}
        {...(tint ? { style: { color: tint } } : {})}
      />
      <span className="relative z-10 flex-1 truncate text-sm">{label}</span>
      {typeof count === "number" && (
        <span
          className={cn(
            "relative z-10 font-mono text-[10px] tabular-nums",
            active ? "text-ink-muted" : "text-ink-ghost",
          )}
        >
          {count.toString().padStart(2, "0")}
        </span>
      )}
    </button>
  );
}

export function ManagerSidebar({
  view,
  onViewChange,
  folderId,
  onFolderChange,
  records,
  folders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  streak,
  unlocked,
  achievementTotal,
  onExit,
  className,
}: ManagerSidebarProps) {
  const counts = React.useMemo(() => viewCounts(records), [records]);
  const [addingFolder, setAddingFolder] = React.useState(false);
  const [draftName, setDraftName] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");

  const bytes = React.useMemo(
    () => records.reduce((sum, record) => sum + recordBytes(record), 0),
    [records],
  );
  const fraction = React.useMemo(() => storageFraction(records), [records]);
  const tasks = React.useMemo(() => {
    let done = 0;
    let total = 0;
    for (const record of records) {
      for (const list of Object.values(record.planetTasks)) {
        total += list.length;
        done += list.filter((task) => task.done).length;
      }
    }
    return { done, total };
  }, [records]);

  const folderCount = (id: string) =>
    records.filter((record) => record.folderId === id && !record.archived)
      .length;

  const commitDraft = () => {
    const name = draftName.trim();
    if (name) {
      onCreateFolder(
        name,
        FOLDER_SWATCHES[folders.length % FOLDER_SWATCHES.length],
      );
    }
    setDraftName("");
    setAddingFolder(false);
  };

  const commitEdit = () => {
    if (editingId && editName.trim())
      onRenameFolder(editingId, editName.trim());
    setEditingId(null);
    setEditName("");
  };

  return (
    <aside
      data-tour="manager-sidebar"
      className={cn(
        "glass-strong flex h-full w-64 shrink-0 flex-col rounded-2xl",
        className,
      )}
      aria-label="Workspace navigation"
    >
      {/* brand + back */}
      <div className="border-hairline flex items-center gap-2 border-b px-4 py-4">
        <Button
          variant="ghost"
          size="xs"
          onClick={onExit}
          iconLeft={<Icon name="arrow-left" />}
        >
          Surface
        </Button>
        <span className="text-ink-faint text-micro tracking-caps ml-auto font-mono">
          WORKSPACE
        </span>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {/* views */}
        <nav className="space-y-1" aria-label="Views">
          {VIEW_ITEMS.map((item) => (
            <Row
              key={item.id}
              active={view === item.id && folderId === null}
              onClick={() => {
                onViewChange(item.id);
                onFolderChange(null);
              }}
              icon={item.icon}
              label={item.label}
              count={counts[item.id]}
            />
          ))}
        </nav>

        {/* folders */}
        <section aria-label="Folders" className="space-y-1">
          <div className="text-ink-faint text-micro tracking-caps flex items-center justify-between px-3 font-mono">
            <span>Folders</span>
            <button
              type="button"
              onClick={() => setAddingFolder(true)}
              aria-label="New folder"
              className="text-ink-faint hover:text-aura-violet rounded p-0.5 transition-colors"
            >
              <Icon name="plus" size="sm" label="" />
            </button>
          </div>

          {addingFolder && (
            <input
              autoFocus
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={commitDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitDraft();
                if (event.key === "Escape") {
                  setDraftName("");
                  setAddingFolder(false);
                }
              }}
              placeholder="Folder name…"
              className="border-aura-violet/50 text-ink placeholder:text-ink-ghost w-full rounded-lg border bg-white/[0.05] px-3 py-2 text-sm outline-none"
            />
          )}

          {folders.map((folder) =>
            editingId === folder.id ? (
              <input
                key={folder.id}
                autoFocus
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                onBlur={commitEdit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitEdit();
                  if (event.key === "Escape") setEditingId(null);
                }}
                className="border-aura-violet/50 text-ink w-full rounded-lg border bg-white/[0.05] px-3 py-2 text-sm outline-none"
              />
            ) : (
              <div key={folder.id} className="group relative">
                <Row
                  active={folderId === folder.id}
                  onClick={() => {
                    onViewChange("all");
                    onFolderChange(folder.id);
                  }}
                  icon="folder"
                  label={folder.name}
                  count={folderCount(folder.id)}
                  tint={folder.color}
                />
                {/* row actions — revealed on hover/focus-within */}
                <div className="absolute top-1/2 right-2 hidden -translate-y-1/2 gap-1 group-focus-within:flex group-hover:flex">
                  <button
                    type="button"
                    aria-label={`Rename folder ${folder.name}`}
                    onClick={() => {
                      setEditingId(folder.id);
                      setEditName(folder.name);
                    }}
                    className="text-ink-faint hover:text-ink rounded p-1"
                  >
                    <Icon name="pencil" size="sm" label="" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete folder ${folder.name}`}
                    onClick={() => onDeleteFolder(folder.id)}
                    className="text-ink-faint hover:text-danger rounded p-1"
                  >
                    <Icon name="trash" size="sm" label="" />
                  </button>
                </div>
              </div>
            ),
          )}

          {folders.length === 0 && !addingFolder && (
            <p className="text-ink-ghost px-3 text-xs leading-relaxed">
              Group universes into folders — hit + above.
            </p>
          )}
        </section>

        {/* vitals */}
        <section className="space-y-4 px-1" aria-label="Workspace vitals">
          <GlassCard tone="subtle" padding="sm" className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-ink-faint text-micro tracking-caps font-mono">
                STORAGE
              </span>
              <span className="text-ink-muted font-mono text-[11px] tabular-nums">
                {formatBytes(bytes)}
              </span>
            </div>
            <div
              aria-hidden="true"
              className="bg-line relative h-1.5 overflow-hidden rounded-full"
            >
              <motion.div
                className="from-aura-violet via-aura-indigo to-aura-cyan absolute inset-y-0 left-0 rounded-full bg-gradient-to-r"
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(2, fraction * 100)}%` }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <p className="text-ink-ghost font-mono text-[10px]">
              {(fraction * 100).toFixed(1)}% of 5 MB quota
            </p>
          </GlassCard>

          <GlassCard tone="subtle" padding="sm" className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-ink-faint text-micro tracking-caps font-mono">
                TASKS
              </span>
              <span className="text-ink-muted font-mono text-[11px] tabular-nums">
                {tasks.done}/{tasks.total}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-ink-faint text-micro tracking-caps font-mono">
                STREAK
              </span>
              <span className="text-aura-violet-soft font-mono text-[11px] tabular-nums">
                {streak.count}d
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-ink-faint text-micro tracking-caps font-mono">
                BADGES
              </span>
              <span className="text-ink-muted font-mono text-[11px] tabular-nums">
                {unlocked}/{achievementTotal}
              </span>
            </div>
          </GlassCard>
        </section>
      </div>
    </aside>
  );
}

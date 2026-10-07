"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Badge, Button, GlassCard, Icon, Input, Modal } from "@/components";
import { useUniverseCount } from "@/hooks/use-workspace";
import {
  useAchievements,
  useBackups,
  useFolders,
  useNotifications,
  useStreak,
  useUniverses,
  useUnreadCount,
  useWorkspaceHydrated,
  workspaceActions,
} from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";
import { CreateUniverse } from "@/sections/universe/create-universe";
import type { UniverseRecord } from "@/types/workspace";

import { ManagerSidebar } from "./manager-sidebar";
import { UniverseCard } from "./universe-card";
import { WorkspaceStats } from "./workspace-stats";
import {
  formatBytes,
  recordBytes,
  selectUniverses,
  type ManagerQuery,
  type ManagerView,
} from "./manager-data";

/* ────────────────────────────────────────────────────────────────────────── *
 * UniverseManager — /universes, the persistent multi-universe workspace.
 *
 * Layout: persistent sidebar (views · folders · vitals) + main stage
 * (search, notifications, create, sortable card grid). Every card action
 * (open/rename/duplicate/export/archive/delete/favorite/reorder) lives on
 * the tile itself; bulk portability (export all, import, local backup)
 * sits in the toolbar's overflow.
 *
 * Reordering: pointer drag via dnd-kit (whole card is the handle), keyboard
 * via the move buttons on each tile — both funnel into
 * `workspaceActions().reorderUniverses` with the full visible order, so a
 * drag inside a filtered view never reorders the hidden records.
 *
 * Hydration: renders a skeleton until localStorage has been read — a fresh
 * profile must never flash the empty state over existing data.
 * ────────────────────────────────────────────────────────────────────────── */

function download(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "universe"
  );
}

/* ── notifications popover ─────────────────────────────────────────────── */

function NotificationsBell() {
  const notifications = useNotifications();
  const unread = useUnreadCount();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) workspaceActions().markNotificationsRead();
        }}
        className={cn(
          "border-line-strong text-ink-muted hover:text-ink relative rounded-xl border p-2.5 transition-colors outline-none",
          "focus-visible:outline-aura-violet focus-visible:outline-2 focus-visible:outline-offset-2",
        )}
      >
        <Icon name="bell" size="sm" label="" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="bg-aura-violet absolute -top-1 -right-1 grid size-4 place-items-center rounded-full font-mono text-[9px] text-black"
          >
            {unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="glass-strong absolute top-full right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl"
            role="status"
            aria-label="Notifications"
          >
            <div className="border-hairline flex items-center justify-between border-b px-4 py-3">
              <span className="text-ink text-xs font-medium">
                Notifications
              </span>
              <button
                type="button"
                onClick={() => workspaceActions().clearNotifications()}
                className="text-ink-faint hover:text-ink text-[11px]"
              >
                Clear
              </button>
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {notifications.length === 0 && (
                <li className="text-ink-faint px-4 py-6 text-center text-xs">
                  Nothing yet — create a universe to get started.
                </li>
              )}
              {notifications.map((item) => (
                <li
                  key={item.id}
                  className="border-hairline border-b px-4 py-3 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        item.kind === "achievement"
                          ? "aura"
                          : item.kind === "warning"
                            ? "warning"
                            : item.kind === "success"
                              ? "success"
                              : "info"
                      }
                    >
                      {item.kind}
                    </Badge>
                    <span className="text-ink truncate text-xs font-medium">
                      {item.title}
                    </span>
                  </div>
                  <p className="text-ink-muted mt-1 text-xs leading-relaxed">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── manager ───────────────────────────────────────────────────────────── */

export function UniverseManager() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const hydrated = useWorkspaceHydrated();
  const records = useUniverses({ includeArchived: true });
  const folders = useFolders();
  const streak = useStreak();
  const achievements = useAchievements();
  const backups = useBackups();
  const count = useUniverseCount();

  const [view, setView] = React.useState<ManagerView>("all");
  const [folderId, setFolderId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [statsOpen, setStatsOpen] = React.useState(false);
  const [renaming, setRenaming] = React.useState<UniverseRecord | null>(null);
  const [renameDraft, setRenameDraft] = React.useState("");
  const [deleting, setDeleting] = React.useState<UniverseRecord | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);

  const query: ManagerQuery = React.useMemo(
    () => ({ view, folderId, search }),
    [view, folderId, search],
  );
  const visible = React.useMemo(
    () => selectUniverses(records, query),
    [records, query],
  );
  const unlocked = achievements.filter((a) => a.unlockedAt !== null).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  /* The command palette opens the creation flow by event — the HUD listens
     for the same one on /universe, and only the mounted route responds. */
  React.useEffect(() => {
    const onCreate = () => setCreating(true);
    window.addEventListener("astra:new-universe", onCreate);
    return () => window.removeEventListener("astra:new-universe", onCreate);
  }, []);

  /* ── actions ──────────────────────────────────────────────────────── */

  const openRecord = (record: UniverseRecord) => {
    workspaceActions().setActiveUniverse(record.id);
    router.push("/universe");
  };

  const commitRename = () => {
    if (renaming && renameDraft.trim()) {
      workspaceActions().renameUniverse(renaming.id, renameDraft.trim());
    }
    setRenaming(null);
  };

  const exportOne = (record: UniverseRecord) => {
    download(
      `${slug(record.name)}.astra-universe.json`,
      JSON.stringify(record, null, 2),
    );
  };

  const exportAll = () => {
    download(
      "astra-workspace.astra-workspace.json",
      workspaceActions().exportJson(),
    );
  };

  const importFile = async (file: File) => {
    setImportError(null);
    try {
      const text = await file.text();
      const result = workspaceActions().importJson(text);
      if (!result.ok) setImportError(result.error ?? "Import failed.");
    } catch {
      setImportError("Could not read that file.");
    }
  };

  const takeBackup = () => {
    const snapshot = workspaceActions().backup();
    if (!snapshot) setImportError("Nothing to back up yet.");
  };

  const moveRecord = (record: UniverseRecord, delta: -1 | 1) => {
    const ids = visible.map((entry) => entry.id);
    const from = ids.indexOf(record.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    const reordered = arrayMove(ids, from, to);
    /* Merge the visible order back into the master order so hidden records
       keep their relative tail positions (reorderUniverses appends them). */
    workspaceActions().reorderUniverses([
      ...reordered,
      ...records.map((entry) => entry.id).filter((id) => !ids.includes(id)),
    ]);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = visible.map((entry) => entry.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const reordered = arrayMove(ids, from, to);
    workspaceActions().reorderUniverses([
      ...reordered,
      ...records.map((entry) => entry.id).filter((id) => !ids.includes(id)),
    ]);
  };

  /* ── empty state ──────────────────────────────────────────────────── */

  const empty = (
    <div className="mx-auto max-w-md py-16 text-center">
      <div
        aria-hidden="true"
        className="from-aura-violet/30 via-aura-indigo/20 to-aura-cyan/10 mx-auto mb-6 grid size-20 place-items-center rounded-full bg-gradient-to-br blur-xl"
      />
      <Icon
        name="orbit"
        size="xl"
        label=""
        className="text-aura-violet mx-auto mb-4"
      />
      <h2 className="text-ink mb-2 text-lg font-semibold">
        {search
          ? "No universe matches that search"
          : view === "archived"
            ? "The archive is empty"
            : view === "favorites"
              ? "No favorites yet"
              : "Your workspace is dark"}
      </h2>
      <p className="text-ink-muted mb-6 text-sm leading-relaxed">
        {search
          ? "Try a different name, tag, teammate or repository."
          : "Every universe is its own procedural solar system — name it, theme it, and it builds itself."}
      </p>
      {!search && (
        <Button
          variant="primary"
          onClick={() => setCreating(true)}
          iconLeft={<Icon name="plus" />}
        >
          Create your first universe
        </Button>
      )}
    </div>
  );

  return (
    <div className="bg-void min-h-screen">
      <a
        href="#manager-main"
        className="focus:bg-aura-violet sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2"
      >
        Skip to universes
      </a>

      <div className="mx-auto flex max-w-[1500px] gap-5 p-4 sm:p-6">
        {/* ── sidebar ─────────────────────────────────────────────── */}
        <ManagerSidebar
          view={view}
          onViewChange={setView}
          folderId={folderId}
          onFolderChange={setFolderId}
          records={records}
          folders={folders}
          onCreateFolder={(name, color) =>
            workspaceActions().createFolder(name, color)
          }
          onRenameFolder={(id, name) =>
            workspaceActions().renameFolder(id, name)
          }
          onDeleteFolder={(id) => workspaceActions().deleteFolder(id)}
          streak={streak}
          unlocked={unlocked}
          achievementTotal={achievements.length}
          onExit={() => router.push("/")}
          className="sticky top-6 hidden h-[calc(100dvh-3rem)] lg:flex"
        />

        {/* ── main ────────────────────────────────────────────────── */}
        <main id="manager-main" className="min-w-0 flex-1 space-y-5">
          <motion.header
            data-tour="manager-toolbar"
            initial={reduce ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap items-center gap-3"
          >
            <div className="min-w-0 flex-1">
              <h1 className="tracking-title text-ink text-xl font-semibold sm:text-2xl">
                Universe Manager
              </h1>
              <p className="text-ink-muted text-xs">
                {count === 0
                  ? "No universes yet"
                  : `${count} universe${count === 1 ? "" : "s"} · ${visible.length} shown`}
                {folderId && ` · folder filter on`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Input
                aria-label="Search universes"
                placeholder="Search universes…"
                icon={<Icon name="search" size="sm" label="" />}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                wrapperClassName="w-44 sm:w-64"
                size="sm"
              />
              <NotificationsBell />
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCreating(true)}
                iconLeft={<Icon name="plus" />}
              >
                <span className="hidden sm:inline">New universe</span>
              </Button>
            </div>
          </motion.header>

          {/* toolbar: portability */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="glass"
              size="xs"
              onClick={exportAll}
              disabled={records.length === 0}
              iconLeft={<Icon name="download" />}
            >
              Export all
            </Button>
            <label
              className={cn(
                "border-line-strong text-ink-muted hover:text-ink inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
                "focus-within:outline-aura-violet focus-within:outline-2",
              )}
            >
              <Icon name="upload" size="sm" label="" />
              Import
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importFile(file);
                  event.target.value = "";
                }}
              />
            </label>
            <Button
              variant="glass"
              size="xs"
              onClick={takeBackup}
              disabled={records.length === 0}
              iconLeft={<Icon name="shield" />}
            >
              Local backup
            </Button>
            <WorkspaceStats
              open={statsOpen}
              onOpenChange={setStatsOpen}
              trigger={
                <Button
                  variant="glass"
                  size="xs"
                  iconLeft={<Icon name="chart" />}
                >
                  Stats
                </Button>
              }
            />

            <div className="ml-auto flex items-center gap-2">
              <span className="text-ink-muted font-mono text-[10px]">
                {formatBytes(records.reduce((n, r) => n + recordBytes(r), 0))}{" "}
                persisted
              </span>
              {backups.length > 0 && (
                <select
                  aria-label="Restore a backup"
                  className="border-line text-ink-muted rounded-lg border bg-white/[0.03] px-2 py-1 text-[11px] outline-none"
                  value=""
                  onChange={(event) => {
                    const id = event.target.value;
                    if (id) {
                      workspaceActions().restoreBackup(id);
                      event.target.value = "";
                    }
                  }}
                >
                  <option value="">Restore backup…</option>
                  {backups.map((backup) => (
                    <option key={backup.id} value={backup.id}>
                      {new Date(backup.at).toLocaleString()} · {backup.count}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {importError && (
            <p role="alert" className="text-danger text-xs">
              {importError}
            </p>
          )}

          {/* ── grid ──────────────────────────────────────────────── */}
          {!hydrated ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div
                  key={i}
                  className="glass-strong h-72 animate-pulse rounded-2xl"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : visible.length === 0 ? (
            empty
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={visible.map((record) => record.id)}
                strategy={rectSortingStrategy}
              >
                <div
                  data-tour="manager-grid"
                  className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                >
                  <AnimatePresence mode="popLayout">
                    {visible.map((record, index) => (
                      <UniverseCard
                        key={record.id}
                        record={record}
                        index={index}
                        onOpen={openRecord}
                        onRename={(target) => {
                          setRenameDraft(target.name);
                          setRenaming(target);
                        }}
                        onDuplicate={(target) =>
                          workspaceActions().duplicateUniverse(target.id)
                        }
                        onExport={exportOne}
                        onArchive={(target, archived) =>
                          workspaceActions().setArchived(target.id, archived)
                        }
                        onFavorite={(target, favorite) =>
                          workspaceActions().setFavorite(target.id, favorite)
                        }
                        onDelete={(target) => setDeleting(target)}
                        onMove={moveRecord}
                        canMoveUp={index > 0}
                        canMoveDown={index < visible.length - 1}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* workspace summary */}
          {hydrated && visible.length > 0 && (
            <GlassCard tone="subtle" padding="md">
              <div className="text-ink-muted flex flex-wrap items-center justify-between gap-3 font-mono text-[11px]">
                <span>
                  ACHIEVEMENTS · {unlocked}/{achievements.length} unlocked
                </span>
                <span>STREAK · {streak.count}d</span>
                <span>BACKUPS · {backups.length}</span>
              </div>
            </GlassCard>
          )}
        </main>
      </div>

      {/* ── dialogs ─────────────────────────────────────────────────── */}
      <CreateUniverse open={creating} onOpenChange={setCreating} />

      <Modal
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
        size="sm"
        title="Rename universe"
        description="The new name re-derives the world labels on next scene build."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={commitRename}>
              Save name
            </Button>
          </>
        }
      >
        <Input
          label="Universe name"
          value={renameDraft}
          autoFocus
          onChange={(event) => setRenameDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitRename();
          }}
        />
      </Modal>

      <Modal
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        size="sm"
        title={`Delete ${deleting?.name ?? ""}?`}
        description="This removes the universe, its planets, tasks, notes and documents. It cannot be undone — export or back up first."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              iconLeft={<Icon name="trash" />}
              onClick={() => {
                if (deleting) workspaceActions().deleteUniverse(deleting.id);
                setDeleting(null);
              }}
            >
              Delete universe
            </Button>
          </>
        }
      >
        <p className="text-ink-muted text-sm">
          {deleting &&
            `${deleting.name} holds ${recordBytes(deleting)} bytes of
            workspace data.`}
        </p>
      </Modal>
    </div>
  );
}

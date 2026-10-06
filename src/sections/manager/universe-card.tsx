"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useReducedMotion } from "framer-motion";

import { Badge, Button, GlassCard, Icon } from "@/components";
import type { IconName } from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
  fallbackCover,
  themeById,
  type UniverseRecord,
} from "@/types/workspace";

import {
  daysUntil,
  relativeTime,
  taskTotals,
  universeProgress,
  universeWorlds,
} from "./manager-data";

/* ────────────────────────────────────────────────────────────────────────── *
 * UniverseCard — one universe as an animated, actionable tile.
 *
 * Anatomy: cover (preset URL or procedural gradient) with favorite star +
 * status badges, name/description, a progress meter wired to the generated
 * scene's average completion, then a meta strip (last edited, worlds,
 * tasks, storage, AI model, team initials) and a quick-action rail that
 * reveals on hover/focus — open, rename, duplicate, export, archive,
 * delete.
 *
 * Drag-and-drop: `useSortable` supplies the transform + listeners; the
 * whole card is the handle (pointer drag on the cover), keyboard users get
 * the same ordering through the explicit move buttons in the action rail.
 * Reduced motion drops the entrance spring but keeps every interaction.
 * ────────────────────────────────────────────────────────────────────────── */

export interface UniverseCardProps {
  record: UniverseRecord;
  index: number;
  /** True while this card is the pointer/keyboard drag source. */
  dragging?: boolean;
  onOpen: (record: UniverseRecord) => void;
  onRename: (record: UniverseRecord) => void;
  onDuplicate: (record: UniverseRecord) => void;
  onExport: (record: UniverseRecord) => void;
  onArchive: (record: UniverseRecord, archived: boolean) => void;
  onFavorite: (record: UniverseRecord, favorite: boolean) => void;
  onDelete: (record: UniverseRecord) => void;
  /** Keyboard reordering (index shift by ±1). */
  onMove: (record: UniverseRecord, delta: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

function ActionButton({
  label,
  icon,
  onClick,
  tone = "default",
  disabled = false,
}: {
  label: string;
  icon: IconName;
  onClick: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "rounded-lg p-1.5 transition-colors outline-none",
        "focus-visible:outline-aura-violet focus-visible:outline-2 focus-visible:outline-offset-1",
        "disabled:pointer-events-none disabled:opacity-30",
        tone === "danger"
          ? "text-ink-faint hover:bg-danger/15 hover:text-danger"
          : "text-ink-faint hover:text-ink hover:bg-white/10",
      )}
    >
      <Icon name={icon} size="sm" label="" />
    </button>
  );
}

export function UniverseCard({
  record,
  index,
  dragging = false,
  onOpen,
  onRename,
  onDuplicate,
  onExport,
  onArchive,
  onFavorite,
  onDelete,
  onMove,
  canMoveUp,
  canMoveDown,
}: UniverseCardProps) {
  const reduce = useReducedMotion();
  const theme = themeById(record.themeId);
  const progress = React.useMemo(() => universeProgress(record), [record]);
  const worlds = React.useMemo(() => universeWorlds(record), [record]);
  const tasks = React.useMemo(() => taskTotals(record), [record]);
  const due = daysUntil(record.deadline);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: record.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
    opacity: isDragging ? 0.9 : undefined,
  };

  const cover = record.cover || fallbackCover(record.seed);
  const isGradient = cover.startsWith("linear-gradient") || cover.startsWith("radial");
  const coverStyle: React.CSSProperties = isGradient
    ? { background: cover }
    : { backgroundImage: `url("${cover}")` };

  const open = () => onOpen(record);

  return (
    <motion.article
      ref={setNodeRef}
      style={style}
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.96 }}
      transition={{
        duration: 0.5,
        delay: reduce ? 0 : Math.min(index * 0.05, 0.4),
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(dragging && "cursor-grabbing")}
      aria-label={`${record.name} universe`}
    >
      <GlassCard
        tone="strong"
        padding="none"
        interactive
        className={cn(
          "group overflow-hidden",
          isDragging && "ring-aura-violet/50 ring-2",
        )}
      >
        {/* ── cover ─────────────────────────────────────────────────── */}
        <div
          {...attributes}
          {...listeners}
          onClick={open}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              open();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Open ${record.name}`}
          className="relative h-32 cursor-pointer bg-cover bg-center outline-none sm:h-36"
          style={coverStyle}
        >
          {/* readability scrim */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
          />

          {/* favorite star */}
          <button
            type="button"
            aria-label={
              record.favorite
                ? `Remove ${record.name} from favorites`
                : `Add ${record.name} to favorites`
            }
            aria-pressed={record.favorite}
            onClick={(event) => {
              event.stopPropagation();
              onFavorite(record, !record.favorite);
            }}
            className={cn(
              "absolute top-2.5 right-2.5 rounded-lg p-1.5 backdrop-blur-sm transition-colors outline-none",
              "focus-visible:outline-aura-violet focus-visible:outline-2",
              record.favorite
                ? "text-warning bg-black/40"
                : "text-ink-faint hover:text-ink bg-black/30 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
            )}
          >
            <Icon name="star" size="sm" label="" />
          </button>

          {/* status badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
            {record.archived && (
              <Badge variant="outline" className="bg-black/40 backdrop-blur-sm">
                Archived
              </Badge>
            )}
            {due !== null && (
              <Badge
                variant={due < 0 ? "danger" : due <= 14 ? "warning" : "default"}
                className="bg-black/40 backdrop-blur-sm"
              >
                {due < 0 ? `${Math.abs(due)}d overdue` : `${due}d left`}
              </Badge>
            )}
            <Badge
              variant="aura"
              className="hidden bg-black/40 backdrop-blur-sm sm:inline-flex"
            >
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full"
                style={{ background: theme.accent }}
              />
              {theme.label}
            </Badge>
          </div>

          {/* name + description pinned to the bottom of the cover */}
          <div className="absolute right-3 bottom-3 left-3">
            <h3 className="text-ink truncate text-sm font-semibold sm:text-base">
              {record.name}
            </h3>
            {record.description && (
              <p className="text-ink-muted line-clamp-1 text-xs">
                {record.description}
              </p>
            )}
          </div>
        </div>

        {/* ── body ──────────────────────────────────────────────────── */}
        <div className="space-y-3 p-4">
          {/* progress */}
          <div className="space-y-1.5">
            <div className="text-ink-faint flex items-baseline justify-between font-mono text-[10px]">
              <span className="tracking-caps">COMPLETION</span>
              <span className="text-ink-muted tabular-nums">{progress}%</span>
            </div>
            <div
              aria-hidden="true"
              className="bg-line relative h-1 overflow-hidden rounded-full"
            >
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>

          {/* meta strip */}
          <dl className="text-ink-faint grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px]">
            <div className="flex items-center justify-between">
              <dt>Edited</dt>
              <dd className="text-ink-muted">
                {relativeTime(record.updatedAt)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Worlds</dt>
              <dd className="text-ink-muted tabular-nums">
                {worlds.toString().padStart(2, "0")}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Tasks</dt>
              <dd className="text-ink-muted tabular-nums">
                {tasks.done}/{tasks.total}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>AI</dt>
              <dd className="text-ink-muted truncate pl-2">{record.aiModel}</dd>
            </div>
          </dl>

          {/* footer: team + actions */}
          <div className="border-hairline flex items-center justify-between border-t pt-3">
            <div
              className="flex items-center gap-1.5"
              aria-label="Team members"
            >
              {record.teamMembers.slice(0, 3).map((member) => (
                <span
                  key={member}
                  title={member}
                  className="border-line-strong text-ink-muted grid size-6 place-items-center rounded-full border bg-white/[0.06] font-mono text-[10px] uppercase"
                >
                  {member.slice(0, 2)}
                </span>
              ))}
              {record.teamMembers.length === 0 && (
                <span className="text-ink-ghost font-mono text-[10px]">
                  solo
                </span>
              )}
              {record.githubRepo && (
                <Icon
                  name="github"
                  size="sm"
                  label=""
                  className="text-ink-faint ml-1"
                />
              )}
            </div>

            <div className="flex items-center gap-0.5">
              <span className="hidden gap-0.5 group-focus-within:flex group-hover:flex sm:flex">
                <ActionButton
                  label="Move earlier"
                  icon="arrow-left"
                  disabled={!canMoveUp}
                  onClick={() => onMove(record, -1)}
                />
                <ActionButton
                  label="Move later"
                  icon="arrow-right"
                  disabled={!canMoveDown}
                  onClick={() => onMove(record, 1)}
                />
                <ActionButton
                  label="Rename"
                  icon="pencil"
                  onClick={() => onRename(record)}
                />
                <ActionButton
                  label="Duplicate"
                  icon="copy"
                  onClick={() => onDuplicate(record)}
                />
                <ActionButton
                  label="Export"
                  icon="download"
                  onClick={() => onExport(record)}
                />
                <ActionButton
                  label={record.archived ? "Restore" : "Archive"}
                  icon="archive"
                  onClick={() => onArchive(record, !record.archived)}
                />
                <ActionButton
                  label="Delete"
                  icon="trash"
                  tone="danger"
                  onClick={() => onDelete(record)}
                />
              </span>
              <Button
                variant="cosmic"
                size="xs"
                onClick={open}
                iconLeft={<Icon name="enter" />}
              >
                Open
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>
    </motion.article>
  );
}

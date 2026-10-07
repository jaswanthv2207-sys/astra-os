"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { Badge, Button, Icon, Input } from "@/components";
import type { Project } from "@/data";
import { useRepoSimulation } from "@/hooks/use-github";
import type { DossierWorkspace } from "@/hooks/use-workspace";
import type { IconName } from "@/lib/icons";
import { DOC_KINDS, computePlanetInsight } from "@/lib/universe-generator";
import { cn, relativeTime } from "@/lib/utils";

import { EASE, Section } from "./dossier-section";
import { progressAt } from "./timeline";

/* ────────────────────────────────────────────────────────────────────────── *
 * Dossier tabs — the tab strip plus the seven workspace tabs the immersive
 * dossier gained alongside Overview / Screenshots / Timeline (whose bodies
 * stay in project-detail-panel — they are the original content, verbatim).
 *
 * Every tab is deterministic and offline: Notes / Tasks / Documents read
 * persisted workspace buckets through `useDossierWorkspace` (stock graph and
 * generated universes alike), while GitHub / AI Insights / Activity /
 * Analytics are seeded simulations derived from the world's repo + seed —
 * no network, same numbers every visit.
 * ────────────────────────────────────────────────────────────────────────── */

export type DossierTabId =
  | "overview"
  | "notes"
  | "tasks"
  | "documents"
  | "screenshots"
  | "github"
  | "timeline"
  | "insights"
  | "activity"
  | "analytics";

export interface DossierTabMeta {
  id: DossierTabId;
  label: string;
  icon: IconName;
}

/** Canonical tab order — the strip, the panel and a11y all read this. */
export const DOSSIER_TABS: readonly DossierTabMeta[] = [
  { id: "overview", label: "Overview", icon: "box" },
  { id: "notes", label: "Notes", icon: "note" },
  { id: "tasks", label: "Tasks", icon: "check" },
  { id: "documents", label: "Documents", icon: "file" },
  { id: "screenshots", label: "Screenshots", icon: "palette" },
  { id: "github", label: "GitHub", icon: "github" },
  { id: "timeline", label: "Timeline", icon: "clock" },
  { id: "insights", label: "AI Insights", icon: "sparkles" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "analytics", label: "Analytics", icon: "chart" },
];

/** Shared field styling (matches the UI kit's Input focus language). */
const FIELD =
  "w-full rounded-xl border border-line bg-white/[0.04] px-3 py-2 text-sm text-ink placeholder:text-ink-ghost outline-none transition-colors focus:border-aura-violet/60 focus:ring-2 focus:ring-aura-violet/25";

/** Epoch ms → "8 Oct 2024" (formatDate in planet-card takes ISO dates). */
function fmtDay(at: number): string {
  return new Date(at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* ── tab strip ──────────────────────────────────────────────────────────── */

/**
 * Horizontally scrolling tab strip pinned under the dossier header.
 * Roving tabindex + arrow keys per the ARIA tabs pattern; the sliding glass
 * pill is a shared `layoutId` so switching tabs glides rather than cuts.
 */
export function DossierTabBar({
  active,
  onChange,
}: {
  active: DossierTabId;
  onChange: (id: DossierTabId) => void;
}) {
  const reduce = useReducedMotion();
  const listRef = React.useRef<HTMLDivElement>(null);

  /* Keep the selected tab in view inside the scrolling strip. */
  React.useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`#dossier-tab-${active}`)
      ?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [active]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = DOSSIER_TABS.findIndex((tab) => tab.id === active);
    if (index < 0) return;
    let next = -1;
    if (event.key === "ArrowRight") {
      next = (index + 1) % DOSSIER_TABS.length;
    } else if (event.key === "ArrowLeft") {
      next = (index - 1 + DOSSIER_TABS.length) % DOSSIER_TABS.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = DOSSIER_TABS.length - 1;
    }
    if (next < 0) return;
    event.preventDefault();
    const tab = DOSSIER_TABS[next];
    onChange(tab.id);
    listRef.current
      ?.querySelector<HTMLElement>(`#dossier-tab-${tab.id}`)
      ?.focus();
  };

  return (
    <div className="border-line/70 shrink-0 border-b px-3 sm:px-4">
      <div
        ref={listRef}
        role="tablist"
        aria-label="Dossier sections"
        className="flex [scrollbar-width:none] gap-1 overflow-x-auto py-2 [&::-webkit-scrollbar]:hidden"
        onKeyDown={onKeyDown}
      >
        {DOSSIER_TABS.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`dossier-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls="dossier-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] tracking-wide transition-colors outline-none",
                "focus-visible:ring-aura-violet/70 focus-visible:ring-2",
                selected
                  ? "text-ink"
                  : "text-ink-muted hover:text-ink hover:bg-white/[0.05]",
              )}
            >
              {selected && (
                <motion.span
                  aria-hidden="true"
                  layoutId="dossier-tab-glow"
                  className="border-line/80 absolute inset-0 rounded-lg border bg-white/[0.07]"
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 480, damping: 40 }
                  }
                />
              )}
              <Icon name={tab.icon} size="xs" className="relative" />
              <span className="relative">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── shared tab bits ────────────────────────────────────────────────────── */

interface TabBodyProps {
  project: Project;
  work: DossierWorkspace;
}

/** Sub-heading inside a tab body (the eyebrow style, no icon). */
function Subhead({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="eyebrow mt-4 mb-2 flex items-center gap-1.5 first:mt-0"
      style={{ color: "var(--ink-secondary)" }}
    >
      {children}
    </p>
  );
}

function EmptyTab({ icon, text }: { icon: IconName; text: string }) {
  return (
    <div className="border-line/60 rounded-xl border border-dashed px-4 py-6 text-center">
      <Icon name={icon} size="sm" className="text-ink-ghost mx-auto mb-2" />
      <p className="text-ink-muted text-xs">{text}</p>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="border-line/70 rounded-xl border bg-white/[0.03] p-3">
      <p className="text-ink-muted text-micro tracking-caps font-mono">
        {label}
      </p>
      <p
        className={cn(
          "text-ink mt-1.5 font-mono text-base leading-none tabular-nums",
          tone,
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="text-ink-faint mt-1 font-mono text-[10px]">{hint}</p>
      )}
    </div>
  );
}

/* ── Notes ──────────────────────────────────────────────────────────────── */

export function NotesTabBody({ work }: TabBodyProps) {
  const [draftTitle, setDraftTitle] = React.useState("");
  const [draftBody, setDraftBody] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editBody, setEditBody] = React.useState("");

  const submit = () => {
    if (!draftTitle.trim() && !draftBody.trim()) return;
    work.addNote(draftTitle, draftBody);
    setDraftTitle("");
    setDraftBody("");
  };

  const startEdit = (note: { id: string; title: string; body: string }) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditBody(note.body);
  };

  const saveEdit = () => {
    if (!editingId) return;
    work.updateNote(editingId, {
      title: editTitle.trim() || "Untitled note",
      body: editBody,
    });
    setEditingId(null);
  };

  return (
    <Section label="Notes" icon="note">
      {/* composer */}
      <div className="border-line/70 space-y-2 rounded-xl border bg-white/[0.03] p-3">
        <Input
          size="sm"
          aria-label="New note title"
          placeholder="Note title"
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
        />
        <textarea
          rows={2}
          aria-label="New note body"
          placeholder="Write it down…"
          value={draftBody}
          onChange={(event) => setDraftBody(event.target.value)}
          className={FIELD}
        />
        <div className="flex justify-end">
          <Button
            variant="glass"
            size="sm"
            onClick={submit}
            iconLeft={<Icon name="plus" size="xs" />}
          >
            Add note
          </Button>
        </div>
      </div>

      <ul className="mt-3 space-y-2.5">
        {work.notes.length === 0 && (
          <li>
            <EmptyTab
              icon="note"
              text="No notes yet — the first one starts the log."
            />
          </li>
        )}
        {work.notes.map((note) => (
          <li
            key={note.id}
            className="border-line/70 rounded-xl border bg-white/[0.03] p-3.5"
          >
            {editingId === note.id ? (
              <div className="space-y-2">
                <Input
                  size="sm"
                  aria-label="Note title"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                />
                <textarea
                  rows={3}
                  aria-label="Note body"
                  value={editBody}
                  onChange={(event) => setEditBody(event.target.value)}
                  className={FIELD}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="glass"
                    size="sm"
                    onClick={saveEdit}
                    iconLeft={<Icon name="check" size="xs" />}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-ink min-w-0 text-sm font-medium">
                    {note.title}
                  </p>
                  <div className="text-ink-ghost flex shrink-0 gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100 hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit note ${note.title}`}
                      onClick={() => startEdit(note)}
                      iconLeft={<Icon name="pencil" />}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete note ${note.title}`}
                      onClick={() => work.deleteNote(note.id)}
                      iconLeft={<Icon name="trash" />}
                    />
                  </div>
                </div>
                {note.body && (
                  <p className="text-ink-muted mt-1.5 text-xs leading-relaxed">
                    {note.body}
                  </p>
                )}
                <p className="text-ink-faint mt-2 font-mono text-[10px]">
                  {relativeTime(note.updatedAt)}
                </p>
              </>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ── Tasks ──────────────────────────────────────────────────────────────── */

export function TasksTabBody({ work }: TabBodyProps) {
  const reduce = useReducedMotion();
  const [draft, setDraft] = React.useState("");
  const total = work.tasks.length;
  const done = work.tasks.filter((task) => task.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const submit = () => {
    if (!draft.trim()) return;
    work.addTask(draft);
    setDraft("");
  };

  return (
    <Section label="Tasks" icon="check">
      <div className="mb-3">
        <div className="flex items-baseline justify-between">
          <span className="text-ink-muted text-micro tracking-caps font-mono">
            Progress
          </span>
          <span className="text-ink text-micro font-mono tabular-nums">
            {done} / {total} done
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="from-aura-violet to-aura-cyan h-full rounded-full bg-gradient-to-r"
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{
              duration: reduce ? 0 : 0.7,
              ease: EASE,
              delay: reduce ? 0 : 0.15,
            }}
          />
        </div>
      </div>

      <ul className="space-y-2">
        {total === 0 && (
          <li>
            <EmptyTab
              icon="check"
              text="Nothing queued — add the first task below."
            />
          </li>
        )}
        {work.tasks.map((task) => (
          <li
            key={task.id}
            className="border-line/70 flex items-center gap-3 rounded-xl border bg-white/[0.03] px-3 py-2.5"
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={task.done}
              aria-label={`${task.done ? "Reopen" : "Complete"} ${task.title}`}
              onClick={() => work.toggleTask(task.id)}
              className={cn(
                "focus-visible:ring-aura-violet/70 flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors outline-none focus-visible:ring-2",
                task.done
                  ? "bg-aura-violet border-transparent text-white"
                  : "border-line-strong hover:border-aura-violet/70",
              )}
            >
              {task.done && <Icon name="check" size="xs" />}
            </button>
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm",
                task.done ? "text-ink-ghost line-through" : "text-ink",
              )}
            >
              {task.title}
            </span>
            <button
              type="button"
              aria-label={`Delete task ${task.title}`}
              onClick={() => work.deleteTask(task.id)}
              className="text-ink-ghost hover:text-danger focus-visible:ring-aura-violet/70 shrink-0 rounded p-1 transition-colors outline-none focus-visible:ring-2"
            >
              <Icon name="trash" size="xs" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        <Input
          size="sm"
          aria-label="New task"
          placeholder="Add a task…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          className="flex-1"
          wrapperClassName="flex-1"
        />
        <Button
          variant="glass"
          size="sm"
          onClick={submit}
          iconLeft={<Icon name="plus" size="xs" />}
        >
          Add
        </Button>
      </div>
    </Section>
  );
}

/* ── Documents ──────────────────────────────────────────────────────────── */

export function DocumentsTabBody({ work }: TabBodyProps) {
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<string>(DOC_KINDS[0]);

  const submit = () => {
    if (!name.trim()) return;
    work.addDocument(name, kind);
    setName("");
  };

  return (
    <Section label="Documents" icon="file">
      <ul className="space-y-2">
        {work.documents.length === 0 && (
          <li>
            <EmptyTab
              icon="file"
              text="No documents yet — attach the first spec or runbook."
            />
          </li>
        )}
        {work.documents.map((doc) => (
          <li
            key={doc.id}
            className="border-line/70 flex items-center gap-3 rounded-xl border bg-white/[0.03] px-3 py-2.5"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05]">
              <Icon name="file" size="xs" className="text-ink-muted" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-ink block truncate text-sm">
                {doc.name}
              </span>
              <span className="text-ink-faint block font-mono text-[10px]">
                {doc.kind} · {doc.sizeKb} KB · {relativeTime(doc.updatedAt)}
              </span>
            </span>
            <button
              type="button"
              aria-label={`Delete document ${doc.name}`}
              onClick={() => work.deleteDocument(doc.id)}
              className="text-ink-ghost hover:text-danger focus-visible:ring-aura-violet/70 shrink-0 rounded p-1 transition-colors outline-none focus-visible:ring-2"
            >
              <Icon name="trash" size="xs" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          size="sm"
          aria-label="New document name"
          placeholder="Document name…"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          className="min-w-0 flex-1"
          wrapperClassName="min-w-[9rem] flex-1"
        />
        <select
          aria-label="Document kind"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          className="border-line text-ink focus:border-aura-violet/60 rounded-lg border bg-white/[0.04] px-2 py-2 font-mono text-[11px] transition-colors outline-none"
        >
          {DOC_KINDS.map((option) => (
            <option key={option} value={option} className="bg-[#0a0916]">
              {option}
            </option>
          ))}
        </select>
        <Button
          variant="glass"
          size="sm"
          onClick={submit}
          iconLeft={<Icon name="plus" size="xs" />}
        >
          Add
        </Button>
      </div>
    </Section>
  );
}

/* ── GitHub ─────────────────────────────────────────────────────────────── */

export function GithubTabBody({ project, work }: TabBodyProps) {
  const repo = work.meta?.repo ?? project.links.repo;
  const sim = useRepoSimulation(repo, project.id);
  const merged = sim.pullRequests.filter((pr) => pr.state === "merged").length;
  const openPrs = sim.pullRequests.filter((pr) => pr.state === "open").length;
  const openIssues = sim.issues.filter(
    (issue) => issue.state === "open",
  ).length;

  const stateChip = (state: string) =>
    cn(
      "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide",
      state === "merged"
        ? "border-success/30 bg-success-dim text-success"
        : state === "open"
          ? "border-info/30 bg-info-dim text-info"
          : "border-line-strong text-ink-faint",
    );

  return (
    <Section label="GitHub" icon="github">
      {/* repo header */}
      <div className="border-line/70 flex flex-wrap items-center gap-2 rounded-xl border bg-white/[0.03] p-3.5">
        <Icon name="github" size="sm" className="text-ink shrink-0" />
        <span className="text-ink min-w-0 flex-1 truncate font-mono text-xs">
          {repo}
        </span>
        <Badge
          variant={
            sim.health >= 70
              ? "success"
              : sim.health >= 45
                ? "warning"
                : "danger"
          }
          dot
        >
          {sim.health}% health
        </Badge>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <Tile
          label="CI"
          value={sim.ci.passing ? "Passing" : "Failing"}
          hint={`${sim.ci.passRate}% · ${sim.ci.avgMinutes}m avg`}
          tone={sim.ci.passing ? "text-success" : "text-danger"}
        />
        <Tile
          label="Pull requests"
          value={`${openPrs} open`}
          hint={`${merged} merged`}
        />
        <Tile
          label="Issues"
          value={`${openIssues} open`}
          hint={`${sim.issues.length} total`}
        />
        <Tile
          label="Branch"
          value={sim.branch}
          hint={`${sim.branches.length} branches`}
        />
      </div>

      <Subhead>Recent commits</Subhead>
      <ul className="space-y-2">
        {sim.commits.slice(0, 5).map((commit) => (
          <li key={commit.sha} className="flex items-center gap-2.5">
            <span className="border-line text-ink-faint rounded border px-1.5 py-0.5 font-mono text-[10px]">
              {commit.sha}
            </span>
            <span className="text-ink min-w-0 flex-1 truncate text-xs">
              {commit.message}
            </span>
            <span className="text-ink-faint shrink-0 font-mono text-[10px]">
              {commit.author} · {relativeTime(commit.at)}
            </span>
          </li>
        ))}
      </ul>

      <Subhead>Pull requests</Subhead>
      <ul className="space-y-2">
        {sim.pullRequests.slice(0, 3).map((pr) => (
          <li
            key={pr.number}
            className="border-line/70 flex items-center gap-2.5 rounded-xl border bg-white/[0.03] px-3 py-2.5"
          >
            <span className={cn(stateChip(pr.state))}>{pr.state}</span>
            <span className="text-ink min-w-0 flex-1 truncate text-xs">
              {pr.title}
            </span>
            <span className="text-ink-faint shrink-0 font-mono text-[10px]">
              #{pr.number} · {pr.author}
            </span>
          </li>
        ))}
      </ul>

      <Subhead>Issues</Subhead>
      <ul className="space-y-2">
        {sim.issues.slice(0, 3).map((issue) => (
          <li
            key={issue.number}
            className="border-line/70 flex items-center gap-2.5 rounded-xl border bg-white/[0.03] px-3 py-2.5"
          >
            <span className={cn(stateChip(issue.state))}>{issue.state}</span>
            <span className="text-ink min-w-0 flex-1 truncate text-xs">
              {issue.title}
            </span>
            <span className="border-line text-ink-muted shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px]">
              {issue.label}
            </span>
          </li>
        ))}
      </ul>

      <Subhead>Contributors</Subhead>
      <ul className="space-y-2">
        {sim.contributors.slice(0, 4).map((person) => (
          <li key={person.name} className="flex items-center gap-3">
            <span className="text-ink-muted w-16 shrink-0 font-mono text-[11px]">
              {person.name}
            </span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <span
                className="from-aura-violet to-aura-cyan block h-full rounded-full bg-gradient-to-r"
                style={{ width: `${person.share}%` }}
              />
            </span>
            <span className="text-ink-faint w-9 shrink-0 text-right font-mono text-[10px] tabular-nums">
              {person.share}%
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4">
        <Button asChild variant="glass" size="sm">
          <a
            href={project.links.repo}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="external" size="xs" />
            <span>Open repository</span>
          </a>
        </Button>
      </div>
    </Section>
  );
}

/* ── AI Insights ────────────────────────────────────────────────────────── */

function Gauge({
  label,
  value,
  barClass,
}: {
  label: string;
  value: number;
  barClass: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-ink-muted text-micro tracking-caps font-mono">
          {label}
        </span>
        <span className="text-ink text-micro font-mono tabular-nums">
          {value}%
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={cn("h-full rounded-full bg-gradient-to-r", barClass)}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{
            duration: reduce ? 0 : 0.8,
            ease: EASE,
            delay: reduce ? 0 : 0.2,
          }}
        />
      </div>
    </div>
  );
}

export function InsightsTabBody({ project, work }: TabBodyProps) {
  const insight = React.useMemo(
    () =>
      computePlanetInsight(
        project,
        work.meta ?? undefined,
        work.tasks,
        work.seedKey,
      ),
    [project, work.meta, work.tasks, work.seedKey],
  );

  const overdue =
    insight.dueAt != null &&
    insight.dueAt < Date.now() &&
    insight.progress < 90;
  const dueHint = (() => {
    if (insight.dueAt == null) return "no deadline set";
    const days = Math.ceil((insight.dueAt - Date.now()) / 86_400_000);
    if (days < 0) return `${Math.abs(days)}d ago`;
    if (days === 0) return "due today";
    return `in ${days}d`;
  })();

  return (
    <Section label="AI Insights" icon="sparkles">
      <div className="space-y-3.5">
        <Gauge
          label="Health"
          value={insight.health}
          barClass="from-aura-cyan to-aura-violet"
        />
        <Gauge
          label="Risk"
          value={insight.risk}
          barClass={
            insight.risk >= 60
              ? "from-warning to-danger"
              : insight.risk >= 35
                ? "from-warning/70 to-warning"
                : "from-success/70 to-success"
          }
        />
        <Gauge
          label="Forecast"
          value={insight.completionPrediction}
          barClass="from-aura-violet to-aura-blue"
        />
      </div>

      <Subhead>Bottlenecks</Subhead>
      {insight.bottlenecks.length === 0 ? (
        <p className="text-ink-muted text-xs">No bottlenecks detected.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {insight.bottlenecks.map((bottleneck) => (
            <span
              key={bottleneck}
              className="border-warning/30 bg-warning-dim text-warning rounded-full border px-2.5 py-1 font-mono text-[10px]"
            >
              {bottleneck}
            </span>
          ))}
        </div>
      )}

      <div className="border-line/70 mt-4 grid grid-cols-2 gap-2">
        <Tile label="Workload" value={insight.workload} hint="tracked tasks" />
        <Tile
          label={overdue ? "Overdue" : "Due"}
          value={insight.dueAt != null ? fmtDay(insight.dueAt) : "—"}
          hint={dueHint}
          tone={overdue ? "text-danger" : undefined}
        />
      </div>

      <p className="text-ink-faint mt-4 font-mono text-[10px] tracking-wider uppercase">
        Astra forecast · seeded locally · no network
      </p>
    </Section>
  );
}

/* ── Activity ───────────────────────────────────────────────────────────── */

export function ActivityTabBody({ project, work }: TabBodyProps) {
  const sim = useRepoSimulation(
    work.meta?.repo ?? project.links.repo,
    project.id,
  );

  const rows = React.useMemo(() => {
    const merged = [
      ...work.activity.map((entry) => ({
        id: `w:${entry.id}`,
        text: entry.text,
        at: entry.at,
      })),
      ...sim.activity.map((entry, index) => ({
        id: `r:${index}`,
        text: entry.text,
        at: entry.at,
      })),
    ];
    merged.sort((a, b) => b.at - a.at);
    return merged.slice(0, 10);
  }, [work.activity, sim]);

  return (
    <Section label="Activity" icon="activity">
      {rows.length === 0 ? (
        <EmptyTab
          icon="activity"
          text="Quiet out here — activity appears as the world ships."
        />
      ) : (
        <ol className="relative space-y-3.5 pl-5">
          <span
            aria-hidden="true"
            className="bg-line-strong absolute top-1.5 bottom-1.5 left-[3px] w-px"
          />
          {rows.map((row, index) => {
            const last = index === rows.length - 1;
            return (
              <li key={row.id} className="relative">
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-1.5 -left-5 size-[7px] rounded-full",
                    last
                      ? "bg-aura-cyan shadow-glow-dot-current text-aura-cyan"
                      : "bg-line-strong",
                  )}
                />
                <p className="text-ink text-xs leading-snug">{row.text}</p>
                <p className="text-ink-faint mt-0.5 font-mono text-[10px]">
                  {relativeTime(row.at)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

/* ── Analytics ──────────────────────────────────────────────────────────── */

export function AnalyticsTabBody({ project, work }: TabBodyProps) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const sim = useRepoSimulation(
    work.meta?.repo ?? project.links.repo,
    project.id,
  );

  const now = Date.now();
  const start = Date.parse(project.createdAt) || now - 90 * 86_400_000;

  /* Completion as it grew from createdAt → now (16 samples — cheap enough
     to recompute per render rather than memoize a stale `now`). */
  const SAMPLES = 16;
  const points = Array.from({ length: SAMPLES }, (_, index) => {
    const at = start + ((now - start) * index) / (SAMPLES - 1);
    return Math.max(0, Math.min(100, progressAt(at, project, now)));
  });

  const W = 320;
  const H = 92;
  const PAD = 8;
  const stepX = (W - PAD * 2) / (points.length - 1);
  const xAt = (index: number) => PAD + index * stepX;
  const yAt = (value: number) => H - PAD - (value / 100) * (H - PAD * 2);
  const line = points
    .map(
      (value, index) =>
        `${index === 0 ? "M" : "L"}${xAt(index).toFixed(1)} ${yAt(value).toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L${xAt(points.length - 1).toFixed(1)} ${H - PAD} L${xAt(0).toFixed(1)} ${H - PAD} Z`;

  const merged = sim.pullRequests.filter((pr) => pr.state === "merged").length;

  return (
    <Section label="Analytics" icon="chart">
      {/* completion curve */}
      <div className="border-line/70 rounded-xl border bg-white/[0.03] p-3.5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-ink-muted text-micro tracking-caps font-mono">
            Completion curve
          </span>
          <span className="text-ink text-micro font-mono tabular-nums">
            {project.progress}%
          </span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block aspect-[320/92] w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={project.planet.atmosphere}
                stopOpacity="0.35"
              />
              <stop
                offset="100%"
                stopColor={project.planet.atmosphere}
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#spark-${uid})`} />
          <path
            d={line}
            fill="none"
            stroke={project.planet.atmosphere}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="text-ink-faint mt-1.5 flex justify-between font-mono text-[10px]">
          <span>{fmtDay(start)}</span>
          <span>now</span>
        </div>
      </div>

      {/* repo pulse */}
      <Subhead>Repo pulse</Subhead>
      <div className="grid grid-cols-2 gap-2">
        <Tile label="Commits" value={sim.commits.length} hint="recent window" />
        <Tile
          label="Merged PRs"
          value={merged}
          hint={`${sim.pullRequests.length} total`}
        />
        <Tile
          label="CI pass rate"
          value={`${sim.ci.passRate}%`}
          hint={`${sim.ci.avgMinutes}m average`}
          tone={sim.ci.passing ? "text-success" : "text-danger"}
        />
        <Tile
          label="Workspace"
          value={`${work.tasks.filter((task) => task.done).length}/${work.tasks.length}`}
          hint={`${work.documents.length} docs · ${work.notes.length} notes`}
        />
      </div>

      {/* contributors */}
      <Subhead>Contribution share</Subhead>
      <ul className="space-y-2">
        {sim.contributors.map((person) => (
          <li key={person.name} className="flex items-center gap-3">
            <span className="text-ink-muted w-16 shrink-0 font-mono text-[11px]">
              {person.name}
            </span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <span
                className="from-aura-violet to-aura-cyan block h-full rounded-full bg-gradient-to-r"
                style={{ width: `${person.share}%` }}
              />
            </span>
            <span className="text-ink-faint w-9 shrink-0 text-right font-mono text-[10px] tabular-nums">
              {person.share}%
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Button, Icon, Input, Modal } from "@/components";
import { workspaceActions } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";
import {
  AI_MODELS,
  COVER_PRESETS,
  DEFAULT_AI_MODEL,
  PLANET_STYLES,
  THEMES,
  fallbackCover,
  type UniverseForm,
  type UniversePrivacy,
  type UniverseRecord,
} from "@/types/workspace";

/* ────────────────────────────────────────────────────────────────────────── *
 * CreateUniverse — the floating "+" on /universe and its glassmorphism
 * form. The form is the *only* input to the generator: name, description,
 * colour theme, planet style, cover, team, AI model, privacy, repo,
 * deadline and tags hash into a seed, so two identical forms still yield
 * different systems only through their names — and the same form always
 * rebuilds the same solar system.
 *
 * Placement contract (regression probes): lives in the HUD top bar as a
 * `button`, never a `div.glass.rounded-full` (those are planet pills, which
 * the probes count by text) and never inside the footer (whose first
 * `glass-strong` is the measured ESC pill).
 * ────────────────────────────────────────────────────────────────────────── */

const EMPTY_FORM: UniverseForm = {
  name: "",
  description: "",
  themeId: THEMES[0].id,
  planetStyleId: PLANET_STYLES[0].id,
  cover: "",
  teamMembers: [],
  aiModel: DEFAULT_AI_MODEL,
  privacy: "private",
  githubRepo: "",
  deadline: "",
  tags: [],
};

const PRIVACY_OPTIONS: readonly {
  id: UniversePrivacy;
  label: string;
  icon: "shield" | "boxes" | "star";
  hint: string;
}[] = [
  { id: "private", label: "Private", icon: "shield", hint: "Only you" },
  { id: "team", label: "Team", icon: "boxes", hint: "Members only" },
  { id: "public", label: "Public", icon: "star", hint: "Anyone" },
];

/** "a, b, c" → ["a", "b", "c"] — trimmed, deduped, capped. */
function parseList(raw: string, cap: number): string[] {
  return [
    ...new Set(
      raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ].slice(0, cap);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-ink-faint text-micro tracking-caps font-mono">
      {children}
    </span>
  );
}

/** Swatch/option chip — a real radio under the hood. */
function ChoiceChip({
  active,
  onClick,
  label,
  sub,
  swatch,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub?: string;
  swatch?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-2.5 text-left transition-all duration-200 outline-none",
        "focus-visible:outline-aura-violet focus-visible:outline-2 focus-visible:outline-offset-2",
        active
          ? "border-aura-violet bg-white/[0.07] shadow-[0_0_22px_var(--shadow-glow-violet)]"
          : "border-line hover:border-line-strong hover:bg-white/[0.04]",
      )}
    >
      <span className="flex items-center gap-2">
        {swatch && (
          <span
            aria-hidden="true"
            className="size-3 shrink-0 rounded-full"
            style={{ background: swatch, boxShadow: `0 0 10px ${swatch}` }}
          />
        )}
        <span
          className={cn(
            "text-xs font-medium",
            active ? "text-ink" : "text-ink-muted",
          )}
        >
          {label}
        </span>
      </span>
      {sub && (
        <span className="text-ink-faint mt-0.5 block text-[11px]">{sub}</span>
      )}
    </button>
  );
}

function TagEditor({
  value,
  onChange,
  placeholder,
  cap = 8,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
  cap?: number;
}) {
  const [draft, setDraft] = React.useState("");

  const commit = () => {
    const next = parseList(draft, cap);
    if (next.length === 0) return;
    onChange([...new Set([...value, ...next])].slice(0, cap));
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onChange(value.filter((entry) => entry !== tag))}
            aria-label={`Remove tag ${tag}`}
            className="border-line text-ink-muted hover:border-danger/50 hover:text-ink rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors"
          >
            {tag} <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>
      <Input
        size="sm"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        hint="Press Enter to add."
      />
    </div>
  );
}

export interface CreateUniverseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the freshly created record (caller switches the scene). */
  onCreated?: (record: UniverseRecord) => void;
}

export function CreateUniverse({
  open,
  onOpenChange,
  onCreated,
}: CreateUniverseProps) {
  const reduce = useReducedMotion();
  const [form, setForm] = React.useState<UniverseForm>(EMPTY_FORM);
  const [coverIndex, setCoverIndex] = React.useState(-1); // -1 = gradient
  const canCreate = form.name.trim().length > 0;

  /* Fresh form each time the modal opens. */
  React.useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setCoverIndex(-1);
  }, [open]);

  const set = <K extends keyof UniverseForm>(key: K, value: UniverseForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = () => {
    if (!canCreate) return;
    const workspace = workspaceActions();
    const record = workspace.createUniverse({
      ...form,
      cover:
        coverIndex >= 0
          ? COVER_PRESETS[coverIndex]
          : fallbackCover(form.name.length * 37),
    });
    workspace.setActiveUniverse(record.id);
    onCreated?.(record);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={
        <span className="flex items-center gap-2.5">
          <Icon name="plus" size="sm" className="text-aura-violet" label="" />
          Create a universe
        </span>
      }
      description="Every field feeds the generator — the same inputs always rebuild the same solar system."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            disabled={!canCreate}
            iconLeft={<Icon name="sparkles" />}
          >
            Generate universe
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* ── identity ───────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Universe name"
            value={form.name}
            autoFocus
            required
            placeholder="Helios Platform"
            onChange={(event) => set("name", event.target.value)}
            hint="Hashed into the procedural seed."
          />
          <Input
            label="GitHub repository"
            value={form.githubRepo}
            placeholder="acme/helios"
            onChange={(event) => set("githubRepo", event.target.value)}
            hint="owner/repo — commits, PRs and CI are simulated."
          />
        </div>

        <label className="block space-y-2">
          <FieldLabel>Description</FieldLabel>
          <textarea
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
            rows={2}
            placeholder="What does this universe hold? Keywords steer module naming."
            className="border-line focus:border-aura-violet/60 placeholder:text-ink-ghost text-ink mt-2 w-full resize-none rounded-xl border bg-white/[0.03] px-3.5 py-2.5 text-sm leading-relaxed transition-colors outline-none focus:shadow-[0_0_0_3px_var(--shadow-glow-violet)]"
          />
        </label>

        {/* ── colour theme ───────────────────────────────────────────── */}
        <section
          className="space-y-2.5"
          role="radiogroup"
          aria-label="Colour theme"
        >
          <FieldLabel>Colour theme</FieldLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {THEMES.map((theme) => (
              <ChoiceChip
                key={theme.id}
                active={form.themeId === theme.id}
                onClick={() => set("themeId", theme.id)}
                label={theme.label}
                swatch={theme.accent}
              />
            ))}
          </div>
        </section>

        {/* ── planet style ───────────────────────────────────────────── */}
        <section
          className="space-y-2.5"
          role="radiogroup"
          aria-label="Planet style"
        >
          <FieldLabel>Planet style</FieldLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {PLANET_STYLES.map((style) => (
              <ChoiceChip
                key={style.id}
                active={form.planetStyleId === style.id}
                onClick={() => set("planetStyleId", style.id)}
                label={style.label}
              />
            ))}
          </div>
        </section>

        {/* ── cover ──────────────────────────────────────────────────── */}
        <section className="space-y-2.5" aria-label="Cover image">
          <FieldLabel>Cover</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={coverIndex < 0}
              onClick={() => setCoverIndex(-1)}
              className={cn(
                "h-12 w-20 rounded-lg border transition-all",
                coverIndex < 0
                  ? "border-aura-violet shadow-[0_0_18px_var(--shadow-glow-violet)]"
                  : "border-line hover:border-line-strong",
              )}
              style={{ background: fallbackCover(form.name.length * 37) }}
              aria-label="Procedural gradient cover"
            />
            {COVER_PRESETS.map((cover, index) => (
              <button
                key={cover}
                type="button"
                aria-pressed={coverIndex === index}
                onClick={() => setCoverIndex(index)}
                className={cn(
                  "h-12 w-20 rounded-lg border bg-cover bg-center transition-all",
                  coverIndex === index
                    ? "border-aura-violet shadow-[0_0_18px_var(--shadow-glow-violet)]"
                    : "border-line hover:border-line-strong",
                )}
                style={{ backgroundImage: `url("${cover}")` }}
                aria-label={`Cover preset ${index + 1}`}
              />
            ))}
          </div>
        </section>

        {/* ── access & model ─────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <section
            className="space-y-2.5"
            role="radiogroup"
            aria-label="Privacy"
          >
            <FieldLabel>Privacy</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              {PRIVACY_OPTIONS.map((option) => (
                <ChoiceChip
                  key={option.id}
                  active={form.privacy === option.id}
                  onClick={() => set("privacy", option.id)}
                  label={option.label}
                  sub={option.hint}
                />
              ))}
            </div>
          </section>

          <div className="space-y-4">
            <label className="block">
              <Input
                label="AI model"
                value={form.aiModel}
                list="astra-ai-models"
                onChange={(event) => set("aiModel", event.target.value)}
                hint="Assistant persona for this universe."
              />
              <datalist id="astra-ai-models">
                {AI_MODELS.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </label>
            <Input
              label="Deadline"
              type="date"
              value={form.deadline}
              onChange={(event) => set("deadline", event.target.value)}
              hint="Optional — drives risk + predictions."
            />
          </div>
        </div>

        {/* ── team ───────────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <Input
              label="Team members"
              value={form.teamMembers.join(", ")}
              placeholder="ada, grace, linus"
              onChange={(event) =>
                set("teamMembers", parseList(event.target.value, 12))
              }
              hint="Comma-separated handles."
            />
          </label>
          <div className="space-y-2">
            <FieldLabel>Tags</FieldLabel>
            <TagEditor
              value={form.tags}
              onChange={(tags) => set("tags", tags)}
              placeholder="ai, infra, launch"
            />
          </div>
        </div>

        {/* ── generation preview (procedural flourish, no data) ──────── */}
        <AnimatePresence>
          {canCreate && (
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-ink-faint flex items-center gap-2 font-mono text-[11px]"
            >
              <Icon
                name="orbit"
                size="sm"
                label=""
                className="text-aura-cyan"
              />
              seed preview · {form.tags.join(" / ") || "no tags"} ·{" "}
              {form.privacy} · {form.aiModel}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}

/**
 * The floating trigger — sits in the HUD top bar. Exported separately so
 * the shell can place it without re-rendering the whole modal tree.
 */
export function CreateUniverseButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="cosmic"
      size="sm"
      onClick={onClick}
      aria-label="Create a new universe"
      className="pointer-events-auto"
      iconLeft={<Icon name="plus" />}
    >
      <span className="hidden sm:inline">New universe</span>
    </Button>
  );
}

"use client";

import * as React from "react";

import { Button, Icon, Input, Modal } from "@/components";
import {
  settingsActions,
  useSettings,
  useSoundConfig,
  workspaceActions,
  aiActions,
  githubActions,
  syncActions,
  aiConfigured,
  githubConfigured,
  resolveModel,
} from "@/hooks";
import { SETTINGS_EVENT, type SettingsSection } from "@/lib/settings-event";
import type { IconName } from "@/lib/icons";
import { playCue, configure as configureAudio } from "@/lib/audio";
import { canInstall, isInstalled, promptInstall } from "@/lib/install";
import { cn, relativeTime } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────── *
 * Settings — the device-local control room. One dialog, five sections:
 *
 *   assistant  BYO API key → free-form asks stream from a real model,
 *              with the built-in engine as the ever-ready fallback,
 *   github     optional token → live repo activity over the simulation,
 *   sync       secret-gist upload/pull of the whole workspace,
 *   sound      procedural audio master + ambient + cues,
 *   app        install, offline note, about.
 *
 * Mounted once in the root layout; any surface opens it through
 * `openSettings(section)` (custom event, same pattern as the tour).
 * Radix gives us the dialog contract — focus trap, `Esc`, `aria-modal` —
 * which is exactly what the palette's ⌘K guard and the tour's auto-start
 * guard look for, so Escape precedence stays intact for free.
 * ────────────────────────────────────────────────────────────────────────── */

type TabId = SettingsSection;
type Tone = "ok" | "err" | "muted";
interface Note {
  tone: Tone;
  text: string;
}

const TABS: ReadonlyArray<{ id: TabId; label: string; icon: IconName }> = [
  { id: "assistant", label: "Assistant", icon: "sparkles" },
  { id: "github", label: "GitHub", icon: "github" },
  { id: "sync", label: "Sync", icon: "refresh" },
  { id: "sound", label: "Sound", icon: "activity" },
  { id: "app", label: "App", icon: "box" },
];

/* ── Primitives ──────────────────────────────────────────────────────────── */

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors outline-none",
        "focus-visible:outline-aura-violet",
        checked
          ? "border-aura-violet/60 bg-aura-violet/60"
          : "border-line-strong bg-white/[0.08]",
      )}
    >
      <span
        className={cn(
          "bg-ink absolute top-1/2 left-0.5 size-4 -translate-y-1/2 rounded-full shadow transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-line flex items-center justify-between gap-4 rounded-xl border bg-white/[0.03] px-4 py-3",
        disabled && "opacity-50",
      )}
    >
      <div className="min-w-0">
        <p className="text-ink text-sm font-medium">{label}</p>
        <p className="text-ink-muted text-xs">{desc}</p>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function StatusLine({ note }: { note: Note | null }) {
  if (!note) return null;
  return (
    <p
      aria-live="polite"
      className={cn(
        "flex items-start gap-2 text-xs leading-relaxed",
        note.tone === "ok" && "text-aura-cyan",
        note.tone === "err" && "text-danger",
        note.tone === "muted" && "text-ink-muted",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-1 size-1.5 shrink-0 rounded-full",
          note.tone === "ok" && "bg-aura-cyan",
          note.tone === "err" && "bg-danger",
          note.tone === "muted" && "bg-ink-faint",
        )}
      />
      <span className="min-w-0 break-words">{note.text}</span>
    </p>
  );
}

function SectionIntro({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="space-y-1">
      <h3 className="text-ink text-sm font-semibold tracking-wide">{title}</h3>
      <p className="text-ink-muted text-xs leading-relaxed">{desc}</p>
    </div>
  );
}

function SecretInput({
  label,
  hint,
  value,
  onChange,
  placeholder,
  id,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  id: string;
}) {
  const [visible, setVisible] = React.useState(false);
  return (
    <Input
      id={id}
      label={label}
      hint={hint}
      type={visible ? "text" : "password"}
      value={value}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((flag) => !flag)}
          className="text-ink-muted hover:text-ink tracking-caps focus-visible:text-ink text-[10px] uppercase outline-none"
        >
          {visible ? "Hide" : "Show"}
        </button>
      }
    />
  );
}

/* ── Sections ────────────────────────────────────────────────────────────── */

function AssistantSection() {
  const { ai } = useSettings();
  const [note, setNote] = React.useState<Note | null>(null);
  const [busy, setBusy] = React.useState(false);
  const configured = aiConfigured(ai);

  const test = async () => {
    if (!configured) {
      setNote({ tone: "err", text: "Add an API key first." });
      return;
    }
    setBusy(true);
    setNote(null);
    const result = await aiActions().test({
      provider: ai.provider,
      model: resolveModel(ai),
      key: ai.key.trim(),
      messages: [{ role: "user", content: "Reply with the word: ready" }],
      maxTokens: 8,
    });
    setNote({ tone: result.ok ? "ok" : "err", text: result.message });
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      <SectionIntro
        title="Astra's brain"
        desc="Add an API key and free-form questions stream from a real model — grounded in your live universe briefing. Commands, camera moves and every no-network path stay on the built-in engine, so Astra never goes dark."
      />

      <div className="space-y-1.5">
        <p className="text-ink-muted tracking-caps text-[10px] uppercase">
          Provider
        </p>
        <div
          role="radiogroup"
          aria-label="AI provider"
          className="border-line flex gap-1 rounded-lg border bg-white/[0.04] p-1"
        >
          {(["openai", "anthropic"] as const).map((provider) => (
            <button
              key={provider}
              type="button"
              role="radio"
              aria-checked={ai.provider === provider}
              onClick={() => {
                settingsActions().setAi({ provider });
                setNote(null);
              }}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm transition-colors outline-none",
                "focus-visible:outline-aura-violet",
                ai.provider === provider
                  ? "text-ink bg-white/[0.1] shadow-sm"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              {provider === "openai" ? "OpenAI" : "Anthropic"}
            </button>
          ))}
        </div>
      </div>

      <Input
        id="settings-model"
        label="Model"
        hint={`Blank uses the provider default (${
          ai.provider === "openai" ? "gpt-4o-mini" : "claude-sonnet-4"
        }).`}
        value={ai.model}
        placeholder={
          ai.provider === "openai" ? "gpt-4o-mini" : "claude-sonnet-4-20250514"
        }
        spellCheck={false}
        autoComplete="off"
        onChange={(event) =>
          settingsActions().setAi({ model: event.target.value })
        }
      />

      <SecretInput
        id="settings-ai-key"
        label="API key"
        hint="Stored in this browser only — never exported, never synced, sent only to the provider you choose."
        value={ai.key}
        placeholder={ai.provider === "openai" ? "sk-…" : "sk-ant-…"}
        onChange={(key) => {
          settingsActions().setAi({ key });
          setNote(null);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="glass"
          size="sm"
          onClick={test}
          disabled={busy}
          iconLeft={
            <Icon
              name={busy ? "loader" : "activity"}
              className={busy ? "animate-spin" : undefined}
            />
          }
        >
          {busy ? "Testing…" : "Test connection"}
        </Button>
        <span
          className={cn(
            "flex items-center gap-2 text-xs",
            configured ? "text-ink-muted" : "text-ink-faint",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              configured ? "bg-aura-cyan" : "bg-ink-faint",
            )}
          />
          {configured
            ? `Live model on — ${ai.provider === "openai" ? "OpenAI" : "Anthropic"} · ${resolveModel(ai)}`
            : "No key — the built-in engine answers everything, offline."}
        </span>
      </div>

      <StatusLine note={note} />
    </div>
  );
}

function GithubSection() {
  const { github } = useSettings();
  const [note, setNote] = React.useState<Note | null>(null);
  const [busy, setBusy] = React.useState(false);
  const configured = githubConfigured(github);

  const test = async () => {
    if (!configured) {
      setNote({ tone: "err", text: "Add a token first." });
      return;
    }
    setBusy(true);
    setNote(null);
    const result = await githubActions().test(github.token.trim());
    setNote({ tone: result.ok ? "ok" : "err", text: result.message });
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      <SectionIntro
        title="Live repository data"
        desc="A read-only token swaps the seeded activity simulation for real commits, pull requests, issues and checks from your repos. Without a token nothing changes — the feed stays simulated exactly as shipped."
      />

      <SecretInput
        id="settings-gh-token"
        label="Personal access token"
        hint="Classic token with public repo read is enough; add the gist scope to unlock Sync. Stored locally, sent only to api.github.com."
        value={github.token}
        placeholder="ghp_…"
        onChange={(token) => {
          settingsActions().setGithub({ token });
          setNote(null);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="glass"
          size="sm"
          onClick={test}
          disabled={busy}
          iconLeft={
            <Icon
              name={busy ? "loader" : "github"}
              className={busy ? "animate-spin" : undefined}
            />
          }
        >
          {busy ? "Checking…" : "Check token"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            githubActions().clearRepoCache();
            window.dispatchEvent(new Event("astra:github-refresh"));
            setNote({
              tone: "ok",
              text: "Cache cleared — activity refetches on the next view.",
            });
          }}
          iconLeft={<Icon name="refresh" />}
        >
          Refresh cache
        </Button>
        <span className="text-ink-muted flex items-center gap-2 text-xs">
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              configured ? "bg-aura-cyan" : "bg-ink-faint",
            )}
          />
          {configured ? "Live activity on" : "Simulated activity"}
        </span>
      </div>

      <StatusLine note={note} />
    </div>
  );
}

function SyncSection() {
  const { github } = useSettings();
  const [note, setNote] = React.useState<Note | null>(null);
  const [busy, setBusy] = React.useState<"upload" | "pull" | null>(null);
  const [confirmUpload, setConfirmUpload] = React.useState(false);
  const [pending, setPending] = React.useState<{
    json: string;
    count: number;
  } | null>(null);
  const [gistDraft, setGistDraft] = React.useState("");

  const token = github.token.trim();
  const gistId = (github.gistId || gistDraft).trim();

  if (!token) {
    return (
      <div className="space-y-4">
        <SectionIntro
          title="Workspace sync"
          desc="Push this workspace to a secret gist and pull it onto any machine — same JSON as the manager's export/import files, so sync and file backups are interchangeable."
        />
        <p className="border-line text-ink-muted rounded-xl border bg-white/[0.03] px-4 py-3 text-xs leading-relaxed">
          Sync needs a GitHub token with the{" "}
          <code className="text-aura-cyan">gist</code> scope — add one in the
          GitHub tab first.
        </p>
        <StatusLine note={note} />
      </div>
    );
  }

  const upload = async () => {
    if (!confirmUpload) {
      setConfirmUpload(true);
      setNote({
        tone: "muted",
        text: github.gistId
          ? "This overwrites the remote gist with this device's workspace. Click again to confirm."
          : "This creates a new secret gist. Click again to confirm.",
      });
      return;
    }
    setConfirmUpload(false);
    setBusy("upload");
    setNote(null);
    try {
      const content = workspaceActions().exportJson();
      const result = await syncActions().upload({
        token,
        gistId: github.gistId || null,
        content,
      });
      settingsActions().setGithub({
        gistId: result.id,
        lastSynced: Date.now(),
      });
      setNote({
        tone: "ok",
        text: `${result.created ? "Created secret gist" : "Pushed to"} ${result.id.slice(0, 8)}… · ${relativeTime(Date.now())}`,
      });
      playCue("sync");
    } catch (error) {
      setNote({
        tone: "err",
        text: error instanceof Error ? error.message : "Upload failed.",
      });
    } finally {
      setBusy(null);
    }
  };

  const pull = async () => {
    if (!gistId) {
      setNote({ tone: "err", text: "Paste the gist id to pull from." });
      return;
    }
    setBusy("pull");
    setNote(null);
    try {
      const result = await syncActions().pull({ token, gistId });
      let count = 0;
      try {
        const parsed = JSON.parse(result.content) as {
          universes?: unknown[];
        };
        count = parsed.universes?.length ?? 0;
      } catch {
        throw new Error("That gist doesn't contain a workspace.");
      }
      if (!github.gistId && gistDraft) {
        settingsActions().setGithub({ gistId: gistDraft.trim() });
      }
      setPending({ json: result.content, count });
      setNote({
        tone: "muted",
        text: `Gist holds ${count} universe${count === 1 ? "" : "s"} (updated ${relativeTime(result.updatedAt)}). Replace this device's workspace to continue.`,
      });
    } catch (error) {
      setNote({
        tone: "err",
        text: error instanceof Error ? error.message : "Pull failed.",
      });
    } finally {
      setBusy(null);
    }
  };

  const replace = () => {
    if (!pending) return;
    const result = workspaceActions().importJson(pending.json);
    if (result.ok) {
      settingsActions().setGithub({ lastSynced: Date.now() });
      setNote({
        tone: "ok",
        text: `Restored ${result.count} universe${result.count === 1 ? "" : "s"} from the gist.`,
      });
      playCue("sync");
    } else {
      setNote({ tone: "err", text: result.error ?? "Import failed." });
    }
    setPending(null);
  };

  return (
    <div className="space-y-5">
      <SectionIntro
        title="Workspace sync"
        desc="Push this workspace to a secret gist, pull it onto any machine. The payload is byte-for-byte the manager's export — sync and file backups are interchangeable, and every move is an explicit confirm."
      />

      <div className="border-line space-y-3 rounded-xl border bg-white/[0.03] px-4 py-3.5">
        <div className="text-ink-muted flex items-center justify-between gap-3 text-xs">
          <span>
            Gist{" "}
            <code className="text-aura-cyan">
              {github.gistId
                ? `${github.gistId.slice(0, 8)}…`
                : "not linked yet"}
            </code>
          </span>
          <span>
            {github.lastSynced
              ? `Last synced ${relativeTime(github.lastSynced)}`
              : "Never synced from this device"}
          </span>
        </div>

        {!github.gistId && (
          <Input
            id="settings-gist-id"
            label="Gist id"
            hint="Only needed when pulling on a new device — copy it from the device that uploaded."
            value={gistDraft}
            placeholder="Paste gist id (abc123…)"
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setGistDraft(event.target.value)}
          />
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="glass"
            size="sm"
            onClick={upload}
            disabled={busy !== null}
            iconLeft={
              <Icon
                name={
                  busy === "upload"
                    ? "loader"
                    : confirmUpload
                      ? "check"
                      : "upload"
                }
                className={busy === "upload" ? "animate-spin" : undefined}
              />
            }
          >
            {busy === "upload"
              ? "Uploading…"
              : confirmUpload
                ? "Confirm upload"
                : "Upload workspace"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={pending ? undefined : pull}
            disabled={busy !== null || Boolean(pending)}
            iconLeft={
              <Icon
                name={busy === "pull" ? "loader" : "download"}
                className={busy === "pull" ? "animate-spin" : undefined}
              />
            }
          >
            {busy === "pull" ? "Pulling…" : "Pull from gist"}
          </Button>
          {pending && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={replace}
                iconLeft={<Icon name="check" />}
              >
                Replace workspace
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPending(null);
                  setNote({ tone: "muted", text: "Pull cancelled." });
                }}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      <StatusLine note={note} />
    </div>
  );
}

function SoundSection() {
  const { sound } = useSettings();
  const setSound = (patch: Partial<typeof sound>) =>
    settingsActions().setSound(patch);

  const preview = () => {
    // Preview is an explicit request to hear the cue — bypass a dead switch
    // for one shot (the stored preference is untouched).
    configureAudio({ volume: sound.volume, ui: true });
    playCue("open");
  };

  return (
    <div className="space-y-5">
      <SectionIntro
        title="Sound & atmosphere"
        desc="Procedural audio, no files: a three-oscillator drone tuned to each universe's key, plus soft interface cues. Ships off — your call."
      />

      <div className="space-y-2.5">
        <ToggleRow
          label="Master sound"
          desc="Everything silent when off."
          checked={sound.on}
          onChange={(on) => setSound({ on })}
        />
        <ToggleRow
          label="Ambient drone"
          desc="Slow pad while you're inside a universe."
          checked={sound.ambient}
          onChange={(ambient) => setSound({ ambient })}
          disabled={!sound.on}
        />
        <ToggleRow
          label="Interface cues"
          desc="Palette open, send & reply, focus, warp, sync."
          checked={sound.ui}
          onChange={(ui) => setSound({ ui })}
          disabled={!sound.on}
        />
      </div>

      <div className="space-y-2">
        <div className="text-ink-muted flex items-center justify-between text-xs">
          <label htmlFor="settings-volume" className="tracking-caps uppercase">
            Volume
          </label>
          <span className="text-ink tabular-nums">
            {Math.round(sound.volume * 100)}%
          </span>
        </div>
        <input
          id="settings-volume"
          type="range"
          min={0}
          max={100}
          value={Math.round(sound.volume * 100)}
          onChange={(event) =>
            setSound({ volume: Number(event.target.value) / 100 })
          }
          className="accent-aura-violet w-full cursor-pointer"
        />
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={preview}
        iconLeft={<Icon name="play" />}
      >
        Preview cue
      </Button>
    </div>
  );
}

function AppSection() {
  const [installable, setInstallable] = React.useState(false);
  const [installed, setInstalled] = React.useState(false);
  const [note, setNote] = React.useState<Note | null>(null);

  React.useEffect(() => {
    const sync = () => {
      setInstallable(canInstall());
      setInstalled(isInstalled());
    };
    sync();
    window.addEventListener("astra:installable", sync);
    return () => window.removeEventListener("astra:installable", sync);
  }, []);

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      setNote({
        tone: "ok",
        text: "Installing — Astra will live in your dock.",
      });
    } else if (outcome === "dismissed") {
      setNote({ tone: "muted", text: "Install dismissed." });
    } else {
      setNote({
        tone: "muted",
        text: "No install prompt here — use your browser's “Install app / Add to Home Screen” menu.",
      });
    }
    setInstallable(canInstall());
    setInstalled(isInstalled());
  };

  return (
    <div className="space-y-5">
      <SectionIntro
        title="Astra OS"
        desc="A local-first workspace: every universe, note and credential lives in this browser, exportable at any time from the manager toolbar."
      />

      <div className="border-line space-y-3 rounded-xl border bg-white/[0.03] px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ink text-sm font-medium">Install app</p>
            <p className="text-ink-muted text-xs">
              Standalone window, dock icon, offline-cached shell.
            </p>
          </div>
          {installed ? (
            <span className="border-aura-violet/40 text-aura-cyan flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
              <Icon name="check" className="size-3.5" />
              Installed
            </span>
          ) : (
            <Button
              variant="glass"
              size="sm"
              onClick={install}
              iconLeft={<Icon name="download" />}
            >
              {installable ? "Install Astra OS" : "How to install"}
            </Button>
          )}
        </div>
        <p className="text-ink-faint text-xs leading-relaxed">
          Core pages are cached by a service worker, so /universes, /universe
          and /shortcuts open even offline. Live AI, GitHub and sync need a
          connection when they run.
        </p>
      </div>

      <div className="border-line space-y-1.5 rounded-xl border bg-white/[0.03] px-4 py-3.5">
        <p className="text-ink text-sm font-medium">About</p>
        <p className="text-ink-muted text-xs leading-relaxed">
          Astra OS — a token-driven, dark-first interface built with Next.js 15,
          Tailwind CSS v4 and Framer Motion. Ships with zero backend:
          persistence, backups and every integration are yours to configure.
        </p>
        <a
          href="https://github.com/jaswanthv2207-sys/astra-os"
          target="_blank"
          rel="noreferrer"
          className="text-aura-violet inline-flex items-center gap-1.5 text-xs hover:underline"
        >
          <Icon name="github" className="size-3.5" />
          Source on GitHub
          <Icon name="external" className="size-3" />
        </a>
      </div>

      <StatusLine note={note} />
    </div>
  );
}

/* ── Root ────────────────────────────────────────────────────────────────── */

export function SettingsModal() {
  const [open, setOpen] = React.useState(false);
  const [section, setSection] = React.useState<TabId>("assistant");

  /* Push sound prefs into the audio engine — mounted for the app's life. */
  useSoundConfig();

  React.useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ section?: SettingsSection }>)
        .detail;
      if (detail?.section) setSection(detail.section);
      setOpen(true);
    };
    window.addEventListener(SETTINGS_EVENT, onOpen);
    return () => window.removeEventListener(SETTINGS_EVENT, onOpen);
  }, []);

  const focusTab = (id: TabId) =>
    requestAnimationFrame(() =>
      document.getElementById(`settings-tab-${id}`)?.focus(),
    );

  const onTabKeyDown = (event: React.KeyboardEvent) => {
    const index = TABS.findIndex((tab) => tab.id === section);
    let next = index;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      next = (index + 1) % TABS.length;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      next = (index - 1 + TABS.length) % TABS.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = TABS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const target = TABS[next];
    if (target) {
      setSection(target.id);
      focusTab(target.id);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Settings"
      description="Device-local preferences and credentials — secrets never leave this browser except to their own APIs."
      size="lg"
    >
      <div className="flex flex-col gap-5 sm:flex-row">
        <div
          role="tablist"
          aria-label="Settings sections"
          aria-orientation="vertical"
          onKeyDown={onTabKeyDown}
          className="border-line flex gap-1 overflow-x-auto rounded-xl border bg-white/[0.03] p-1 sm:w-40 sm:shrink-0 sm:flex-col sm:overflow-visible"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={section === tab.id}
              aria-controls={`settings-panel-${tab.id}`}
              tabIndex={section === tab.id ? 0 : -1}
              onClick={() => setSection(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors outline-none",
                "focus-visible:outline-aura-violet",
                section === tab.id
                  ? "border-line-strong text-ink border bg-white/[0.08]"
                  : "text-ink-muted hover:text-ink border border-transparent hover:bg-white/[0.04]",
              )}
            >
              <Icon name={tab.icon} className="size-4 shrink-0 opacity-80" />
              {tab.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`settings-panel-${section}`}
          aria-labelledby={`settings-tab-${section}`}
          tabIndex={0}
          className="min-w-0 flex-1 outline-none"
        >
          {section === "assistant" && <AssistantSection />}
          {section === "github" && <GithubSection />}
          {section === "sync" && <SyncSection />}
          {section === "sound" && <SoundSection />}
          {section === "app" && <AppSection />}
        </div>
      </div>
    </Modal>
  );
}

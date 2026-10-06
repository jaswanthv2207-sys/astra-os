"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Button, Icon } from "@/components";
import { PROJECTS, type Project } from "@/data";
import {
  useAssistant,
  type AssistantAction,
  type AssistantMessage,
} from "@/hooks/use-assistant";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSearch } from "@/hooks/use-search";
import { useUniverse } from "@/hooks/use-universe";
import { cn } from "@/lib/utils";

import { respond, suggestReplies } from "./assistant-reply";

/* ────────────────────────────────────────────────────────────────────────── *
 * UniverseAssistant — Astra, the glowing orb in the lower-right corner of
 * the universe and the conversational interface it expands into.
 *
 * The orb breathes (halo pulse, drifting float, spinning dashed ring),
 * answers to hover with a glow and a label, and — clicked — hands the stage
 * to a smoked-glass panel that grows from the orb's corner. The conversation
 * runs on the local reply engine (`assistant-reply.ts`): the same parser
 * behind the floating search, so "Show all AI projects" glows the matches,
 * frames them and — after a readable beat — collapses the panel so the
 * camera reveal owns the stage, exactly like a search commit.
 *
 * Placement: the dossier owns the right edge on desktop, so the anchor
 * column slides left of it while a world is focused; on mobile the dossier
 * is a bottom sheet, so the orb politely disappears until it closes. The
 * HUD's footer reserves the corner (`pr-20`) so nothing collides with the
 * orb's hit area.
 * ────────────────────────────────────────────────────────────────────────── */

const EASE = [0.16, 1, 0.3, 1] as const;
/** Exit curve — collapses feel decisive rather than floaty. */
const EASE_IN = [0.4, 0, 1, 1] as const;
/** `right-6` (24) + dossier `w-[440px]` + a 24px gutter. */
const DOSSIER_SHIFT = -464;
/** How long a camera-running reply stays on screen before the panel folds. */
const REVEAL_HOLD_MS = 1150;

/* ── Waveform ────────────────────────────────────────────────────────────── */

/**
 * Waveform — the thinking indicator: staggered bars breathing in a gradient.
 * Static under reduced motion (the copy and status line still change), and
 * marked `data-waveform` as a selector hook for automated QA.
 */
function Waveform({
  animate,
  bars = 5,
  size = "md",
}: {
  animate: boolean;
  bars?: number;
  size?: "sm" | "md";
}) {
  return (
    <span
      aria-hidden="true"
      data-waveform=""
      className={cn(
        "flex items-center gap-[3px]",
        size === "md" ? "h-4" : "h-2.5",
      )}
    >
      {Array.from({ length: bars }, (_, index) => (
        <motion.span
          key={index}
          className={cn(
            "from-aura-violet to-aura-cyan w-[3px] origin-bottom rounded-full bg-gradient-to-t",
            size === "md" && "shadow-[0_0_6px_var(--palette-cyan)]",
          )}
          style={{ height: "100%" }}
          initial={{ scaleY: 0.3 }}
          animate={
            animate ? { scaleY: [0.3, 1, 0.4, 0.9, 0.3] } : { scaleY: 0.35 }
          }
          transition={
            animate
              ? {
                  duration: 1.05,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                  delay: index * 0.11,
                }
              : { duration: 0.25 }
          }
        />
      ))}
    </span>
  );
}

/* ── Orb ─────────────────────────────────────────────────────────────────── */

interface OrbProps {
  reduce: boolean;
  thinking: boolean;
  unread: boolean;
  delay: number;
  onOpen: () => void;
  orbRef: React.RefCallback<HTMLButtonElement>;
}

function AssistantOrb({
  reduce,
  thinking,
  unread,
  delay,
  onOpen,
  orbRef,
}: OrbProps) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.7 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.7 }}
      transition={{
        duration: reduce ? 0 : 0.5,
        ease: EASE,
        delay: reduce ? 0 : delay,
      }}
      className="relative"
    >
      <div className={cn("animate-float", reduce && "animate-none")}>
        <button
          ref={orbRef}
          type="button"
          onClick={onOpen}
          aria-label={
            unread
              ? "Open Astra assistant (conversation in progress)"
              : "Open Astra assistant"
          }
          className="group ease-out-expo focus-visible:outline-aura-cyan relative grid size-14 place-items-center rounded-full transition-transform duration-300 outline-none hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-4 active:scale-95 sm:size-16"
        >
          {/* halo — the gentle pulse */}
          <span
            aria-hidden="true"
            className="animate-pulse-glow from-aura-violet/70 via-aura-indigo/50 to-aura-cyan/60 absolute -inset-1 rounded-full bg-gradient-to-br opacity-70 blur-[14px] transition-opacity duration-300 group-hover:opacity-100"
          />
          {/* dashed orbit ring — slow rotation */}
          {!reduce && (
            <span
              aria-hidden="true"
              className="animate-spin-slow border-aura-violet-soft/40 absolute -inset-0.5 rounded-full border border-dashed"
            />
          )}
          {/* frosted shell */}
          <span
            aria-hidden="true"
            className="glass-strong absolute inset-0 rounded-full"
          />
          {/* gradient core */}
          <span
            aria-hidden="true"
            className="shadow-glow-violet relative grid size-8 place-items-center rounded-full sm:size-9"
            style={{
              background:
                "radial-gradient(circle at 32% 30%, rgb(255 255 255 / 0.85), rgb(255 255 255 / 0) 44%), linear-gradient(140deg, var(--palette-violet), var(--palette-cyan))",
            }}
          >
            {thinking ? (
              <Waveform animate={!reduce} bars={3} size="sm" />
            ) : (
              <Icon name="sparkles" size="xs" className="text-white/90" />
            )}
          </span>
          {/* unread marker — there is history to return to */}
          {unread && (
            <span
              aria-hidden="true"
              className="border-void bg-aura-cyan absolute top-1 right-1 size-2 rounded-full border shadow-[0_0_8px_var(--palette-cyan)]"
            />
          )}
          {/* hover / focus label */}
          <span className="glass-strong text-ink absolute top-1/2 right-full mr-3 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
            Ask Astra
          </span>
        </button>
      </div>
    </motion.div>
  );
}

/* ── Messages ────────────────────────────────────────────────────────────── */

function UserBubble({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="flex justify-end"
    >
      <p className="text-on-aura from-aura-violet to-aura-indigo max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br px-3.5 py-2 text-sm leading-relaxed shadow-[0_8px_24px_-12px_var(--palette-violet)]">
        {text}
      </p>
    </motion.div>
  );
}

function AstraBubble({
  message,
  reduce,
  onAction,
}: {
  message: AssistantMessage;
  reduce: boolean;
  onAction: (action: AssistantAction) => void;
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.3, ease: EASE }}
      className="flex justify-start"
    >
      <div className="max-w-[92%]">
        <div className="border-line/70 glass flex gap-2.5 rounded-2xl rounded-bl-md border p-3">
          <span
            aria-hidden="true"
            className="mt-1.5 size-2 shrink-0 rounded-full"
            style={{
              background:
                "linear-gradient(135deg, var(--palette-violet), var(--palette-cyan))",
              boxShadow: "0 0 8px var(--palette-violet)",
            }}
          />
          <p className="text-ink text-sm leading-relaxed whitespace-pre-wrap">
            {message.text}
          </p>
        </div>
        {message.actions && message.actions.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {message.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onAction(action)}
                className="glass text-ink-muted hover:text-ink hover:border-aura-violet/60 focus-visible:outline-aura-cyan flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <Icon name={action.icon} size="xs" />
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ThinkingBubble({ reduce }: { reduce: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="border-line/70 glass flex w-fit items-center gap-3 rounded-2xl rounded-bl-md border px-3.5 py-2.5"
    >
      <Waveform animate={!reduce} bars={6} />
      <span className="text-ink-faint font-mono text-[10px] tracking-widest uppercase">
        reasoning
      </span>
    </div>
  );
}

/* ── Panel ───────────────────────────────────────────────────────────────── */

interface PanelProps {
  reduce: boolean;
  thinking: boolean;
  messages: readonly AssistantMessage[];
  context: Project | null;
  suggestions: readonly string[];
  draft: string;
  onDraft: (value: string) => void;
  onSend: (text: string) => void;
  onAction: (action: AssistantAction) => void;
  onClose: () => void;
}

function AssistantPanel({
  reduce,
  thinking,
  messages,
  context,
  suggestions,
  draft,
  onDraft,
  onSend,
  onAction,
  onClose,
}: PanelProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const logRef = React.useRef<HTMLDivElement>(null);

  // Focus lands in the composer the moment the panel exists…
  React.useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  // …and the transcript follows each new line (promptly under reduce).
  React.useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    log.scrollTo({
      top: log.scrollHeight,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [messages, thinking, reduce]);

  const showGreeting = messages.length === 0;

  return (
    <motion.section
      role="dialog"
      aria-label="Astra assistant"
      data-astra-assistant=""
      initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.86, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={
        reduce
          ? { opacity: 0, transition: { duration: 0.12 } }
          : {
              opacity: 0,
              scale: 0.9,
              y: 12,
              transition: { duration: 0.3, ease: EASE_IN },
            }
      }
      transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
      style={{
        transformOrigin: "100% 100%",
        background:
          "linear-gradient(160deg, rgb(10 9 22 / 0.8), rgb(6 5 15 / 0.92))",
      }}
      className="border-line/70 glass-strong text-ink flex h-[min(34rem,calc(100svh_-_12rem))] w-[min(26rem,calc(100vw_-_2rem))] flex-col overflow-hidden rounded-2xl border shadow-[0_30px_90px_-30px_rgb(0_0_0_/_0.95)]"
    >
      {/* header */}
      <header className="border-line/70 flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <span className="relative grid size-8 shrink-0 place-items-center">
          <span
            aria-hidden="true"
            className={cn(
              "from-aura-violet to-aura-cyan absolute inset-0 rounded-full bg-gradient-to-br opacity-60 blur-md",
              thinking && !reduce && "animate-pulse-glow",
            )}
          />
          <span
            aria-hidden="true"
            className="relative size-6 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 32% 30%, rgb(255 255 255 / 0.85), rgb(255 255 255 / 0) 44%), linear-gradient(140deg, var(--palette-violet), var(--palette-cyan))",
            }}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-ink text-sm leading-tight font-semibold">Astra</p>
          <p className="text-ink-faint truncate font-mono text-[10px] tracking-widest uppercase">
            {thinking ? (
              <span className="text-aura-violet-soft">reasoning…</span>
            ) : context ? (
              <>context · {context.name}</>
            ) : (
              "online · local reasoning"
            )}
          </p>
        </div>
        {thinking && <Waveform animate={!reduce} bars={4} />}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close Astra assistant (Escape)"
          onClick={onClose}
          iconLeft={<Icon name="close" />}
        />
      </header>

      {/* transcript */}
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
        style={{ scrollbarWidth: "thin" }}
      >
        {showGreeting && (
          <div className="border-line/70 glass max-w-[95%] rounded-2xl rounded-bl-md border p-3">
            <p className="text-ink text-sm leading-relaxed">
              {context
                ? `I'm Astra. You're looking at ${context.name} — ask me to summarise it, list its stack, or frame the worlds it's linked to.`
                : "I'm Astra. I reason over the whole graph on-device — ask me to find, frame or open worlds across the universe."}
            </p>
            <p className="text-ink-faint mt-2 font-mono text-[10px] tracking-widest uppercase">
              Local reasoning · no network
            </p>
          </div>
        )}
        {messages.map((message) =>
          message.role === "user" ? (
            <UserBubble key={message.id} text={message.text} />
          ) : (
            <AstraBubble
              key={message.id}
              message={message}
              reduce={reduce}
              onAction={onAction}
            />
          ),
        )}
        {thinking && <ThinkingBubble reduce={reduce} />}
      </div>

      {/* contextual suggestions — keyed so chips re-fade on context change */}
      <div
        className={cn(
          "border-line/70 shrink-0 border-t px-4 pt-3 pb-1 transition-opacity duration-200",
          thinking && "pointer-events-none opacity-40",
        )}
      >
        <motion.div
          key={context?.id ?? "none"}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduce ? 0 : 0.35, ease: EASE }}
          className="flex gap-1.5 overflow-x-auto pb-1"
          style={{ scrollbarWidth: "thin" }}
        >
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSend(suggestion)}
              className="glass text-ink-muted hover:text-ink hover:border-aura-violet/60 focus-visible:outline-aura-cyan shrink-0 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {suggestion}
            </button>
          ))}
        </motion.div>
      </div>

      {/* composer */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend(draft);
        }}
        className="border-line/70 flex shrink-0 items-center gap-2 border-t px-3 py-3"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          maxLength={240}
          autoComplete="off"
          aria-label="Message Astra"
          placeholder="Ask Astra…"
          className="text-ink placeholder:text-ink-ghost min-w-0 flex-1 bg-transparent px-1.5 text-sm outline-none"
        />
        <Button
          type="submit"
          variant="primary"
          size="icon-sm"
          aria-label="Send message"
          disabled={!draft.trim() || thinking}
          iconLeft={<Icon name="enter" />}
        />
      </form>
    </motion.section>
  );
}

/* ── Root ────────────────────────────────────────────────────────────────── */

export function UniverseAssistant() {
  const reduce = Boolean(useReducedMotion());
  const { open, messages, setOpen, push } = useAssistant();
  const { focusedId, focus, release } = useUniverse();
  const { setMatches, frame, clearFrame } = useSearch();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const [draft, setDraft] = React.useState("");
  const [thinking, setThinking] = React.useState(false);

  const context = React.useMemo(
    () => PROJECTS.find((project) => project.id === focusedId) ?? null,
    [focusedId],
  );
  const suggestions = React.useMemo(() => suggestReplies(context), [context]);

  /* ── Placement: share the right edge with the dossier ────────────────── */
  const dossierOpen = Boolean(focusedId);
  const occluded = dossierOpen && !isDesktop;
  const shiftX = dossierOpen && isDesktop ? DOSSIER_SHIFT : 0;

  // The mobile bottom sheet covers the orb's corner — fold the panel first
  // so no invisible dialog stays mounted under the dossier.
  React.useEffect(() => {
    if (dossierOpen && !isDesktop && open) setOpen(false);
  }, [dossierOpen, isDesktop, open, setOpen]);

  /* ── Conversation ─────────────────────────────────────────────────────── */
  const timers = React.useRef<number[]>([]);
  React.useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const uid = React.useId();
  const seq = React.useRef(0);
  const nextId = React.useCallback(() => `${uid}-${(seq.current += 1)}`, [uid]);

  /** Execute a camera move: mirrors a reveal commit's semantics. */
  const execute = React.useCallback(
    (action: { kind: "focus" | "frame"; ids: readonly string[] }) => {
      if (action.kind === "focus") {
        const [id] = action.ids;
        if (!id) return;
        clearFrame();
        focus(id);
      } else if (action.kind === "frame" && action.ids.length > 0) {
        const ids = [...action.ids];
        release();
        setMatches(ids);
        frame(ids);
      }
    },
    [clearFrame, focus, frame, release, setMatches],
  );

  const send = React.useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || thinking) return;
      setDraft("");
      push({ id: nextId(), role: "user", text });
      setThinking(true);

      const reply = respond(text, { focused: context });
      const thinkMs = reduce ? 240 : 520 + Math.min(460, reply.text.length * 4);
      const replyTimer = window.setTimeout(() => {
        setThinking(false);
        push({
          id: nextId(),
          role: "astra",
          text: reply.text,
          actions: reply.actions,
        });
        if (reply.run) {
          // The reveal owns the stage — hold the copy briefly, then fold.
          execute(reply.run);
          const foldTimer = window.setTimeout(
            () => setOpen(false),
            reduce ? 60 : REVEAL_HOLD_MS,
          );
          timers.current.push(foldTimer);
        }
      }, thinkMs);
      timers.current.push(replyTimer);
    },
    [context, execute, nextId, push, reduce, setOpen, thinking],
  );

  /** Action chips run immediately and fold the panel (same stage rules). */
  const runAction = React.useCallback(
    (action: AssistantAction) => {
      execute(action);
      setOpen(false);
    },
    [execute, setOpen],
  );

  /* ── Focus handoff: panel input → orb button on close ────────────────── */
  const pendingOrbFocus = React.useRef(false);
  const wasOpen = React.useRef(open);
  React.useEffect(() => {
    if (wasOpen.current && !open) pendingOrbFocus.current = true;
    wasOpen.current = open;
  }, [open]);
  const orbRef = React.useCallback<React.RefCallback<HTMLButtonElement>>(
    (node) => {
      if (!node || !pendingOrbFocus.current) return;
      pendingOrbFocus.current = false;
      node.focus();
    },
    [],
  );

  // First orb entrance lands after the HUD settles; later returns are quick.
  const orbSeeded = React.useRef(false);
  React.useEffect(() => {
    orbSeeded.current = true;
  }, []);
  const orbDelay = orbSeeded.current ? 0.08 : 0.8;

  return (
    <div
      data-astra-anchor=""
      className="z-popover pointer-events-none fixed inset-x-0 bottom-0 flex justify-end p-4 sm:p-6"
    >
      <motion.div
        className="flex flex-col items-end"
        style={{ pointerEvents: occluded ? "none" : "auto" }}
        animate={{
          x: reduce ? 0 : shiftX,
          opacity: occluded ? 0 : 1,
          scale: occluded ? 0.85 : 1,
        }}
        transition={{ duration: reduce ? 0 : 0.5, ease: EASE }}
      >
        <AnimatePresence mode="wait">
          {!open ? (
            <AssistantOrb
              key="orb"
              reduce={reduce}
              thinking={thinking}
              unread={messages.length > 0}
              delay={orbDelay}
              onOpen={() => setOpen(true)}
              orbRef={orbRef}
            />
          ) : (
            <AssistantPanel
              key="panel"
              reduce={reduce}
              thinking={thinking}
              messages={messages}
              context={context}
              suggestions={suggestions}
              draft={draft}
              onDraft={setDraft}
              onSend={send}
              onAction={runAction}
              onClose={() => setOpen(false)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

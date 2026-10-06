import { PROJECTS, type Project } from "@/data";
import type { IconName } from "@/lib/icons";

import { parseQuery } from "./search-query";

/* ────────────────────────────────────────────────────────────────────────── *
 * assistant-reply — the local "understanding" layer behind Astra.
 *
 * Conversational requests are matched in priority order — greeting/help
 * small-talk, then what a *specific* world is built with, linked to and
 * about — before falling back to the search parser (`search-query.ts`), so
 * "What powers Quasar ML?", "Show worlds linked to it" and
 * "Show all AI projects" all resolve without a network round-trip. Pure
 * functions only: the UI owns state and executes the returned camera
 * moves, this owns meaning.
 *
 * The action shape mirrors (structurally) `AssistantAction` in
 * `stores/assistant-store.ts` — same decoupling as the search store: the
 * engine never imports stores, the component pushes replies verbatim.
 * ────────────────────────────────────────────────────────────────────────── */

/** A camera move Astra can perform (chip or immediate `run`). */
export interface AssistantReplyAction {
  /** Stable key for React lists. */
  id: string;
  /** Chip label. */
  label: string;
  /** Icon registry name rendered inside the chip. */
  icon: IconName;
  /** Camera move: fly to one world, or frame a set of worlds. */
  kind: "focus" | "frame";
  /** Target world id(s) — one for focus, many for frame. */
  ids: readonly string[];
}

export interface AssistantReply {
  /** Message body (may contain \n bullets). */
  text: string;
  /** Chips rendered under the bubble for later, manual moves. */
  actions?: readonly AssistantReplyAction[];
  /**
   * Camera move executed the moment the reply lands (search parity: a
   * results reply glows the matches, frames them and — after a beat so the
   * copy is readable — collapses the panel so the reveal owns the stage).
   */
  run?: AssistantReplyAction;
}

/* ── Intent patterns ─────────────────────────────────────────────────────── */

const GREETING_RE =
  /^(hi|hey|hello|yo|hiya|howdy|good (morning|afternoon|evening))\b/i;
const HELP_RE =
  /\b(what can you do|help|capabilit(?:y|ies)|commands?|how (?:do|does) (?:you|this) work)\b/i;
const IDENTITY_RE =
  /\b(who are you|what are you|your name|introduce yourself|about you)\b/i;
/** Questions about how a world is built. Checked before digest so
 *  "What's the stack of X" answers the stack, not the summary. */
const STACK_RE =
  /\b(stack|built with|made with|technolog(?:y|ies)|powers|written in)\b/i;
const RELATED_RE =
  /\b(related|neighbours?|neighbors?|linked|connections?|entangled)\b/i;
const DIGEST_RE =
  /\b(summari[sz]e|summary|overview|describe|explain|tell me about|what(?:'s|s| is| are| was))\b/i;
/** Pronouns that let a bare verb fall back to the focused world. */
const CONTEXT_RE = /\b(it|it's|its|this|this one|current|selected|focused)\b/i;

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** Find a project whose name (or a distinctive word of it) occurs in `text`. */
function matchProjectName(text: string): Project | undefined {
  const lower = text.toLowerCase();
  const full = PROJECTS.find((project) =>
    lower.includes(project.name.toLowerCase()),
  );
  if (full) return full;
  return PROJECTS.find((project) =>
    project.name
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= 4)
      .some((word) =>
        new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(
          lower,
        ),
      ),
  );
}

/** "FastAPI, React, Postgres +2" — stack line for a reply body. */
function listStack(project: Project): string {
  const { stack } = project;
  const head = stack.slice(0, 3).join(", ");
  return stack.length > 3 ? `${head} +${stack.length - 3}` : head;
}

/** "Nebula Studio, Quasar ML +2 more" — name list capped at three. */
function listNames(names: readonly string[]): string {
  const head = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${head} +${names.length - 3} more` : head;
}

function flyAction(project: Project): AssistantReplyAction {
  return {
    id: `fly-${project.id}`,
    label: `Fly to ${project.name}`,
    icon: "orbit",
    kind: "focus",
    ids: [project.id],
  };
}

/* ── Reply bodies ────────────────────────────────────────────────────────── */

function greetingReply(focused: Project | null): AssistantReply {
  return {
    text: focused
      ? `Hey — I'm Astra. You're looking at ${focused.name}: I can summarise it, list its stack, or frame the worlds it's linked to — or search the whole universe.`
      : "Hey — I'm Astra, the assistant built into Astra OS. I read the whole graph on-device and fly the camera for you. Ask me to find, frame or open worlds.",
  };
}

const IDENTITY_REPLY =
  "I'm Astra — this OS's assistant. No cloud round-trip: I parse your intent locally, then move the camera, glow the matching worlds and surface the dossier for you.";

const HELP_REPLY = [
  "I reason over the whole graph, on-device:",
  "• Find by stack — “Find projects using Fast API”",
  "• Filter by tag — “Show all AI projects”",
  "• Jump to the freshest — “Open my latest hackathon project”",
  "• Explain what you're viewing — “Summarise it”",
  "I'll fly the camera for you as we go.",
].join("\n");

function stackReply(target: Project): AssistantReply {
  return {
    text: `${target.name} runs ${listStack(target)} — ${target.progress}% complete.`,
    actions: [flyAction(target)],
  };
}

function relatedReply(target: Project): AssistantReply {
  const linked = target.related
    .map((id) => PROJECTS.find((project) => project.id === id))
    .filter((project): project is Project => Boolean(project));
  if (linked.length === 0) return digestReply(target);
  const beams = `knowledge beam${linked.length === 1 ? "" : "s"}`;
  return {
    text: `${target.name} is linked to ${listNames(linked.map((p) => p.name))} through ${linked.length} ${beams}. Framing the cluster now.`,
    actions: [flyAction(target)],
    run: {
      id: `frame-linked-${target.id}`,
      label: "Frame linked worlds",
      icon: "network",
      kind: "frame",
      ids: [target.id, ...target.related],
    },
  };
}

function digestReply(target: Project): AssistantReply {
  const linked = target.related
    .map((id) => PROJECTS.find((project) => project.id === id))
    .filter((project): project is Project => Boolean(project));
  const linkedLine = linked.length
    ? `\nLinked to ${listNames(linked.map((p) => p.name))}.`
    : "";
  return {
    text: `${target.name} — ${target.summary}\n\n${listStack(target)} · ${target.progress}% complete${linkedLine}`,
    actions: [
      flyAction(target),
      {
        id: `frame-linked-${target.id}`,
        label: "Frame linked worlds",
        icon: "network",
        kind: "frame",
        ids: [target.id, ...target.related],
      },
    ],
  };
}

/* ── Engine ──────────────────────────────────────────────────────────────── */

export interface RespondContext {
  /** The world the camera is holding, if any — the conversation's context. */
  focused: Project | null;
}

/**
 * respond — one user utterance in, one reply out.
 *
 * @example
 * respond("Show all AI projects", { focused: null })
 * // → { text: "Matching AI: … Framing all 5.", run: { kind: "frame", … } }
 */
export function respond(raw: string, context: RespondContext): AssistantReply {
  const text = raw.trim();
  if (!text) {
    return {
      text: "Ask me anything about this universe — a tag, a stack, or which world you're curious about.",
    };
  }

  // Conversational small-talk first, so greetings never fall through to
  // the text scorer (which would answer them with an unrelated world).
  if (GREETING_RE.test(text)) return greetingReply(context.focused);
  if (IDENTITY_RE.test(text)) return { text: IDENTITY_REPLY };
  if (HELP_RE.test(text)) return { text: HELP_REPLY };

  // World-scoped questions: an explicit name, or a pronoun with a focused
  // world under the camera ("summarise it").
  const target =
    matchProjectName(text) ?? (CONTEXT_RE.test(text) ? context.focused : null);
  if (target) {
    if (STACK_RE.test(text)) return stackReply(target);
    if (RELATED_RE.test(text)) return relatedReply(target);
    if (DIGEST_RE.test(text)) return digestReply(target);
  }

  // Universe queries — the same parser the floating search uses, so both
  // surfaces agree on what "latest", "Fast API" or "AI" means.
  const intent = parseQuery(text);
  if (intent && intent.results.length > 0) {
    const { results, reason, detail } = intent;
    const n = results.length;
    const names = listNames(results.map((project) => project.name));
    const describe =
      reason === "recent"
        ? `The ${n} freshest worlds: ${names}.`
        : reason === "text"
          ? `Matching “${detail}”: ${names}.`
          : `Matching ${detail}: ${names}.`;
    const open = intent.open || n === 1;
    const best = results[0];
    return {
      text: open
        ? `${describe} Opening ${best.name}.`
        : `${describe} Framing all ${n}.`,
      run: open
        ? {
            id: `open-${best.id}`,
            label: `Open ${best.name}`,
            icon: "orbit",
            kind: "focus",
            ids: [best.id],
          }
        : {
            id: "frame-results",
            label: "Frame results",
            icon: "network",
            kind: "frame",
            ids: results.map((project) => project.id),
          },
    };
  }

  return {
    text: `I couldn't tie “${text}” to a world. Try a tag (“AI”), a stack (“Fast API”), “latest”, or ask what I can do.`,
  };
}

/**
 * suggestReplies — the chips under the composer: contextual when a world is
 * focused, discovery-oriented otherwise.
 */
export function suggestReplies(focused: Project | null): string[] {
  if (focused) {
    return [
      `Summarise ${focused.name}`,
      `What powers ${focused.name}?`,
      `Show worlds linked to ${focused.name}`,
      "Show all AI projects",
    ];
  }
  return [
    "What can you do?",
    "Show all AI projects",
    "Find projects using Fast API",
    "Open my latest hackathon project",
  ];
}

import { type Project } from "@/data";
import { sceneProjects } from "@/data/scene-data";
import type { UniverseBriefing } from "@/hooks/use-insights";
import type { IconName } from "@/lib/icons";
import type { PlanetInsight } from "@/lib/universe-generator";

import { parseQuery } from "./search-query";
import { formatTimelineDate } from "./timeline";

/* ────────────────────────────────────────────────────────────────────────── *
 * assistant-reply — the local "understanding" layer behind Astra.
 *
 * Conversational requests are matched in priority order — greeting/help
 * small-talk, then what a *specific* world is built with, linked to and
 * about, then whole-universe status read from the live briefing — before
 * falling back to the search parser (`search-query.ts`), so
 * "What powers Quasar ML?", "Show worlds linked to it",
 * "How's my universe doing?" and "Show all AI projects" all resolve without
 * a network round-trip. Pure functions only: the UI owns state and executes
 * the returned camera moves, this owns meaning.
 *
 * The action shape mirrors (structurally) `AssistantAction` in
 * `stores/assistant-store.ts` — same decoupling as the search store: the
 * engine never imports stores, the component pushes replies verbatim (the
 * briefing arrives as a plain data snapshot — a type-only import from the
 * hooks layer, no runtime edge).
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
/** A *specific* world's status — checked before digest so "What's the
 *  status of Quasar ML" answers the numbers, not the summary. */
const WORLD_STATUS_RE =
  /\b(status|health|how('s| is| are) .{0,40}(doing|going|looking)|forecast|predict(?:ion|ions)?|due|deadline|risk\w*|bottleneck\w*|attention)\b/i;

/* Universe-scoped questions — answered from the live briefing whenever no
 * specific world is in play, so they never fall through to the text scorer
 * as "couldn't tie … to a world". */
const TASKS_RE = /\b(task\w*|todo\w*|deadline\w*|workload|due)\b/i;
const INSIGHTS_RE =
  /\b(attention\w*|insight\w*|bottleneck\w*|recommend\w*|advice|priorit\w*|what needs|what should i|risk\w*)\b/i;
const UNIVERSE_RE =
  /\b((my|this|the|our|whole|entire) universe|universe (status|health|report|summary)|how('s| is| are) (it|everything|things|this)|everything (going|doing)|overall (status|health|picture)|forecast\w*|predict(?:ion|ions)?|status( report)?|health( check)?|how are we doing)\b/i;

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** Find a project whose name (or a distinctive word of it) occurs in `text`. */
function matchProjectName(text: string): Project | undefined {
  const lower = text.toLowerCase();
  const full = sceneProjects().find((project) =>
    lower.includes(project.name.toLowerCase()),
  );
  if (full) return full;
  return sceneProjects().find((project) =>
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
  "• Universe status — “How's my universe doing?”, “What's due?”",
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
    .map((id) => sceneProjects().find((project) => project.id === id))
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
    .map((id) => sceneProjects().find((project) => project.id === id))
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

/* ── Universe-level reply bodies (briefing-backed) ──────────────────────── */

/** Chip: frame every world in the active scene at once. */
function frameAllAction(): AssistantReplyAction {
  return {
    id: "frame-all-worlds",
    label: "Frame all worlds",
    icon: "grid",
    kind: "frame",
    ids: sceneProjects().map((project) => project.id),
  };
}

/** Chip: fly to the riskiest world (null when the briefing has none). */
function riskiestAction(
  planets: readonly PlanetInsight[],
): AssistantReplyAction | null {
  const riskiest = [...planets].sort((a, b) => b.risk - a.risk)[0];
  if (!riskiest) return null;
  return {
    id: `fly-risk-${riskiest.planetId}`,
    label: `Check ${riskiest.name}`,
    icon: "target",
    kind: "focus",
    ids: [riskiest.planetId],
  };
}

/** Headline numbers: health, risk, forecast, productivity, task totals. */
function universeStatusReply(briefing: UniverseBriefing): AssistantReply {
  const { name, insights, worldCount, openTasks, doneTasks } = briefing;
  const riskiest = riskiestAction(insights.planets);
  return {
    text: [
      `${name} — ${worldCount} worlds.`,
      `Health ${insights.health} · risk ${insights.riskScore} · productivity ${insights.productivity}.`,
      `Forecast: ${insights.completionPrediction}% predicted completion.`,
      `${openTasks} open tasks · ${doneTasks} done.`,
      insights.bottleneck
        ? `Watch: ${insights.bottleneck}.`
        : "No bottleneck on the board.",
    ].join("\n"),
    actions: [frameAllAction(), ...(riskiest ? [riskiest] : [])],
  };
}

/** Attention ask: the recommended actions plus the worlds carrying risk. */
function insightsReply(briefing: UniverseBriefing): AssistantReply {
  const { insights } = briefing;
  const ranked = [...insights.planets].sort((a, b) => b.risk - a.risk);
  const atRisk = ranked.filter((planet) => planet.risk >= 45).slice(0, 3);
  const watch = (atRisk.length > 0 ? atRisk : ranked.slice(0, 2)).map(
    (planet) => `${planet.name} (${planet.risk})`,
  );
  const riskiest = riskiestAction(insights.planets);
  return {
    text: [
      "Where to look first:",
      ...insights.actions.map((action) => `• ${action}`),
      ...(watch.length > 0 ? [`Riskiest worlds: ${watch.join(", ")}.`] : []),
    ].join("\n"),
    actions: [frameAllAction(), ...(riskiest ? [riskiest] : [])],
  };
}

/** Task/deadline ask: totals across the universe plus dated milestones. */
function tasksReply(briefing: UniverseBriefing): AssistantReply {
  const { insights, worldCount, openTasks, doneTasks } = briefing;
  const deadlines = insights.deadlines.map(
    (deadline) => `• ${deadline.name} — ${formatTimelineDate(deadline.dueAt)}`,
  );
  const riskiest = riskiestAction(insights.planets);
  return {
    text: [
      `${openTasks} open tasks across ${worldCount} worlds · ${doneTasks} done.`,
      deadlines.length > 0
        ? `Next deadlines:\n${deadlines.join("\n")}`
        : "No dated milestones on the board — everything's open-ended.",
    ].join("\n"),
    actions: [frameAllAction(), ...(riskiest ? [riskiest] : [])],
  };
}

/** One world's status — its slice of the briefing (health/risk/forecast). */
function projectStatusReply(
  target: Project,
  briefing: UniverseBriefing,
): AssistantReply {
  const insight = briefing.insights.planets.find(
    (planet) => planet.planetId === target.id,
  );
  if (!insight) return digestReply(target);
  const due =
    insight.dueAt != null ? ` · due ${formatTimelineDate(insight.dueAt)}` : "";
  const lines = [
    `${target.name} — health ${insight.health} · risk ${insight.risk} · forecast ${insight.completionPrediction}%.`,
    `${insight.progress}% complete · ${insight.workload} task${insight.workload === 1 ? "" : "s"} tracked${due}.`,
  ];
  if (insight.bottlenecks.length > 0) {
    lines.push(`Watch: ${insight.bottlenecks.join(", ")}.`);
  }
  return { text: lines.join("\n"), actions: [flyAction(target)] };
}

/* ── Engine ──────────────────────────────────────────────────────────────── */

export interface RespondContext {
  /** The world the camera is holding, if any — the conversation's context. */
  focused: Project | null;
  /** Live universe rollup — status/attention/deadline asks read from it. */
  briefing?: UniverseBriefing | null;
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
  const briefing = context.briefing ?? null;
  if (target) {
    if (STACK_RE.test(text)) return stackReply(target);
    if (RELATED_RE.test(text)) return relatedReply(target);
    if (briefing && WORLD_STATUS_RE.test(text)) {
      return projectStatusReply(target, briefing);
    }
    if (DIGEST_RE.test(text)) return digestReply(target);
  }

  // Universe-scoped asks — answered from the live briefing before the text
  // scorer, so status/attention/deadline questions never degrade into a
  // "couldn't tie … to a world" fallback.
  if (!target && briefing) {
    if (TASKS_RE.test(text)) return tasksReply(briefing);
    if (INSIGHTS_RE.test(text)) return insightsReply(briefing);
    if (UNIVERSE_RE.test(text)) return universeStatusReply(briefing);
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
 * focused, discovery-oriented otherwise. With a briefing in hand the
 * universe-level asks join the row (the container scrolls, so 5–6 fit).
 */
export function suggestReplies(
  focused: Project | null,
  briefing?: UniverseBriefing | null,
): string[] {
  const universe = briefing
    ? ["How's my universe doing?", "What's due soon?"]
    : [];
  if (focused) {
    return [
      `Summarise ${focused.name}`,
      `What powers ${focused.name}?`,
      `Show worlds linked to ${focused.name}`,
      "Show all AI projects",
      ...universe,
    ];
  }
  return [
    "What can you do?",
    "Show all AI projects",
    "Find projects using Fast API",
    "Open my latest hackathon project",
    ...universe,
  ];
}

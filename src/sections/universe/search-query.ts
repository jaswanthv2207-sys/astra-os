import { type Project } from "@/data";
import { sceneProjects } from "@/data/scene-data";

/* ────────────────────────────────────────────────────────────────────────── *
 * search-query — the local "understanding" layer behind Astra's asks.
 *
 * A query is parsed in priority order — technologies, then classification
 * tags, then recency, then a loose keyword fallback — so natural phrasings
 * like "Show all AI projects", "Find projects using Fast API" or "Open my
 * latest hackathon project" all resolve to a set of worlds without a network
 * round-trip. Pure functions only: the assistant owns state, this owns
 * meaning.
 * ────────────────────────────────────────────────────────────────────────── */

export type SearchReason =
  "stack" | "tag" | "mixed" | "recent" | "text" | "empty";

export interface SearchIntent {
  /** Matched worlds, best first (structured matches sort by recency). */
  results: Project[];
  /** Which layer of the parser produced the answer. */
  reason: SearchReason;
  /** Human label for what matched — "FastAPI", "AI", "latest"… */
  detail: string;
  /** The phrasing asked to *open* something ("open my …"). */
  open: boolean;
}

/* ── vocabulary ──────────────────────────────────────────────────────────── */

/**
 * Natural phrases that activate each classification tag. Phrases are matched
 * as whole words (multi-word phrases allow hyphen/whitespace joins), so
 * "ai" never fires inside "email" and "real time" also reads "real-time".
 */
const TAG_PHRASES: Record<string, readonly string[]> = {
  ai: ["ai", "artificial intelligence", "genai", "llm"],
  design: ["design", "designer", "ui", "ux"],
  frontend: ["frontend", "front-end", "front end"],
  webgl: ["webgl"],
  graph: ["graph"],
  knowledge: ["knowledge"],
  database: ["database"],
  devops: ["devops", "dev ops", "operations"],
  ci: ["ci", "pipeline", "continuous integration"],
  automation: ["automation", "automated", "autonomous"],
  search: ["search", "retrieval"],
  nlp: ["nlp", "natural language"],
  neural: ["neural"],
  notes: ["notes", "notebook", "note taking"],
  productivity: ["productivity", "workspace"],
  ml: ["machine learning", "ml"],
  hackathon: ["hackathon", "hack"],
  mlops: ["mlops", "model ops", "training"],
  network: ["network", "routing", "router", "traffic"],
  edge: ["edge"],
  performance: ["performance", "latency"],
  realtime: ["realtime", "real time", "real-time"],
  infrastructure: ["infrastructure", "infra"],
  collaboration: ["collaboration", "collaborative", "shared"],
};

/** Pretty spellings for tag ids in the response line. */
const TAG_DISPLAY: Record<string, string> = {
  ai: "AI",
  ml: "ML",
  ci: "CI",
  nlp: "NLP",
  mlops: "MLOps",
  webgl: "WebGL",
  devops: "DevOps",
};

/** Words the parser treats as grammar, not signal. */
const STOPWORDS = new Set([
  "show",
  "find",
  "open",
  "list",
  "search",
  "give",
  "me",
  "my",
  "all",
  "the",
  "a",
  "an",
  "of",
  "using",
  "with",
  "that",
  "which",
  "what",
  "where",
  "when",
  "who",
  "why",
  "how",
  "do",
  "does",
  "did",
  "is",
  "are",
  "was",
  "were",
  "be",
  "to",
  "in",
  "on",
  "at",
  "for",
  "from",
  "by",
  "and",
  "or",
  "not",
  "no",
  "yes",
  "i",
  "we",
  "you",
  "it",
  "its",
  "this",
  "project",
  "projects",
  "world",
  "worlds",
  "app",
  "apps",
  "about",
  "related",
  "between",
  "across",
  "inside",
  "any",
  "some",
  "get",
  "need",
  "want",
  "see",
  "look",
  "please",
  "can",
  "could",
  "would",
  "should",
  "most",
  "more",
  "than",
  "then",
  "there",
  "here",
  "their",
  "them",
  "they",
  "latest",
  "newest",
  "recent",
  "last",
]);

/** Recency phrasing — narrows an otherwise broad ask to the freshest worlds. */
const RECENT_RE = /\b(latest|newest|most recent|recent|last)\b/i;
/** "Open …" phrasing — the commit should open the best match, not just frame. */
const OPEN_RE = /\bopen\b/i;

/** `\bai\b` — never fires inside "email"; multi-word joins allow hyphens. */
function phraseRegex(phrase: string): RegExp {
  const pattern = phrase
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[\\s-]*");
  return new RegExp(`\\b${pattern}\\b`, "i");
}

/**
 * `FastAPI` → `/fast[\s._/-]*api\b/i` — matches "FastAPI", "fast api" and
 * "fast-api" alike while word boundaries keep "rust" out of "trust".
 */
function stackRegex(stack: string): RegExp {
  const chars = stack.replace(/[^a-z0-9]/gi, "");
  const pattern = chars.split("").join("[\\s._/-]*");
  return new RegExp(`\\b${pattern}\\b`, "i");
}

/**
 * Stack vocabulary for the current scene. Computed lazily and memoised on
 * the projects array identity, so `parseQuery` (called per ask) never
 * rebuilds regexes — and a universe swap naturally invalidates the cache.
 */
type StackKey = { key: string; display: string; regex: RegExp };

let stackKeySource: readonly Project[] | null = null;
let stackKeyCache: StackKey[] = [];

function stackKeys(projects: readonly Project[]): StackKey[] {
  if (stackKeySource === projects) return stackKeyCache;
  stackKeySource = projects;
  stackKeyCache = [...new Set(projects.flatMap((p) => [...p.stack]))].map(
    (display) => ({
      key: display.toLowerCase().replace(/[^a-z0-9]/g, ""),
      display,
      regex: stackRegex(display),
    }),
  );
  return stackKeyCache;
}

const tagPatterns = Object.entries(TAG_PHRASES).map(([tag, phrases]) => ({
  tag,
  regexes: phrases.map(phraseRegex),
}));

/* ── helpers ─────────────────────────────────────────────────────────────── */

const normStack = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

function haystack(project: Project): string {
  return [
    project.name,
    project.summary,
    project.overview,
    project.stack.join(" "),
    project.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

/** Freshest first — the default "best match" ordering for structured asks. */
function byRecency(projects: readonly Project[]): Project[] {
  return [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function displayTag(tag: string): string {
  return TAG_DISPLAY[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1);
}

/* ── parser ──────────────────────────────────────────────────────────────── */

/**
 * Parse one natural-language query into a search intent.
 * Returns `null` for an empty/whitespace-only query.
 *
 * @example
 * parseQuery("Find projects using Fast API")   // → 1 world, reason "stack"
 * parseQuery("Open my latest hackathon project") // → open, narrowed to 1
 */
export function parseQuery(raw: string): SearchIntent | null {
  const query = raw.trim();
  if (!query) return null;

  const projects = sceneProjects();
  const open = OPEN_RE.test(query);
  const recent = RECENT_RE.test(query);

  /* Layer 1 — technologies ("Fast API", "Next.js", "Rust"). */
  const stackKeysHit = stackKeys(projects).filter((entry) =>
    entry.regex.test(query),
  );
  /* Layer 2 — classification tags ("AI", "hackathon", "notes"). */
  const tagHits = tagPatterns
    .filter((entry) => entry.regexes.some((regex) => regex.test(query)))
    .map((entry) => entry.tag);

  const hasFilter = stackKeysHit.length > 0 || tagHits.length > 0;
  let results: Project[];
  let reason: SearchReason;
  let detail = "";

  if (hasFilter) {
    /* Structured layers combine as AND: "AI projects using Fast API". */
    results = projects.filter(
      (project) =>
        (stackKeysHit.length === 0 ||
          project.stack.some((s) =>
            stackKeysHit.some((hit) => hit.key === normStack(s)),
          )) &&
        (tagHits.length === 0 ||
          tagHits.some((tag) => project.tags.includes(tag))),
    );
    if (recent && results.length > 0) {
      results = byRecency(results).slice(0, open ? 1 : 3);
    } else {
      results = byRecency(results);
    }
    reason =
      stackKeysHit.length > 0 && tagHits.length > 0
        ? "mixed"
        : stackKeysHit.length > 0
          ? "stack"
          : "tag";
    detail = [
      stackKeysHit.map((hit) => hit.display).join(", "),
      tagHits.map(displayTag).join(", "),
    ]
      .filter(Boolean)
      .join(" · ");
  } else if (recent) {
    /* "latest …" with no other constraint — the freshest handful. */
    results = byRecency(projects).slice(0, open ? 1 : 3);
    reason = "recent";
    detail = "most recent";
  } else {
    /* Layer 3 — loose keyword fallback over names, prose, stacks and tags. */
    const terms = query
      .toLowerCase()
      .replace(/[^a-z0-9\s+#.-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 2 && !STOPWORDS.has(word));
    const scored = projects
      .map((project) => ({
        project,
        score: terms.reduce(
          (total, term) => total + (haystack(project).includes(term) ? 1 : 0),
          0,
        ),
      }))
      .filter((entry) => entry.score > 0);
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        b.project.updatedAt.localeCompare(a.project.updatedAt),
    );
    results = scored.map((entry) => entry.project);
    reason = results.length > 0 ? "text" : "empty";
    detail = terms.join(" ");
  }

  if (results.length === 0) reason = "empty";
  return { results, reason, detail, open };
}

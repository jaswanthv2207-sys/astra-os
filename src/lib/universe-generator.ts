/**
 * universe-generator — turn a `UniverseRecord` (form + seed) into a fully
 * procedural solar system: planets derived from project modules, links,
 * orbit geometry, planet palettes, labels and per-planet workspace metadata.
 *
 * Pure and deterministic: the same record always regenerates the same scene,
 * so the workspace store never has to persist the generated `Project[]`
 * (records stay small; scenes rebuild on load).
 *
 * Non-overlap invariants (documented in `data/projects.ts`) are respected by
 * construction:
 *   • planets on the same centre sit on radii spaced 8 units apart while
 *     their sphere radii sum to ≤ 4.3 → centres are always ≥ 3.7 apart,
 *   • centres are the three stock invisible points (55–61 apart) while the
 *     furthest orbit + planet reaches ≤ 24.5 units.
 *
 * Uniqueness comes from everything else: module names, counts, phases,
 * speeds, inclinations, palette (theme + style + seed), surface seeds,
 * spin/tilt, band character, star tint, orbit-ring tint and sector labels.
 */

import type {
  Project,
  ProjectLayer,
  ProjectLink,
  ProjectMilestone,
  ProjectPlanet,
  ProjectShot,
  ProjectStat,
} from "@/data";
import type { IconName } from "@/lib/icons";
import { relatedKnowledge } from "@/lib/knowledge-links";
import { classifyUniverse } from "@/lib/planet-category";
import {
  chance,
  float,
  int,
  pick,
  rngFrom,
  shuffle,
  slugify,
} from "@/lib/prng";
import type {
  PlanetActivity,
  PlanetDocument,
  PlanetMeta,
  PlanetNote,
  PlanetTask,
  UniverseRecord,
} from "@/types/workspace";
import { styleById, themeById } from "@/types/workspace";

/* ── Module vocabulary ────────────────────────────────────────────────────── */

/** Curated module lexicon — the building blocks every universe composes from. */
const MODULE_LEXICON = [
  "Core",
  "API",
  "Auth",
  "Gateway",
  "Sync",
  "Search",
  "Dashboard",
  "Pipeline",
  "Agents",
  "Studio",
  "Index",
  "Router",
  "Cache",
  "Queue",
  "Billing",
  "Analytics",
  "Registry",
  "Console",
  "Vault",
  "Workers",
  "Events",
  "Metrics",
  "Console",
  "Fleet",
  "Ledger",
  "Mesh",
  "Streams",
  "Canvas",
  "Deploy",
  "Observability",
] as const;

const MODULE_STACK: Record<string, readonly string[]> = {
  api: ["FastAPI", "OpenAPI", "Uvicorn", "Pydantic"],
  auth: ["OAuth2", "JWT", "Argon2", "RBAC"],
  gateway: ["Envoy", "gRPC", "Nginx", "mTLS"],
  sync: ["CRDT", "WebSockets", "Redis", "Postgres"],
  search: ["Meilisearch", "BM25", "Embeddings", "Vitest"],
  dashboard: ["React", "Recharts", "D3", "Zustand"],
  pipeline: ["Airflow", "dbt", "Spark", "Parquet"],
  agents: ["LangGraph", "Tool use", "Evals", "RAG"],
  studio: ["Three.js", "R3F", "GLSL", "GSAP"],
  index: ["Tantivy", "Bloom filters", "RocksDB", "Zstd"],
  router: ["BGP", "Anycast", "eBPF", "WireGuard"],
  cache: ["Redis", "CDN", "ETags", "LRU"],
  queue: ["Kafka", "RabbitMQ", "Idempotency", "DLQ"],
  billing: ["Stripe", "Metering", "Ledger", "Tax"],
  analytics: ["ClickHouse", "Kafka", "Cohorts", "Funnels"],
  registry: ["OCI", "Helm", "Semver", "Cosign"],
  console: ["React", "XState", "Tailwind", "Radix"],
  vault: ["KMS", "Envelope crypto", "OPA", "Audit log"],
  workers: ["Temporal", "Retries", "Backoff", "Tracing"],
  events: ["EventStore", "Outbox", "CDC", "Avro"],
  metrics: ["Prometheus", "OpenTelemetry", "Grafana", "SLOs"],
  fleet: ["Kubernetes", "Argo", "Terraform", "Cilium"],
  ledger: ["Double-entry", "Append-only", "Reconciliation", "SQL"],
  mesh: ["Istio", "mTLS", "Envoy", "Latency budgets"],
  streams: ["Flink", "Watermarks", "Exactly-once", "Kafka"],
  canvas: ["WebGPU", "CanvasKit", "WASM", "Skia"],
  deploy: ["GitHub Actions", "Canaries", "Feature flags", "Rollbacks"],
  observability: ["OpenTelemetry", "Jaeger", "Loki", "Error budgets"],
  core: ["Rust", "Tokio", "WASM", "SQLite"],
};

const MODULE_ROLE = [
  "the control plane",
  "the data plane",
  "the realtime layer",
  "the delivery surface",
  "the intelligence layer",
  "the reliability layer",
  "the developer surface",
  "the integration layer",
] as const;

const STAT_POOL: readonly ProjectStat[] = [
  { label: "p95 latency", value: "42ms", delta: "-3ms" },
  { label: "throughput", value: "18.4k/s", delta: "+9%" },
  { label: "uptime", value: "99.97%", delta: "+0.02%" },
  { label: "error budget", value: "92%", delta: "+4%" },
  { label: "deploys / week", value: "37", delta: "+6" },
  { label: "test coverage", value: "87%", delta: "+2%" },
  { label: "active tenants", value: "2,140", delta: "+180" },
  { label: "cache hit rate", value: "94.2%", delta: "+1.1%" },
  { label: "mean recovery", value: "4m 12s", delta: "-38s" },
  { label: "queue depth", value: "312", delta: "-64" },
  { label: "cold start", value: "118ms", delta: "-9ms" },
  { label: "docs coverage", value: "76%", delta: "+5%" },
];

const SHOT_POOL: readonly ProjectShot[] = [
  { title: "Overview", caption: "Landing surface with live system health." },
  { title: "Traces", caption: "Distributed trace waterfall across services." },
  { title: "Console", caption: "Operator console with guarded actions." },
  { title: "Pipeline", caption: "Pipeline board with stage-level SLAs." },
  { title: "Metrics", caption: "Golden-signal dashboard per service." },
  { title: "Design tokens", caption: "Token studio with live previews." },
  { title: "Onboarding", caption: "Guided setup with progress recall." },
  { title: "Insights", caption: "Cohort insights with anomaly flags." },
];

const MILESTONE_LABELS = [
  ["Foundation laid", "Core runtime stable"],
  ["Private alpha", "First tenants onboarded"],
  ["Public beta", "Self-serve signups open"],
  ["v1 launch", "GA declared"],
  ["Scale pass", "Multi-region rollout"],
  ["Hardening", "SOC2 evidence automation"],
] as const;

const EMOJI_POOL = ["🪐", "🛸", "🛰️", "☄️", "🌌", "🔭", "🚀", "⭐", "🌙", "✨"];
const ICON_POOL: readonly IconName[] = [
  "orbit",
  "rocket",
  "sparkles",
  "zap",
  "boxes",
  "layers",
  "network",
  "palette",
  "activity",
  "shield",
  "command",
  "star",
];

const NOTE_TEMPLATES: readonly { title: string; body: string }[] = [
  {
    title: "Architecture decision",
    body: "ADR: keep the write path append-only; project reads through the materialised view so rollback stays O(1).",
  },
  {
    title: "Interview notes",
    body: "Two enterprise prospects asked for region pinning — worth a config surface before the beta window closes.",
  },
  {
    title: "Risk log",
    body: "Single-threaded exporter is the current bottleneck; shard by tenant hash and keep ordering inside the shard.",
  },
  {
    title: "Weekly sync",
    body: "Shipped the guarded rollout path. Next: token studio parity, then observability pass on the ingest edge.",
  },
  {
    title: "Customer signal",
    body: "Usage clusters around the console + metrics views; the studio is loved but under-discovered.",
  },
];

const TASK_POOL = [
  "Wire tracing into the ingest edge",
  "Backfill the migration ledger",
  "Add canary alerts for p95",
  "Draft the RBAC matrix",
  "Shard the exporter by tenant",
  "Cut a public status page",
  "Add replay support to the queue",
  "Tokenize the console theme",
  "Write the rollback runbook",
  "Instrument cold-start budget",
  "Pin regions in the tenant config",
  "Close the docs coverage gap",
];

/** Document kinds offered when adding a doc by hand (dossier + generator). */
export const DOC_KINDS = [
  "RFC",
  "Runbook",
  "Spec",
  "ADR",
  "Dashboard",
  "Guide",
];
const DOC_PREFIX = [
  "ingest",
  "gateway",
  "sync",
  "auth",
  "billing",
  "fleet",
  "console",
  "metrics",
];

const ACTIVITY_POOL = [
  "Merged the guarded rollout PR",
  "Cut release v{n}.{minor}.{patch}",
  "Flipped the new routing flag",
  "Opened the observability ADR",
  "Onboarded a design-partner tenant",
  "Closed the p95 regression",
  "Shipped the token studio pass",
];

const STATUS_WORDS = ["active", "building", "idle"] as const;

/* ── Colour helpers ───────────────────────────────────────────────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Scale a hex colour toward (factor > 1) or away from (factor < 1) white. */
function shade(hex: string, factor: number): string {
  return mix(hex, factor >= 1 ? "#ffffff" : "#000000", Math.abs(factor - 1));
}

/* ── Scene building ───────────────────────────────────────────────────────── */

/**
 * Orbit centres are deliberately *shared* with the stock graph
 * (`ORBIT_CENTRES`, re-exported through the scene): they are the invisible
 * anchors the camera framing, beam geometry and belt placement were tuned
 * against, and reusing them keeps the documented reach/separation
 * invariants (centres 55–61 apart, reach ≤ 24.5) true by construction for
 * every generated universe. Uniqueness comes from everything orbiting them.
 */

/** Orbit radius slots per centre, spaced exactly 8 units apart. */
const ORBIT_SLOTS: readonly (readonly number[])[] = [
  [6, 14, 22],
  [7, 15, 23],
  [7, 15, 23],
];

/**
 * The core world's free orbit slot — between slot 0 and slot 1 of centre 0.
 * With sphere radii capped at 1.6 the reverse-triangle gap holds ≥ 0.3 units
 * against both neighbours (6 + 2.15 = 8.15 ≤ 8.4 and 11.6 ≤ 14 − 2.15), so
 * the knowledge core can never touch a generated planet.
 */
const CORE_SLOT = 10;

/** Stable id of a universe's own knowledge core (scene + birth sequence). */
export function coreProjectId(record: UniverseRecord): string {
  return `${slugify(record.name) || "universe"}-core`;
}

/** Plane inclinations — small, readable, all different per planet. */
function orbitPlane(rng: () => number): [number, number, number] {
  return [
    float(rng, -0.42, 0.42),
    float(rng, -0.22, 0.22),
    float(rng, -0.32, 0.32),
  ];
}

/**
 * Derive module names for a universe: user tags first (they encode intent),
 * then description keywords, then the lexicon — deduped, capped at 9.
 */
function deriveModules(record: UniverseRecord, count: number): string[] {
  const rng = rngFrom(`${record.seed}:modules`, 7);
  const lower = (s: string) => s.toLowerCase();

  const descriptionWords = new Set(
    lower(record.description)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  );

  const fromTags = record.tags
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 4)
    .map((t) => t.replace(/\b\w/g, (c) => c.toUpperCase()));

  const fromDescription = shuffle(rng, [...descriptionWords])
    .slice(0, 3)
    .map((w) => w.replace(/\b\w/g, (c) => c.toUpperCase()));

  const picked: string[] = [];
  const seen = new Set<string>();
  for (const name of [...fromTags, ...fromDescription]) {
    const key = lower(name);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(name);
    if (picked.length >= count) break;
  }
  const lexicon = shuffle(rng, [...MODULE_LEXICON]);
  for (const name of lexicon) {
    if (picked.length >= count) break;
    if (seen.has(lower(name))) continue;
    seen.add(lower(name));
    picked.push(name);
  }
  return picked;
}

const STOPWORDS = new Set([
  "that",
  "with",
  "this",
  "from",
  "have",
  "will",
  "your",
  "about",
  "which",
  "their",
  "there",
  "what",
  "when",
  "make",
  "made",
  "like",
  "just",
  "over",
  "into",
  "than",
  "then",
  "them",
  "they",
  "project",
  "projects",
  "system",
  "platform",
  "service",
  "services",
]);

function stackFor(moduleName: string): readonly string[] {
  const key = moduleName.toLowerCase();
  for (const [lex, stack] of Object.entries(MODULE_STACK)) {
    if (key.includes(lex)) return stack;
  }
  return ["TypeScript", "Postgres", "Redis", "Terraform"];
}

function isoDaysAgo(now: number, days: number): string {
  return new Date(now - days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * generateScene — the whole deterministic solar system for one record.
 * Returns the `Project[]` + `ProjectLink[]` the existing scene already
 * understands, plus ambient tuning for the generated look.
 */
export interface GeneratedScene {
  projects: Project[];
  links: ProjectLink[];
  /** Star-field tint / count tweak derived from the theme. */
  starTint: string;
  starCount: number;
  /** Orbit ring colour (scene draws rings only for generated universes). */
  orbitRingColor: string;
  /** Sector label for the HUD ("Sector 07 · Helios Reach"). */
  sectorLabel: string;
}

export function generateScene(record: UniverseRecord): GeneratedScene {
  const now = Date.now();
  const rng = rngFrom(`${record.seed}:${record.name}`, 1);
  const theme = themeById(record.themeId);
  const style = styleById(record.planetStyleId);

  const planetCount = int(rng, 4, 9);
  const modules = deriveModules(record, planetCount);

  const projects: Project[] = [];
  const links: ProjectLink[] = [];

  // Distribute modules across centres (2–3 per centre, matching stock).
  const perCentre = [0, 0, 0];
  const maxPerCentre = 3;

  modules.forEach((module, index) => {
    const moduleId = slugify(module) || `module-${index + 1}`;
    const id = `${slugify(record.name) || "universe"}-${moduleId}`;

    // Choose a centre with a free orbit slot.
    const centreOrder = shuffle(rng, [0, 1, 2]);
    let centre = centreOrder[0];
    for (const c of centreOrder) {
      if (perCentre[c] < maxPerCentre) {
        centre = c;
        break;
      }
    }
    perCentre[centre] += 1;
    const slotIndex = perCentre[centre] - 1;
    const orbitRadius = ORBIT_SLOTS[centre][slotIndex];

    // Planet palette: theme accents modulated by style + seed.
    const hueShift = float(rng, -18, 18);
    const accent = mix(theme.accent, theme.accent2, float(rng, 0, 1));
    const deep = shade(mix(accent, "#0a0a18", 0.72), 0.9);
    const mid = mix(accent, shade(accent, 0.4), float(rng, 0.35, 0.65));
    const bright = shade(
      mix(accent, theme.accent2, 0.3),
      1.55 + hueShift * 0.004,
    );
    const atmosphere = shade(accent, 1.25);

    const planet: ProjectPlanet = {
      /* Reach invariant: orbit + planet ≤ 24.5 (slot 23 caps at 1.5) and
         same-centre pairs sum ≤ 4.3 (radius ≤ 2.15) — both by construction. */
      radius: Math.min(float(rng, 1.3, 2.2), 2.15, 24.5 - orbitRadius),
      deep,
      mid,
      accent: bright,
      atmosphere,
      bands: Math.min(1, Math.max(0, style.bands + float(rng, -0.12, 0.12))),
      seed: int(rng, 1, 9999),
      spin:
        float(rng, style.spin[0], style.spin[1]) * (chance(rng, 0.25) ? -1 : 1),
      tilt: float(rng, 0.06, 0.52),
    };

    // Timeline: creation spread over the past 20–34 months, milestones to now.
    const ageDays = int(rng, 610, 1030);
    const createdAt = isoDaysAgo(now, ageDays);
    const updatedAt = isoDaysAgo(now, int(rng, 1, 26));
    const milestoneCount = int(rng, 3, 5);
    const timeline: ProjectMilestone[] = [];
    for (let m = 0; m < milestoneCount; m++) {
      const [label] =
        MILESTONE_LABELS[Math.min(m, MILESTONE_LABELS.length - 1)];
      const daysAgo = Math.round(ageDays - (ageDays * m) / milestoneCount);
      const status: "done" | "planned" =
        m === 0
          ? "done"
          : m === milestoneCount - 1 && chance(rng, 0.45)
            ? "planned"
            : "done";
      timeline.push({
        date: isoDaysAgo(now, Math.max(0, daysAgo)),
        label,
        status,
      });
    }
    // Mark one mid milestone active if the universe is still shipping.
    if (timeline.length > 2 && chance(rng, 0.7)) {
      const idx = timeline.length - 2;
      timeline[idx] = { ...timeline[idx], status: "active" };
    }

    const progress = Math.max(
      8,
      Math.min(
        97,
        Math.round(
          (timeline.filter((t) => t.status === "done").length /
            timeline.length) *
            100 +
            float(rng, -8, 10),
        ),
      ),
    );

    const stack = stackFor(module);
    const repo = record.githubRepo
      ? `${record.githubRepo}/${moduleId}`
      : `github.com/${slugify(record.name) || "universe"}/${moduleId}`;

    const project: Project = {
      id,
      name: module,
      status: pick(rng, STATUS_WORDS) as Project["status"],
      summary: `${module} — ${pick(rng, MODULE_ROLE)} of ${record.name}. ${pick(
        rng,
        [
          "Guarded rollouts, live traces and tenant-scoped config from day one.",
          "Built for multi-region workloads with exactly-once semantics.",
          "A thin, observable surface over the busiest paths in the system.",
          "Designed so every action is reversible within one command.",
        ],
      )}`,
      overview: `${module} carries ${pick(rng, MODULE_ROLE)} for ${record.name}. ${
        record.description || "It keeps the surrounding systems honest."
      } The surface is deliberately small: ${stack
        .slice(0, 3)
        .join(
          ", ",
        )} underneath, one clear API above, and telemetry on every path.`,
      stats: shuffle(rng, STAT_POOL)
        .slice(0, 4)
        .map((s) => ({
          ...s,
          value:
            chance(rng, 0.5) && /\d/.test(s.value)
              ? s.value
              : `${int(rng, 40, 980)}${s.value.replace(/^[\d.,]+/, "")}`,
        })),
      architecture: [
        { name: "Edge", detail: `${stack[0]} termination with tenant auth.` },
        { name: "Service", detail: `${module} logic with structured traces.` },
        {
          name: "Data",
          detail: `${stack[2] ?? "Postgres"} storage + read model.`,
        },
      ] satisfies ProjectLayer[],
      timeline,
      related: [],
      shots: shuffle(rng, SHOT_POOL)
        .slice(0, int(rng, 2, 3))
        .map((s) => ({ ...s })),
      links: {
        repo,
        demo: `https://${slugify(record.name) || "universe"}.app/${moduleId}`,
      },
      stack,
      tags: [...record.tags.slice(0, 3), module.toLowerCase()].filter(
        (t, i, a) => a.indexOf(t) === i,
      ),
      progress,
      updatedAt,
      createdAt,
      planet,
      orbit: {
        centre: centre as 0 | 1 | 2,
        radius: orbitRadius,
        phase: float(rng, 0, Math.PI * 2),
        // One orbit ≈ 2.5–4 minutes, matching the stock feel.
        speed: float(rng, 0.026, 0.042) * (chance(rng, 0.3) ? -1 : 1),
        plane: orbitPlane(rng),
      },
    };

    projects.push(project);
  });

  // Links: chain neighbours inside each centre, then a few cross-system jumps.
  const byCentre = new Map<number, Project[]>();
  for (const p of projects) {
    const c = p.orbit.centre;
    const arr = byCentre.get(c) ?? [];
    arr.push(p);
    byCentre.set(c, arr);
  }
  for (const group of byCentre.values()) {
    for (let i = 0; i + 1 < group.length; i++) {
      links.push({ from: group[i].id, to: group[i + 1].id });
    }
  }
  const crossCount = int(rng, 2, 4);
  const centres = [...byCentre.keys()].sort();
  for (let i = 0; i < crossCount && centres.length >= 2; i++) {
    const a = pick(rng, projects);
    const b = pick(rng, projects);
    if (a.id !== b.id) links.push({ from: a.id, to: b.id });
  }

  /* ── the core — the universe's own knowledge node ─────────────────────────
     Synthesised last, after every world exists, so it can be compared with
     all of them: this is the planet the Planet Birth Experience forms when
     the universe is created. Its palette comes from the record's category
     (AI reads purple, frontend oceanic, backend metallic — see
     `planet-category.ts`), jittered by the same seed so no two cores match,
     and its radius is pinned inside the documented non-overlap envelope for
     the free orbit slot. */
  const identity = classifyUniverse(record);
  const coreStack = identity.stack;
  const coreCreatedAt = new Date(now).toISOString().slice(0, 10);

  let coreDeep: string;
  let coreMid: string;
  let coreAccent: string;
  let coreAtmosphere: string;
  let coreBands: number;
  if (identity.category === "general") {
    /* No specific signal — take the theme-derived route every other
       generated planet uses, so stock behaviour reads straight through. */
    const themeAccent = mix(theme.accent, theme.accent2, float(rng, 0, 1));
    coreDeep = shade(mix(themeAccent, "#0a0a18", 0.72), 0.9);
    coreMid = mix(themeAccent, shade(themeAccent, 0.4), float(rng, 0.35, 0.65));
    coreAccent = shade(mix(themeAccent, theme.accent2, 0.3), 1.55);
    coreAtmosphere = shade(themeAccent, 1.25);
    coreBands = Math.min(
      1,
      Math.max(0, identity.profile.bands + float(rng, -0.1, 0.1)),
    );
  } else {
    const profile = identity.profile;
    coreDeep = shade(profile.deep, 1 + float(rng, -0.07, 0.07));
    coreMid = shade(
      mix(profile.mid, theme.accent, 0.12),
      1 + float(rng, -0.06, 0.06),
    );
    coreAccent = shade(profile.accent, 1 + float(rng, -0.05, 0.1));
    coreAtmosphere = shade(
      mix(profile.atmosphere, theme.accent2, 0.1),
      1 + float(rng, -0.05, 0.08),
    );
    coreBands = Math.min(
      1,
      Math.max(0, profile.bands + float(rng, -0.08, 0.08)),
    );
  }

  const slug = slugify(record.name) || "universe";
  const coreProject: Project = {
    id: coreProjectId(record),
    name: record.name,
    status: pick(rng, STATUS_WORDS) as Project["status"],
    summary:
      record.description.trim() ||
      `${record.name} — the knowledge core that seeds every world in this universe.`,
    overview: `${record.name} is the originating knowledge node of this universe. ${
      record.description.trim() ||
      "Its worlds orbit the intent it was created with."
    } Every module out here links back through shared stack and language — search, the timeline and the dossier all read this world as the project itself.`,
    stats: shuffle(rng, STAT_POOL)
      .slice(0, 4)
      .map((s) => ({
        ...s,
        value:
          chance(rng, 0.5) && /\d/.test(s.value)
            ? s.value
            : `${int(rng, 40, 980)}${s.value.replace(/^[\d.,]+/, "")}`,
      })),
    architecture: [
      {
        name: "Core",
        detail: `${coreStack[0]} surface over the record's intent.`,
      },
      {
        name: "Knowledge",
        detail: `${coreStack[1] ?? coreStack[0]} links to every generated world.`,
      },
      {
        name: "Sync",
        detail: "Timeline, search and dossier read from one record.",
      },
    ] satisfies ProjectLayer[],
    timeline: [
      { date: coreCreatedAt, label: "Universe created", status: "done" },
      { date: coreCreatedAt, label: "Neural links mapped", status: "active" },
      {
        date: coreCreatedAt,
        label: "Continuous knowledge sync",
        status: "planned",
      },
    ],
    related: [],
    shots: shuffle(rng, SHOT_POOL)
      .slice(0, int(rng, 2, 3))
      .map((s) => ({ ...s })),
    links: {
      repo: record.githubRepo || `github.com/${slug}/${slug}-core`,
      demo: `https://${slug}.app`,
    },
    stack: coreStack,
    tags:
      identity.category === "general"
        ? record.tags.slice(0, 5)
        : [...record.tags.slice(0, 5), identity.category].filter(
            (t, i, a) => a.indexOf(t) === i,
          ),
    progress: 100,
    updatedAt: coreCreatedAt,
    createdAt: coreCreatedAt,
    planet: {
      radius: 1.5 + float(rng, 0, 0.1),
      deep: coreDeep,
      mid: coreMid,
      accent: coreAccent,
      atmosphere: coreAtmosphere,
      bands: coreBands,
      seed: int(rng, 1, 9999),
      spin:
        float(rng, style.spin[0], style.spin[1]) * (chance(rng, 0.35) ? -1 : 1),
      tilt: float(rng, 0.08, 0.5),
    },
    orbit: {
      centre: 0,
      radius: CORE_SLOT,
      phase: float(rng, 0, Math.PI * 2),
      speed: float(rng, 0.028, 0.04) * (chance(rng, 0.35) ? -1 : 1),
      plane: orbitPlane(rng),
    },
    isCore: true,
  };
  projects.push(coreProject);

  /* Phase-6 beams live in scene data from the start — the birth sequence
     simply holds them dark until the connection phase lights them. */
  for (const connection of relatedKnowledge(coreProject, projects)) {
    links.push({ from: coreProject.id, to: connection.id });
  }

  // related[] — mirror links so the dossier's "linked worlds" reads true.
  const relatedMap = new Map<string, string[]>();
  for (const l of links) {
    relatedMap.set(l.from, [...(relatedMap.get(l.from) ?? []), l.to]);
    relatedMap.set(l.to, [...(relatedMap.get(l.to) ?? []), l.from]);
  }
  for (const p of projects) {
    p.related = (relatedMap.get(p.id) ?? []).slice(0, 3);
  }

  const starTint = mix(theme.accent2, "#ffffff", 0.55);
  const sectorNumber = String(int(rng, 2, 48)).padStart(2, "0");
  const sectorWord = pick(rng, [
    "Reach",
    "Arc",
    "Drift",
    "Halo",
    "Expanse",
    "Rift",
  ]);

  return {
    projects,
    links,
    starTint,
    starCount: int(rng, 5200, 9000),
    orbitRingColor: mix(theme.accent, theme.accent2, 0.4),
    sectorLabel: `Sector ${sectorNumber} · ${record.name} ${sectorWord}`,
  };
}

/* ── Per-planet workspace data ────────────────────────────────────────────── */

/** Deterministic default workspace metadata for every generated planet. */
export function generatePlanetMeta(
  record: UniverseRecord,
): Record<string, PlanetMeta> {
  const out: Record<string, PlanetMeta> = {};
  const { projects } = generateScene(record);
  for (const project of projects) {
    const rng = rngFrom(`${record.seed}:${project.id}:meta`, 3);
    out[project.id] = {
      icon: pick(rng, ICON_POOL),
      emoji: pick(rng, EMOJI_POOL),
      completion: project.progress,
      taskCount: int(rng, 3, 12),
      aiSummary: project.summary,
      repo: project.links.repo,
      dueAt: chance(rng, 0.6)
        ? Date.now() + int(rng, 5, 120) * 86_400_000
        : null,
    };
  }
  return out;
}

/** Seeded task list for a planet (workspace store persists user edits). */
export function generatePlanetTasks(
  record: UniverseRecord,
  planetId: string,
): PlanetTask[] {
  const rng = rngFrom(`${record.seed}:${planetId}:tasks`, 4);
  const count = int(rng, 3, 7);
  return shuffle(rng, TASK_POOL)
    .slice(0, count)
    .map((title, i) => ({
      id: `${planetId}-task-${i}`,
      planetId,
      title,
      done: chance(rng, 0.45),
      createdAt: Date.now() - int(rng, 0, 40) * 86_400_000,
    }));
}

export function generatePlanetNotes(
  record: UniverseRecord,
  planetId: string,
): PlanetNote[] {
  const rng = rngFrom(`${record.seed}:${planetId}:notes`, 5);
  return shuffle(rng, NOTE_TEMPLATES)
    .slice(0, int(rng, 1, 3))
    .map((n, i) => ({
      id: `${planetId}-note-${i}`,
      planetId,
      title: n.title,
      body: n.body,
      updatedAt: Date.now() - int(rng, 1, 60) * 86_400_000,
    }));
}

export function generatePlanetDocs(
  record: UniverseRecord,
  planetId: string,
): PlanetDocument[] {
  const rng = rngFrom(`${record.seed}:${planetId}:docs`, 6);
  return shuffle(rng, DOC_KINDS)
    .slice(0, int(rng, 2, 5))
    .map((kind, i) => ({
      id: `${planetId}-doc-${i}`,
      planetId,
      name: `${pick(rng, DOC_PREFIX)}-${slugify(kind)}.${kind === "Dashboard" ? "json" : "md"}`,
      kind,
      sizeKb: int(rng, 4, 940),
      updatedAt: Date.now() - int(rng, 1, 90) * 86_400_000,
    }));
}

export function generatePlanetActivity(
  record: UniverseRecord,
  planetId: string,
): PlanetActivity[] {
  const rng = rngFrom(`${record.seed}:${planetId}:activity`, 8);
  return shuffle(rng, ACTIVITY_POOL)
    .slice(0, int(rng, 2, 4))
    .map((text, i) => ({
      id: `${planetId}-act-${i}`,
      planetId,
      text: text
        .replace("{n}", String(int(rng, 1, 4)))
        .replace("{minor}", String(int(rng, 0, 9)))
        .replace("{patch}", String(int(rng, 0, 20))),
      at: Date.now() - int(rng, 1, 45) * 86_400_000,
    }));
}

/* ── GitHub simulation (deterministic, offline) ───────────────────────────── */

export interface SimCommit {
  sha: string;
  message: string;
  author: string;
  at: number;
}

export interface SimPullRequest {
  number: number;
  title: string;
  state: "open" | "merged" | "closed";
  author: string;
  at: number;
}

export interface SimIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  label: string;
}

export interface RepoSimulation {
  repo: string;
  branch: string;
  branches: string[];
  commits: SimCommit[];
  pullRequests: SimPullRequest[];
  issues: SimIssue[];
  ci: { passing: boolean; passRate: number; avgMinutes: number };
  health: number;
  contributors: { name: string; commits: number; share: number }[];
  activity: { at: number; text: string }[];
}

const COMMIT_MSGS = [
  "fix: shard the exporter by tenant hash",
  "feat: guarded rollout path for the gateway",
  "chore: bump otel collector to 0.112",
  "perf: cache the materialised read model",
  "test: golden traces for the ingest edge",
  "docs: rollback runbook for multi-region",
  "refactor: collapse the auth middleware",
  "feat: region pinning in tenant config",
  "fix: idempotency key on the billing hook",
  "perf: batch flush for the metrics buffer",
];

const AUTHOR_POOL = [
  "mira",
  "devon",
  "sam",
  "aria",
  "jonah",
  "priya",
  "kai",
  "lena",
  "noor",
  "theo",
];

const PR_TITLES = [
  "Guarded rollout: canary + auto-rollback",
  "Tenant-scoped config surface",
  "Tracing on the ingest edge",
  "Token studio parity pass",
  "Region pinning groundwork",
  "Queue replay support",
];

const ISSUE_TITLES = [
  "p95 regression after the queue change",
  "Docs gap: RBAC matrix",
  "Cold-start budget exceeded in eu-west",
  "Export ordering under shard split",
  "Status page missing component health",
];

const LABELS = ["bug", "perf", "docs", "infra", "security", "design"];

const AUTHORS = AUTHOR_POOL;

/**
 * simulateRepo — a deterministic, offline stand-in for GitHub data so the
 * dossier can show commits / PRs / issues / CI without any network.
 */
export function simulateRepo(repo: string, seedKey: string): RepoSimulation {
  const rng = rngFrom(`${repo}:${seedKey}:repo`, 9);
  const now = Date.now();
  const branch = pick(rng, ["main", "trunk", "master"]);
  const branches = shuffle(rng, [
    branch,
    "release/canary",
    "feat/rollout",
    "chore/otel",
    "hotfix/p95",
  ]).slice(0, int(rng, 3, 5));

  const commits: SimCommit[] = [];
  for (let i = 0; i < int(rng, 6, 12); i++) {
    commits.push({
      sha: Math.floor(rng() * 0xfffffff)
        .toString(16)
        .padStart(7, "0"),
      message: pick(rng, COMMIT_MSGS),
      author: pick(rng, AUTHORS),
      at: now - int(rng, 0, 90) * 86_400_000 - int(rng, 0, 86_400_000),
    });
  }
  commits.sort((a, b) => b.at - a.at);

  const pullRequests: SimPullRequest[] = [];
  for (let i = 0; i < int(rng, 3, 6); i++) {
    pullRequests.push({
      number: int(rng, 120, 498),
      title: pick(rng, PR_TITLES),
      state: pick(rng, ["merged", "merged", "open", "closed"]),
      author: pick(rng, AUTHORS),
      at: now - int(rng, 1, 60) * 86_400_000,
    });
  }

  const issues: SimIssue[] = [];
  for (let i = 0; i < int(rng, 2, 5); i++) {
    issues.push({
      number: int(rng, 40, 220),
      title: pick(rng, ISSUE_TITLES),
      state: chance(rng, 0.55) ? "open" : "closed",
      label: pick(rng, LABELS),
    });
  }

  const passRate = Math.round(float(rng, 78, 99));
  const ci = {
    passing: passRate >= 85,
    passRate,
    avgMinutes: int(rng, 3, 14),
  };

  const health = Math.round(
    Math.min(
      99,
      passRate * 0.5 +
        float(rng, 20, 45) +
        pullRequests.filter((p) => p.state === "merged").length * 3,
    ),
  );

  const counts = new Map<string, number>();
  for (const c of commits)
    counts.set(c.author, (counts.get(c.author) ?? 0) + 1);
  const contributors = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, n]) => ({
      name,
      commits: n,
      share: Math.round((n / commits.length) * 100),
    }));

  const activity = commits.slice(0, 6).map((c) => ({
    at: c.at,
    text: `${c.author} pushed ${c.sha} — ${c.message}`,
  }));

  return {
    repo,
    branch,
    branches,
    commits,
    pullRequests,
    issues,
    ci,
    health,
    contributors,
    activity,
  };
}

export interface RepoFeedItem {
  /** Commit hash (7 chars). */
  sha: string;
  message: string;
  author: string;
  /** Repo short name (last path segment). */
  repo: string;
  /** Committed-at timestamp (ms). */
  at: number;
}

/** One universe-wide GitHub pulse aggregated across every world's repo. */
export interface RepoFeed {
  /** How many worlds carry a repo. */
  repos: number;
  /** Average CI pass rate across repos (passing at the 85% bar). */
  ci: { passing: boolean; passRate: number };
  prsOpen: number;
  prsMerged: number;
  issuesOpen: number;
  /** Distinct branch names across every repo. */
  branches: number;
  /** Freshest commits across the whole universe, newest first. */
  activity: RepoFeedItem[];
}

/**
 * aggregateRepoFeed — the HUD's universe-wide GitHub card in one call.
 * Runs the same deterministic simulations the dossier's GitHub tab uses
 * (offline, no network), then folds commits / PRs / issues / CI across
 * every world's repo. Scene-level repo overrides are already merged into
 * `project.links.repo`, so custom repos count here too.
 *
 * @example
 * aggregateRepoFeed(projects);
 * // → { repos: 5, ci: { passing: true, passRate: 94 }, …, activity: […] }
 *
 * With a live cache in hand (token configured, `services/api/github`), pass
 * it as the second argument — matching repos use the fetched simulation,
 * the rest fall back to seeded simulation per-repo.
 */
export function aggregateRepoFeed(
  projects: readonly Project[],
  live?: ReadonlyMap<string, RepoSimulation> | null,
): RepoFeed {
  let prsOpen = 0;
  let prsMerged = 0;
  let issuesOpen = 0;
  let passSum = 0;
  const branchNames = new Set<string>();
  const activity: RepoFeedItem[] = [];

  for (const project of projects) {
    const sim =
      live?.get(project.links.repo) ??
      simulateRepo(project.links.repo, project.id);
    passSum += sim.ci.passRate;
    for (const name of sim.branches) branchNames.add(name);
    for (const pr of sim.pullRequests) {
      if (pr.state === "open") prsOpen += 1;
      else if (pr.state === "merged") prsMerged += 1;
    }
    for (const issue of sim.issues) {
      if (issue.state === "open") issuesOpen += 1;
    }
    const short = sim.repo.split("/").pop() ?? sim.repo;
    for (const commit of sim.commits.slice(0, 2)) {
      activity.push({
        sha: commit.sha,
        message: commit.message,
        author: commit.author,
        repo: short,
        at: commit.at,
      });
    }
  }

  activity.sort((a, b) => b.at - a.at);
  const passRate = Math.round(passSum / Math.max(1, projects.length));
  return {
    repos: projects.length,
    ci: { passing: passRate >= 85, passRate },
    prsOpen,
    prsMerged,
    issuesOpen,
    branches: branchNames.size,
    activity: activity.slice(0, 3),
  };
}

/* ── AI insights (deterministic heuristics over generated data) ───────────── */

export interface PlanetInsight {
  planetId: string;
  name: string;
  progress: number;
  health: number;
  completionPrediction: number;
  risk: number;
  bottlenecks: string[];
  workload: number;
  dueAt: number | null;
}

export interface UniverseInsights {
  health: number;
  riskScore: number;
  completionPrediction: number;
  productivity: number;
  bottleneck: string | null;
  deadlines: { name: string; dueAt: number }[];
  actions: string[];
  planets: PlanetInsight[];
}

/**
 * One planet's forecast — health / risk / predicted completion plus its
 * bottlenecks. Works for any `Project` (the stock graph and generated
 * universes alike): the dossier's AI Insights tab calls it directly and
 * `computeInsights` rolls the same maths up universe-wide.
 *
 * `seedKey` is the universe seed (or the stock scene's) so the numbers are
 * deterministic per world — no network, no flicker between visits.
 */
export function computePlanetInsight(
  project: Project,
  meta: PlanetMeta | undefined,
  tasks: PlanetTask[],
  seedKey: string,
): PlanetInsight {
  const rng = rngFrom(`${seedKey}:${project.id}:insight`, 11);
  const now = Date.now();
  const done = tasks.filter((t) => t.done).length;
  const workload = tasks.length;
  const completion = meta?.completion ?? project.progress;
  const overdue = meta?.dueAt != null && meta.dueAt < now && completion < 90;
  const health = Math.round(
    Math.max(
      12,
      Math.min(
        98,
        completion * 0.6 +
          (workload ? (done / workload) * 40 : 25) +
          float(rng, -8, 8) -
          (overdue ? 22 : 0),
      ),
    ),
  );
  const risk = Math.round(
    Math.max(
      4,
      Math.min(
        96,
        (100 - completion) * 0.55 +
          (overdue ? 26 : 0) +
          float(rng, -6, 10) +
          (workload > 8 ? 8 : 0),
      ),
    ),
  );
  const bottlenecks: string[] = [];
  if (overdue) bottlenecks.push("Overdue milestone");
  if (workload > 8) bottlenecks.push("High task load");
  if (completion < 35) bottlenecks.push("Early stage");
  if (project.related.length === 0) bottlenecks.push("No linked worlds");
  if (bottlenecks.length === 0 && chance(rng, 0.35)) {
    bottlenecks.push(pick(rng, ["Flaky CI", "Docs lag", "Review queue"]));
  }
  return {
    planetId: project.id,
    name: project.name,
    progress: completion,
    health,
    completionPrediction: Math.round(
      Math.min(99, completion + (100 - completion) * float(rng, 0.25, 0.6)),
    ),
    risk,
    bottlenecks,
    workload,
    dueAt: meta?.dueAt ?? null,
  };
}

export function computeInsights(
  record: UniverseRecord,
  scene: { projects: readonly Project[] },
): UniverseInsights {
  const planets: PlanetInsight[] = scene.projects.map((project) =>
    computePlanetInsight(
      project,
      record.planetMeta[project.id],
      record.planetTasks[project.id] ?? [],
      String(record.seed),
    ),
  );
  return aggregateInsights(planets, String(record.seed));
}

/**
 * aggregateInsights — the universe-wide rollup over any set of per-planet
 * forecasts. `computeInsights` uses it for generated records; the stock
 * scene (no record) builds its planets with `computePlanetInsight` +
 * `STOCK_SEED` and aggregates them here, so both paths share one set of
 * numbers. The seed keys the productivity jitter — same key, same output.
 *
 * @example
 * aggregateInsights(planets, String(STOCK_SEED));
 * // → { health, riskScore, …, actions, planets }
 */
export function aggregateInsights(
  planets: PlanetInsight[],
  seedKey: string,
): UniverseInsights {
  const rng = rngFrom(`${seedKey}:insights`, 11);

  const health = Math.round(
    planets.reduce((s, p) => s + p.health, 0) / Math.max(1, planets.length),
  );
  const riskScore = Math.round(
    planets.reduce((s, p) => s + p.risk, 0) / Math.max(1, planets.length),
  );
  const completionPrediction = Math.round(
    planets.reduce((s, p) => s + p.completionPrediction, 0) /
      Math.max(1, planets.length),
  );
  const productivity = Math.round(
    Math.max(8, Math.min(98, health * 0.6 + float(rng, 10, 40))),
  );
  const bottleneck =
    [...planets].sort((a, b) => b.risk - a.risk)[0]?.bottlenecks[0] ?? null;

  const deadlines = planets
    .filter((p) => p.dueAt != null)
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
    .slice(0, 4)
    .map((p) => ({ name: p.name, dueAt: p.dueAt as number }));

  const actions: string[] = [];
  const riskiest = [...planets].sort((a, b) => b.risk - a.risk)[0];
  if (riskiest && riskiest.risk > 45) {
    actions.push(`Rebalance load on ${riskiest.name} — highest risk score.`);
  }
  const underloaded = [...planets].sort((a, b) => a.workload - b.workload)[0];
  if (underloaded && underloaded.workload < 4) {
    actions.push(`${underloaded.name} is underloaded — pull work forward.`);
  }
  if (deadlines.length > 0) {
    actions.push(`${deadlines.length} deadline(s) inside the next window.`);
  }
  if (completionPrediction < 60) {
    actions.push("Predicted completion is behind — split the largest planet.");
  }
  if (actions.length === 0) {
    actions.push("Everything looks healthy — consider a hardening pass.");
  }

  return {
    health,
    riskScore,
    completionPrediction,
    productivity,
    bottleneck,
    deadlines,
    actions,
    planets,
  };
}

/**
 * Sample projects for Astra OS — each one is rendered as a unique floating
 * planet in the `/universe` scene, and `PROJECT_LINKS` pairs of them render
 * as animated neural energy beams (identity, look, orbit and graph all live
 * here so the layout is declarative and auditable in one place).
 *
 * Non-overlap invariants (checked by construction):
 * - Planets orbiting the same centre sit on radii spaced 8 units apart while
 *   planet radii sum to ≤ 4.3 — by the triangle inequality their centres are
 *   always ≥ (Δr − radii sum) ≥ 3.7 units apart, in any orbital plane, at any
 *   phase. That also keeps them visually clear on screen: a system seen
 *   edge-on projects along the view axis, so only the guaranteed 3D gap
 *   (not the apparent one) can be relied on.
 * - The three invisible centres are 55–61 units apart while the furthest
 *   orbit + planet ever reaches 24.5 units (reach sum ≤ 47.9), so systems can
 *   never collide either.
 */

export type ProjectStatus = "active" | "building" | "idle";

export interface ProjectPlanet {
  /** World-space sphere radius — kept deliberately small and understated. */
  radius: number;
  /** Deep oceans / shadow tone. */
  deep: string;
  /** Mid terrain / dominant band tone. */
  mid: string;
  /** High-contrast highlights: poles, storms, ridges. */
  accent: string;
  /** Atmosphere halo + label glow colour. */
  atmosphere: string;
  /** 0 = rocky worlds with continents, 1 = banded gas giants. */
  bands: number;
  /** Offsets the procedural noise so no two surfaces repeat. */
  seed: number;
  /** Self-rotation in rad/s (negative = retrograde). */
  spin: number;
  /** Axial tilt in radians. */
  tilt: number;
}

export interface ProjectOrbit {
  /** Index into `ORBIT_CENTRES` — the invisible point this planet circles. */
  centre: 0 | 1 | 2;
  /** Distance from the centre in world units. */
  radius: number;
  /** Starting angle in radians (keeps planets visually spread at t=0). */
  phase: number;
  /** Angular speed in rad/s — a full orbit takes ~2–4 minutes. */
  speed: number;
  /** Inclination of the orbital plane as an Euler triple. */
  plane: [number, number, number];
}

export interface ProjectStat {
  /** Tile caption, e.g. "p95 latency". */
  label: string;
  /** Pre-formatted figure — mono styling is applied by the panel. */
  value: string;
  /** Optional signed delta shown beside the figure ("+9%", "-1.2ms"). */
  delta?: string;
}

export interface ProjectLayer {
  /** Layer name, e.g. "Data plane". */
  name: string;
  /** One-line description of what lives there. */
  detail: string;
}

export interface ProjectMilestone {
  /** ISO date (`YYYY-MM-DD`). */
  date: string;
  /** Milestone label. */
  label: string;
  status: "done" | "active" | "planned";
}

export interface ProjectShot {
  /** Screenshot title — the artwork itself is procedural (see the panel). */
  title: string;
  caption: string;
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  /** AI-authored one-liner shown on the planet's hover card. */
  summary: string;
  /** Longer narrative that opens the immersive detail panel. */
  overview: string;
  /** Data statistics rendered as tiles in the detail panel. */
  stats: readonly ProjectStat[];
  /** Architecture layers (top → bottom) for the detail panel. */
  architecture: readonly ProjectLayer[];
  /** Ship milestones powering the detail panel's timeline. */
  timeline: readonly ProjectMilestone[];
  /** Neighbouring worlds the panel links to (ids must exist in `PROJECTS`). */
  related: readonly string[];
  /** Screenshot gallery captions for the detail panel. */
  shots: readonly ProjectShot[];
  /** External pointers used by the panel's quick actions. */
  links: { repo: string; demo: string };
  /** Technology chips rendered on the hover card. */
  stack: readonly string[];
  /** Classification tags — the natural-language search's vocabulary. */
  tags: readonly string[];
  /** Completion percent (0–100) for the hover card's progress bar. */
  progress: number;
  /** ISO date (`YYYY-MM-DD`) of the last meaningful update. */
  updatedAt: string;
  /** ISO date (`YYYY-MM-DD`) the project was created — the knowledge
   *  timeline scrubs from the earliest `createdAt` to the present. */
  createdAt: string;
  planet: ProjectPlanet;
  orbit: ProjectOrbit;
  /** The universe's own knowledge core — synthesised for generated scenes
   *  (the world the Planet Birth Experience forms). Absent on stock. */
  isCore?: boolean;
}

/**
 * A synapse: two projects the knowledge graph links together. The `/universe`
 * scene draws each one as an animated neural energy beam that tracks both
 * planets as they orbit — one entry here adds one living connection.
 *
 * Keep ids in `PROJECTS`; pairs should read as plausible relations (a project
 * sharing context with its system neighbours, plus a few cross-system jumps
 * so the graph spans the whole scene).
 */
export interface ProjectLink {
  from: string;
  to: string;
}

export const PROJECT_LINKS: readonly ProjectLink[] = [
  /* Inside system 0 — the studio cluster. */
  { from: "nebula-studio", to: "orion-index" },
  { from: "orion-index", to: "pulsar-ci" },
  /* Inside system 1 — search / notes / models. */
  { from: "vega-search", to: "lyra-notes" },
  { from: "lyra-notes", to: "quasar-ml" },
  /* Inside system 2 — the edge pair. */
  { from: "helix-router", to: "aether-sync" },
  /* Cross-system jumps that stretch the graph across the scene. */
  { from: "nebula-studio", to: "lyra-notes" },
  { from: "nebula-studio", to: "aether-sync" },
  { from: "orion-index", to: "vega-search" },
  { from: "pulsar-ci", to: "quasar-ml" },
  { from: "vega-search", to: "helix-router" },
  { from: "quasar-ml", to: "helix-router" },
];

/** Invisible centres each system orbits — no star is drawn at any of them. */
export const ORBIT_CENTRES: readonly (readonly [number, number, number])[] = [
  [-26, 5, -54],
  [30, -9, -74],
  [-8, 20, -104],
];

export const PROJECTS: readonly Project[] = [
  {
    id: "nebula-studio",
    name: "Nebula Studio",
    status: "active",
    summary:
      "AI design canvas that turns prompts into production-grade interfaces — generative layouts, motion specs and design tokens synced straight into code.",
    overview:
      "A prompt-to-interface studio where designers describe a screen and watch it compose itself — generative layout trees, motion curves and token sets stream straight into the codebase, reviewed like any other pull request.",
    stats: [
      { label: "Components", value: "1,284", delta: "+62" },
      { label: "Gen accuracy", value: "94.2%", delta: "+1.8%" },
      { label: "Avg build", value: "1.9s", delta: "-0.3s" },
      { label: "Weekly runs", value: "8.4k", delta: "+12%" },
    ],
    architecture: [
      { name: "Canvas", detail: "WebGL scene graph with infinite artboards" },
      {
        name: "Engine",
        detail: "Layout solver · motion compiler · token graph",
      },
      { name: "Sync", detail: "Git-backed revisions, PR-native export" },
      { name: "Shell", detail: "Next.js app router, edge-rendered" },
    ],
    timeline: [
      { date: "2026-04-12", label: "Prompt canvas alpha", status: "done" },
      {
        date: "2026-06-30",
        label: "Token graph v2 + code export",
        status: "done",
      },
      {
        date: "2026-09-28",
        label: "Motion compiler public beta",
        status: "active",
      },
      {
        date: "2026-11-15",
        label: "Team workspaces & review flows",
        status: "planned",
      },
    ],
    related: ["orion-index", "lyra-notes", "aether-sync"],
    shots: [
      { title: "Generative canvas", caption: "Prompt → layout tree in 400ms" },
      {
        title: "Motion studio",
        caption: "Curves previewed on the real screen",
      },
      { title: "Token diff", caption: "Design tokens reviewed as a PR" },
    ],
    links: {
      repo: "https://github.com/astra-os/nebula-studio",
      demo: "https://nebula.astra.dev",
    },
    stack: ["Next.js", "TypeScript", "WebGL", "Tailwind"],
    tags: ["ai", "design", "frontend", "webgl"],
    progress: 94,
    updatedAt: "2026-09-28",
    createdAt: "2024-10-08",
    planet: {
      radius: 2.2,
      deep: "#2a1b5e",
      mid: "#7c5cd6",
      accent: "#c4b5fd",
      atmosphere: "#a78bfa",
      bands: 0.1,
      seed: 1.7,
      spin: 0.12,
      tilt: 0.32,
    },
    orbit: {
      centre: 0,
      radius: 6,
      phase: 0.3,
      speed: 0.05,
      plane: [0.32, 0, -0.14],
    },
  },
  {
    id: "orion-index",
    name: "Orion Index",
    status: "active",
    summary:
      "The graph at the heart of Astra OS: every project, doc and decision linked as one queryable knowledge mesh with semantic recall.",
    overview:
      "The knowledge mesh every Astra surface queries: entities, decisions and documents stored as a typed graph with hybrid vector recall, sub-10ms traversals and provenance stamped on every edge.",
    stats: [
      { label: "Edges", value: "12.6M", delta: "+340k" },
      { label: "p95 query", value: "8ms", delta: "-2ms" },
      { label: "Recall@10", value: "96.4%", delta: "+0.6%" },
      { label: "Nodes", value: "2.1M", delta: "+58k" },
    ],
    architecture: [
      { name: "API", detail: "GraphQL federation + streaming subscriptions" },
      { name: "Core", detail: "Rust graph engine, typed edge provenance" },
      { name: "Recall", detail: "pgvector HNSW fused with BM25 ranking" },
      { name: "Store", detail: "PostgreSQL 17, sharded by workspace" },
    ],
    timeline: [
      { date: "2026-03-02", label: "Graph engine alpha", status: "done" },
      { date: "2026-06-11", label: "Hybrid vector recall", status: "done" },
      {
        date: "2026-09-21",
        label: "Provenance on every edge",
        status: "active",
      },
      {
        date: "2026-11-30",
        label: "Multi-region read replicas",
        status: "planned",
      },
    ],
    related: ["vega-search", "nebula-studio", "pulsar-ci"],
    shots: [
      { title: "Graph explorer", caption: "12M edges, 60fps pan" },
      { title: "Semantic query", caption: "Ask in prose, get subgraphs back" },
      { title: "Provenance trail", caption: "Every claim traces to a source" },
    ],
    links: {
      repo: "https://github.com/astra-os/orion-index",
      demo: "https://orion.astra.dev",
    },
    stack: ["Rust", "PostgreSQL", "pgvector", "GraphQL"],
    tags: ["ai", "graph", "knowledge", "database"],
    progress: 88,
    updatedAt: "2026-09-21",
    createdAt: "2024-12-19",
    planet: {
      radius: 1.7,
      deep: "#0b3a4a",
      mid: "#1b7f8c",
      accent: "#67e8f9",
      atmosphere: "#22d3ee",
      bands: 0.15,
      seed: 4.2,
      spin: -0.09,
      tilt: -0.21,
    },
    orbit: {
      centre: 0,
      radius: 14,
      phase: 2.4,
      speed: 0.036,
      plane: [0.4, 0.2, -0.1],
    },
  },
  {
    id: "pulsar-ci",
    name: "Pulsar CI",
    status: "building",
    summary:
      "Autonomous build fleet that predicts broken merges before they land — containerised runners, flake detection and one-click rollback.",
    overview:
      "A build fleet with intuition: it watches the merge queue, predicts which changes will break main and stages the fix before the PR even lands — flakes quarantined automatically, rollbacks one click away.",
    stats: [
      { label: "Predict F1", value: "0.91", delta: "+0.04" },
      { label: "Median CI", value: "3m 42s", delta: "-54s" },
      { label: "Flake rate", value: "0.7%", delta: "-1.1%" },
      { label: "Runners", value: "128", delta: "+24" },
    ],
    architecture: [
      { name: "Queue", detail: "gRPC merge predictor in front of the fleet" },
      {
        name: "Compute",
        detail: "Karpenter-scaled Kubernetes runners, warm pools",
      },
      { name: "Signals", detail: "Flake detector + automated bisects" },
      { name: "Control", detail: "Rollback plane with one-click revert" },
    ],
    timeline: [
      { date: "2026-05-08", label: "Fleet prototype", status: "done" },
      { date: "2026-07-19", label: "Predictive merge gate", status: "done" },
      { date: "2026-10-02", label: "Flake quarantine beta", status: "active" },
      { date: "2026-12-01", label: "Autonomous rollback", status: "planned" },
    ],
    related: ["orion-index", "quasar-ml"],
    shots: [
      { title: "Merge predictor", caption: "Risk score on every open PR" },
      { title: "Runner heatmap", caption: "128 runners, live utilisation" },
      { title: "Bisect report", caption: "First bad commit in 90s" },
    ],
    links: {
      repo: "https://github.com/astra-os/pulsar-ci",
      demo: "https://pulsar.astra.dev",
    },
    stack: ["Go", "Docker", "Kubernetes", "gRPC"],
    tags: ["devops", "ci", "automation"],
    progress: 62,
    updatedAt: "2026-10-02",
    createdAt: "2025-03-04",
    planet: {
      radius: 1.4,
      deep: "#6b3410",
      mid: "#d97706",
      accent: "#fcd34d",
      atmosphere: "#fbbf24",
      bands: 0.95,
      seed: 8.9,
      spin: 0.15,
      tilt: 0.12,
    },
    orbit: {
      centre: 0,
      radius: 22,
      phase: 4.6,
      speed: 0.028,
      plane: [0.26, -0.15, 0.08],
    },
  },
  {
    id: "vega-search",
    name: "Vega Search",
    status: "active",
    summary:
      "Neural search across the entire workspace — hybrid vector and keyword ranking that learns from every click and query rewrite.",
    overview:
      "Workspace search that rewrites itself: hybrid lexical and neural ranking, query understanding trained on click feedback, and answers that cite the note they came from.",
    stats: [
      { label: "Queries / day", value: "412k", delta: "+9%" },
      { label: "p95 latency", value: "46ms", delta: "-12ms" },
      { label: "CTR @1", value: "0.72", delta: "+0.03" },
      { label: "Indexes", value: "86", delta: "+6" },
    ],
    architecture: [
      { name: "Edge", detail: "Query rewrite + typo tolerance at the door" },
      { name: "Rank", detail: "Hybrid BM25 × vectors, learned fusion" },
      { name: "Feedback", detail: "Redis click stream retrains nightly" },
      { name: "Index", detail: "Elasticsearch, workspace-partitioned" },
    ],
    timeline: [
      { date: "2026-02-20", label: "Keyword-first search", status: "done" },
      { date: "2026-05-27", label: "Neural re-ranker", status: "done" },
      {
        date: "2026-09-14",
        label: "Click-trained query rewrite",
        status: "active",
      },
      {
        date: "2026-10-30",
        label: "Answer cards with citations",
        status: "planned",
      },
    ],
    related: ["orion-index", "helix-router", "lyra-notes"],
    shots: [
      { title: "Command palette", caption: "One keystroke to every doc" },
      { title: "Answer cards", caption: "Cited results, zero scrolling" },
      { title: "Rank insights", caption: "What your team actually clicks" },
    ],
    links: {
      repo: "https://github.com/astra-os/vega-search",
      demo: "https://vega.astra.dev",
    },
    stack: ["TypeScript", "Elasticsearch", "React", "Redis"],
    tags: ["ai", "search", "nlp", "neural"],
    progress: 91,
    updatedAt: "2026-09-14",
    createdAt: "2025-05-21",
    planet: {
      radius: 1.9,
      deep: "#0c2d6b",
      mid: "#2563eb",
      accent: "#93c5fd",
      atmosphere: "#60a5fa",
      bands: 0.1,
      seed: 12.3,
      spin: 0.1,
      tilt: 0.4,
    },
    orbit: {
      centre: 1,
      radius: 7,
      phase: 1.1,
      speed: 0.048,
      plane: [-0.3, 0.1, 0.16],
    },
  },
  {
    id: "lyra-notes",
    name: "Lyra Notes",
    status: "idle",
    summary:
      "Living notebooks where notes link themselves — AI backlinks, ambient summaries and a timeline that rewinds your thinking.",
    overview:
      "Notebooks that maintain themselves: links form as you type, summaries drift with the content, and the whole timeline of a thought can be replayed like a film.",
    stats: [
      { label: "Notes linked", value: "94%", delta: "+3%" },
      { label: "Sync delay", value: "180ms", delta: "-40ms" },
      { label: "Backlinks / note", value: "6.2", delta: "+0.8" },
      { label: "Local storage", value: "2.4GB", delta: "+0.2GB" },
    ],
    architecture: [
      { name: "Editor", detail: "Block CRDT, conflict-free on every device" },
      { name: "Graph", detail: "Auto-linker and ambient summariser" },
      { name: "Local", detail: "SQLite + IndexedDB, offline-first" },
      { name: "Sync", detail: "WebRTC mesh with server fallback" },
    ],
    timeline: [
      { date: "2026-01-15", label: "Block CRDT editor", status: "done" },
      { date: "2026-04-28", label: "Auto-backlinks", status: "done" },
      { date: "2026-08-30", label: "Replay timeline", status: "active" },
      { date: "2026-11-10", label: "Shared spaces", status: "planned" },
    ],
    related: ["nebula-studio", "vega-search", "aether-sync"],
    shots: [
      { title: "Ambient graph", caption: "Backlinks form as you type" },
      { title: "Rewind", caption: "Scrub a note's whole history" },
      { title: "Daily brief", caption: "What changed while you were out" },
    ],
    links: {
      repo: "https://github.com/astra-os/lyra-notes",
      demo: "https://lyra.astra.dev",
    },
    stack: ["Next.js", "CRDT", "SQLite", "IndexedDB"],
    tags: ["ai", "notes", "productivity"],
    progress: 76,
    updatedAt: "2026-08-30",
    createdAt: "2025-07-30",
    planet: {
      radius: 2.4,
      deep: "#59093a",
      mid: "#db2777",
      accent: "#f9a8d4",
      atmosphere: "#f472b6",
      bands: 0.3,
      seed: 16.8,
      spin: -0.07,
      tilt: -0.3,
    },
    orbit: {
      centre: 1,
      radius: 15,
      phase: 3.4,
      speed: 0.034,
      plane: [-0.36, -0.1, 0.2],
    },
  },
  {
    id: "quasar-ml",
    name: "Quasar ML",
    status: "building",
    summary:
      "Model-ops console for training runs, eval sweeps and drift alerts, distilled into one glass dashboard the whole team can read.",
    overview:
      "One glass console for the model lifecycle — training runs, evaluation sweeps, drift alarms and rollout gates compressed into a surface the whole team can actually read.",
    stats: [
      { label: "Runs tracked", value: "18.2k", delta: "+1.4k" },
      { label: "GPU utilisation", value: "87%", delta: "+5%" },
      { label: "Drift catches", value: "31", delta: "+4" },
      { label: "Eval suites", value: "46", delta: "+3" },
    ],
    architecture: [
      { name: "Console", detail: "Glass dashboard with live run streams" },
      { name: "Orchestration", detail: "Ray clusters, spot-aware scheduling" },
      { name: "Tracking", detail: "MLflow registry + artifact lake" },
      { name: "Eval", detail: "Drift detectors, gated rollouts" },
    ],
    timeline: [
      { date: "2026-06-03", label: "Run tracker MVP", status: "done" },
      {
        date: "2026-08-12",
        label: "Sweep orchestration on Ray",
        status: "done",
      },
      { date: "2026-10-04", label: "Drift alerts beta", status: "active" },
      { date: "2026-12-18", label: "Rollout gates GA", status: "planned" },
    ],
    related: ["pulsar-ci", "helix-router"],
    shots: [
      { title: "Run board", caption: "Every job, one live grid" },
      { title: "Eval sweep", caption: "Candidates ranked side by side" },
      { title: "Drift alarm", caption: "Feature drift flagged in minutes" },
    ],
    links: {
      repo: "https://github.com/astra-os/quasar-ml",
      demo: "https://quasar.astra.dev",
    },
    stack: ["Python", "PyTorch", "FastAPI", "Ray", "MLflow"],
    tags: ["ai", "ml", "hackathon", "mlops"],
    progress: 47,
    updatedAt: "2026-10-04",
    createdAt: "2025-10-15",
    planet: {
      radius: 1.5,
      deep: "#1e1b4b",
      mid: "#4f46e5",
      accent: "#818cf8",
      atmosphere: "#818cf8",
      bands: 0.85,
      seed: 21.5,
      spin: 0.13,
      tilt: 0.18,
    },
    orbit: {
      centre: 1,
      radius: 23,
      phase: 5.5,
      speed: 0.026,
      plane: [-0.24, 0.18, 0.12],
    },
  },
  {
    id: "helix-router",
    name: "Helix Router",
    status: "active",
    summary:
      "Edge traffic intelligence that reroutes requests around cold regions in milliseconds — programmable, observable, zero-config.",
    overview:
      "The edge thinks for itself: WASM filters route around cold regions in single-digit milliseconds, and every decision leaves an observable trail from POP to origin.",
    stats: [
      { label: "p99 latency", value: "7.4ms", delta: "-1.2ms" },
      { label: "Reroutes / s", value: "31k", delta: "+4k" },
      { label: "Availability", value: "99.99%", delta: "+0.01%" },
      { label: "POPs", value: "54", delta: "+7" },
    ],
    architecture: [
      { name: "Data plane", detail: "Envoy + WASM filters at 54 POPs" },
      { name: "Control", detail: "NATS mesh, sub-second config push" },
      { name: "Telemetry", detail: "Per-decision traces, OTLP export" },
      { name: "Origin", detail: "Health-aware failover pools" },
    ],
    timeline: [
      { date: "2026-03-19", label: "WASM filter preview", status: "done" },
      { date: "2026-06-25", label: "Latency-aware failover", status: "done" },
      { date: "2026-09-09", label: "Full-fleet config mesh", status: "active" },
      { date: "2026-11-05", label: "Self-tuning routes", status: "planned" },
    ],
    related: ["aether-sync", "vega-search", "quasar-ml"],
    shots: [
      { title: "Route map", caption: "Traffic bending around a cold POP" },
      { title: "Filter editor", caption: "WASM policies, hot-reloaded" },
      { title: "Decision log", caption: "Every reroute, explained" },
    ],
    links: {
      repo: "https://github.com/astra-os/helix-router",
      demo: "https://helix.astra.dev",
    },
    stack: ["Rust", "WebAssembly", "NATS", "Envoy"],
    tags: ["network", "edge", "performance"],
    progress: 83,
    updatedAt: "2026-09-09",
    createdAt: "2026-01-08",
    planet: {
      radius: 2.0,
      deep: "#052e16",
      mid: "#16a34a",
      accent: "#86efac",
      atmosphere: "#4ade80",
      bands: 0.1,
      seed: 27.1,
      spin: 0.11,
      tilt: -0.26,
    },
    orbit: {
      centre: 2,
      radius: 7,
      phase: 0.8,
      speed: 0.046,
      plane: [0.44, 0, 0.1],
    },
  },
  {
    id: "aether-sync",
    name: "Aether Sync",
    status: "idle",
    summary:
      "Conflict-free realtime layer keeping every device identical — offline-first replication with sub-frame merge semantics.",
    overview:
      "The quiet layer under every surface: offline edits merge inside a frame, state converges across devices without a coordinator, and conflicts resolve before you notice them.",
    stats: [
      { label: "Merge p95", value: "0.9ms", delta: "-0.3ms" },
      { label: "Devices", value: "48k", delta: "+3k" },
      { label: "Conflicts", value: "0.02%", delta: "-0.01%" },
      { label: "Uptime", value: "99.98%", delta: "±0" },
    ],
    architecture: [
      { name: "Protocol", detail: "CRDT ops over WebRTC data channels" },
      { name: "Broker", detail: "Redis fanout for NAT-heavy networks" },
      { name: "Storage", detail: "Append-only op log, compaction jobs" },
      { name: "Client", detail: "Sub-frame three-way merge" },
    ],
    timeline: [
      { date: "2026-02-06", label: "Op-log prototype", status: "done" },
      { date: "2026-05-14", label: "WebRTC transport", status: "done" },
      { date: "2026-08-17", label: "Sub-frame merge", status: "active" },
      { date: "2026-10-22", label: "Presence & cursors", status: "planned" },
    ],
    related: ["lyra-notes", "nebula-studio", "helix-router"],
    shots: [
      { title: "Device mesh", caption: "48k devices, one identity" },
      { title: "Merge visualiser", caption: "Conflicts dissolving in 0.9ms" },
      { title: "Offline queue", caption: "Weeks of edits, one replay" },
    ],
    links: {
      repo: "https://github.com/astra-os/aether-sync",
      demo: "https://aether.astra.dev",
    },
    stack: ["TypeScript", "CRDT", "WebRTC", "Redis"],
    tags: ["realtime", "infrastructure", "collaboration"],
    progress: 88,
    updatedAt: "2026-08-17",
    createdAt: "2026-02-24",
    planet: {
      radius: 1.3,
      deep: "#450a0a",
      mid: "#b91c1c",
      accent: "#fca5a5",
      atmosphere: "#f87171",
      bands: 0.5,
      seed: 33.6,
      spin: -0.14,
      tilt: 0.24,
    },
    orbit: {
      centre: 2,
      radius: 15,
      phase: 3.9,
      speed: 0.032,
      plane: [0.5, 0.12, 0.05],
    },
  },
];

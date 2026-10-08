/**
 * planet-category — the metadata → planet identity rule.
 *
 * A universe record (name, description, tags, repo) classifies the project it
 * represents into one of six worlds — AI, research, backend, frontend,
 * database, deployment — or "general" when nothing specific is said. The
 * category drives three things:
 *
 *   1. the born planet's palette (the Planet Birth Experience's appearance
 *      rules: AI reads purple, frontend oceanic blue, backend dark metallic,
 *      database crystalline orange, research bioluminescent green,
 *      deployment white — every value jittered by the seed so no two cores
 *      ever look identical),
 *   2. the Phase-6 similarity vocabulary (`stack` chips that also exist in
 *      generated worlds' stacks, so "Connected through React" reads true),
 *   3. the Phase-5 scan cards (category label + planet class name).
 *
 * Pure, deterministic, and dependency-free — the generator calls it while
 * synthesising the core world and the birth director calls it for the cards.
 */

import type { UniverseRecord } from "@/types/workspace";

export type PlanetCategory =
  | "ai"
  | "research"
  | "backend"
  | "frontend"
  | "database"
  | "deployment"
  | "general";

export interface CategoryProfile {
  id: PlanetCategory;
  /** Scan-card label, e.g. "Artificial Intelligence". */
  label: string;
  /** The planet's class, e.g. "Neural World". */
  planetType: string;
  /** Base palette — jittered by the seed when the core planet is built. */
  deep: string;
  mid: string;
  accent: string;
  atmosphere: string;
  /** Rocky ↔ crystalline banding (0 = continents, 1 = gas/crystal bands). */
  bands: number;
  /** Similarity chips — each string also appears in generated world stacks. */
  stack: readonly string[];
}

/**
 * Detection sets, checked in this order: research before AI (a "reinforcement
 * learning paper" is research), backend before frontend (FastAPI + React is a
 * backend project), and deployment last (Docker around Flask doesn't stop it
 * being a backend project). Short tokens ("ai", "ml", "ui") only match as
 * whole words so "email" and "html" never misclassify.
 */
const KEYWORDS: Readonly<
  Record<Exclude<PlanetCategory, "general">, readonly string[]>
> = {
  research: [
    "research",
    "paper",
    "thesis",
    "arxiv",
    "survey",
    "benchmark",
    "study",
    "studies",
    "science",
    "scientific",
    "experiment",
    "experiments",
    "reinforcement learning",
    "rl",
    "publication",
    "journal",
    "lab",
    "ablation",
  ],
  ai: [
    "artificial intelligence",
    "ai",
    "machine learning",
    "ml",
    "deep learning",
    "llm",
    "llms",
    "gpt",
    "large language model",
    "neural",
    "transformer",
    "transformers",
    "torch",
    "pytorch",
    "tensorflow",
    "rag",
    "agent",
    "agents",
    "diffusion",
    "nlp",
    "computer vision",
    "claude",
    "llama",
    "openai",
    "huggingface",
    "inference",
    "embedding",
    "embeddings",
    "model",
    "models",
    "autonomous",
    "prompt",
  ],
  backend: [
    "backend",
    "back-end",
    "api",
    "apis",
    "fastapi",
    "django",
    "flask",
    "node",
    "express",
    "nestjs",
    "spring",
    "golang",
    "go",
    "microservice",
    "microservices",
    "server",
    "serverless",
    "rest",
    "graphql",
    "grpc",
    "websocket",
    "websockets",
    "worker",
  ],
  frontend: [
    "frontend",
    "front-end",
    "react",
    "nextjs",
    "next",
    "vue",
    "nuxt",
    "svelte",
    "angular",
    "astro",
    "tailwind",
    "css",
    "html",
    "ui",
    "ux",
    "webgl",
    "threejs",
    "browser",
    "component",
    "components",
    "design system",
  ],
  database: [
    "database",
    "databases",
    "db",
    "sql",
    "postgres",
    "postgresql",
    "mysql",
    "mongo",
    "mongodb",
    "redis",
    "elasticsearch",
    "clickhouse",
    "vector",
    "warehouse",
    "storage",
    "sqlite",
    "supabase",
    "schema",
    "indexing",
  ],
  deployment: [
    "deploy",
    "deployment",
    "deployments",
    "docker",
    "kubernetes",
    "k8s",
    "terraformed",
    "terraform",
    "aws",
    "gcp",
    "azure",
    "vercel",
    "netlify",
    "ci/cd",
    "cicd",
    "devops",
    "gitops",
    "cluster",
    "clusters",
    "infrastructure",
    "argo",
    "helm",
    "platform engineering",
  ],
};

/** The ordered classification — first category with a hit wins. */
const ORDER: readonly Exclude<PlanetCategory, "general">[] = [
  "research",
  "ai",
  "backend",
  "frontend",
  "database",
  "deployment",
];

export const CATEGORY_PROFILES: Readonly<
  Record<PlanetCategory, CategoryProfile>
> = {
  ai: {
    id: "ai",
    label: "Artificial Intelligence",
    planetType: "Neural World",
    deep: "#1b0b33",
    mid: "#7c3aed",
    accent: "#c4b5fd",
    atmosphere: "#a78bfa",
    bands: 0.16,
    stack: ["Python", "PyTorch", "Embeddings", "RAG", "FastAPI"],
  },
  research: {
    id: "research",
    label: "Research",
    planetType: "Bio-Luminescent World",
    deep: "#06281c",
    mid: "#059669",
    accent: "#6ee7b7",
    atmosphere: "#34d399",
    bands: 0.22,
    stack: ["Python", "Embeddings", "Evals", "PyTorch"],
  },
  backend: {
    id: "backend",
    label: "Backend",
    planetType: "Forge World",
    deep: "#0e1118",
    mid: "#3f4a5e",
    accent: "#7dd3fc",
    atmosphere: "#38bdf8",
    bands: 0.1,
    stack: ["FastAPI", "Postgres", "Redis", "gRPC"],
  },
  frontend: {
    id: "frontend",
    label: "Frontend",
    planetType: "Oceanic World",
    deep: "#0a1a3a",
    mid: "#2563eb",
    accent: "#93c5fd",
    atmosphere: "#60a5fa",
    bands: 0.38,
    stack: ["React", "TypeScript", "Tailwind", "Three.js"],
  },
  database: {
    id: "database",
    label: "Database",
    planetType: "Crystalline Vault",
    deep: "#2a1405",
    mid: "#ea580c",
    accent: "#fdba74",
    atmosphere: "#fb923c",
    bands: 0.76,
    stack: ["Postgres", "Redis", "ClickHouse", "SQL"],
  },
  deployment: {
    id: "deployment",
    label: "Deployment",
    planetType: "Orbital Foundry",
    deep: "#6f7a92",
    mid: "#c9d4e8",
    accent: "#f8fafc",
    atmosphere: "#dbeafe",
    bands: 0.12,
    stack: ["Kubernetes", "Terraform", "GitHub Actions", "Argo"],
  },
  general: {
    id: "general",
    label: "General",
    planetType: "Knowledge World",
    /* Palette unused — general cores take the theme-derived colours the
       other generated planets use, so stock behaviour reads through. */
    deep: "#141330",
    mid: "#4c4fd8",
    accent: "#c4c6ff",
    atmosphere: "#8b9cff",
    bands: 0.3,
    stack: ["TypeScript", "Postgres", "Redis", "React"],
  },
};

/** Tag → canonical chip, so `react` in tags joins `React` on the stack. */
const TECH_CANON: Readonly<Record<string, string>> = {
  react: "React",
  next: "Next.js",
  nextjs: "Next.js",
  vue: "Vue",
  svelte: "Svelte",
  angular: "Angular",
  typescript: "TypeScript",
  javascript: "JavaScript",
  tailwind: "Tailwind",
  python: "Python",
  pytorch: "PyTorch",
  tensorflow: "TensorFlow",
  fastapi: "FastAPI",
  django: "Django",
  flask: "Flask",
  node: "Node.js",
  postgres: "Postgres",
  postgresql: "Postgres",
  redis: "Redis",
  mongo: "MongoDB",
  mongodb: "MongoDB",
  clickhouse: "ClickHouse",
  sql: "SQL",
  docker: "Docker",
  kubernetes: "Kubernetes",
  k8s: "Kubernetes",
  terraform: "Terraform",
  aws: "AWS",
  vercel: "Vercel",
  graphql: "GraphQL",
  grpc: "gRPC",
  threejs: "Three.js",
  r3f: "R3F",
  webgl: "WebGL",
  llm: "LLM",
  rag: "RAG",
  nlp: "NLP",
};

export interface UniverseIdentity {
  category: PlanetCategory;
  profile: CategoryProfile;
  /** Category chips + canon-mapped record tags — the similarity vocabulary. */
  stack: readonly string[];
}

function hit(haystack: string, keywords: readonly string[]): boolean {
  const padded = ` ${haystack} `;
  return keywords.some((keyword) =>
    keyword.length <= 2
      ? padded.includes(` ${keyword} `)
      : padded.includes(keyword),
  );
}

/** Classify a record: category, profile and the core planet's stack. */
export function classifyUniverse(record: UniverseRecord): UniverseIdentity {
  const haystack = [
    record.name,
    record.description,
    record.tags.join(" "),
    record.githubRepo,
  ]
    .join(" ")
    .toLowerCase();

  let category: PlanetCategory = "general";
  for (const id of ORDER) {
    if (hit(haystack, KEYWORDS[id])) {
      category = id;
      break;
    }
  }

  const profile = CATEGORY_PROFILES[category];
  const stack: string[] = [...profile.stack];
  for (const tag of record.tags) {
    const canon = TECH_CANON[tag.trim().toLowerCase()];
    if (canon && !stack.includes(canon)) stack.push(canon);
  }
  return { category, profile, stack: stack.slice(0, 7) };
}

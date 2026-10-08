/**
 * knowledge-links — Phase 6 of the Planet Birth Experience.
 *
 * When a core world is born it is compared with every existing world in the
 * universe: shared stack entries are the strongest signal (a real chip like
 * `React` appearing on both stacks), shared tags the weaker second thought.
 * Each connection carries the human sentence the overlay floats next to the
 * beam — "Connected through React", "Connected through Artificial
 * Intelligence".
 *
 * Pure and deterministic: the generator calls it while building a scene (so
 * the beams live in `SceneData.links` and ride every existing pipeline) and
 * the birth director calls it for the contextual messages — both derive the
 * identical list from the identical inputs.
 */

import type { Project } from "@/data";

export interface KnowledgeConnection {
  /** The world id this connection reaches. */
  id: string;
  /** Overlay sentence, e.g. "Connected through React". */
  reason: string;
  /** Stack matches outrank tag matches; ties keep scene order. */
  score: number;
}

/** Tag → the elegant phrase the beam explains itself with. */
const TAG_REASON: Readonly<Record<string, string>> = {
  ai: "Artificial Intelligence",
  ml: "Machine Learning",
  "machine-learning": "Machine Learning",
  "deep-learning": "Deep Learning",
  llm: "Large Language Models",
  nlp: "Natural Language",
  cv: "Computer Vision",
  "computer-vision": "Computer Vision",
  rl: "Reinforcement Learning",
  "reinforcement-learning": "Reinforcement Learning",
  rag: "Retrieval Augmented Generation",
  agents: "Autonomous Agents",
  react: "React",
  frontend: "Frontend",
  backend: "Backend",
  api: "APIs",
  database: "Databases",
  data: "Data Systems",
  devops: "DevOps",
  deployment: "Deployment",
  cloud: "Cloud Infrastructure",
  security: "Security",
  research: "Research",
  realtime: "Realtime Systems",
  web: "Web Platforms",
  mobile: "Mobile",
  typescript: "TypeScript",
  python: "Python",
};

/** Title-case fallback for tags without a curated phrase. */
function tagReason(tag: string): string {
  const mapped = TAG_REASON[tag.toLowerCase()];
  if (mapped) return mapped;
  return tag
    .split(/[\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The most related worlds for a core project, best first. Stack overlap
 * scores 3 per shared chip, tag overlap 1.5; `limit` caps the beams so the
 * reveal stays readable (four is what the overlay stages).
 */
export function relatedKnowledge(
  core: Project,
  worlds: readonly Project[],
  limit = 4,
): KnowledgeConnection[] {
  const coreStack = new Set(core.stack.map((entry) => entry.toLowerCase()));
  const coreTags = new Set(core.tags.map((entry) => entry.toLowerCase()));
  const connections: KnowledgeConnection[] = [];

  worlds.forEach((world, index) => {
    if (world.id === core.id) return;

    const shared = world.stack.filter((entry) =>
      coreStack.has(entry.toLowerCase()),
    );
    if (shared.length > 0) {
      connections.push({
        id: world.id,
        reason: `Connected through ${shared[0]}`,
        score: shared.length * 3 - index * 0.01,
      });
      return;
    }

    const sharedTag = world.tags.find((entry) =>
      coreTags.has(entry.toLowerCase()),
    );
    if (sharedTag) {
      connections.push({
        id: world.id,
        reason: `Connected through ${tagReason(sharedTag)}`,
        score: 1.5 - index * 0.01,
      });
    }
  });

  connections.sort((a, b) => b.score - a.score);

  /* Fallback — a newborn universe must always light some connections (the
     reveal stages up to `limit` beams and the overlay floats one sentence
     each). When nothing genuinely overlaps (a name-only record carries no
     tags to match on), pad in scene order with each world's primary
     technology as the sentence: deterministic, and it reads true — that
     world really does run React. */
  if (connections.length < limit) {
    const have = new Set(connections.map((c) => c.id));
    for (const world of worlds) {
      if (connections.length >= limit) break;
      if (world.id === core.id || have.has(world.id)) continue;
      const primary = world.stack[0];
      if (!primary) continue;
      connections.push({
        id: world.id,
        reason: `Connected through ${primary}`,
        score: 0.5,
      });
      have.add(world.id);
    }
  }

  return connections.slice(0, limit);
}

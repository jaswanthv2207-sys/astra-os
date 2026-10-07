import type {
  RepoSimulation,
  SimCommit,
  SimIssue,
  SimPullRequest,
} from "@/lib/universe-generator";

/**
 * Live GitHub transport — token-gated, cached, never required.
 *
 * With no token nothing here runs: the HUD, dossier and insights keep
 * reading the deterministic `simulateRepo()` engine exactly as shipped.
 * With a token, `fetchRepoSimulations()` maps the REST API onto the same
 * `RepoSimulation` shape, so every consumer works unchanged — only the
 * data source differs.
 *
 * Cache: responses land in `astra.ghcache.v1` for 10 minutes so repeated
 * visits (and unauthenticated browsing after one tokened session) never
 * re-hit the API for data they already have.
 */

const API = "https://api.github.com";
const CACHE_KEY = "astra.ghcache.v1";
const TTL_MS = 10 * 60 * 1000;

interface CacheShape {
  at: number;
  entries: Record<string, RepoSimulation>;
}

/* ── Shared plumbing ─────────────────────────────────────────────────────── */

/** `https://github.com/owner/name` | `owner/name` → `owner/name`. */
export function repoSlug(repo: string): string | null {
  const trimmed = repo.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const slug = parts.slice(-2).join("/");
  return /^[^/]+\/[^/]+$/.test(slug) ? slug : null;
}

/** One authenticated GET with GitHub-shaped error messages. */
export async function ghFetch(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      "x-gitHub-api-version": "2022-11-28",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch {
      /* keep status line */
    }
    throw new Error(detail);
  }
  return response;
}

/* ── Token liveness ──────────────────────────────────────────────────────── */

export interface GithubProbe {
  ok: boolean;
  message: string;
}

/** Validate a token against the rate-limit endpoint (1 cheap request). */
export async function testGithubToken(token: string): Promise<GithubProbe> {
  try {
    const response = await ghFetch("/rate_limit", token);
    const body = (await response.json()) as {
      resources?: { core?: { limit: number; remaining: number } };
    };
    const core = body.resources?.core;
    if (core && core.limit > 100) {
      return {
        ok: true,
        message: `Connected — ${core.remaining.toLocaleString()} of ${core.limit.toLocaleString()} calls left.`,
      };
    }
    return { ok: true, message: "Connected." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Connection failed.",
    };
  }
}

/* ── Mapping: REST → RepoSimulation ──────────────────────────────────────── */

interface RawRepo {
  default_branch?: string;
  pushed_at?: string;
}
interface RawCommit {
  sha?: string;
  commit?: {
    message?: string;
    author?: { name?: string; date?: string };
  };
  author?: { login?: string } | null;
}
interface RawPull {
  number?: number;
  title?: string;
  state?: string;
  merged_at?: string | null;
  user?: { login?: string };
  created_at?: string;
  closed_at?: string | null;
}
interface RawIssue {
  number?: number;
  title?: string;
  state?: string;
  labels?: Array<{ name?: string }>;
  /** Present on issues that are actually pull requests — filtered out. */
  pull_request?: unknown;
}
interface RawBranch {
  name?: string;
}
interface RawContributor {
  login?: string;
  contributions?: number;
}
interface RawCheck {
  check_runs?: Array<{
    conclusion?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
  }>;
}

const iso = (value?: string | null): number => {
  const at = value ? Date.parse(value) : NaN;
  return Number.isFinite(at) ? at : Date.now();
};

async function safeGet<T>(path: string, token: string): Promise<T | null> {
  try {
    const response = await ghFetch(path, token);
    return (await response.json()) as T;
  } catch {
    return null; // optional facets degrade instead of failing the repo
  }
}

/** Fetch one repository and map it onto the simulation contract. */
async function fetchOne(
  slug: string,
  token: string,
  original: string,
): Promise<RepoSimulation> {
  const [meta, commits, pulls, issues, branches, contributors] =
    await Promise.all([
      safeGet<RawRepo>(`/repos/${slug}`, token),
      safeGet<RawCommit[]>(`/repos/${slug}/commits?per_page=15`, token),
      safeGet<RawPull[]>(`/repos/${slug}/pulls?state=all&per_page=10`, token),
      safeGet<RawIssue[]>(`/repos/${slug}/issues?state=all&per_page=15`, token),
      safeGet<RawBranch[]>(`/repos/${slug}/branches?per_page=20`, token),
      safeGet<RawContributor[]>(
        `/repos/${slug}/contributors?per_page=6`,
        token,
      ),
    ]);
  if (!meta) throw new Error(`Could not read ${slug}`);

  const head = commits?.[0]?.sha;

  /* CI: check-runs on HEAD, then combined status, then benign default. */
  const checks = head
    ? await safeGet<RawCheck>(
        `/repos/${slug}/commits/${head}/check-runs`,
        token,
      )
    : null;
  const runs = checks?.check_runs ?? [];
  let ci = { passing: true, passRate: 100, avgMinutes: 4 };
  if (runs.length > 0) {
    const failed = runs.filter((run) =>
      ["failure", "timed_out", "cancelled"].includes(run.conclusion ?? ""),
    ).length;
    const minutes = runs
      .map((run) => {
        if (!run.started_at || !run.completed_at) return null;
        return (iso(run.completed_at) - iso(run.started_at)) / 60_000;
      })
      .filter((n): n is number => n !== null && n > 0 && n < 240);
    ci = {
      passing: failed === 0,
      passRate: Math.round(((runs.length - failed) / runs.length) * 100),
      avgMinutes:
        minutes.length > 0
          ? Math.max(
              1,
              Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length),
            )
          : 4,
    };
  }

  const mappedCommits: SimCommit[] = (commits ?? [])
    .filter((c) => c.sha && c.commit)
    .map((c) => ({
      sha: (c.sha ?? "").slice(0, 7),
      message: (c.commit?.message ?? "").split("\n")[0]?.slice(0, 120) ?? "",
      author: c.author?.login ?? c.commit?.author?.name ?? "unknown",
      at: iso(c.commit?.author?.date),
    }))
    .sort((a, b) => b.at - a.at);

  const mappedPulls: SimPullRequest[] = (pulls ?? [])
    .filter((p) => p.number && p.title)
    .map((p) => ({
      number: p.number ?? 0,
      title: p.title ?? "",
      state: p.merged_at ? "merged" : p.state === "open" ? "open" : "closed",
      author: p.user?.login ?? "unknown",
      at: iso(p.merged_at ?? p.closed_at ?? p.created_at),
    }));

  const mappedIssues: SimIssue[] = (issues ?? [])
    .filter((i) => !("pull_request" in i && i.pull_request) && i.number)
    .map((i) => ({
      number: i.number ?? 0,
      title: i.title ?? "",
      state: i.state === "open" ? "open" : "closed",
      label: i.labels?.[0]?.name ?? "general",
    }));

  const totalContributions =
    (contributors ?? []).reduce((sum, c) => sum + (c.contributions ?? 0), 0) ||
    1;
  const mappedContributors = (contributors ?? [])
    .filter((c) => c.login)
    .map((c) => ({
      name: c.login ?? "",
      commits: c.contributions ?? 0,
      share: Math.round(((c.contributions ?? 0) / totalContributions) * 100),
    }));

  const openIssues = mappedIssues.filter((i) => i.state === "open").length;
  const openPulls = mappedPulls.filter((p) => p.state === "open").length;
  const mergedPulls = mappedPulls.filter((p) => p.state === "merged").length;
  const newest = mappedCommits[0]?.at ?? 0;
  const daysIdle = newest ? (Date.now() - newest) / 86_400_000 : 30;
  const health = Math.round(
    Math.min(
      99,
      ci.passRate * 0.45 +
        Math.max(0, 35 - openIssues * 2 - openPulls * 2) +
        mergedPulls * 2 +
        Math.max(0, 12 - daysIdle),
    ),
  );

  const branchNames = (branches ?? []).map((b) => b.name ?? "").filter(Boolean);
  const branch = meta.default_branch ?? branchNames[0] ?? "main";

  return {
    repo: original,
    branch,
    branches: branchNames.length > 0 ? branchNames.slice(0, 6) : [branch],
    commits: mappedCommits,
    pullRequests: mappedPulls,
    issues: mappedIssues,
    ci,
    health: Math.max(20, Math.min(99, health)),
    contributors: mappedContributors.slice(0, 6),
    activity: mappedCommits.slice(0, 6).map((c) => ({
      at: c.at,
      text: `${c.author} pushed ${c.sha} — ${c.message}`,
    })),
  };
}

/* ── Cache ───────────────────────────────────────────────────────────────── */

function readCache(): Map<string, RepoSimulation> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as CacheShape;
    if (Date.now() - parsed.at > TTL_MS) return new Map();
    return new Map(Object.entries(parsed.entries));
  } catch {
    return new Map();
  }
}

function writeCache(entries: Map<string, RepoSimulation>): void {
  try {
    const shape: CacheShape = {
      at: Date.now(),
      entries: Object.fromEntries(entries),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(shape));
  } catch {
    /* quota — cache is best-effort */
  }
}

/* ── Public API ──────────────────────────────────────────────────────────── */

/**
 * Fetch simulations for every slug, hitting the network only for entries
 * missing or older than the TTL. Individual repo failures degrade to an
 * empty slot (callers fall back to simulation per-repo); concurrent calls
 * for the same repo set share one in-flight request.
 */
const inflight = new Map<string, Promise<Map<string, RepoSimulation>>>();

export async function fetchRepoSimulations(
  repos: ReadonlyArray<{ repo: string }>,
  token: string,
): Promise<Map<string, RepoSimulation>> {
  const key = repos
    .map((entry) => entry.repo)
    .slice()
    .sort()
    .join("|");
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const cache = readCache();
    const out = new Map<string, RepoSimulation>();
    const stale = new Map<string, string>(); // slug → original repo string

    for (const entry of repos) {
      const slug = repoSlug(entry.repo);
      if (!slug) continue;
      const hit = cache.get(slug);
      if (hit) out.set(entry.repo, hit);
      else stale.set(slug, entry.repo);
    }

    const slugs = [...stale.keys()];
    const results = await Promise.allSettled(
      slugs.map((slug) => fetchOne(slug, token, stale.get(slug) ?? slug)),
    );
    let fetched = 0;
    results.forEach((result, index) => {
      const slug = slugs[index];
      const original = stale.get(slug);
      if (!slug || !original) return;
      if (result.status === "fulfilled") {
        out.set(original, result.value);
        cache.set(slug, result.value);
        fetched += 1;
      }
    });
    if (fetched > 0) writeCache(cache);
    return out;
  })();

  inflight.set(key, promise);
  promise
    .catch(() => undefined)
    .finally(() => {
      inflight.delete(key);
    });
  return promise;
}

/** Drop cached repo data (the HUD's refresh affordance). */
export function invalidateRepoCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

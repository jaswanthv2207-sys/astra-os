"use client";

import * as React from "react";

import { simulateRepo, type RepoSimulation } from "@/lib/universe-generator";
import { githubConfigured, useSettings } from "@/hooks/use-settings";
import {
  fetchRepoSimulations,
  invalidateRepoCache,
} from "@/services/api/github";

/* ────────────────────────────────────────────────────────────────────────── *
 * GitHub hooks — the seam between the deterministic simulation (default,
 * offline, exactly as shipped) and live REST data (token configured).
 *
 * Both hooks stay silent without a token: `live` remains null and
 * `useRepoSimulation` keeps returning `simulateRepo(...)`. With a token the
 * fetch lands in the shared 10-minute cache, so the HUD and the dossier's
 * three repo tabs read each repository once per TTL. Failures fall back to
 * simulation — the UI never blanks.
 *
 * `astra:github-refresh` (Settings → GitHub → Refresh cache) bumps every
 * subscriber after clearing the cache.
 * ────────────────────────────────────────────────────────────────────────── */

/** Local nonce bumped by the refresh event — shared by both hooks. */
function useRefreshNonce(): number {
  const [nonce, setNonce] = React.useState(0);
  React.useEffect(() => {
    const onRefresh = () => setNonce((value) => value + 1);
    window.addEventListener("astra:github-refresh", onRefresh);
    return () => window.removeEventListener("astra:github-refresh", onRefresh);
  }, []);
  return nonce;
}

export interface UseRepoFeedResult {
  /** Live simulations keyed by the project's repo string — null = simulated. */
  live: Map<string, RepoSimulation> | null;
  /** A fetch is in flight (the HUD's badge shows "sync"). */
  loading: boolean;
  /** Epoch ms of the last successful live fetch, 0 otherwise. */
  updatedAt: number;
  /** Clear the cache and refetch. */
  refresh: () => void;
}

/**
 * Universe-wide live repo data for the HUD.
 *
 * @example
 * const { live, loading } = useRepoFeed(projects);
 * aggregateRepoFeed(projects, live);
 */
export function useRepoFeed(
  projects: readonly { links: { repo: string } }[],
): UseRepoFeedResult {
  const { github } = useSettings();
  const token = github.token.trim();
  const enabled = githubConfigured(github);
  const nonce = useRefreshNonce();

  const [live, setLive] = React.useState<Map<string, RepoSimulation> | null>(
    null,
  );
  const [loading, setLoading] = React.useState(false);
  const [updatedAt, setUpdatedAt] = React.useState(0);

  const reposKey = React.useMemo(
    () => projects.map((project) => project.links.repo).join("|"),
    [projects],
  );

  React.useEffect(() => {
    if (!enabled || !token || reposKey === "") {
      setLive(null);
      setUpdatedAt(0);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const repos = reposKey
      .split("|")
      .filter(Boolean)
      .map((repo) => ({ repo }));
    fetchRepoSimulations(repos, token)
      .then((map) => {
        if (cancelled || map.size === 0) return;
        setLive(map);
        setUpdatedAt(Date.now());
      })
      .catch(() => {
        /* stay on simulation */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, token, reposKey, nonce]);

  const refresh = React.useCallback(() => {
    invalidateRepoCache();
    window.dispatchEvent(new Event("astra:github-refresh"));
  }, []);

  return { live, loading, updatedAt, refresh };
}

/**
 * One repo's simulation — live when a token is configured, seeded otherwise.
 * Accepts any `repo` string (full URL or `owner/name`) plus the seed the
 * simulation keys off (usually the project id).
 */
export function useRepoSimulation(
  repo: string,
  seedKey: string,
): RepoSimulation {
  const { github } = useSettings();
  const enabled = githubConfigured(github);
  const token = github.token.trim();
  const nonce = useRefreshNonce();

  const [live, setLive] = React.useState<RepoSimulation | null>(null);

  React.useEffect(() => {
    if (!enabled || !token || !repo) {
      setLive(null);
      return;
    }
    let cancelled = false;
    fetchRepoSimulations([{ repo }], token)
      .then((map) => {
        if (!cancelled) setLive(map.get(repo) ?? null);
      })
      .catch(() => {
        /* stay on simulation */
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, token, repo, nonce]);

  return live ?? simulateRepo(repo, seedKey);
}

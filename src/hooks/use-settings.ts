"use client";

import { useShallow } from "zustand/react/shallow";

import {
  useSettingsStore,
  DEFAULT_MODELS,
  type AiProvider,
  type AiSettings,
  type GithubSettings,
  type SoundSettings,
} from "@/stores";
import { streamChat, testAiConnection } from "@/services/api/ai";
import { invalidateRepoCache, testGithubToken } from "@/services/api/github";
import { pullFromGist, uploadToGist } from "@/services/api/gist";

/* ────────────────────────────────────────────────────────────────────────── *
 * Settings hooks — the sanctioned bridge to the device-local settings store
 * (dependency rule: sections never import `stores/` or `services/` directly;
 * the network calls hang off the grab-bags below, mirroring
 * `workspaceActions()`).
 *
 * `useSettings()` returns a shallow-merged view so consumers re-render only
 * when a slice they read actually changes; `settingsActions()` is the
 * imperative grab-bag for event handlers and the audio engine.
 * ────────────────────────────────────────────────────────────────────────── */

export interface UseSettingsResult {
  ai: AiSettings;
  github: GithubSettings;
  sound: SoundSettings;
}

export function useSettings(): UseSettingsResult {
  return useSettingsStore(
    useShallow((state) => ({
      ai: state.ai,
      github: state.github,
      sound: state.sound,
    })),
  );
}

/** Imperative access — never call during render. */
export function settingsActions(): ReturnType<
  typeof useSettingsStore.getState
> {
  return useSettingsStore.getState();
}

/** The model actually sent — blank fields fall back to the provider default. */
export function resolveModel(ai: AiSettings): string {
  return ai.model.trim() || DEFAULT_MODELS[ai.provider];
}

/** Is there enough configuration to attempt a real model call? */
export function aiConfigured(ai: AiSettings): boolean {
  return ai.key.trim().length > 0;
}

/** Is there a token — i.e. live GitHub features are possible? */
export function githubConfigured(github: GithubSettings): boolean {
  return github.token.trim().length > 0;
}

/* ── Network actions ─────────────────────────────────────────────────────── */

/** Probe the configured provider, or stream a chat completion (SSE). */
export function aiActions() {
  return { test: testAiConnection, stream: streamChat };
}

/** Validate the token, or drop the 10-minute repo cache (refetch follows). */
export function githubActions() {
  return { test: testGithubToken, clearRepoCache: invalidateRepoCache };
}

/** Secret-gist workspace sync — the payload is `exportJson()` verbatim. */
export function syncActions() {
  return { upload: uploadToGist, pull: pullFromGist };
}

export type { AiProvider, AiSettings, GithubSettings, SoundSettings };
export type { ChatMessage } from "@/services/api/ai";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Settings — device-local preferences and credentials.
 *
 * Deliberately separate from `workspace-store`: this slice holds *secrets*
 * (an AI API key, a GitHub token) and device preferences that must never
 * ride along in `exportJson()` / a synced gist. Only non-secret preference
 * data (sound, provider choice, gist id, last-sync stamp) is persisted.
 *
 * Every feature here is optional and layered on top of the deterministic
 * engine: empty credentials ⇒ the app behaves exactly as it ships —
 * simulated repo activity, the built-in Astra reply engine, no network.
 */

export type AiProvider = "openai" | "anthropic";

export interface AiSettings {
  /** Which API to call for free-form asks. */
  provider: AiProvider;
  /** Model id — empty means “the provider default”. */
  model: string;
  /** API key, stored locally in this browser only. */
  key: string;
}

export interface GithubSettings {
  /** Personal access token (repo read + gist scopes). */
  token: string;
  /** Gist id used for workspace sync (set after the first upload). */
  gistId: string;
  /** Epoch ms of the last successful sync, or null. */
  lastSynced: number | null;
}

export interface SoundSettings {
  /** Master switch — everything silent when off. */
  on: boolean;
  /** Ambient drone on /universe. */
  ambient: boolean;
  /** Interface cues (palette, assistant, warp). */
  ui: boolean;
  /** Master volume 0–1. */
  volume: number;
}

export interface SettingsState {
  ai: AiSettings;
  github: GithubSettings;
  sound: SoundSettings;
  setAi: (patch: Partial<AiSettings>) => void;
  setGithub: (patch: Partial<GithubSettings>) => void;
  setSound: (patch: Partial<SoundSettings>) => void;
}

/** Storage key — also labelled in the workspace stats scan. */
export const SETTINGS_KEY = "astra.settings.v1";

/** Sensible model per provider when the field is left blank. */
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-20250514",
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ai: { provider: "openai", model: "", key: "" },
      github: { token: "", gistId: "", lastSynced: null },
      sound: { on: false, ambient: true, ui: true, volume: 0.7 },

      setAi: (patch) => set((state) => ({ ai: { ...state.ai, ...patch } })),
      setGithub: (patch) =>
        set((state) => ({ github: { ...state.github, ...patch } })),
      setSound: (patch) =>
        set((state) => ({ sound: { ...state.sound, ...patch } })),
    }),
    { name: SETTINGS_KEY },
  ),
);

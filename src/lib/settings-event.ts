/**
 * `astra:settings-open` — the one way any surface raises the Settings
 * modal (same dispatch pattern as `astra:tour-start`): palette command,
 * assistant gear, manager sync button all land here without importing
 * each other.
 */

export type SettingsSection = "assistant" | "github" | "sync" | "sound" | "app";

export const SETTINGS_EVENT = "astra:settings-open";

/** Open Settings, optionally scrolled to a section. Client-only. */
export function openSettings(section?: SettingsSection): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SETTINGS_EVENT, { detail: { section } }),
  );
}

"use client";

import * as React from "react";

import { configure, startAmbient, stopAmbient } from "@/lib/audio";
import { useSettings } from "@/hooks/use-settings";

/* ────────────────────────────────────────────────────────────────────────── *
 * Sound hooks — the bridge between the settings store and the pure audio
 * engine (`lib/audio` has no React or store knowledge).
 *
 *   • `useSoundConfig()`  — mounted once (settings modal): pushes every
 *                           preference change into the engine.
 *   • `useAmbient(seed)`  — mounted on /universe: keeps the drone keyed to
 *                           the active universe, fades out on leave.
 * ────────────────────────────────────────────────────────────────────────── */

export function useSoundConfig(): void {
  const { sound } = useSettings();

  React.useEffect(() => {
    configure({
      volume: sound.volume,
      ui: sound.on && sound.ui,
      ambient: sound.on && sound.ambient,
    });
    if (!(sound.on && sound.ambient)) stopAmbient(0.6);
  }, [sound.on, sound.ui, sound.ambient, sound.volume]);
}

/**
 * Ambient drone for a universe seed. Pass `null` when there is no universe
 * (leaving the page) — the pad fades out. Re-runs on any sound preference
 * change, so toggling Settings mid-scene just works.
 */
export function useAmbient(seed: number | null): void {
  const { sound } = useSettings();
  const { on, ambient } = sound;

  React.useEffect(() => {
    if (on && ambient && seed !== null) startAmbient(seed);
    else stopAmbient(0.8);
    return () => stopAmbient(0.4);
  }, [on, ambient, seed]);
}

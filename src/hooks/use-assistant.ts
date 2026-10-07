"use client";

import {
  useAssistantStore,
  type AssistantAction,
  type AssistantMessage,
  type AssistantState,
} from "@/stores";

export type { AssistantAction, AssistantMessage };

/* ────────────────────────────────────────────────────────────────────────── *
 * Assistant hooks — the only sanctioned way to reach the assistant store
 * (dependency rule: never import `stores/` directly).
 *
 * Two views on purpose: the shell subscribes only to `open` so the page
 * never re-renders on a message push (the 3D scene is a child of the shell),
 * while `UniverseAssistant` takes the full view it drives.
 * ────────────────────────────────────────────────────────────────────────── */

/** Open flag + close — for the shell's Escape ordering and remount guard. */
export function useAssistantOpen(): {
  open: boolean;
  close: () => void;
} {
  const open = useAssistantStore((state) => state.open);
  const close = useAssistantStore((state) => state.close);
  return { open, close };
}

export interface UseAssistantResult {
  open: AssistantState["open"];
  messages: AssistantMessage[];
  setOpen: AssistantState["setOpen"];
  push: AssistantState["push"];
  update: AssistantState["update"];
}

/**
 * Everything in one view — for `UniverseAssistant`, which drives it all.
 *
 * @example
 * const { open, messages, setOpen, push, update } = useAssistant();
 */
export function useAssistant(): UseAssistantResult {
  const open = useAssistantStore((state) => state.open);
  const messages = useAssistantStore((state) => state.messages);
  const setOpen = useAssistantStore((state) => state.setOpen);
  const push = useAssistantStore((state) => state.push);
  const update = useAssistantStore((state) => state.update);
  return { open, messages, setOpen, push, update };
}

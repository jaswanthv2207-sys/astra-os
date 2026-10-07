import { create } from "zustand";

import type { IconName } from "@/lib/icons";

/**
 * Astra — the assistant orb's conversation, the single source of truth
 * connecting the floating orb, the expanded chat panel and the shell's
 * Escape ordering.
 *
 * The store holds raw conversation state only; the "understanding" layer
 * lives in `sections/universe/assistant-reply.ts` (the UI computes replies
 * and pushes them here, so this file never imports data or parsing — the
 * same contract as `search-store`). Messages persist across visits to
 * /universe; only `open` resets, guarded in the shell's remount handler.
 *
 *   • `open`     — is the conversational panel expanded (orb ⇄ panel),
 *   • `messages` — the transcript; `actions` on an Astra message are the
 *                  chips rendered under its bubble (plain data — the shell
 *                  maps them to camera moves), kept so history stays
 *                  actionable after the panel auto-closes for a reveal.
 */
export interface AssistantAction {
  /** Stable key for React lists. */
  id: string;
  /** Chip label. */
  label: string;
  /** Icon registry name rendered inside the chip. */
  icon: IconName;
  /** Camera move this chip performs when clicked. */
  kind: "focus" | "frame";
  /** Target world id(s) — one for focus, many for frame. */
  ids: readonly string[];
}

export interface AssistantMessage {
  /** Unique per message (component-generated, stable across renders). */
  id: string;
  /** Who is speaking. */
  role: "user" | "astra";
  /** Message body — may contain newlines rendered as wrapped lines. */
  text: string;
  /** Optional action chips (Astra messages only). */
  actions?: readonly AssistantAction[];
}

export interface AssistantState {
  /** Is the conversational panel expanded. */
  open: boolean;
  /** The conversation transcript. */
  messages: AssistantMessage[];
  /** Expand or collapse the panel. */
  setOpen: (open: boolean) => void;
  /** Collapse the panel without touching the transcript (Escape/close). */
  close: () => void;
  /** Append one message to the transcript. */
  push: (message: AssistantMessage) => void;
  /** Patch a message in place — how a streamed reply grows token by token. */
  update: (id: string, patch: Partial<AssistantMessage>) => void;
}

export const useAssistantStore = create<AssistantState>((set) => ({
  open: false,
  messages: [],
  setOpen: (open) => set((state) => (state.open === open ? state : { open })),
  close: () => set((state) => (state.open ? { open: false } : state)),
  push: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  update: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, ...patch } : message,
      ),
    })),
}));

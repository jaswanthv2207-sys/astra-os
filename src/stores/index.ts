/**
 * Global Zustand stores (one file or folder per store).
 *
 *   stores/ui-store.ts       – transient UI state (modals, theme, sidebar)
 *   stores/launch-store.ts   – cinematic "enter the universe" transition
 *   stores/universe-store.ts – which world the /universe camera focuses
 *   stores/search-store.ts   – /universe AI search text + matched/frame ids
 *   stores/assistant-store.ts– /universe Astra orb open state + transcript
 *   stores/timeline-store.ts – /universe knowledge-timeline viewed date
 *   stores/workspace-store.ts– multi-universe workspace (persisted)
 *   stores/stock-workspace.ts– stock-graph per-planet tasks/notes/docs
 *   stores/settings-store.ts – device-local settings + credentials (secret)
 *
 * Server state belongs in React Query (`src/services`), not Zustand.
 * Consumers read stores through `src/hooks` — never import them from
 * components or sections (see STRUCTURE.md dependency rules).
 */
export {
  useLaunchStore,
  selectLaunching,
  type LaunchPhase,
  type LaunchState,
} from "./launch-store";
export {
  useUniverseStore,
  selectFocusedId,
  type UniverseState,
} from "./universe-store";
export { useSearchStore, type SearchState } from "./search-store";
export {
  useAssistantStore,
  type AssistantAction,
  type AssistantMessage,
  type AssistantState,
} from "./assistant-store";
export { useTimelineStore, type TimelineState } from "./timeline-store";
export {
  useWorkspaceStore,
  flushWorkspace,
  type WorkspaceState,
  type WorkspaceBackup,
} from "./workspace-store";
export {
  useStockWorkspaceStore,
  STOCK_SEED,
  type StockWorkspaceState,
} from "./stock-workspace";
export {
  useSettingsStore,
  SETTINGS_KEY,
  DEFAULT_MODELS,
  type AiProvider,
  type AiSettings,
  type GithubSettings,
  type SoundSettings,
  type SettingsState,
} from "./settings-store";

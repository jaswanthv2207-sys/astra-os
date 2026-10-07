/**
 * Shared, framework-facing React hooks (useMediaQuery, useDebounce, ...).
 *
 * Rules:
 *   - "use client" belongs at the top of the hook file, not here.
 *   - Hooks that wrap a single feature live next to that feature.
 *   - No direct network calls — go through `src/services`.
 *   - Global-state hooks (use-launch) are the bridge between components and
 *     `src/stores` — components never import stores directly.
 */
export { useLaunch, type UseLaunchResult } from "./use-launch";
export { useUniverse, type UseUniverseResult } from "./use-universe";
export {
  useAssistant,
  useAssistantOpen,
  type AssistantAction,
  type AssistantMessage,
  type UseAssistantResult,
} from "./use-assistant";
export { useMediaQuery } from "./use-media-query";
export { useUniverseBriefing, type UniverseBriefing } from "./use-insights";
export { useSceneData, useSceneProjects } from "./use-scene-data";
export {
  useUniverses,
  useUniverseRecord,
  useUniverseCount,
  useActiveUniverseRecord,
  useActiveUniverseId,
  useFolders,
  useNotifications,
  useUnreadCount,
  useAchievements,
  useBackups,
  useStreak,
  useTourSeen,
  useWorkspaceHydrated,
  usePlanetWorkspace,
  useTaskSummary,
  workspaceActions,
} from "./use-workspace";
export {
  useTimeline,
  useTimelineDate,
  readTimelineDate,
  readTimelineNow,
  timelineIsPast,
  resetTimeline,
  setTimelineWindow,
  type UseTimelineResult,
} from "./use-timeline";
export {
  useSettings,
  settingsActions,
  resolveModel,
  aiConfigured,
  githubConfigured,
  aiActions,
  githubActions,
  syncActions,
  type ChatMessage,
  type UseSettingsResult,
} from "./use-settings";
export { useSoundConfig, useAmbient } from "./use-sound";

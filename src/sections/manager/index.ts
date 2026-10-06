/**
 * Manager section — /universes, the persistent multi-universe workspace.
 *
 * Public surface:
 *   UniverseManager  route shell (sidebar, toolbar, sortable card grid)
 *
 * Card/sidebar internals (`universe-card`, `manager-sidebar`,
 * `manager-data`) are deliberately not re-exported — the route imports
 * only the shell, everything else stays section-private.
 */
export { UniverseManager } from "./universe-manager";

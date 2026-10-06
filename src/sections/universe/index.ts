/**
 * Universe section — the immersive /universe experience.
 *
 * Public surface:
 *   UniverseExperience  route shell (boot, WebGL guard, HUD, exit)
 *   UniverseHud         the futuristic-OS overlay
 *
 * The WebGL scene (`scene/`) is intentionally NOT exported here — it is
 * loaded with `ssr: false` inside `universe-experience.tsx` so three.js
 * never enters the server bundle or the landing-page chunk graph.
 */
export { UniverseExperience } from "./universe-experience";
export { UniverseHud, type UniverseHudProps } from "./universe-hud";

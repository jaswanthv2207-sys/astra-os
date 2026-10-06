/**
 * Feature-agnostic reusable widgets: scroll reveals, animated page
 * backgrounds, empty states, spinners, confirm dialogs.
 *
 * Anything interactive here is a Client Component (`"use client"`) — the
 * server-safe modules stay importable from Server Components either way,
 * since this barrel is only re-exported as React client references.
 */
export { Reveal, type RevealProps } from "./reveal";
export { LaunchTransition } from "./launch-transition";
export {
  AnimatedBackground,
  AuroraBackground,
  GridBackground,
  NoiseOverlay,
  type AnimatedBackgroundProps,
  type AuroraBackgroundProps,
  type GridBackgroundProps,
  type NoiseOverlayProps,
} from "./animated-background";

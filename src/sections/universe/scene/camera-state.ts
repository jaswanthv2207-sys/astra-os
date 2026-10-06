/**
 * Shared, render-loop-safe camera state for the `/universe` scene.
 *
 * A plain module singleton (no React re-renders) bridges four systems:
 *   • `CinematicCamera` writes the camera while `mode === "auto"` and steps
 *     aside the instant the visitor engages the orbit controls,
 *   • `CameraRig` owns the mode machine + warp jumps and measures camera
 *     speed into `motion` (0..1) while shaping the warp envelope,
 *   • the speed-blur postprocess effect reads `motion` / `warp` / `flash`
 *     in its `update()` hook — one frame behind at most, imperceptible,
 *   • the star field stretches its points into hyperspace streaks off
 *     `warp`, and `BloomDriver` surges the bloom off `warp` + `flash`.
 */
export type CameraMode = "auto" | "user" | "flying";

export const cameraState = {
  /** `auto` = cinematic drift, `user` = orbit controls, `flying` = warp jump. */
  mode: "auto" as CameraMode,
  /** 0..1 normalised camera speed — drives the motion-blur strength. */
  motion: 0,
  /**
   * Warp-jump envelope. Positive (0..1) drives the hyperspace streaks, the
   * energy tunnel and the field-of-view punch; a small negative dip during
   * the pre-launch charge tightens the FOV for tension; 0 at rest.
   */
  warp: 0,
  /** Touchdown/ignition flash spike (1 → decays to 0) — the burst of light. */
  flash: 0,
};

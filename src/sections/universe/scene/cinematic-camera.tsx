"use client";

import * as React from "react";
import { useFrame, useThree, invalidate } from "@react-three/fiber";
import * as THREE from "three";

import { cameraState } from "./camera-state";

/* ────────────────────────────────────────────────────────────────────────── *
 * CinematicCamera — the slow, expensive-feeling move.
 *
 * • arrival dolly: the camera sweeps in from far away over ~6s (easeOutQuart)
 * • perpetual lissajous drift so the parallax between star shell, dust and
 *   nebula never stops changing
 * • a second, much slower drift layer (~3 min period) layered underneath —
 *   two incommensurate cycles mean the frame composition is always evolving
 *   and never visibly repeats
 * • pointer parallax, critically damped so it glides instead of tracking
 * • a slow look-target wander plus a whisper of dutch roll
 *
 * Hand-off: the moment the visitor touches the scene, `camera-rig.tsx`
 * flips `cameraState.mode` to "user" and this component stops writing — the
 * orbit controls pick the shot up exactly where the drift left it.
 *
 * Under prefers-reduced-motion the camera is placed once, statically, in a
 * composed hero frame and never moves again.
 * ────────────────────────────────────────────────────────────────────────── */

const INTRO_SECONDS = 6;
const INTRO_START_Z = 46;
const HOME_Z = 17;

export interface CinematicCameraProps {
  /** Freeze all camera motion (prefers-reduced-motion). */
  reduced?: boolean;
}

export function CinematicCamera({ reduced = false }: CinematicCameraProps) {
  const camera = useThree((state) => state.camera);
  const pointer = useThree((state) => state.pointer);

  const lookTarget = React.useRef(new THREE.Vector3(0, 0, -60));

  /* Static hero frame for reduced-motion visitors. */
  React.useEffect(() => {
    if (!reduced) return;
    camera.position.set(-2, 2, HOME_Z);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, -60);
    // frameloop="demand": ask for the one frame that shows this pose.
    invalidate();
  }, [reduced, camera]);

  useFrame((state, delta) => {
    // Yield to the orbit controls / focus flights the instant the visitor
    // engages the scene (or focus mode starts).
    if (reduced || cameraState.mode !== "auto") return;

    const t = state.clock.elapsedTime;
    // easeOutQuart — fast settle, long graceful tail.
    const intro = 1 - Math.pow(1 - Math.min(t / INTRO_SECONDS, 1), 4);
    // Frame-rate independent damping (safe against tab-switch delta spikes).
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * 1.6);

    // Fast drift (~1 min cycle) + slow drift (~3 min cycle). The ratio is
    // irrational enough that the combined path never repeats in practice.
    const slowX = Math.sin(t * 0.037 + 1.9) * 4.2;
    const slowY = Math.cos(t * 0.029 + 0.7) * 2.6;

    const targetX =
      (1 - intro) * -10 + Math.sin(t * 0.11) * 3 + slowX + pointer.x * 2.2;
    const targetY =
      (1 - intro) * 6 + Math.cos(t * 0.09) * 1.6 + slowY + pointer.y * 1.4;
    const targetZ = INTRO_START_Z + (HOME_Z - INTRO_START_Z) * intro;

    camera.position.x += (targetX - camera.position.x) * k;
    camera.position.y += (targetY - camera.position.y) * k;
    camera.position.z += (targetZ - camera.position.z) * k;

    lookTarget.current.set(
      Math.sin(t * 0.07) * 5 + Math.sin(t * 0.023) * 3,
      Math.cos(t * 0.05) * 3 + Math.cos(t * 0.041) * 1.8,
      -60,
    );
    camera.lookAt(lookTarget.current);
    // Subtle dutch roll — sells "handheld in zero-g" without being noticed.
    camera.rotation.z = Math.sin(t * 0.05) * 0.02 + Math.sin(t * 0.031) * 0.012;
  });

  return null;
}

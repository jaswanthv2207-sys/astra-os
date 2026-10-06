"use client";

import * as React from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import type { BloomEffect } from "postprocessing";

import { AsteroidBelts } from "./asteroid-belt";
import { Aurora } from "./aurora";
import { CameraRig } from "./camera-rig";
import { cameraState } from "./camera-state";
import { CinematicCamera } from "./cinematic-camera";
import { Connections } from "./connections";
import { CosmicDust } from "./cosmic-dust";
import { DustField } from "./dust-field";
import { Galaxies } from "./galaxies";
import { labelPortalRef } from "./label-overlay";
import { LensFlares } from "./lens-flares";
import { LightParticles } from "./light-particles";
import { NebulaField } from "./nebula";
import { OrbitRings } from "./orbit-rings";
import { Planets } from "./planets";
import { ShootingStars } from "./shooting-stars";
import { SpeedBlur } from "./speed-blur";
import { StarField } from "./star-field";

/* ────────────────────────────────────────────────────────────────────────── *
 * UniverseScene — everything that lives inside the WebGL canvas.
 *
 * Layer order back→front: distant galaxies → aurora curtains → nebula gas
 * (additive) → star shell → orbiting project planets with their breathing
 * ecosystems (moons, satellites) → asteroid belts → knowledge-graph energy
 * beams → cosmic dust → near dust → floating light particles → shooting stars
 * → lens flares, all seated in exponential fog so distance reads as depth
 * rather than as objects floating on black. Post chain: warp-aware speed
 * blur (radial smear + chroma + energy tunnel + touchdown flash) → bloom,
 * which surges with the warp envelope → chromatic aberration fringes the
 * highlights → noise + vignette seat the whole frame into the Astra OS
 * dark. A warp jump is orchestrated across `camera-state` (written by
 * `CameraRig`), read by the star streaks, the blur and `BloomDriver`.
 * ────────────────────────────────────────────────────────────────────────── */

/** Resting bloom intensity — the warp envelope and flashes surge on top. */
const BLOOM_BASE = 1.15;

export interface UniverseSceneProps {
  /** Freeze every animated system (prefers-reduced-motion). */
  reduced?: boolean;
  /** ~9k stars on desktop, trimmed on phones. */
  starCount?: number;
}

export function UniverseScene({
  reduced = false,
  starCount = 9000,
}: UniverseSceneProps) {
  const bloomRef = React.useRef<BloomEffect>(null);

  return (
    <Canvas
      className="absolute inset-0"
      dpr={[1, 2]}
      frameloop={reduced ? "demand" : "always"}
      camera={{ fov: 55, near: 0.1, far: 400, position: [-10, 6, 46] }}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
      }}
      aria-hidden="true"
    >
      {/* Keeps the drei <Html> label overlay inside the live event container
          so label coordinates + stacking match the canvas exactly. */}
      <LabelOverlayHost />
      {/* Deep-space base + exponential fog: far geometry melts into the void */}
      <color attach="background" args={["#05040c"]} />
      <fogExp2 attach="fog" args={["#070512", 0.012]} />

      {/* Cool key from the nebula mass, violet rim from below-left */}
      <ambientLight intensity={0.35} color="#8b9cff" />
      <directionalLight
        position={[40, 30, -60]}
        intensity={1.1}
        color="#c4b5fd"
      />
      <pointLight position={[-50, -30, -40]} intensity={400} color="#22d3ee" />
      <pointLight position={[30, 40, -80]} intensity={600} color="#e879f9" />

      {/* Deepest layer: distant galaxies + aurora curtains behind the gas */}
      <Galaxies reduced={reduced} />
      <Aurora reduced={reduced} />

      <NebulaField reduced={reduced} />
      <StarField count={starCount} reduced={reduced} />

      {/* The ellipses worlds travel — always on themed scenes, and on stock
          scenes while the knowledge timeline travels (milestones ride them) */}
      <OrbitRings />
      {/* Depth layers in front of the planets */}
      <Planets reduced={reduced} />
      {/* Slow rock rings beyond each system's reach — one rigid rotation per frame */}
      <AsteroidBelts reduced={reduced} />
      {/* Neural beams linking related projects — tracked live off planet positions */}
      <Connections reduced={reduced} />
      <CosmicDust reduced={reduced} />
      <DustField reduced={reduced} />
      <LightParticles reduced={reduced} />
      <ShootingStars reduced={reduced} />
      <LensFlares reduced={reduced} />

      <CinematicCamera reduced={reduced} />
      {/* Orbit controls + warp jumps — engages on first gesture */}
      <CameraRig reduced={reduced} />
      {/* Surges the bloom off the warp envelope + flashes (singleton reads,
          so the glow rides a jump without re-rendering the composer) */}
      <BloomDriver bloomRef={bloomRef} />

      <EffectComposer multisampling={4} enabled>
        {/* First in the chain: smears the raw scene under camera motion */}
        <SpeedBlur />
        <Bloom
          ref={bloomRef}
          mipmapBlur
          intensity={BLOOM_BASE}
          luminanceThreshold={0.12}
          luminanceSmoothing={0.3}
          radius={0.75}
        />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={[0.0008, 0.0008]}
          radialModulation
          modulationOffset={0.35}
        />
        <Vignette eskil={false} offset={0.22} darkness={0.82} />
        <Noise
          premultiply
          blendFunction={BlendFunction.OVERLAY}
          opacity={0.32}
        />
      </EffectComposer>
    </Canvas>
  );
}

/**
 * Mounts the shared label overlay into whatever container drei would have
 * used as its `Html` target. Re-attaches if R3F ever reconnects events to a
 * different node; the labels themselves never move roots, because they all
 * render through the stable `labelPortalRef`.
 */
function LabelOverlayHost() {
  const connected = useThree((state) => state.events.connected);

  React.useLayoutEffect(() => {
    if (!connected) return;
    const overlay = labelPortalRef.current;
    connected.appendChild(overlay);
    return () => {
      overlay.remove();
    };
  }, [connected]);

  return null;
}

/**
 * Surchges the bloom off the warp envelope and the flash spikes — reads the
 * shared singleton each frame and only writes when the delta is worth it, so
 * an idle scene pays one comparison per frame.
 */
function BloomDriver({
  bloomRef,
}: {
  bloomRef: React.RefObject<BloomEffect | null>;
}) {
  useFrame(() => {
    const bloom = bloomRef.current;
    if (!bloom) return;
    const target =
      BLOOM_BASE + cameraState.warp * 0.85 + cameraState.flash * 1.4;
    if (Math.abs(bloom.intensity - target) > 0.004) bloom.intensity = target;
  });
  return null;
}

export default UniverseScene;

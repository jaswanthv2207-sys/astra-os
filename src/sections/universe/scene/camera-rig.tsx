"use client";

import * as React from "react";
import { OrbitControls } from "@react-three/drei";
import { invalidate, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import { PROJECTS } from "@/data";
import { useSearchFrame } from "@/hooks/use-search";
import { useUniverse } from "@/hooks/use-universe";

import { cameraState } from "./camera-state";
import { readPlanetPosition } from "./planet-registry";

/* ────────────────────────────────────────────────────────────────────────── *
 * CameraRig — cinematic controls + the planet fly-through.
 *
 * Hand-off: from load, `CinematicCamera` owns the frame (`cameraState.mode`
 * stays "auto") while the orbit controls sit armed but idle. The first
 * pointer-down or wheel gesture engages the rig: the orbit centre is
 * re-anchored along the exact current view ray, so damping, rotation and
 * panning pick up the shot with zero snap — the drift simply stops.
 *
 * Select a world (click it, or use the HUD's screen-reader twin) and the
 * store gains a `focusedId`; this rig then launches a **warp jump** — the
 * camera accelerates along a gently arced Bézier while a signed envelope
 * (charge → streak → fold-back) drives everything hyperspace: the star
 * streaks and energy tunnel in `speed-blur.ts` / `star-field.tsx`, the FOV
 * punch, the ignition and touchdown flashes, holding the orbit target on
 * the planet throughout so controls resume seamlessly on arrival. Focus
 * also eases the projection's view offset so the planet settles beside the
 * dossier panel (see the framing constants below). Releasing focus
 * (Escape / the panel) warps back to the exact position and target
 * captured on the way out — the return is the mirror of the approach.
 *
 * A committed multi-result search takes a second intent (`reveal`): the rig
 * warps to a radial vantage that frames every matched world at once, then
 * hands the orbit back. Priority is focus → frame → overview, each planned
 * once per key so re-renders never replay a flight. A jump planned while a
 * warp is already warm starts mid-envelope, so rapid prev/next travel
 * between worlds never collapses the streaks between hops.
 *
 * Under prefers-reduced-motion flights cut instead of fly, the warp
 * envelope never engages, auto-rotation is off and the blur measures zero.
 * ────────────────────────────────────────────────────────────────────────── */

/** The scene's visual centre — orbit radius is measured along the view ray. */
const ORBIT_CENTER = new THREE.Vector3(0, 0, -62);
const BASE_FOV = 55;
/** Field-of-view punch at warp speed — the charge dips it, the cruise opens it. */
const FOV_KICK = 15;
/** Seconds for the ignition/touchdown flash to burn out. */
const FLASH_DECAY = 4.6;
/** Units per second that read as full motion for the blur. */
const FULL_SPEED = 48;
const MOTION_ATTACK = 10;
const MOTION_RELEASE = 3.2;

/**
 * The warp envelope over a flight's normalised time: negative during the
 * pre-launch charge (tightens the FOV for tension — no streaks yet), pinned
 * at full streak through the cruise, then folded back to normal space just
 * before touchdown so the destination arrives crisp instead of smeared.
 */
function warpTarget(raw: number): number {
  if (raw < 0.1) return -0.18 * (raw / 0.1);
  if (raw > 0.84) return Math.max(0, (1 - raw) / 0.16);
  return 1;
}

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3();
const ARC_DIR = new THREE.Vector3();
const ARC_SIDE = new THREE.Vector3();

/** Destination distance: the planet fills roughly 40% of frame height. */
function focusDistance(radius: number): number {
  return radius * 4 + 1.8;
}

/* ── focus framing ───────────────────────────────────────────────────────── *
 * The dossier panel docks right (≥1024px) or along the bottom, so on focus
 * the planet is slid into the free half of the screen with the projection's
 * *view offset* rather than by moving the camera — the look-at target stays
 * on the world (orbit/zoom keep it framed) and every consumer that
 * unprojects through the same matrix (pointer picking, drei Html pills)
 * stays glued to it.
 * ───────────────────────────────────────────────────────────────────────── */
/** Fraction of width the planet shifts left beside the side panel. */
const FRAME_X = 0.16;
/** Fraction of height the planet rises above the bottom sheet. */
const FRAME_Y = 0.2;
/** Matches the detail panel's `lg:` breakpoint (side panel vs sheet). */
const FRAME_MIN_WIDTH = 1024;
/** Damping for the framing shift — ~1s settle, no snap. */
const FRAME_LAMBDA = 3;

function focusShift(
  focused: boolean,
  width: number,
  height: number,
): { x: number; y: number } {
  if (!focused) return { x: 0, y: 0 };
  if (width >= FRAME_MIN_WIDTH) return { x: width * FRAME_X, y: 0 };
  return { x: 0, y: height * FRAME_Y };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Gentle sideways + upward sweep so flights arc like a crane, not a rail. */
function arcMid(
  from: THREE.Vector3,
  to: THREE.Vector3,
  out: THREE.Vector3,
): THREE.Vector3 {
  out.copy(from).add(to).multiplyScalar(0.5);
  ARC_DIR.copy(to).sub(from);
  const length = ARC_DIR.length();
  if (length > 1e-4) {
    ARC_DIR.divideScalar(length);
    ARC_SIDE.crossVectors(ARC_DIR, UP);
    if (ARC_SIDE.lengthSq() < 1e-6) ARC_SIDE.set(1, 0, 0);
    else ARC_SIDE.normalize();
    out.addScaledVector(ARC_SIDE, length * 0.16);
    out.y += length * 0.1;
  }
  return out;
}

interface Flight {
  kind: "out" | "back" | "reveal";
  elapsed: number;
  duration: number;
  fromPos: THREE.Vector3;
  mid: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  /** Ignition flash fired once (as the drive lights). */
  charged?: boolean;
  /** Touchdown flash fired once (as the planet locks in). */
  flashed?: boolean;
}

interface Overview {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}

export interface CameraRigProps {
  /** Cut instead of fly; no auto-rotation, no motion blur (reduced motion). */
  reduced?: boolean;
}

export function CameraRig({ reduced = false }: CameraRigProps) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);

  const controlsRef = React.useRef<OrbitControlsImpl | null>(null);
  const flightRef = React.useRef<Flight | null>(null);
  const overviewRef = React.useRef<Overview | null>(null);
  const previousPos = React.useRef(new THREE.Vector3());
  const shift = React.useRef({ x: 0, y: 0 });
  const applied = React.useRef({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    active: false,
  });
  const [engaged, setEngaged] = React.useState(false);
  const [flying, setFlying] = React.useState(false);

  const { focusedId } = useUniverse();
  const frameIds = useSearchFrame();
  /** Which camera intent is currently served — prevents replanning the same
   *  focus/frame twice when an unrelated store field changes. */
  const intentKey = React.useRef<string | null>(null);

  /**
   * Anchor the orbit centre on the current view ray. Because the target sits
   * exactly where the camera already looks, enabling updates cannot snap the
   * orientation — the hand-off from drift (or from a flight) is seamless.
   */
  const anchorTarget = React.useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    camera.getWorldDirection(FORWARD);
    const distance = camera.position.distanceTo(ORBIT_CENTER);
    controls.target.copy(camera.position).addScaledVector(FORWARD, distance);
    controls.update();
  }, [camera]);

  /** First gesture: cinematic drift yields to the visitor. */
  const engage = React.useCallback(() => {
    if (cameraState.mode !== "auto") return;
    cameraState.mode = "user";
    anchorTarget();
    setEngaged(true);
  }, [anchorTarget]);

  /* Initial anchor (before the first frame) + velocity baseline. */
  React.useEffect(() => {
    previousPos.current.copy(camera.position);
    anchorTarget();
  }, [anchorTarget, camera]);

  /* Arm engagement on the first pointer-down or wheel anywhere on the canvas. */
  React.useEffect(() => {
    const element = gl.domElement;
    element.addEventListener("pointerdown", engage);
    element.addEventListener("wheel", engage, { passive: true });
    return () => {
      element.removeEventListener("pointerdown", engage);
      element.removeEventListener("wheel", engage);
    };
  }, [gl, engage]);

  /** Hand a planned flight to the frame loop. A jump that starts while a
   *  warp is already warm skips the charge dip, so rapid prev/next travel
   *  between worlds keeps its streaks instead of collapsing mid-hop. */
  const beginFlight = React.useCallback((flight: Flight) => {
    if (cameraState.warp > 0.4) flight.elapsed = flight.duration * 0.12;
    flightRef.current = flight;
    setFlying(true);
    cameraState.mode = "flying";
  }, []);

  /* Camera intents, in priority order: a focused world beats a framed
     result set, which beats the overview. Each intent plans at most once
     per key, so re-renders never replay a settled or running flight. */
  React.useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (focusedId) {
      const key = `focus:${focusedId}`;
      if (intentKey.current === key) return;
      const planet = readPlanetPosition(focusedId);
      const project = PROJECTS.find((entry) => entry.id === focusedId);
      if (!planet || !project) return;

      // May still be in cinematic mode if the focus came from the HUD's
      // screen-reader list without a canvas gesture first.
      if (cameraState.mode === "auto") {
        cameraState.mode = "user";
        anchorTarget();
        setEngaged(true);
      }

      // Remember the orbit view the first time we leave it — that is where
      // "return to orbit" flies back to.
      if (!overviewRef.current) {
        overviewRef.current = {
          pos: camera.position.clone(),
          target: controls.target.clone(),
        };
      }

      const approach = camera.position.clone().sub(planet);
      if (approach.lengthSq() < 1e-6) approach.set(0, 0.4, 1);
      approach.normalize();

      const toTarget = planet.clone();
      const toPos = planet
        .clone()
        .addScaledVector(approach, focusDistance(project.planet.radius));

      if (reduced) {
        // Reduced motion: cut, don't fly.
        camera.position.copy(toPos);
        controls.target.copy(toTarget);
        controls.update();
        invalidate();
        intentKey.current = key;
        return;
      }

      const fromPos = camera.position.clone();
      const fromTarget = controls.target.clone();
      const travel = fromPos.distanceTo(toPos);
      beginFlight({
        kind: "out",
        elapsed: 0,
        duration: THREE.MathUtils.clamp(0.95 + travel / 150, 1.1, 1.6),
        fromPos,
        mid: arcMid(fromPos, toPos, new THREE.Vector3()),
        toPos,
        fromTarget,
        toTarget,
      });
      intentKey.current = key;
    } else if (frameIds && frameIds.length > 0) {
      /* Search results committed: ease to a vantage that frames the whole
         set at once — the cluster's centroid, seen from radially outside
         the system so the nebula backdrop stays behind the worlds. */
      const key = `frame:${frameIds.join(",")}`;
      if (intentKey.current === key) return;

      const points: { pos: THREE.Vector3; radius: number }[] = [];
      for (const id of frameIds) {
        const pos = readPlanetPosition(id);
        const project = PROJECTS.find((entry) => entry.id === id);
        if (pos && project) points.push({ pos, radius: project.planet.radius });
      }
      if (points.length === 0) return; // registry not warm yet — retry later

      const centroid = new THREE.Vector3();
      for (const point of points) centroid.add(point.pos);
      centroid.divideScalar(points.length);
      let reach = 0;
      for (const point of points) {
        reach = Math.max(reach, centroid.distanceTo(point.pos) + point.radius);
      }

      const direction = centroid.clone().sub(ORBIT_CENTER);
      if (direction.lengthSq() < 0.25) direction.set(0, 0.2, 1);
      direction.normalize();
      const distance = THREE.MathUtils.clamp(reach * 2.4 + 14, 26, 150);
      const toTarget = centroid;
      const toPos = centroid.clone().addScaledVector(direction, distance);
      toPos.y += distance * 0.1;

      // Typing is not a canvas gesture — engage cinematic mode if still auto.
      if (cameraState.mode === "auto") {
        cameraState.mode = "user";
        anchorTarget();
        setEngaged(true);
      }

      if (!overviewRef.current) {
        overviewRef.current = {
          pos: camera.position.clone(),
          target: controls.target.clone(),
        };
      }

      if (reduced) {
        camera.position.copy(toPos);
        controls.target.copy(toTarget);
        controls.update();
        invalidate();
        intentKey.current = key;
        return;
      }

      const fromPos = camera.position.clone();
      const fromTarget = controls.target.clone();
      const travel = fromPos.distanceTo(toPos);
      beginFlight({
        kind: "reveal",
        elapsed: 0,
        duration: THREE.MathUtils.clamp(0.95 + travel / 160, 1.05, 1.55),
        fromPos,
        mid: arcMid(fromPos, toPos, new THREE.Vector3()),
        toPos,
        fromTarget,
        toTarget,
      });
      intentKey.current = key;
    } else if (intentKey.current !== "overview") {
      // Only after an actual departure (the snapshot exists).
      intentKey.current = "overview";
      if (!overviewRef.current) return;
      const overview = overviewRef.current;
      const fromPos = camera.position.clone();
      const fromTarget = controls.target.clone();

      if (reduced) {
        camera.position.copy(overview.pos);
        controls.target.copy(overview.target);
        controls.update();
        invalidate();
        return;
      }

      beginFlight({
        kind: "back",
        elapsed: 0,
        duration: THREE.MathUtils.clamp(
          0.9 + fromPos.distanceTo(overview.pos) / 170,
          1.0,
          1.45,
        ),
        fromPos,
        mid: arcMid(fromPos, overview.pos, new THREE.Vector3()),
        toPos: overview.pos.clone(),
        fromTarget,
        toTarget: overview.target.clone(),
      });
    }
  }, [focusedId, frameIds, anchorTarget, camera, reduced, beginFlight]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const controls = controlsRef.current;
    const flight = flightRef.current;

    /* Ignition and touchdown flashes burn out at a fixed rate — every
       frame, flying or not (reduced motion never sets them). */
    if (cameraState.flash > 0) {
      cameraState.flash = Math.max(0, cameraState.flash - dt * FLASH_DECAY);
    }

    if (flight && controls) {
      flight.elapsed += dt;
      const raw = Math.min(flight.elapsed / flight.duration, 1);
      const e = easeInOutCubic(raw);
      const inv = 1 - e;

      /* Quadratic Bézier: position + orbit target travel the same arc, so
         the planet stays centred and controls resume with zero snap. */
      camera.position
        .copy(flight.fromPos)
        .multiplyScalar(inv * inv)
        .addScaledVector(flight.mid, 2 * inv * e)
        .addScaledVector(flight.toPos, e * e);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, e);
      camera.lookAt(controls.target);

      /* The warp envelope, damped asymmetrically (fast attack, slower
         release) so charge, streaks and fold-back read as a drive spooling
         rather than a switch flipping — and so a chained jump never
         collapses the field between hops. */
      const target = warpTarget(raw);
      cameraState.warp = THREE.MathUtils.damp(
        cameraState.warp,
        target,
        target > cameraState.warp ? 11 : 6,
        dt,
      );
      if (!flight.charged && raw >= 0.1) {
        flight.charged = true;
        cameraState.flash = 0.45; // ignition burst as the drive lights
      }
      if (!flight.flashed && raw >= 0.97) {
        flight.flashed = true;
        cameraState.flash = 1; // touchdown burst as the planet locks in
      }

      if (raw >= 1) {
        flightRef.current = null;
        cameraState.mode = "user";
        controls.target.copy(flight.toTarget);
        controls.update();
        setFlying(false);
      }
    } else if (cameraState.warp !== 0) {
      /* Idle: the last streaks of a jump (or a cut) fold smoothly away. */
      const settled = THREE.MathUtils.damp(cameraState.warp, 0, 6, dt);
      cameraState.warp = Math.abs(settled) < 0.001 ? 0 : settled;
    }

    /* The lens rides the envelope: the charge narrows the frame for
       tension, the cruise punches it wide, the fold-back restores it
       exactly — no snap on landing. */
    {
      const perspective = camera as THREE.PerspectiveCamera;
      if (perspective.isPerspectiveCamera) {
        const fov = BASE_FOV + FOV_KICK * cameraState.warp;
        if (Math.abs(perspective.fov - fov) > 0.01) {
          perspective.fov = fov;
          perspective.updateProjectionMatrix();
        }
      }
    }

    /* Focus framing — ease the projection's view offset so the world settles
       into the half of the screen the dossier panel is not covering (and
       slides back to centre on release). Applied only when it moves, or when
       the viewport size changes, so idle frames cost nothing. */
    const target = focusShift(Boolean(focusedId), size.width, size.height);
    if (reduced) {
      shift.current.x = target.x;
      shift.current.y = target.y;
    } else {
      shift.current.x = THREE.MathUtils.damp(
        shift.current.x,
        target.x,
        FRAME_LAMBDA,
        dt,
      );
      shift.current.y = THREE.MathUtils.damp(
        shift.current.y,
        target.y,
        FRAME_LAMBDA,
        dt,
      );
      if (
        Math.abs(shift.current.x - target.x) > 0.5 ||
        Math.abs(shift.current.y - target.y) > 0.5
      ) {
        invalidate(); // keep demand-mode frames flowing while the shift eases
      }
    }
    {
      const ap = applied.current;
      const idle = shift.current.x === 0 && shift.current.y === 0 && !ap.active;
      const drifted =
        Math.abs(ap.x - shift.current.x) > 0.01 ||
        Math.abs(ap.y - shift.current.y) > 0.01 ||
        ap.w !== size.width ||
        ap.h !== size.height;
      if (!idle && drifted) {
        camera.setViewOffset(
          size.width,
          size.height,
          shift.current.x,
          shift.current.y,
          size.width,
          size.height,
        );
        applied.current = {
          x: shift.current.x,
          y: shift.current.y,
          w: size.width,
          h: size.height,
          active: true,
        };
      } else if (idle && ap.active) {
        camera.clearViewOffset();
        applied.current = { x: 0, y: 0, w: 0, h: 0, active: false };
      }
    }

    /* Speed → motion blur: fast attack, slow release, zero when reduced. */
    if (reduced) {
      cameraState.motion = 0;
    } else {
      const speed =
        camera.position.distanceTo(previousPos.current) / Math.max(dt, 1e-4);
      previousPos.current.copy(camera.position);
      const target = Math.min(speed / FULL_SPEED, 1);
      const rate = target > cameraState.motion ? MOTION_ATTACK : MOTION_RELEASE;
      cameraState.motion +=
        (target - cameraState.motion) * (1 - Math.exp(-dt * rate));
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={!flying}
      enableDamping
      dampingFactor={0.055}
      rotateSpeed={0.55}
      zoomSpeed={0.6}
      panSpeed={0.55}
      screenSpacePanning
      minDistance={3.5}
      maxDistance={240}
      minPolarAngle={0.12}
      maxPolarAngle={Math.PI - 0.12}
      autoRotate={!reduced && engaged && !flying}
      autoRotateSpeed={0.14}
    />
  );
}

import { BlendFunction, Effect } from "postprocessing";
import { wrapEffect } from "@react-three/postprocessing";
import { Uniform } from "three";

import { cameraState } from "./camera-state";

/* ────────────────────────────────────────────────────────────────────────── *
 * SpeedBlur — the warp drive's lens: speed-driven radial zoom blur with a
 * chromatic fringe, an energy tunnel and the touchdown flash.
 *
 * While the camera moves (intro dolly, orbit drags, warp jumps) the frame
 * smears outward from the centre the way a lens does under motion, and the
 * channels split slightly harder toward the edges. During a warp the smear
 * stretches much further, the edges crush into space and a cyan-white core
 * gathers ahead of the ship — the gate the camera flies through — ending in
 * a centre-weighted burst as the destination locks in. When the camera rests
 * the effect short-circuits to a single assignment, so idle frames pay one
 * ALU op and zero extra texture fetches.
 *
 * Strength comes from `cameraState` (CameraRig's smoothed units/s plus the
 * warp envelope and the flash spike), so normal flights stay subtle and only
 * a warp jump floods the lens.
 * ────────────────────────────────────────────────────────────────────────── */

/** Radial smear (in UV units) at full camera speed — subtle by design. */
const MAX_STRENGTH = 0.055;
/** Extra smear the warp envelope adds on top — hyperspace needs distance. */
const WARP_STRENGTH = 0.13;

const fragmentShader = /* glsl */ `
  uniform float uStrength;
  uniform float uWarp;
  uniform float uFlash;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    /* Idle path: idempotent under any blend function, no texture fetches. */
    if (uStrength < 0.0004 && uWarp < 0.002 && uFlash < 0.002) {
      outputColor = inputColor;
      return;
    }

    vec4 color = inputColor;

    if (uStrength >= 0.0004) {
      vec2 dir = uv - vec2(0.5);
      vec4 sum = vec4(0.0);
      float total = 0.0;

      for (int i = 0; i < 12; i++) {
        float t = float(i) / 11.0;
        float weight = 1.0 - t * 0.55;
        vec2 coord = uv - dir * (t * uStrength);
        /* Chromatic split grows along the smear — speed fringes the edges,
           and a warp shoves the fringe harder still. */
        float chroma = (uStrength * 0.16 + uWarp * 0.005) * t;
        vec4 s;
        s.r = texture2D(inputBuffer, coord + dir * chroma).r;
        s.g = texture2D(inputBuffer, coord).g;
        s.b = texture2D(inputBuffer, coord - dir * chroma).b;
        s.a = 1.0;
        sum += s * weight;
        total += weight;
      }

      color = sum / total;
    }

    outputColor = color;

    if (uWarp > 0.002 || uFlash > 0.002) {
      vec2 fromCentre = uv - vec2(0.5);
      float r = length(fromCentre) * 2.0;

      /* Energy tunnel: crush the frame's edges into space and gather a
         cyan-white core ahead of the ship — the gate of the warp. */
      float edge = 1.0 - smoothstep(0.3, 1.5, r);
      outputColor.rgb *= mix(1.0, 0.28 + 0.72 * edge, uWarp * 0.8);
      float core = exp(-r * r * 2.4);
      outputColor.rgb += mix(vec3(0.2, 0.55, 1.0), vec3(0.85, 0.95, 1.0), core)
        * core * uWarp * 0.5;

      /* Ignition / touchdown burst — a centre-weighted white-cyan wash. */
      outputColor.rgb += vec3(0.8, 0.93, 1.0) * uFlash
        * (0.5 + 0.7 * exp(-r * r * 1.6));
    }
  }
`;

export class SpeedBlurEffect extends Effect {
  constructor(options?: { blendFunction?: BlendFunction }) {
    super("SpeedBlurEffect", fragmentShader, {
      blendFunction: options?.blendFunction ?? BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["uStrength", new Uniform(0)],
        ["uWarp", new Uniform(0)],
        ["uFlash", new Uniform(0)],
      ]),
    });
  }

  update(): void {
    const warp = Math.min(1, Math.max(0, cameraState.warp));
    const strength = this.uniforms.get("uStrength");
    if (strength) {
      strength.value = cameraState.motion * MAX_STRENGTH + warp * WARP_STRENGTH;
    }
    const warpUniform = this.uniforms.get("uWarp");
    if (warpUniform) warpUniform.value = warp;
    const flash = this.uniforms.get("uFlash");
    if (flash) flash.value = cameraState.flash;
  }
}

/** Component form for `<EffectComposer>` (effects are read off its children). */
export const SpeedBlur = wrapEffect(SpeedBlurEffect, {
  blendFunction: BlendFunction.NORMAL,
});

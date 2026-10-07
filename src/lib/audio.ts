/**
 * Procedural sound — Web Audio, zero assets.
 *
 * Every cue is synthesised: short enveloped oscillators for interface
 * moments, a seeded three-oscillator pad + filtered noise for the ambient
 * drone on /universe. Everything routes through one master gain so the
 * settings volume slider is a single node write.
 *
 * Contract:
 *   • The AudioContext is created lazily on the first cue or ambient start
 *     (always inside a user gesture) and auto-resumes on the first pointer/
 *     key interaction after a hard autoplay block.
 *   • Sound is OFF until the user enables it in Settings → Sound — nothing
 *     plays on a fresh profile.
 *   • Pure lib: no React, no stores. Preferences reach it through
 *     `configure()` (wired by `hooks/use-sound`-style effects) and callers
 *     gate themselves with `soundEnabled()`.
 */

/* ── Types ───────────────────────────────────────────────────────────────── */

export type Cue =
  | "open" /* palette / dialog rises */
  | "send" /* user sends an assistant message */
  | "reply" /* Astra answers */
  | "focus" /* camera locks onto a world */
  | "warp" /* warp jump */
  | "sync"; /* upload / pull lands */

export interface AudioConfig {
  /** Master volume 0–1. */
  volume: number;
  /** Interface cues enabled. */
  ui: boolean;
  /** Ambient drone enabled. */
  ambient: boolean;
}

/* ── Engine state ────────────────────────────────────────────────────────── */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let config: AudioConfig = { volume: 0.7, ui: false, ambient: true };
let gestureHooked = false;

/* Ambient nodes (teardown handle). */
interface AmbientHandle {
  stop: (fadeSec: number) => void;
}
let ambient: AmbientHandle | null = null;
let ambientSeed: number | null = null;

/** Push new preferences in — cheap, idempotent, safe during render. */
export function configure(next: Partial<AudioConfig>): void {
  config = { ...config, ...next };
  if (master && ctx) {
    master.gain.setTargetAtTime(config.volume, ctx.currentTime, 0.05);
  }
  if (ambient && !config.ambient) stopAmbient();
}

/** Master gate — checked by every caller before synthesising. */
export function soundEnabled(): boolean {
  return config.ui || config.ambient;
}

function hookGestureResume(): void {
  if (gestureHooked || typeof window === "undefined") return;
  gestureHooked = true;
  const resume = () => {
    if (ctx && ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }
    if (ctx && ctx.state !== "suspended") {
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    }
  };
  window.addEventListener("pointerdown", resume);
  window.addEventListener("keydown", resume);
}

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = config.volume;
    master.connect(ctx.destination);
    hookGestureResume();
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  return ctx;
}

/* ── Synth helpers ───────────────────────────────────────────────────────── */

interface Blip {
  freq: number;
  /** Optional end frequency for a sweep (exponential). */
  to?: number;
  /** Seconds. */
  dur: number;
  type?: OscillatorType;
  /** Peak gain 0–1 (pre-master). */
  gain: number;
  /** Delay before onset, seconds. */
  delay?: number;
  /** Attack ramp, seconds (default 0.008). */
  attack?: number;
}

function blip(node: Blip, dest: AudioNode): void {
  const c = ctx;
  if (!c || !c.currentTime) return;
  const t0 = c.currentTime + (node.delay ?? 0);
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = node.type ?? "sine";
  osc.frequency.setValueAtTime(node.freq, t0);
  if (node.to)
    osc.frequency.exponentialRampToValueAtTime(node.to, t0 + node.dur);
  const attack = node.attack ?? 0.008;
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(node.gain, t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + node.dur);
  osc.connect(env).connect(dest);
  osc.start(t0);
  osc.stop(t0 + node.dur + 0.05);
}

function noiseBurst(
  dest: AudioNode,
  opts: {
    dur: number;
    cutoff: number;
    gain: number;
    sweepTo?: number;
    delay?: number;
  },
): void {
  const c = ctx;
  if (!c) return;
  const t0 = c.currentTime + (opts.delay ?? 0);
  const frames = Math.max(1, Math.floor(c.sampleRate * opts.dur));
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // Envelope-shaped noise: fast-in, exponential-out.
    const decay = 1 - i / frames;
    data[i] = (Math.random() * 2 - 1) * decay * decay;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(opts.cutoff, t0);
  if (opts.sweepTo) {
    filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + opts.dur);
  }
  const env = c.createGain();
  env.gain.value = opts.gain;
  src.connect(filter).connect(env).connect(dest);
  src.start(t0);
}

/* ── Public cues ─────────────────────────────────────────────────────────── */

/** Play one interface cue. No-op when sound or the ui toggle is off. */
export function playCue(cue: Cue): void {
  if (!config.ui) return;
  const c = ensure();
  if (!c || !master) return;

  switch (cue) {
    case "open":
      blip(
        { freq: 523.25, to: 659.25, dur: 0.16, type: "sine", gain: 0.13 },
        master,
      );
      blip(
        { freq: 784, dur: 0.2, type: "sine", gain: 0.07, delay: 0.05 },
        master,
      );
      break;
    case "send":
      blip(
        { freq: 660, to: 880, dur: 0.09, type: "triangle", gain: 0.1 },
        master,
      );
      break;
    case "reply":
      blip({ freq: 392, to: 440, dur: 0.18, type: "sine", gain: 0.09 }, master);
      break;
    case "focus":
      blip({ freq: 440, dur: 0.1, type: "sine", gain: 0.08 }, master);
      blip(
        { freq: 660, dur: 0.14, type: "sine", gain: 0.06, delay: 0.06 },
        master,
      );
      break;
    case "warp":
      blip(
        {
          freq: 140,
          to: 1040,
          dur: 0.55,
          type: "sawtooth",
          gain: 0.07,
          attack: 0.04,
        },
        master,
      );
      noiseBurst(master, { dur: 0.5, cutoff: 500, sweepTo: 4200, gain: 0.05 });
      break;
    case "sync":
      blip({ freq: 523.25, dur: 0.12, type: "sine", gain: 0.1 }, master);
      blip(
        { freq: 659.25, dur: 0.14, type: "sine", gain: 0.1, delay: 0.09 },
        master,
      );
      blip(
        { freq: 1046.5, dur: 0.22, type: "sine", gain: 0.08, delay: 0.18 },
        master,
      );
      break;
  }
}

/* ── Ambient drone ───────────────────────────────────────────────────────── */

/** Seedable pitch set — each universe gets its own key (G2…D3). */
const DRONE_NOTES = [98, 110, 116.54, 123.47, 130.81, 146.83];

/**
 * Start the ambient pad for a universe seed. Idempotent per seed: an
 * already-running drone with the same seed is left alone; a different seed
 * crossfades the old one out over 1.2s.
 */
export function startAmbient(seed: number): void {
  if (!config.ambient) return;
  if (ambient && ambientSeed === seed) return; // already humming this key
  const c = ensure();
  if (!c || !master) return;

  const base = DRONE_NOTES[Math.abs(Math.trunc(seed)) % DRONE_NOTES.length];
  const target = 0.055;
  const t0 = c.currentTime;

  const bus = c.createGain();
  bus.gain.value = 0;
  bus.connect(master);

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.4;
  filter.connect(bus);

  const freqs: Array<{
    freq: number;
    type: OscillatorType;
    gain: number;
    detune: number;
  }> = [
    { freq: base, type: "sine", gain: 0.5, detune: -4 },
    { freq: base * 1.4983, type: "sine", gain: 0.3, detune: 3 },
    { freq: base * 2, type: "triangle", gain: 0.16, detune: 7 },
  ];
  const oscs = freqs.map((f) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = f.type;
    osc.frequency.value = f.freq;
    osc.detune.value = f.detune;
    gain.gain.value = f.gain;
    osc.connect(gain).connect(filter);
    osc.start(t0);
    return osc;
  });

  // Slow breathing — one LFO shared across the pad's amplitude. The depth
  // is a fraction of the pad level so the gain never swings negative.
  const lfo = c.createOscillator();
  const lfoDepth = c.createGain();
  lfo.frequency.value = 0.06;
  lfoDepth.gain.value = target * 0.35;
  lfo.connect(lfoDepth).connect(bus.gain);
  lfo.start(t0);

  // Air: a loop of pink-ish noise, heavily filtered.
  const frames = Math.floor(c.sampleRate * 3);
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < frames; i++) {
    const white = Math.random() * 2 - 1;
    last = 0.985 * last + 0.015 * white; // integrate → pink tilt
    data[i] = last * 3.2;
  }
  const noise = c.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const noiseFilter = c.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 420;
  const noiseGain = c.createGain();
  noiseGain.gain.value = 0.5;
  noise.connect(noiseFilter).connect(noiseGain).connect(bus);
  noise.start(t0);

  bus.gain.cancelScheduledValues(t0);
  bus.gain.setValueAtTime(0, t0);
  bus.gain.linearRampToValueAtTime(target, t0 + 2.5);

  const handle: AmbientHandle = {
    stop: (fadeSec: number) => {
      const c2 = ctx;
      if (!c2) return;
      const t1 = c2.currentTime;
      bus.gain.cancelScheduledValues(t1);
      bus.gain.setValueAtTime(bus.gain.value, t1);
      bus.gain.linearRampToValueAtTime(0, t1 + fadeSec);
      window.setTimeout(
        () => {
          oscs.forEach((o) => {
            try {
              o.stop();
            } catch {
              /* already stopped */
            }
          });
          [lfo, noise].forEach((n) => {
            try {
              n.stop();
            } catch {
              /* already stopped */
            }
          });
          bus.disconnect();
        },
        (fadeSec + 0.15) * 1000,
      );
    },
  };

  ambient?.stop(0.8);
  ambient = handle;
  ambientSeed = seed;
}

/** Fade the ambient pad out (leaving /universe, master toggled off). */
export function stopAmbient(fadeSec = 1.2): void {
  ambient?.stop(fadeSec);
  ambient = null;
  ambientSeed = null;
}

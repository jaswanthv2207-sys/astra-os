/**
 * prng — deterministic, seedable pseudo-random numbers.
 *
 * Every generated universe must look identical on every reload, across
 * exports and re-imports, so all procedural work funnels through these
 * helpers keyed off a stable string (universe name + form fields) hashed
 * into a 32-bit seed. `mulberry32` is the standard small, fast, well-
 * distributed generator for this kind of work.
 */

/** A seeded random source in [0, 1). */
export type Rng = () => number;

/** FNV-1a — stable, fast, well-spread 32-bit string hash. */
export function hashString(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — tiny PRNG with a full 2^32 period. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive an independent stream from a seed string (salt separates uses). */
export function rngFrom(text: string, salt = 0): Rng {
  const mixed = (hashString(text) ^ Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
  return mulberry32(mixed);
}

/** Integer in [min, max] inclusive. */
export function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Float in [min, max). */
export function float(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** `true` with probability `p`. */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

/** Uniform pick (empty arrays return `fallback`). */
export function pick<T>(rng: Rng, items: readonly T[], fallback?: T): T {
  if (items.length === 0) {
    if (fallback !== undefined) return fallback;
    throw new Error("pick: empty list and no fallback");
  }
  return items[Math.floor(rng() * items.length) % items.length];
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** Slugify a title into a stable id fragment (lowercase, hyphenated). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

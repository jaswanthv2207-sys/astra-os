/**
 * Generates the PWA icon set into `public/icons/` — no image dependencies,
 * just math + node:zlib.
 *
 *   npm run icons
 *
 * Design: near-black rounded square, a violet radial bloom, orbit ring and
 * shaded planet — the same visual language as the /universe scene. Rendered
 * at 3× and box-downsampled for clean anti-aliasing.
 *
 * Outputs:
 *   icon-192.png, icon-512.png   — rounded square (any purpose)
 *   maskable-512.png             — full-bleed inside the safe zone
 *   apple-touch-icon.png         — 180px full-bleed (iOS)
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const SS = 3; // supersample factor

/* ── PNG encoding (RGBA8, no interlace) ─────────────────────────────────── */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ── Drawing helpers ────────────────────────────────────────────────────── */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;

/** Rounded-square signed distance (negative inside). */
function roundedRectSdf(x, y, size, radius) {
  const cx = Math.abs(x - size / 2);
  const cy = Math.abs(y - size / 2);
  const r = radius;
  const dx = Math.max(cx - (size / 2 - r), 0);
  const dy = Math.max(cy - (size / 2 - r), 0);
  return Math.hypot(dx, dy) - r;
}

/** Coverage from an SDF in pixels (1px transition band). */
const cov = (sdf) => clamp01(0.5 - sdf);

function render(size, { rounded }) {
  const W = size * SS;
  const buf = Buffer.alloc(W * W * 4);

  const R = rounded ? size * 0.22 : 0;
  const s = size;

  // Planet geometry in final-size units.
  const px = s * 0.5;
  const py = s * 0.555;
  const pr = s * 0.165;
  // Ring: ellipse rotated by −18°.
  const ringAngle = -0.32;
  const ringA = s * 0.315;
  const ringB = s * 0.105;
  const ringHalf = s * 0.0205;
  const cos = Math.cos(ringAngle);
  const sin = Math.sin(ringAngle);

  // Deterministic starfield.
  const stars = [];
  let seed = 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 46; i++) {
    stars.push({
      x: rand() * s,
      y: rand() * s,
      r: (0.6 + rand() * 1.5) * s * 0.0038,
      a: 0.25 + rand() * 0.55,
    });
  }

  for (let py2 = 0; py2 < W; py2++) {
    for (let px2 = 0; px2 < W; px2++) {
      const x = (px2 + 0.5) / SS;
      const y = (py2 + 0.5) / SS;

      /* — background: vertical gradient + violet bloom — */
      const t = y / s;
      let r = mix(11, 5, t);
      let g = mix(10, 5, t);
      let b = mix(20, 8, t);

      const bloomD = Math.hypot(x - s * 0.62, y - s * 0.30) / (s * 0.72);
      const bloom = Math.exp(-bloomD * bloomD * 2.1) * 0.42;
      r = mix(r, 139, bloom * 0.65);
      g = mix(g, 92, bloom * 0.65);
      b = mix(b, 246, bloom * 0.65);

      const cyanD = Math.hypot(x - s * 0.16, y - s * 0.86) / (s * 0.6);
      const cyan = Math.exp(-cyanD * cyanD * 2.6) * 0.22;
      r = mix(r, 34, cyan * 0.5);
      g = mix(g, 211, cyan * 0.5);
      b = mix(b, 238, cyan * 0.5);

      let alpha = 1;
      if (rounded) alpha = cov(roundedRectSdf(x, y, s, R));

      if (alpha > 0) {
        /* — stars — */
        for (const star of stars) {
          const d = Math.hypot(x - star.x, y - star.y) - star.r;
          const c = cov(d);
          if (c > 0) {
            r = mix(r, 236, c * star.a);
            g = mix(g, 233, c * star.a);
            b = mix(b, 255, c * star.a);
          }
        }

        /* — ring (back half only; the planet occludes the front) — */
        const rx = x - px;
        const ry = y - py;
        const lx = rx * cos + ry * sin;
        const ly = -rx * sin + ry * cos;
        const ex = lx / ringA;
        const ey = ly / ringB;
        const dNorm = Math.hypot(ex, ey);
        const bandPx = Math.abs(dNorm - 1) * Math.min(ringA, ringB);
        const behind = ly < 0;
        if (Math.abs(bandPx) < ringHalf) {
          const c = cov(Math.abs(bandPx) - ringHalf);
          const fade = behind ? 0.5 : 0.95; // back arc dimmer than front
          const across = 1 - Math.abs(bandPx) / ringHalf; // brighter core
          const a = c * fade * (0.55 + 0.45 * across);
          r = mix(r, 221, a);
          g = mix(g, 214, a);
          b = mix(b, 255, a);
        }

        /* — planet — */
        const pd = Math.hypot(x - px, y - py) - pr;
        if (pd < 0.5) {
          const c = cov(pd);
          // Sphere shading: light from upper-left.
          const nx = clamp01((x - px) / pr * 0.5 + 0.5);
          const ny = clamp01((y - py) / pr * 0.5 + 0.5);
          const light = clamp01(1 - Math.hypot(nx - 0.32, ny - 0.28) * 1.15);
          const grad = clamp01((y - (py - pr)) / (pr * 2));
          const vr = mix(mix(196, 88, grad), 255, light * 0.55);
          const vg = mix(mix(181, 63, grad), 240, light * 0.55);
          const vb = mix(mix(253, 160, grad), 255, light * 0.6);
          // Terminator rim: a hint of aura at the dark edge.
          const rim = clamp01(Math.hypot(nx - 0.5, ny - 0.5) * 2 - 0.72);
          r = mix(r, mix(vr, 167, rim * 0.5), c);
          g = mix(g, mix(vg, 139, rim * 0.5), c);
          b = mix(b, mix(vb, 251, rim * 0.5), c);
        }
      }

      const i = (py2 * W + px2) * 4;
      buf[i] = Math.round(clamp01(r / 255) * 255);
      buf[i + 1] = Math.round(clamp01(g / 255) * 255);
      buf[i + 2] = Math.round(clamp01(b / 255) * 255);
      buf[i + 3] = Math.round(alpha * 255);
    }
  }

  return downsample(buf, W, size);
}

/** Box-filter the supersampled buffer down to final size (alpha-weighted). */
function downsample(src, W, size) {
  const out = Buffer.alloc(size * size * 4);
  const factor = SS * SS;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let aSum = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
          const a = src[i + 3];
          r += src[i] * a;
          g += src[i + 1] * a;
          b += src[i + 2] * a;
          aSum += a;
        }
      }
      // α-weighted average: Σ(rgb·α)/Σα — transparent texels don't vote.
      const w = aSum || 1;
      const o = (y * size + x) * 4;
      out[o] = Math.min(255, Math.round(r / w));
      out[o + 1] = Math.min(255, Math.round(g / w));
      out[o + 2] = Math.min(255, Math.round(b / w));
      out[o + 3] = Math.round(aSum / factor);
    }
  }
  return out;
}

/* ── Emit ───────────────────────────────────────────────────────────────── */

mkdirSync(OUT, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, rounded: true },
  { file: "icon-512.png", size: 512, rounded: true },
  { file: "maskable-512.png", size: 512, rounded: false },
  { file: "apple-touch-icon.png", size: 180, rounded: false },
];

for (const target of targets) {
  const rgba = render(target.size, { rounded: target.rounded });
  writeFileSync(join(OUT, target.file), encodePng(target.size, target.size, rgba));
  console.log(`✓ ${target.file}`);
}

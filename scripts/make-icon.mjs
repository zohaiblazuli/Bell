/**
 * Renders the Bell app icon to a 1024px PNG, which `npx tauri icon` then fans out into every size
 * the installer needs. Procedural rather than a binary blob in the repo, so it can be re-derived
 * when the tokens move — and so it is provably the same artwork as the sidebar mark rather than a
 * lookalike drawn once and forgotten.
 *
 * The subject is `Mr. Bell Mark`: 15 rects on a strict 4px grid in a 64x64 box, geometry taken
 * verbatim from design/specs/brand-wordmark-lockups.md and shared with src/ui/brand/MrBellMark.tsx.
 * Scaled by an integer factor so every 4px cell lands on whole device pixels — pixel art that
 * falls between pixels stops being pixel art.
 *
 *   node scripts/make-icon.mjs [out.png]
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const N = 1024;
const SS = 3; // supersampling per axis

// --- tokens ------------------------------------------------------------------
// Mode-invariant by design: the mark looks the same in Day and Night, and so does the icon.
const CAP_HI = [0x58, 0xc8, 0xff];
const CAP_MID = [0x2c, 0x7b, 0xff];
const CAP_LO = [0x14, 0x36, 0xc8];
const PAGE_INK = [0x1a, 0x1c, 0x24];
// --ground in Night. The Figma `app icon` frame (368:62) is a rounded tile of exactly this, with
// no gradient and no cast — sampled off the file rather than guessed. It is also the only ground
// dark enough for the mark's cap-lo claws and legs to separate; on the Primary button's gradient
// they sit on their own colour and disappear.
const TILE_FILL = [0x11, 0x12, 0x19];

/**
 * Mr. Bell Mark, in its native 64x64 coordinates, in paint order.
 * Keep in step with src/ui/brand/MrBellMark.tsx — same numbers, same order.
 */
const MARK = [
  [4, 36, 8, 8, CAP_LO],    // claw L
  [4, 44, 4, 4, CAP_LO],    // claw L tip
  [52, 36, 8, 8, CAP_LO],   // claw R
  [56, 44, 4, 4, CAP_LO],   // claw R tip
  [14, 52, 12, 4, CAP_LO],  // leg 1
  [26, 52, 12, 4, CAP_LO],  // leg 2
  [38, 52, 12, 4, CAP_LO],  // leg 3
  [16, 28, 4, 4, CAP_MID],  // stalk L
  [44, 28, 4, 4, CAP_MID],  // stalk R
  [12, 32, 40, 20, CAP_MID],// shell
  [28, 14, 8, 8, CAP_LO],   // bridge
  [8, 8, 20, 20, CAP_HI],   // lens L
  [36, 8, 20, 20, CAP_HI],  // lens R
  [14, 14, 8, 8, PAGE_INK], // pupil L
  [42, 14, 8, 8, PAGE_INK], // pupil R
];

// Figma puts a 66px mark in a 96px frame at inset 15 — so the mark box is 68.75% of the tile,
// centred, with no optical nudge. 11x scales the 64-unit grid to 704 (= 68.75% of 1024) and each
// 4px cell to a whole 44px, which is what keeps the blocks hard-edged.
const SCALE = 11;
const MARK_ORIGIN = { x: (N - 64 * SCALE) / 2, y: (N - 64 * SCALE) / 2 };

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (edge, w, d) => clamp01(0.5 - d / w); // linear coverage across a w-wide edge

/** Signed distance to a rounded rect centred at (cx,cy). Negative inside. */
function sdRound(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - (hw - r);
  const qy = Math.abs(y - cy) - (hh - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(ax, ay) - r;
}

// The tile fills the canvas, as it does in the Figma frame. Radius is 22/96 of the side.
const TILE = { cx: N / 2, cy: N / 2, hw: N / 2, hh: N / 2, r: Math.round((22 / 96) * N) };

function sample(x, y) {
  // Outside the tile the icon is transparent.
  const dTile = sdRound(x, y, TILE.cx, TILE.cy, TILE.hw, TILE.hh, TILE.r);
  const aTile = smooth(0, 1.5, dTile);
  if (aTile <= 0) return [0, 0, 0, 0];

  // Flat, like the file: no gradient, no specular, no cast. The mark carries the icon on its own.
  let rgb = TILE_FILL.slice();

  const mx = (x - MARK_ORIGIN.x) / SCALE;
  const my = (y - MARK_ORIGIN.y) / SCALE;

  // The mark, in paint order. Each rect is a hard-edged block; supersampling handles the edges,
  // so no per-rect antialiasing is needed.
  for (const [rx, ry, rw, rh, colour] of MARK) {
    if (mx >= rx && mx < rx + rw && my >= ry && my < ry + rh) rgb = colour.slice();
  }

  return [...rgb, 255 * aTile];
}

// --- render, then encode ----------------------------------------------------
const px = Buffer.alloc(N * N * 4);
for (let py = 0; py < N; py++) {
  for (let pxi = 0; pxi < N; pxi++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const s = sample(pxi + (sx + 0.5) / SS, py + (sy + 0.5) / SS);
        r += s[0] * s[3];
        g += s[1] * s[3];
        b += s[2] * s[3];
        a += s[3];
      }
    }
    const i = (py * N + pxi) * 4;
    px[i] = a ? Math.round(r / a) : 0;
    px[i + 1] = a ? Math.round(g / a) : 0;
    px[i + 2] = a ? Math.round(b / a) : 0;
    px[i + 3] = Math.round(a / (SS * SS));
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0);
ihdr.writeUInt32BE(N, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // truecolour + alpha
const raw = Buffer.alloc(N * (N * 4 + 1));
for (let y = 0; y < N; y++) {
  raw[y * (N * 4 + 1)] = 0; // filter: none
  px.copy(raw, y * (N * 4 + 1) + 1, y * N * 4, (y + 1) * N * 4);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = process.argv[2] ?? 'icon-src.png';
writeFileSync(out, png);
console.log(`${out} — ${N}x${N}, ${(png.length / 1024).toFixed(0)} kB`);

/**
 * The Phase 5 verification audits, in one repeatable place.
 *
 *   node scripts/audit.mjs            (or: npm run audit)
 *
 * Three passes, all static, all of which were listed in TASKS.md §5.10 and none of which a human
 * should have to redo by hand:
 *
 *   offline   — the hard requirement. Nothing in the shipped bundle may fetch anything: no CDN, no
 *               font `@import`, no remote `url()`. Every `http(s)` string left in `dist/` has to be
 *               an XML namespace, a licence comment or a schema id, and this says which.
 *   contrast  — every ink on every ground it actually sits on, in BOTH modes, composited through the
 *               alpha the token carries. A ratio computed against a flat hex is wrong for this
 *               palette: `--card` is 90% opaque in Night, so its real contrast depends on the ground
 *               behind it.
 *   motion    — every `@keyframes` and every `animation:` in `src/` has to be reachable by a
 *               reduced-motion gate. One uncovered track is a rule the OS setting cannot switch off.
 *
 * Exit code is 1 if the offline or motion pass fails. Contrast reports and does not fail: the Figma
 * file records its own Day failures and defers them, so failing the build on them would be asserting
 * a decision that is Zohaib's (TASKS.md, open calls).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

/** Every file under `dir` whose name matches, recursively. */
function walk(dir, test, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, test, out);
    else if (test(entry.name)) out.push(full);
  }
  return out;
}

const heading = (s) => console.log(`\n\x1b[1m${s}\x1b[0m`);
const pass = (s) => console.log(`  \x1b[32mok\x1b[0m    ${s}`);
const warn = (s) => console.log(`  \x1b[33mnote\x1b[0m  ${s}`);
const fail = (s) => {
  failures++;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${s}`);
};

/* ─────────────────────────────────────────────────────────── 1 · OFFLINE ─────────────────────── */

/**
 * A remote string is benign only if it is one of these. Everything else in a shipped bundle is a
 * fetch waiting to happen, so the allowlist is deliberately narrow and each entry says why.
 */
const BENIGN = [
  { re: /www\.w3\.org\//, why: 'XML/SVG namespace' },
  { re: /schemas\.(openxmlformats|microsoft)\.com/, why: 'XML namespace' },
  { re: /(purl\.org|adobe\.com\/(ns|xap)|iptc\.org|ns\.adobe)/, why: 'XMP/metadata namespace' },
  { re: /(opensource\.org|www\.apache\.org\/licenses|mozilla\.org\/MPL|gnu\.org\/licenses)/, why: 'licence URL in a comment' },
  { re: /github\.com\/(mozilla|Vercel|vercel|adobe)/, why: 'upstream project link in a licence header' },
  { re: /github\.com\/zohaiblazuli\/Bell/, why: "the app's own repo link (star gate), opened in the browser — not a fetch" },
  { re: /(scripts\.sil\.org|openfontlicense)/, why: 'SIL OFL licence URL' },
  { re: /developer\.mozilla\.org/, why: 'doc link in a comment' },
  { re: /(xfa|xdp)\.(org|adobe)/, why: 'pdf.js XFA schema id' },
  { re: /^https:\/\/react\.dev\/errors\//, why: "React's minified-error explainer, printed in a thrown message" },
  { re: /^https?:\/\/\$\{/, why: 'a template literal in pdf.js URL-normalisation code, not a literal host' },
  { re: /^https?:\/\/(example\.com|foo\.bar)/, why: 'pdf.js placeholder base for relative-URL resolution' },
];

function auditOffline() {
  heading('1 · OFFLINE — nothing in dist/ may reach the network');
  const dist = join(root, 'dist');
  if (!existsSync(dist)) {
    fail('no dist/ — run `npm run build` first');
    return;
  }
  const files = walk(dist, (n) => /\.(js|mjs|css|html|json)$/.test(n));
  const suspects = [];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/https?:\/\/[^\s'"`)\\]+/g)) {
      const url = m[0];
      if (BENIGN.some((b) => b.re.test(url))) continue;
      suspects.push({ file: relative(root, f), url: url.slice(0, 110) });
    }
    // A font `@import` or a remote `url()` is the specific regression this guards against.
    for (const m of text.matchAll(/@import\s+(?:url\()?['"]?(https?:)/g)) {
      suspects.push({ file: relative(root, f), url: `@import ${m[1]}…` });
    }
  }
  const total = files.length;
  if (suspects.length === 0) {
    pass(`${total} bundled files scanned; every remote string is an allowlisted namespace or licence`);
  } else {
    for (const s of suspects.slice(0, 20)) fail(`${s.file} → ${s.url}`);
    if (suspects.length > 20) fail(`…and ${suspects.length - 20} more`);
  }
  // The CSP is the enforcement behind the audit, so assert it has not loosened.
  const html = join(dist, 'index.html');
  if (existsSync(html)) {
    const csp = readFileSync(html, 'utf8').match(/content-security-policy[^>]*content="([^"]+)"/i);
    if (!csp) warn('no CSP meta in dist/index.html — it is set in tauri.conf.json instead');
    else if (/default-src 'self'/.test(csp[1])) pass(`CSP holds: ${csp[1].slice(0, 80)}`);
    else fail(`CSP no longer starts from 'self': ${csp[1].slice(0, 80)}`);
  }
}

/* ────────────────────────────────────────────────────────── 2 · CONTRAST ─────────────────────── */

/** `#rgb`, `#rrggbb`, `#rrggbbaa` and `rgba(r, g, b, a)` → `[r, g, b, a]`, a in 0…1. */
function parseColour(v) {
  const s = v.trim();
  let m = s.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    const h = m[1];
    const x = h.length <= 4 ? h.split('').map((c) => c + c).join('') : h;
    return [
      parseInt(x.slice(0, 2), 16),
      parseInt(x.slice(2, 4), 16),
      parseInt(x.slice(4, 6), 16),
      x.length === 8 ? parseInt(x.slice(6, 8), 16) / 255 : 1,
    ];
  }
  m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return null;
}

/** Read `tokens.css` into flat maps. `:root` is Day/Light; `[data-tone='night']` and
 *  `[data-theme='dark']` are the legacy-night and v2-dark overrides respectively. */
function readTokens() {
  const css = readFileSync(join(root, 'src', 'styles', 'tokens.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );
  const blocks = [
    ...css.matchAll(/(:root|\.app\[data-tone='night'\]|\[data-theme='dark'\])\s*{([^}]*)}/g),
  ];
  const day = {};
  const night = {};
  const dark = {};
  for (const [, sel, body] of blocks) {
    const into = sel === ':root' ? day : sel.includes('data-tone') ? night : dark;
    for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) into[m[1]] = m[2].trim();
  }
  // Legacy screens: day = :root, night = :root + night override.
  // v2 screens: light = :root, dark = :root + dark override.
  return {
    day: { ...day },
    night: { ...day, ...night },
    light: { ...day },
    dark: { ...day, ...dark },
  };
}

/** Composite `src` (which may carry alpha) over `dst`, both opaque-resolved. */
const over = (src, dst) => {
  const a = src[3];
  return [0, 1, 2].map((i) => src[i] * a + dst[i] * (1 - a)).concat(1);
};

const luminance = ([r, g, b]) => {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/**
 * What sits on what. `min` is the threshold that actually applies, and `note` says why when it is not
 * the 4.5 body-text default: 3.0 for large text (WCAG 1.4.3) and for UI component boundaries
 * (1.4.11), and `exempt` for the heat and activity ramps, which are data encodings rather than text —
 * their legends and labels are checked instead.
 */
const PAIRS = [
  { fg: '--ink', bg: '--ground', min: 4.5, note: 'body text on the ground' },
  { fg: '--ink-2', bg: '--ground', min: 4.5, note: 'secondary text on the ground' },
  { fg: '--ink-3', bg: '--ground', min: 4.5, note: 'meta text on the ground' },
  { fg: '--ink', bg: '--card', min: 4.5, note: 'body text on a card' },
  { fg: '--ink-2', bg: '--card', min: 4.5, note: 'secondary text on a card' },
  { fg: '--ink-3', bg: '--card', min: 4.5, note: 'meta text on a card' },
  { fg: '--accent', bg: '--card', min: 3.0, note: 'accent as a UI boundary (1.4.11)' },
  { fg: '--accent', bg: '--ground', min: 3.0, note: 'focus ring on the ground (1.4.11)' },
  { fg: '--page-ink', bg: '--paper', min: 4.5, note: 'the exam paper itself' },
  { fg: '--page-ink-2', bg: '--paper', min: 4.5, note: 'secondary ink on paper' },
  /* The Primary button is the design system's one sanctioned accent-as-fill, and it is filled with
     `--grad-btn` — `bell/cap-lo → bell/cap-mid`, both mode-invariant — NOT with `--accent`. Testing
     white on `--accent` is the mistake this comment exists to stop someone repeating: in Night
     `--accent` is a light `#6aa8ff` and the pair measures 2.43, which looks like a serious defect and
     is not one, because nothing ever paints white on it. Both real stops are checked instead, and the
     lighter one is the binding case. */
  { fg: '--white', bg: '--bell-cap-lo', min: 4.5, note: "the Primary button's dark stop" },
  { fg: '--white', bg: '--bell-cap-mid', min: 4.5, note: "the Primary button's light stop" },
  { fg: '--d1', bg: '--card', min: 3.0, exempt: true, note: 'difficulty ramp — a data encoding' },
  { fg: '--d2', bg: '--card', min: 3.0, exempt: true },
  { fg: '--d3', bg: '--card', min: 3.0, exempt: true },
  { fg: '--d4', bg: '--card', min: 3.0, exempt: true },
  { fg: '--d5', bg: '--card', min: 3.0, exempt: true },
  { fg: '--activity-4', bg: '--card', min: 3.0, exempt: true, note: 'activity ramp — a heatmap' },
  { fg: '--hair', bg: '--card', min: 1.0, exempt: true, note: 'a hairline, not a boundary' },
  /* The eight notebook covers. Mode-invariant, so both modes report the same figure — that is the
     point of the family, not a bug in the loop. `--cover-label` is the cover title, `--cover-label-2`
     the meta line under it, and the second one is the binding case: it is white at 84%, and 74% was
     rejected precisely because covers 2, 3 and 4 failed there. */
  { fg: '--cover-label', bg: '--cover-1', min: 4.5, note: 'cover title on cover 1' },
  { fg: '--cover-label', bg: '--cover-2', min: 4.5, note: 'cover title on cover 2' },
  { fg: '--cover-label', bg: '--cover-3', min: 4.5, note: 'cover title on cover 3' },
  { fg: '--cover-label', bg: '--cover-4', min: 4.5, note: 'cover title on cover 4' },
  { fg: '--cover-label', bg: '--cover-5', min: 4.5, note: 'cover title on cover 5' },
  { fg: '--cover-label', bg: '--cover-6', min: 4.5, note: 'cover title on cover 6' },
  { fg: '--cover-label', bg: '--cover-7', min: 4.5, note: 'cover title on cover 7' },
  { fg: '--cover-label', bg: '--cover-8', min: 4.5, note: 'cover title on cover 8' },
  { fg: '--cover-label-2', bg: '--cover-1', min: 4.5, note: 'cover meta on cover 1' },
  { fg: '--cover-label-2', bg: '--cover-2', min: 4.5, note: 'cover meta on cover 2' },
  { fg: '--cover-label-2', bg: '--cover-3', min: 4.5, note: 'cover meta on cover 3' },
  { fg: '--cover-label-2', bg: '--cover-4', min: 4.5, note: 'cover meta on cover 4' },
  { fg: '--cover-label-2', bg: '--cover-5', min: 4.5, note: 'cover meta on cover 5' },
  { fg: '--cover-label-2', bg: '--cover-6', min: 4.5, note: 'cover meta on cover 6' },
  { fg: '--cover-label-2', bg: '--cover-7', min: 4.5, note: 'cover meta on cover 7' },
  { fg: '--cover-label-2', bg: '--cover-8', min: 4.5, note: 'cover meta on cover 8' },
  /* `--danger` is text as well as a boundary — the Notice message and the Delete row both print in
     it — so it is held to 4.5, not the 3.0 a pure boundary would take. */
  { fg: '--danger', bg: '--card', min: 4.5, note: 'error text on a card' },
];

function auditContrast() {
  heading('2 · CONTRAST — every ink on every ground it sits on, composited through its alpha');
  const tokens = readTokens();
  const rows = [];
  for (const mode of ['day', 'night']) {
    const t = tokens[mode];
    const ground = parseColour(t['--ground']);
    if (!ground) {
      fail(`--ground is unreadable in ${mode}`);
      continue;
    }
    for (const p of PAIRS) {
      const rawFg = parseColour(t[p.fg]);
      const rawBg = parseColour(t[p.bg]);
      if (!rawFg || !rawBg) continue;
      // A card is translucent over the ground; ink is then composited over that result.
      const bg = over(rawBg, ground);
      const fg = over(rawFg, bg);
      rows.push({ mode, ...p, r: ratio(fg, bg) });
    }
  }
  const bad = rows.filter((r) => !r.exempt && r.r < r.min);
  for (const r of rows) {
    const line = `${r.mode.padEnd(5)} ${r.fg.padEnd(14)} on ${r.bg.padEnd(10)} ${r.r
      .toFixed(2)
      .padStart(6)}  (needs ${r.min})${r.note ? '  — ' + r.note : ''}`;
    if (r.exempt) warn(line + (r.exempt && !r.note ? '' : ''));
    else if (r.r < r.min) warn(line + '  ← below');
    else pass(line);
  }
  if (bad.length) {
    warn(
      `${bad.length} pair(s) below threshold. Reported, not failed: the Figma file records its own ` +
        `Day failures and defers them, so failing here would decide something that is Zohaib's call.`,
    );
  }
}

/**
 * Design System v2 contrast — the flat productivity palette, checked light and dark. Composited over
 * --bg-canvas rather than --ground, because v2 text sits on the new surfaces, not the glass ground.
 * Reports only, same posture as the legacy pass. Skips cleanly if v2 tokens are not present yet.
 */
const V2_PAIRS = [
  { fg: '--text-primary', bg: '--bg-canvas', min: 4.5, note: 'primary text on canvas' },
  { fg: '--text-secondary', bg: '--bg-canvas', min: 4.5, note: 'secondary text on canvas' },
  { fg: '--text-tertiary', bg: '--bg-canvas', min: 4.5, note: 'tertiary text on canvas' },
  { fg: '--text-primary', bg: '--bg-panel', min: 4.5, note: 'primary text on panel' },
  { fg: '--text-secondary', bg: '--bg-panel', min: 4.5, note: 'secondary text on panel' },
  { fg: '--text-primary', bg: '--bg-sidebar', min: 4.5, note: 'primary text on sidebar' },
  { fg: '--accent', bg: '--bg-canvas', min: 3.0, note: 'accent boundary on canvas (1.4.11)' },
  { fg: '--accent', bg: '--bg-panel', min: 3.0, note: 'accent boundary on panel (1.4.11)' },
  { fg: '--info', bg: '--bg-canvas', min: 3.0, note: 'info boundary on canvas' },
  { fg: '--success', bg: '--bg-canvas', min: 3.0, note: 'success boundary on canvas' },
  { fg: '--warning', bg: '--bg-canvas', min: 3.0, note: 'warning boundary on canvas' },
  { fg: '--danger', bg: '--bg-canvas', min: 4.5, note: 'danger text on canvas' },
  { fg: '--border-default', bg: '--bg-panel', min: 1.0, exempt: true, note: 'panel border' },
];

function auditContrastV2() {
  heading('2b · CONTRAST (v2) — Design System v2 text/state on the flat surfaces, light and dark');
  const tokens = readTokens();
  const rows = [];
  for (const mode of ['light', 'dark']) {
    const t = tokens[mode];
    const canvas = parseColour(t['--bg-canvas']);
    if (!canvas) {
      warn(`--bg-canvas unreadable in ${mode} — v2 tokens not present yet, skipping`);
      continue;
    }
    for (const p of V2_PAIRS) {
      const rawFg = parseColour(t[p.fg]);
      const rawBg = parseColour(t[p.bg]);
      if (!rawFg || !rawBg) continue;
      const bg = over(rawBg, canvas);
      const fg = over(rawFg, bg);
      rows.push({ mode, ...p, r: ratio(fg, bg) });
    }
  }
  for (const r of rows) {
    const line = `${r.mode.padEnd(5)} ${r.fg.padEnd(18)} on ${r.bg.padEnd(14)} ${r.r
      .toFixed(2)
      .padStart(6)}  (needs ${r.min})${r.note ? '  — ' + r.note : ''}`;
    if (r.exempt) warn(line);
    else if (r.r < r.min) warn(line + '  ← below');
    else pass(line);
  }
}

/* ──────────────────────────────────────────────────────────── 3 · MOTION ─────────────────────── */

/**
 * Every stylesheet that animates has to be reachable by a reduced-motion gate — either the OS media
 * query or the product's own `[data-motion='off']`, which the Settings switch drives.
 *
 * "Reachable" is checked per FILE rather than per rule, because a gate is almost always written once
 * at the bottom of a sheet and covers everything above it with `*` or a list. A file that animates and
 * carries no gate at all is the failure this catches, and it is the one that actually happens.
 */
function auditMotion() {
  heading('3 · MOTION — every animating stylesheet must have a reduced-motion escape');
  const sheets = walk(join(root, 'src'), (n) => n.endsWith('.css'));
  let animating = 0;
  const naked = [];
  for (const f of sheets) {
    const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const anims = (css.match(/@keyframes|animation(-name)?\s*:/g) ?? []).length;
    if (anims === 0) continue;
    animating++;
    const gated =
      /prefers-reduced-motion/.test(css) ||
      /\[data-motion=['"]off['"]\]/.test(css) ||
      // `Dialog.css` and friends opt IN under `no-preference`, which is the same guarantee inverted.
      /prefers-reduced-motion:\s*no-preference/.test(css);
    if (!gated) naked.push({ file: relative(root, f), anims });
  }
  // One global sweep exists in app.css and covers transitions everywhere; note it so the count reads.
  const app = readFileSync(join(root, 'src', 'styles', 'chrome.css'), 'utf8');
  const globalSweep = /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,400}\*,/.test(app);
  if (globalSweep) pass('chrome.css carries the global `*` reduced-motion sweep for transitions');

  if (naked.length === 0) {
    pass(`${animating} stylesheet(s) animate; every one of them is gated`);
  } else {
    for (const n of naked) fail(`${n.file} has ${n.anims} animation declaration(s) and no gate`);
  }

  // The rig is the one place a gate must also restore a POSE rather than the first frame.
  const bell = readFileSync(join(root, 'src', 'ui', 'brand', 'MrBell.css'), 'utf8');
  const poses = ["data-anim='slump'", "data-anim='sleep'"].filter((p) =>
    new RegExp(`prefers-reduced-motion[\\s\\S]*${p.replace(/[[\]']/g, '\\$&')}`).test(bell),
  );
  if (poses.length === 2) pass('MrBell.css holds slump and sleep at their END pose under reduced motion');
  else fail(`MrBell.css: slump/sleep end-pose handling missing (found ${poses.length} of 2)`);
}

/**
 * The v2 layer (src/ui|components|views/v2) must be token-only — no raw hex. Difficulty pills are
 * the sanctioned exception and carry NO literal here (the hex lives in src/lib/difficulty.ts and is
 * passed through inline custom properties), so a hex literal inside a v2 file is a real regression.
 */
function auditV2Hex() {
  heading('4 · V2 TOKENS — the v2 layer must be hex-free (tokens only)');
  const dirs = ['src/ui/v2', 'src/components/v2', 'src/views/v2'].map((d) => join(root, d));
  const hits = [];
  for (const dir of dirs) {
    for (const f of walk(dir, (n) => n.endsWith('.css') || n.endsWith('.tsx'))) {
      const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of text.matchAll(/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
        hits.push({ file: relative(root, f), hex: m[0] });
      }
    }
  }
  if (hits.length === 0) {
    pass('v2 layer is token-only — no raw hex in src/{ui,components,views}/v2');
  } else {
    for (const h of hits.slice(0, 20)) fail(`${h.file} → raw hex ${h.hex}`);
    if (hits.length > 20) fail(`…and ${hits.length - 20} more`);
  }
}

auditOffline();
auditContrast();
auditContrastV2();
auditMotion();
auditV2Hex();

heading(failures === 0 ? 'All blocking audits passed.' : `${failures} blocking failure(s).`);
process.exit(failures === 0 ? 0 : 1);

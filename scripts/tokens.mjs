/**
 * Token generator — the source of truth for src/styles/tokens.css and src/styles/theme.css.
 *
 *   node scripts/tokens.mjs          (or: npm run tokens)
 *
 * Values are harvested from the Bell Figma file (GnDdYtn8SaQjgmA4SQRCn7) via the MCP
 * `get_variable_defs`, which resolves every variable to 8-digit hex per mode — so the alpha is
 * already baked in and Figma's paint-opacity-vs-token-alpha split does not have to be modelled.
 * Figma's own Code Syntax declares most of these CSS names, which is why they are kept as-is
 * rather than renamed to match the Figma variable paths.
 *
 * Day lives on :root. Night overrides on .app[data-tone='night'] — a product-level toggle, not
 * prefers-color-scheme; the user chooses, not the OS. A token with no `night` value is
 * deliberately mode-invariant and is emitted once.
 *
 * Retuning a token is a one-line edit here plus a re-run. Do not hand-edit the generated CSS.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** `#rrggbbaa` -> `rgba(r, g, b, .aa)`; `#rrggbb` passes through. Keeps the alpha readable. */
function css(v) {
  if (typeof v !== 'string' || !/^#[0-9a-f]{8}$/i.test(v)) return v;
  const [r, g, b, a] = [1, 3, 5, 7].map((i) => parseInt(v.slice(i, i + 2), 16));
  const alpha = Number((a / 255).toFixed(3));
  return `rgba(${r}, ${g}, ${b}, ${String(alpha).replace(/^0\./, '.')})`;
}

/* ------------------------------------------------------------------ the tokens */

const GROUPS = [
  {
    title: 'Type — SF Pro for UI (split at Apple’s 20pt optical crossover) and Geist Mono for\n     exam and machine data. Two families, not three: `Ink/Annotation` and its Caveat face were\n     deleted from the design file, and the app never rendered ink as text anyway — annotations are\n     canvas strokes. Faces vendored: npm run fonts.',
    tokens: {
      '--font-ui': { day: "'Jost', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif" },
      '--font-disp': { day: "'Jost', 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif" },
      '--font-mono': { day: "'Azeret Mono', 'Geist Mono', ui-monospace, 'Cascadia Code', Consolas, monospace" },
    },
  },
  {
    title: 'Ground — a picked cool periwinkle-grey in Day, never flat grey. Night is a BRIGHT\n     stack knocked down by translucent scrims, not a dark base: the Night sidebar composites to\n     #46526d (lum 81) in the file’s own render of `Library — Night`, and Day’s to #efeafa (lum\n     236). If a rebuild looks near-black, an alpha was flattened — see scripts/tone-verify.py.',
    tokens: {
      '--ground': { day: '#efe9dc', night: '#262624' },
      '--ground-2': { day: '#e2d9c6', night: '#403e3a' },
      '--ground-veil': { day: '#efe9dc00', night: '#26262400' },
    },
  },
  {
    title: 'Ambient — the two oversized blooms behind every screen. Opaque in Figma; their\n     translucency comes from a 160px blur compositing over what is behind them.',
    tokens: {
      '--ambient-a': { day: '#efe9dc00', night: '#26262400' },
      '--ambient-b': { day: '#efe9dc00', night: '#26262400' },
    },
  },
  {
    title: 'Paper — mode-invariant on purpose. The exam PDF is the brightest, highest-contrast\n     thing on screen in both tones, and ink printed on it must never invert.',
    tokens: {
      '--paper': { day: '#ffffff' },
      '--page-ink': { day: '#1a1c24' },
      '--page-ink-2': { day: '#5b6072' },
      '--page-line': { day: '#1a1c2424' },
    },
  },
  {
    title: 'Cover — the eight notebook covers, plus the three paints that sit on one. Mode-invariant\n     for exactly the reason --paper and --page-ink are: a cover is an OBJECT, not chrome, and a\n     physical notebook does not change colour when you turn the lights on. All eight are picked so\n     --cover-label (white) clears 4.5:1 — the design file records 8.9 / 6.4 / 6.6 / 5.93 / 8.2 /\n     9.6 / 17.0 / 8.0; scripts/audit.mjs recomputes 8.78 / 6.30 / 6.52 / 5.93 / 8.08 / 9.71 /\n     17.00 / 7.92 from these hexes, so trust the audit for the last decimal. --cover-label-2 is 84%\n     and NOT 74%: at 74% covers 2, 3 and 4 fall to 4.26 / 4.40 / 4.05, below AA; at 84% the worst\n     case is 4.71 on cover 4. --cover-shade is the spine, --cover-wire the ring coils; both carry\n     alpha, so they ride any of the eight. No purple anywhere.',
    tokens: {
      '--cover-1': { day: '#2a5caa' },
      '--cover-2': { day: '#d9432f' },
      '--cover-3': { day: '#f2b632' },
      '--cover-4': { day: '#1a1a1a' },
      '--cover-5': { day: '#e2d9c6' },
      '--cover-6': { day: '#f2b632' },
      '--cover-7': { day: '#2a5caa' },
      '--cover-8': { day: '#d9432f' },
      '--cover-shade': { day: '#00000029' },
      '--cover-label': { day: '#ffffff' },
      '--cover-label-2': { day: '#ffffffd6' },
      '--cover-wire': { day: '#ffffff94' },
    },
  },
  {
    title: 'Plain white, for text and glyphs sitting ON the accent gradient. Figma binds these to\n     its `white` primitive rather than to `paper/base`, because the roles are unrelated.',
    tokens: {
      '--white': { day: '#ffffff' },
    },
  },
  {
    title: 'Plate — what sits behind the app window itself. Only ever visible at the rounded\n     corners and during the startup splash, so it is a fixed neutral rather than a tone value:\n     the tone vars live on .app, so anything on <body> would resolve Day in both modes.',
    tokens: {
      '--plate': { day: '#0b0c12' },
    },
  },
  {
    title: 'Scrim behind modals — the ⌘K palette and the update dialog. Was an app addition with a\n     guessed value (#10122847 / #00000080); Figma has since adopted it as `Color/ground/scrim`\n     (alpha/scrim-day #181A34 @28%, alpha/scrim-night #05060C @55%) and the file wins, so these are\n     the harvested numbers, not ours.',
    tokens: {
      '--scrim': { day: '#1a1a1a47', night: '#0000008c' },
    },
  },
  {
    title: 'Ink — UI text. Day got darker than the first-generation palette (--ink-2 was #565b6f,\n     --ink-3 was #8a8fa4), which is a real contrast improvement.',
    tokens: {
      '--ink': { day: '#1a1a1a', night: '#ece5d6' },
      '--ink-2': { day: '#5e584d', night: '#b5ad9d' },
      '--ink-3': { day: '#1a1a1a', night: '#ece5d6' },
    },
  },
  {
    title: 'Glass — chrome only, never content: sidebar, top bar, palette, sheets, popovers.',
    tokens: {
      '--glass': { day: '#f8f3e8', night: '#30302e' },
      '--glass-strong': { day: '#f8f3e8', night: '#30302e' },
      '--glass-brd': { day: '#1a1a1a', night: '#5a5751' },
      '--glass-hi': { day: '#ffffff00', night: '#ffffff00' },
    },
  },
  {
    title: 'Hairlines — used as BOTH a fill (1px rule rects) and a stroke (borders). One token;\n     CSS does not care which property consumes it.',
    tokens: {
      '--hair': { day: '#d8d0bf', night: '#4c4a45' },
      '--hair-2': { day: '#1a1a1a2e', night: '#ece5d62e' },
    },
  },
  {
    title: 'Card — content surfaces. Calm and mostly opaque, so they never compete with the paper.',
    tokens: {
      '--card': { day: '#f8f3e8', night: '#30302e' },
      '--card-brd': { day: '#1a1a1a', night: '#5a5751' },
    },
  },
  {
    title: 'Accent — one blue, spent on live elements: focus ring, active nav, timer ring,\n     progress, selection. --accent-soft is the only sanctioned wash.',
    tokens: {
      '--accent': { day: '#2a5caa', night: '#5a8ad8' },
      '--accent-soft': { day: '#dce4f1', night: '#2a3548' },
    },
  },
  {
    title: 'Brand ramp — mode-invariant. The `iris` name is inherited and now lies: every stop is\n     blue. Kept because Figma still uses it, so the two files stay greppable against each other.',
    tokens: {
      '--iris-1': { day: '#6aa8ff' },
      '--iris-2': { day: '#2c7bff' },
      '--iris-3': { day: '#1436c8' },
      '--iris-4': { day: '#f3b7c6' },
    },
  },
  {
    title: 'Mr. Bell — the mascot’s own palette, mode-invariant. cap-* also drive the two\n     gradients below. The spectacles are deliberately raw black and are not tokenised.',
    tokens: {
      '--bell-cap-hi': { day: '#58c8ff' },
      '--bell-cap-mid': { day: '#2c7bff' },
      '--bell-cap-lo': { day: '#1436c8' },
      '--bell-cap-deep': { day: '#0e2596' },
      '--bell-gold-hi': { day: '#ffe9a8' },
      '--bell-gold': { day: '#f7cf5c' },
      '--bell-gold-lo': { day: '#d69a2b' },
      '--bell-blush': { day: '#f3b7c6' },
    },
  },
  {
    title: 'Gradients — Figma keeps these as paint styles, not variables. `Blue/Line 90` is the\n     live line; `Blue/Primary Button 135` fills the Primary button, which the design system\n     names as the single exception to "accent as a line, never a fill".',
    tokens: {
      '--grad-line': { day: 'linear-gradient(90deg, var(--bell-cap-hi), var(--bell-cap-mid), var(--bell-cap-lo), var(--bell-cap-deep))' },
      '--grad-btn': { day: 'linear-gradient(135deg, var(--bell-cap-lo), var(--bell-cap-mid))' },
      '--iris': { day: 'var(--grad-line)' },
    },
  },
  {
    title: 'Board and season palettes — the chip washes and the season badge glyphs.\n     THESE ARE UNBOUND IN FIGMA: `Board/A Level/*` and all three `Season/*` paint styles are raw\n     hex, and `Season Icon` (102:15) binds no variables at all — `get_variable_defs` returns {}.\n     Named here anyway, because the app’s rule is that a retune is one edit and a re-run, and 21\n     literals across Chip.css and SeasonIcon.tsx is exactly what that rule exists to prevent.\n     Mode-invariant, like the paints they come from. Write these names back into Figma’s Code\n     Syntax so the two files stay greppable against each other.\n     IGCSE and O Level are absent on purpose: those two ARE bound, to bell/cap-*.\n     Chip alphas stay in Chip.css — wash vs edge is structural, and the two differ per palette\n     (A Level .40/.90, the seasons .28/.70).',
    tokens: {
      '--board-a-level-a': { day: '#4fc3f7' },
      '--board-a-level-b': { day: '#6aa8ff' },
      '--season-m-a': { day: '#d9432f' },
      '--season-m-b': { day: '#f5d9d3' },
      '--season-s-a': { day: '#f2b632' },
      '--season-s-b': { day: '#f8e7bc' },
      '--season-w-a': { day: '#2a5caa' },
      '--season-w-b': { day: '#dce4f1' },
      // The badge glyphs: a two-stop wash behind a three-stop mark ramp, per season.
      '--season-s-wash-0': { day: '#fff6e0' },
      '--season-s-wash-1': { day: '#ffe2a8' },
      '--season-s-mark-0': { day: '#ffc107' },
      '--season-s-mark-1': { day: '#fb8c00' },
      '--season-s-mark-2': { day: '#f4511e' },
      '--season-w-wash-0': { day: '#eaf6fe' },
      '--season-w-wash-1': { day: '#cde8fb' },
      '--season-w-mark-0': { day: '#4fc3f7' },
      '--season-w-mark-1': { day: '#2e86de' },
      '--season-w-mark-2': { day: '#5c6bc0' },
      '--season-m-wash-0': { day: '#f0f8e6' },
      '--season-m-wash-1': { day: '#d8efc6' },
      '--season-m-mark-0': { day: '#9ccc65' },
      '--season-m-mark-1': { day: '#4caf50' },
      '--season-m-mark-2': { day: '#26a69a' },
    },
  },
  {
    title: 'Difficulty — a separate warm heat axis. Never mix it with the brand blue. Mode-paired:\n     a dark burnt ramp in Day, a bright one in Night.',
    tokens: {
      '--d1': { day: '#2a5caa', night: '#5a8ad8' },
      '--d2': { day: '#2a5caa', night: '#5a8ad8' },
      '--d3': { day: '#c98f0e', night: '#e9b84c' },
      '--d4': { day: '#d9432f', night: '#ea5b44' },
      '--d5': { day: '#d9432f', night: '#ea5b44' },
    },
  },
  {
    title: 'Activity — the contribution grid’s five steps. Step 0 is neutral and OPAQUE on\n     purpose: a desaturated brand tint reads as "a little activity", a grey reads as "an empty\n     slot". Thresholds are absolute papers/day, never per-user quantiles.',
    tokens: {
      '--activity-0': { day: '#7f9bcb', night: '#253a5e' },
      '--activity-1': { day: '#7f9bcb', night: '#253a5e' },
      '--activity-2': { day: '#4d72b8', night: '#34599a' },
      '--activity-3': { day: '#2a4f94', night: '#5a8ad8' },
      '--activity-4': { day: '#15305f', night: '#a9c4f0' },
    },
  },
  {
    title: 'Window controls — macOS traffic lights, mode-invariant.',
    tokens: {
      '--traffic-close': { day: '#ff736a' },
      '--traffic-minimize': { day: '#febc2e' },
      '--traffic-zoom': { day: '#19c332' },
      '--traffic-inactive': { day: '#00000026' },
      '--traffic-glyph': { day: '#0000008c' },
    },
  },
  {
    title: 'Danger — began as an APP ADDITION, because the design system had no success/danger/warning\n     token and error styling was borrowing --d5 by hand, which mixes the difficulty axis into\n     something that is not difficulty. Figma has since adopted it: `Color/state/danger` and\n     `Color/state/danger-soft` now exist (danger/day #B3261E, danger/night #FF6B6B; the soft wash is\n     the same hue at 12% Day / 16% Night), so the values below are harvested, not seeded — they\n     replace the #a5103a / #ff4d6a pair we guessed off --d5. Still never --d5 for state.',
    tokens: {
      '--danger': { day: '#d9432f', night: '#ea5b44' },
      '--danger-soft': { day: '#f5d9d3', night: '#472e29' },
    },
  },
  {
    title: 'Elevation — from the Figma effect styles. Window and Card are measured;\n     TODO card-hover / paper / popover still to be read off Foundations — Elevation & Glass.',
    tokens: {
      '--shadow-win': { day: '0 0 0 2px var(--line)' },
      '--shadow-card': { day: 'none' },
      '--shadow-card-h': { day: '4px 4px 0 var(--line)' },
      '--shadow-paper': { day: '0 0 0 2px var(--line), 6px 6px 0 rgba(var(--ink-rgb), .14)' },
      '--shadow-pop': { day: '0 0 0 2px var(--line), 8px 8px 0 rgba(var(--ink-rgb), .2)' },
    },
  },
  {
    title: 'Radius.',
    tokens: {
      '--r-win': { day: '0px' },
      '--r-panel': { day: '0px' },
      '--r-card': { day: '0px' },
      '--r-btn': { day: '0px' },
      '--r-chip': { day: '0px' },
      '--r-pill': { day: '0px' },
    },
  },
  {
    title: 'Shape Kit — the Bauhaus layer from the Bell App v2 design (Claude Design handoff). Flat\n     primaries on cream, 2px ink rules as the only borders, no radius, no blur. Day values are the\n     prototype\'s THD set and Night its THN set (warm charcoal #262624, Claude-desktop-like).\n     --ground is the prototype\'s cream `--paper`; the app keeps --paper for the exam PDF sheet.',
    tokens: {
      '--line': { day: '#1a1a1a', night: '#5a5751' },
      '--inkbg': { day: '#1a1a1a', night: '#3f3e3a' },
      '--onink': { day: '#efe9dc', night: '#ece5d6' },
      '--ink-rgb': { day: '26, 26, 26', night: '236, 229, 214' },
      '--sheet': { day: '#fffefb', night: '#343431' },
      '--hov': { day: '#fffcf4', night: '#3a3936' },
      '--pale': { day: '#ddd5c4', night: '#46443f' },
      '--pale2': { day: '#e2d9c6', night: '#403e3a' },
      '--rule': { day: '#d8d0bf', night: '#4c4a45' },
      '--hatch': { day: '#f1ece2', night: '#2c2b29' },
      '--mute': { day: '#5e584d', night: '#b5ad9d' },
      '--mute2': { day: '#6b655a', night: '#a59d8e' },
      '--mute3': { day: '#8a8478', night: '#958d7e' },
      '--mute4': { day: '#8f877a', night: '#7f786b' },
      '--dim': { day: '#bdb6a8', night: '#6a665e' },
      '--dim2': { day: '#cfc5b0', night: '#5c5952' },
      '--blue': { day: '#2a5caa', night: '#5a8ad8' },
      '--navy': { day: '#1f4686', night: '#8fb0e8' },
      '--red': { day: '#d9432f', night: '#ea5b44' },
      '--maroon': { day: '#a12b1b', night: '#f29581' },
      '--gold': { day: '#c98f0e', night: '#e9b84c' },
      '--green': { day: '#3e8a5a', night: '#62b482' },
      '--t-blue': { day: '#dce4f1', night: '#2a3548' },
      '--t-blue2': { day: '#c9d3e4', night: '#323e54' },
      '--t-gold': { day: '#f8e7bc', night: '#433a26' },
      '--t-red': { day: '#f5d9d3', night: '#472e29' },
      '--t-green': { day: '#d8ebdd', night: '#28392d' },
      '--heat-1': { day: '#7f9bcb', night: '#253a5e' },
      '--heat-2': { day: '#4d72b8', night: '#34599a' },
      '--heat-3': { day: '#2a4f94', night: '#5a8ad8' },
      '--heat-4': { day: '#15305f', night: '#a9c4f0' },
      // Literal shape colours: the logo, Hush and the reaction faces keep these in both tones.
      '--sk-yellow': { day: '#f2b632' },
      '--sk-blue': { day: '#2a5caa' },
      '--sk-navy': { day: '#1f4686' },
      '--sk-red': { day: '#d9432f' },
      '--sk-black': { day: '#1a1a1a' },
      '--sk-cream': { day: '#efe9dc' },
      '--sk-green': { day: '#3e8a5a' },
      '--sk-gold': { day: '#c98f0e' },
      '--sk-orange': { day: '#e07a2c' },
      '--sk-purple': { day: '#7b5ea7' },
      '--sk-mute': { day: '#5e584d' },
      '--sk-steel': { day: '#8fa3c7' },
    },
  },
];

/* ------------------------------------------------------------------ emit tokens.css */

const HEAD = `/* GENERATED by scripts/tokens.mjs — do not edit by hand. Run \`npm run tokens\`.
   Originally harvested from the Bell Figma file (GnDdYtn8SaQjgmA4SQRCn7); retuned to the Shape
   Kit (Bell App v2) design, keeping the Figma-declared names so existing components follow.
   Day is :root; Night overrides on .app[data-tone='night'] — a product toggle, never
   prefers-color-scheme. A token declared once is deliberately identical in both tones. */
`;

const lines = [HEAD, ':root {'];
for (const g of GROUPS) {
  lines.push(`  /* ${g.title} */`);
  for (const [name, v] of Object.entries(g.tokens)) lines.push(`  ${name}: ${css(v.day)};`);
  lines.push('');
}
if (lines.at(-1) === '') lines.pop();
lines.push('}', '');

lines.push("/* Night. Only the tokens that actually change tone appear here. */");
lines.push(".app[data-tone='night'] {");
for (const g of GROUPS) {
  const flips = Object.entries(g.tokens).filter(([, v]) => v.night);
  if (!flips.length) continue;
  for (const [name, v] of flips) lines.push(`  ${name}: ${css(v.night)};`);
}
lines.push('}', '');

writeFileSync(join(root, 'src', 'styles', 'tokens.css'), lines.join('\n'), 'utf8');

/* ------------------------------------------------------------------ emit theme.css */

const COLOR_KEYS = [
  'ground', 'ground-2', 'paper', 'page-ink', 'white', 'plate', 'scrim', 'ink', 'ink-2', 'ink-3',
  'cover-1', 'cover-2', 'cover-3', 'cover-4', 'cover-5', 'cover-6', 'cover-7', 'cover-8',
  'cover-shade', 'cover-label', 'cover-label-2', 'cover-wire',
  'card', 'card-brd',
  'hair', 'hair-2', 'glass', 'glass-strong', 'glass-brd', 'glass-hi', 'accent', 'accent-soft',
  'iris-1', 'iris-2', 'iris-3', 'iris-4',
  'bell-cap-hi', 'bell-cap-mid', 'bell-cap-lo', 'bell-cap-deep',
  'd1', 'd2', 'd3', 'd4', 'd5',
  'activity-0', 'activity-1', 'activity-2', 'activity-3', 'activity-4',
  'traffic-close', 'traffic-minimize', 'traffic-zoom',
  'danger', 'danger-soft',
];
const RADIUS_KEYS = ['win', 'panel', 'card', 'btn', 'chip', 'pill'];

const theme = [
  '/* GENERATED by scripts/tokens.mjs — do not edit by hand. */',
  '/* Bridges the tokens into Tailwind v4 so any utility that does get used stays on-system.',
  '   Values point at the runtime vars, so Day/Night flows through them. */',
  '',
  '@theme {',
  '  --font-sans: var(--font-ui);',
  '  --font-display: var(--font-disp);',
  "  /* --font-mono collides with the app's own token name, so it carries a literal rather than",
  '     a self-referential var(). Kept in step with tokens.css here. */',
  `  --font-mono: ${GROUPS[0].tokens['--font-mono'].day};`,
  '',
  ...COLOR_KEYS.map((k) => `  --color-${k}: var(--${k});`),
  '',
  ...RADIUS_KEYS.map((k) => `  --radius-${k}: var(--r-${k});`),
  '',
  "  /* No shadow bridge: Tailwind's shadow namespace is --shadow-*, which is also what the",
  '     app calls its own elevation tokens, so a bridge entry would be self-referential. Use',
  '     `box-shadow: var(--shadow-card)` directly — that is how app.css already does it. */',
  '}',
  '',
];

writeFileSync(join(root, 'src', 'styles', 'theme.css'), theme.join('\n'), 'utf8');

/* ------------------------------------------------------------------ emit type.css
 * The Figma text styles, one class each. A component names the style rather than re-deriving
 * size / weight / tracking, which is what let 17 ad-hoc font sizes accumulate before.
 *
 * `family` picks the stack: ui = SF Pro Text, disp = SF Pro Display. Apple's optical crossover
 * is 20pt, so Display carries only the two styles at or above it and Text carries the rest.
 * `track` is Figma's letterSpacing percentage; Figma reports every line height as AUTO, which
 * is the font's own metrics — `normal`, never `1`.
 */

const TYPE = {
  // display — 20px and up, so SF Pro Display
  'display-setup-title': { family: 'disp', weight: 700, size: 26, track: -2.2, note: 'onboarding + setup headline' },
  greeting: { family: 'disp', weight: 600, size: 20, track: 0, note: 'dashboard greeting — off-ramp, not in the Figma ramp' },
  // titles
  'title-toolbar': { family: 'ui', weight: 600, size: 17, track: -1.2, note: 'top bar screen title' },
  'title-wordmark': { family: 'ui', weight: 700, size: 17, track: -1.4, lineHeight: '1.05', note: 'legacy sidebar wordmark — superseded by the Lockup SVG' },
  'title-card': { family: 'ui', weight: 600, size: 15, track: -1, note: 'paper card subject name' },
  // body
  'body-nav': { family: 'ui', weight: 500, size: 13, track: -0.4, note: 'nav + control labels' },
  'body-default': { family: 'ui', weight: 400, size: 13, track: -0.4, note: 'default UI text' },
  'body-strong': { family: 'ui', weight: 600, size: 13, track: -0.4, note: 'button labels, emphasis' },
  'body-small': { family: 'ui', weight: 400, size: 12, track: 0, note: 'card subtitle' },
  'body-chip': { family: 'ui', weight: 500, size: 12, track: 0, note: 'chip + row label' },
  'body-meta': { family: 'ui', weight: 400, size: 11, track: 0, note: 'metadata, helper text' },
  // labels
  'label-difficulty': { family: 'ui', weight: 600, size: 11, track: 0, note: 'difficulty band word; colour from --d1..--d5' },
  'label-section': { family: 'ui', weight: 600, size: 11, track: 6, upper: true, note: 'section eyebrow, sidebar group label' },
  'label-stat': { family: 'ui', weight: 600, size: 10, track: 6, upper: true, note: 'caption under a stat figure' },
  // mono — exam and machine data only
  'mono-hero': { family: 'mono', weight: 600, size: 26, track: -2, note: 'days-to-exam figure — off-ramp, deliberately above Mono/Stat' },
  'mono-stat': { family: 'mono', weight: 600, size: 19, track: -2, note: 'dashboard stat figure' },
  'mono-paper-code': { family: 'mono', weight: 600, size: 15, track: -1.2, note: 'paper code and variant — 9706, /12' },
  'mono-timer': { family: 'mono', weight: 400, size: 15, track: 0, note: 'focus timer readout' },
  'mono-meta': { family: 'mono', weight: 400, size: 12, track: 0, note: 'difficulty score, inline machine data' },
  'mono-small': { family: 'mono', weight: 400, size: 11, track: 0, note: 'session code, kbd, marks' },
};

const FAMILY_VAR = { ui: '--font-ui', disp: '--font-disp', mono: '--font-mono' };

const type = [
  '/* GENERATED by scripts/tokens.mjs — do not edit by hand. Run `npm run tokens`.',
  "   The Figma text styles as classes. Line heights are `normal` because Figma reports AUTO,",
  '   which means the font\'s own metrics — not 1. Tracking is converted from Figma percentages. */',
  '',
];
for (const [name, t] of Object.entries(TYPE)) {
  type.push(`/* ${t.note} */`);
  type.push(`.t-${name} {`);
  type.push(`  font-family: var(${FAMILY_VAR[t.family]});`);
  type.push(`  font-weight: ${t.weight};`);
  type.push(`  font-size: ${t.size}px;`);
  type.push(`  line-height: ${t.lineHeight ?? 'normal'};`);
  if (t.track !== 0) type.push(`  letter-spacing: ${Number((t.track / 100).toFixed(4))}em;`);
  if (t.upper) type.push('  text-transform: uppercase;');
  if (t.family === 'mono') type.push('  font-variant-numeric: tabular-nums;');
  type.push('}');
  type.push('');
}
writeFileSync(join(root, 'src', 'styles', 'type.css'), type.join('\n'), 'utf8');

const count = GROUPS.reduce((n, g) => n + Object.keys(g.tokens).length, 0);
const flips = GROUPS.reduce((n, g) => n + Object.values(g.tokens).filter((v) => v.night).length, 0);
console.log(`tokens.css  ${count} tokens, ${flips} of them mode-paired`);
console.log(`theme.css   ${COLOR_KEYS.length} colours, ${RADIUS_KEYS.length} radii`);
console.log(`type.css    ${Object.keys(TYPE).length} text-style classes`);

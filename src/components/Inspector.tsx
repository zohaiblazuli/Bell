/**
 * The notebook inspector — `design/specs/screen-notebooks.md` §6, `inspector 268 x 808 @(1052,52)`.
 *
 * The Reader's tool panel is the box, to the pixel: `--glass`, 1px `--hair` on all four sides, blur
 * 26, clipped, VERTICAL gap 16, pad 18 (`WorkspaceView.css` `.rd-panel`). What is new is that the
 * panel carries three tabs rather than one column, so `Panel Tabs` is its first child and the rest
 * of the column is whichever tab is showing.
 *
 * THE THREE TABS ARE NOT THREE PANELS OF THE SAME KIND.
 *   Tool     (§6a) edits `NbInkSettings` — a pref, so it belongs to the student and not to this
 *                  notebook. Four cards: nib, ink, stroke, behaviour.
 *   Pages    (§6b) navigates. Its ghost trailing tile is requirement 2 and TRAP 15 made visible:
 *                  never a count, never a total, always one more spread available.
 *   Notebook (§6c) edits `NbAuthored` and holds the only two irreversible controls in the screen.
 *
 * Which is why each tab is its own function below and each mounts fresh: the Pages tab's jump box
 * and the Notebook tab's delete confirmation are both states that must not survive a tab switch.
 *
 * WHAT IS DRAWN RATHER THAN GLYPHED, and why that is the design rather than an economy:
 *  - the four nib tiles draw a real stroke sample at that nib's taper (a computed filled ribbon, not
 *    four copies of one line), because a flat line on all four would make the card decorative;
 *  - the four paper styles and every page mini are real miniature pages — a `--paper` rectangle with
 *    its own ruling — which is exactly why §10's 14 new glyphs include none for paper;
 *  - the cover mini is drawn here from §4e's parts. It should collapse onto `@ui/NotebookCover` the
 *    moment that component lands; see `CoverMini`.
 *
 * TWO DIVERGENCES FROM THE SPEC, both deliberate and both reported upstream:
 *  1. §6c labels the first action `Export PDF`. `nbExport` copies the notebook's directory to
 *     `<app data>\exports\<name>` — pages, history and assets as JSON and PNG. It does not render a
 *     PDF and nothing in `src-tauri` can. The button therefore says what it does.
 *  2. The delete row confirms in place rather than firing. §6c draws one press; a notebook is pages
 *     of the student's own handwriting and `nbDelete` is documented "Irreversible". `@ui/Dialog` is
 *     not the confirmation, and not for taste: this panel sets `backdrop-filter`, which makes it the
 *     containing block for `position: fixed` descendants, so the dialog's scrim would be trapped
 *     inside 268px of glass.
 *
 * CSS prefix `nbi-`, on every class without exception. This sheet loads ahead of `app.css` and the
 * `src/ui` layer, so a bare name that collides with an existing one silently loses — the Reader's
 * sheet documents the same hazard at its head, and the few rules here that must beat a `src/ui`
 * component are element- or parent-qualified for exactly that reason.
 */
import './Inspector.css';
import { useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon';
import Button from '@ui/Button';
import Card from '@ui/Card';
import Chip, { type ChipPalette } from '@ui/Chip';
import Field from '@ui/Field';
import PanelTabs from '@ui/PanelTabs';
import SectionLabel from '@ui/SectionLabel';
import Slider from '@ui/Slider';
import Switch from '@ui/Switch';
import SubjectIcon from '@ui/icons/SubjectIcon';
import {
  NB_INK_PALETTE,
  NB_STROKES,
  NIB_IDS,
  PAPER_STYLES,
  pageLabel,
  spreadCountFor,
  spreadLabel,
  spreadOf,
  spreadPages,
  type NbAuthored,
  type NbEntry,
  type NbInkSettings,
  type NbTool,
  type NibId,
  type PaperStyle,
} from '@/lib/notebooks';
import type { Qualification, Subject } from '@/lib/types';

export interface Props {
  /** 0 Tool · 1 Pages · 2 Notebook. */
  tab: number;
  onTab: (tab: number) => void;

  /** The Tool tab's whole state, as one record. */
  ink: NbInkSettings;
  /** A row emits only what it changed. */
  onInk: (patch: Partial<NbInkSettings>) => void;
  /** Colours the student has actually used, most recent first — §6a's `recent` row. */
  recentColours: string[];

  /** 0-based spread index, and how many exist. Neither is ever shown as a total — TRAP 15. */
  spread: number;
  spreadCount: number;
  onSpread: (spread: number) => void;

  notebook: NbEntry;
  subjects: Subject[];
  onMeta: (meta: NbAuthored) => void;
  onExport: () => void;
  onDelete: () => void;
}

/* ─────────────────────────────────────────────────────────────────── the words ────────────────── */

/** §6's `Panel Tabs`. A 3-tuple, because a fourth segment is not a variant of that component. */
const TABS = ['Tool', 'Pages', 'Notebook'] as const;

/** §6a's `nib` card meta is the live tool's name. All ten dock tools, so the meta cannot go blank. */
const TOOL_LABEL: Record<NbTool, string> = {
  pen: 'Pen',
  pencil: 'Pencil',
  hl: 'Highlighter',
  er: 'Eraser',
  lasso: 'Select',
  shapes: 'Shapes',
  text: 'Text',
  image: 'Image',
  ruler: 'Ruler',
  sticky: 'Sticky note',
};

const NIB_LABEL: Record<NibId, string> = {
  fountain: 'Fountain',
  ballpoint: 'Ballpoint',
  pencil: 'Pencil',
  marker: 'Marker',
};

const PAPER_LABEL: Record<PaperStyle, string> = {
  blank: 'Blank',
  ruled: 'Ruled',
  grid: 'Grid',
  dotted: 'Dotted',
};

/**
 * A name for every token in `NB_INK_PALETTE`, because a swatch whose only cue is its own colour has
 * no accessible name at all. Worded as `annotations.ts`'s `INK_SWATCHES` words the Reader's six.
 */
const INK_NAME: Record<string, string> = {
  '--page-ink': 'Graphite',
  '--iris-3': 'Brand blue',
  '--iris-2': 'Bright blue',
  '--iris-1': 'Light blue',
  '--bell-cap-hi': 'Sky',
  '--cover-2': 'Teal',
  '--cover-3': 'Green',
  '--cover-4': 'Amber',
  '--cover-5': 'Crimson',
  '--cover-8': 'Rust',
};

/** `Chip`'s `Palette` axis, from the catalogue's qualification. §6c draws `Palette=A Level`. */
const QUAL_PALETTE: Record<Qualification, ChipPalette> = {
  a_level: 'a-level',
  igcse: 'igcse',
  o_level: 'o-level',
};

/**
 * §6a's `behaviour` card. Read and patch travel with the label rather than as a key, so the three
 * rows stay exhaustively typed against `NbInkSettings` without a cast at the call site.
 */
const BEHAVIOUR: readonly {
  label: string;
  read: (ink: NbInkSettings) => boolean;
  patch: (on: boolean) => Partial<NbInkSettings>;
}[] = [
  { label: 'Pressure', read: (i) => i.pressure, patch: (on) => ({ pressure: on }) },
  { label: 'Straight-line lock', read: (i) => i.straightLock, patch: (on) => ({ straightLock: on }) },
  { label: 'Snap to ruler', read: (i) => i.snapRuler, patch: (on) => ({ snapRuler: on }) },
];

/* ──────────────────────────────────────────────────────────── the four stroke samples ─────────── */

/**
 * §6a: "Each draws a real stroke sample at that nib taper." So the four tiles are not four copies of
 * one line — they are one centreline swept at four different width profiles, which is the only thing
 * that makes the card informative rather than decorative.
 *
 * Each sample is a FILLED ribbon rather than a stroked path, because a stroke has exactly one width
 * and a taper is the point. The outline is the centreline offset along its own normal by the nib's
 * half-width, sampled forward and then back — computed once at module load, not stored as four hand-
 * written path literals nobody could later re-derive.
 */
const SAMPLE_W = 80;
const SAMPLE_H = 24;
const SAMPLES = 40;

/** The shared centreline: a gentle S across the sample box, so every taper is read on one shape. */
const cx = (t: number) => 7 + (SAMPLE_W - 14) * t;
const cy = (t: number) => 16 - 7 * t + 3 * Math.sin(2 * Math.PI * t);

/** Half-width in sample-box units, so the drawn nib is twice this. */
const NIB_PROFILE: Record<NibId, (t: number) => number> = {
  /** A calligraphic taper: hairline in, 4.8 wide at the middle, hairline out. */
  fountain: (t) => 0.3 + 2.2 * Math.sin(Math.PI * t) ** 0.7,
  /** A ball rolls at one width. The 7% swell is the ink pooling, not a taper. */
  ballpoint: (t) => 0.78 + 0.07 * Math.sin(Math.PI * t),
  /** Graphite is uneven: a fine waver on a constant width, and it lays down grey rather than black. */
  pencil: (t) => 1 + 0.22 * Math.sin(t * 11.3) + 0.1 * Math.sin(t * 24.7),
  /** A chisel — flat, blunt at both ends, and translucent where it overlaps itself. */
  marker: () => 2.3,
};

const r2 = (n: number) => Math.round(n * 100) / 100;

function ribbon(halfWidth: (t: number) => number): string {
  const near: string[] = [];
  const far: string[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    // A central difference for the tangent; the normal is that turned a quarter. Clamped at both
    // ends so the first and last samples use a one-sided difference rather than reading off-curve.
    const a = Math.max(0, t - 1 / SAMPLES);
    const b = Math.min(1, t + 1 / SAMPLES);
    const dx = cx(b) - cx(a);
    const dy = cy(b) - cy(a);
    const len = Math.hypot(dx, dy) || 1;
    const w = halfWidth(t);
    const ox = (-dy / len) * w;
    const oy = (dx / len) * w;
    near.push(`${r2(cx(t) + ox)} ${r2(cy(t) + oy)}`);
    far.push(`${r2(cx(t) - ox)} ${r2(cy(t) - oy)}`);
  }
  return `M${near.join('L')}L${far.reverse().join('L')}Z`;
}

const NIB_PATH: Record<NibId, string> = {
  fountain: ribbon(NIB_PROFILE.fountain),
  ballpoint: ribbon(NIB_PROFILE.ballpoint),
  pencil: ribbon(NIB_PROFILE.pencil),
  marker: ribbon(NIB_PROFILE.marker),
};

/* ────────────────────────────────────────────────────────────────────── formatting ────────────── */

/**
 * A palette entry is a TOKEN (`--iris-3`); a custom colour is a literal. Both reach CSS through
 * here. `notebooks.ts` is explicit that the literal is what gets frozen into a stroke at
 * pointer-down, and `annotations.ts` explains at length why ink is deliberately off-token and never
 * retones: ink is printed on white paper, and a stroke keeps the colour it was drawn in for ever.
 * That exemption is ink's alone — a literal anywhere else in this file would be a bug.
 */
const paint = (colour: string) => (colour.startsWith('--') ? `var(${colour})` : colour);

/** The two `Slider` rows print a percentage; a bare 0..1 range announces "0.4". */
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** §6c prints "2.4 MB". One decimal, and KB below a megabyte. */
function fileSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 1) return `${bytes} B`;
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

/** §6c prints "12 Aug". The year lives in the row's `title`, so a long-lived notebook is not a lie. */
const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const fullDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * The inverse of `pageLabel`. Pages are stored 0-indexed and DISPLAYED with an offset of 2, so a
 * page the student types has to come back through that offset before `spreadOf` can name a spread.
 * `pageLabel(0)` IS the offset, which is how this stays one definition rather than restating the 2.
 */
const indexOfPage = (page: number) => page - pageLabel(0);

/* ─────────────────────────────────────────────────────────────────────── the panel ────────────── */

export default function Inspector({
  tab,
  onTab,
  ink,
  onInk,
  recentColours,
  spread,
  spreadCount,
  onSpread,
  notebook,
  subjects,
  onMeta,
  onExport,
  onDelete,
}: Props) {
  /**
   * How many spread tiles the Pages tab lists. `spreadCount` is the prop, and the other two terms can
   * only ever raise it to a spread that genuinely exists: `spreadCountFor` is the contract's own page
   * arithmetic, and `spread + 1` guarantees the current spread always has a tile — without it,
   * pressing the ghost (which goes to `spreadCount`) would leave nothing selected.
   */
  const count = Math.max(spreadCount, spreadCountFor(notebook.pages), spread + 1);

  return (
    <aside className="nbi">
      {/* §6: the first child is always `Panel Tabs` 232 x 30. It supplies the tablist; each tab
          below is the matching `tabpanel`. `aria-controls` is deliberately unwired in that
          component — the panel it switches is this column, which is the call site's. */}
      <PanelTabs tabs={TABS} selected={tab} onSelect={onTab} label="Inspector" />

      {tab === 1 ? (
        <PagesTab
          spread={spread}
          count={count}
          onSpread={onSpread}
          paper={notebook.paper}
          margin={notebook.margin}
          pages={notebook.pages}
        />
      ) : tab === 2 ? (
        <NotebookTab
          notebook={notebook}
          subjects={subjects}
          onMeta={onMeta}
          onExport={onExport}
          onDelete={onDelete}
        />
      ) : (
        <ToolTab ink={ink} onInk={onInk} recent={recentColours} />
      )}
    </aside>
  );
}

/* ────────────────────────────────────────────────────────────────────── §6a Tool ──────────────── */

function ToolTab({
  ink,
  onInk,
  recent,
}: {
  ink: NbInkSettings;
  onInk: (patch: Partial<NbInkSettings>) => void;
  recent: string[];
}) {
  // A palette pick stores a token, so anything else is a colour the student mixed themselves.
  const custom = !ink.colour.startsWith('--');
  // Four slots whether or not there are four colours yet, so the `plus` never moves and an unused
  // slot reads as empty rather than as a colour.
  const slots = [0, 1, 2, 3].map((i) => recent[i]);

  return (
    <div className="nbi-tab" role="tabpanel" aria-label="Tool">
      {/* §6a `nib` — 2 x 2 of 96 x 56 tiles, each a real stroke sample above its name. */}
      <Card className="nbi-card">
        <SectionLabel label="Nib" meta={TOOL_LABEL[ink.tool]} />
        <div className="nbi-nibs" role="group" aria-label="Nib">
          {NIB_IDS.map((nib) => (
            <button
              key={nib}
              type="button"
              className="nbi-nib"
              aria-pressed={nib === ink.nib}
              onClick={() => onInk({ nib })}
            >
              {/* Painted `--ink-2`, never the live ink colour: `--page-ink` on a `--card` ground is
                  all but invisible in Night, and §5 of the controls spec makes the same call about
                  `State=Active` — an accent fill, an accent glyph and an accent line is three
                  signals for one state. */}
              <svg
                className="nbi-nib-ink"
                data-nib={nib}
                viewBox={`0 0 ${SAMPLE_W} ${SAMPLE_H}`}
                aria-hidden="true"
              >
                <path d={NIB_PATH[nib]} />
              </svg>
              <span className="nbi-nib-name t-body-small">{NIB_LABEL[nib]}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* §6a `ink` — the two measured rows, iterated off the constant rather than retyped. */}
      <Card className="nbi-card">
        <SectionLabel label="Ink" />
        {NB_INK_PALETTE.map((row, i) => (
          <div
            key={i}
            className="nbi-swatches"
            role="group"
            aria-label={i === 0 ? 'Ink colour' : 'Ink colour, second row'}
          >
            {row.map((token) => (
              <button
                key={token}
                type="button"
                className="nbi-swatch"
                aria-pressed={token === ink.colour}
                aria-label={INK_NAME[token] ?? token}
                title={INK_NAME[token] ?? token}
                onClick={() => onInk({ colour: token })}
              >
                <span className="nbi-swatch-disc" style={{ background: paint(token) }} />
              </button>
            ))}
          </div>
        ))}

        <div className="nbi-recent">
          <span className="nbi-recent-label t-body-small">Recent</span>
          {slots.map((colour, i) =>
            colour ? (
              <button
                key={i}
                type="button"
                className="nbi-disc"
                style={{ background: paint(colour) }}
                aria-pressed={colour === ink.colour}
                aria-label={`Recent colour ${i + 1}${INK_NAME[colour] ? ` — ${INK_NAME[colour]}` : ''}`}
                onClick={() => onInk({ colour })}
              />
            ) : (
              <span key={i} className="nbi-disc nbi-disc--empty" aria-hidden="true" />
            ),
          )}
          <span className="nbi-gap" />
          {/* §6a draws a 24 x 24 `Icon Button` `Icon=plus` here. The honest control behind it is the
              platform's own colour picker, so the input IS the button: transparent, filling the box,
              with the `plus` and the picked colour drawn underneath it. Uncontrolled on purpose —
              `ink.colour` is the authoritative value and a controlled `type="color"` would need a
              literal fallback for every state in which no custom colour exists. */}
          <span className="nbi-custom" data-on={custom ? '' : undefined}>
            {custom ? (
              <span className="nbi-custom-fill" style={{ background: paint(ink.colour) }} />
            ) : null}
            <Icon name="plus" className="nbi-custom-plus" />
            <input
              type="color"
              className="nbi-custom-inp"
              aria-label={custom ? 'Custom ink colour, in use' : 'Custom ink colour'}
              onChange={(e) => onInk({ colour: e.target.value })}
            />
          </span>
        </div>
      </Card>

      {/* §6a `stroke` — the 5 / 8 / 12 dots, then the two slider rows. */}
      <Card className="nbi-card">
        <SectionLabel label="Stroke" />
        <div className="nbi-strokes" role="group" aria-label="Stroke width">
          {NB_STROKES.map((px) => (
            /* The file draws bare 5 / 8 / 12 px dots; each sits in a 22px button here, because a
               5px hit target is not operable. The Reader made the same correction. */
            <button
              key={px}
              type="button"
              className="nbi-stroke"
              aria-pressed={px === ink.strokePx}
              aria-label={`${px} px`}
              onClick={() => onInk({ strokePx: px })}
            >
              <span className="nbi-stroke-dot" style={{ width: px, height: px }} />
            </button>
          ))}
          <span className="nbi-gap" />
          <span className="nbi-strokes-read t-mono-small">{ink.strokePx} px</span>
        </div>

        <div className="nbi-slide">
          <span className="nbi-slide-label t-body-small">Opacity</span>
          <Slider
            value={ink.opacity}
            onChange={(v) => onInk({ opacity: v })}
            label="Ink opacity"
            aria-valuetext={pct(ink.opacity)}
          />
          <span className="nbi-slide-val t-mono-small">{pct(ink.opacity)}</span>
        </div>
        <div className="nbi-slide">
          <span className="nbi-slide-label t-body-small">Smoothing</span>
          <Slider
            value={ink.smoothing}
            onChange={(v) => onInk({ smoothing: v })}
            label="Stroke smoothing"
            aria-valuetext={pct(ink.smoothing)}
          />
          <span className="nbi-slide-val t-mono-small">{pct(ink.smoothing)}</span>
        </div>
      </Card>

      {/* §6a `behaviour` — three `Switch` rows at pitch 36, which is the 24 switch plus a 12 gap. */}
      <Card className="nbi-card">
        <SectionLabel label="Behaviour" />
        <div className="nbi-switches">
          {BEHAVIOUR.map((row) => (
            <div key={row.label} className="nbi-swrow">
              <span className="nbi-swrow-label t-body-small">{row.label}</span>
              <span className="nbi-gap" />
              <Switch
                checked={row.read(ink)}
                onChange={(on) => onInk(row.patch(on))}
                label={row.label}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────────── §6b Pages ──────────────── */

function PagesTab({
  spread,
  count,
  onSpread,
  paper,
  margin,
  pages,
}: {
  spread: number;
  count: number;
  onSpread: (spread: number) => void;
  paper: PaperStyle;
  margin: boolean;
  pages: number;
}) {
  const [jump, setJump] = useState('');

  const go = () => {
    const typed = Number.parseInt(jump.trim(), 10);
    if (!Number.isFinite(typed)) return;
    /* Clamped to `count` rather than `count - 1`: one past the end is the ghost, and a notebook has
       as many more pages as the student needs. Clamped at 0 below, because page 1 does not exist —
       the first leaf of a bound notebook is pages 2 and 3. */
    onSpread(Math.min(count, Math.max(0, spreadOf(indexOfPage(typed)))));
    setJump('');
  };

  const [ghostL, ghostR] = spreadPages(count);

  return (
    <div className="nbi-tab" role="tabpanel" aria-label="Pages">
      <Field
        className="nbi-input"
        placeholder="Jump to page…"
        aria-label="Jump to page"
        inputMode="numeric"
        value={jump}
        onChange={(e) => setJump(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          go();
        }}
      />

      {/* The meta is §6b's own "48 pages". That is not the thing TRAP 15 forbids: the trap is a page
          INDICATOR reading "12 of 40", and nothing here ever numbers a spread against a total. */}
      <SectionLabel label="Spreads" meta={`${pages} pages`} />

      <div className="nbi-spreads">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            className="nbi-spread"
            aria-pressed={i === spread}
            onClick={() => onSpread(i)}
          >
            {/* `sheet` 109 x 76 — two page minis, H gap 2. The current spread's 1.5px `--accent` is
                an INSIDE stroke, as every stroke in this file is, so selecting cannot move a tile. */}
            <span className="nbi-sheet">
              <span className="nbi-page" data-paper={paper} data-margin={margin ? '' : undefined} />
              <span className="nbi-page" data-paper={paper} data-margin={margin ? '' : undefined} />
            </span>
            <span className="nbi-spread-label t-mono-small">{spreadLabel(i)}</span>
          </button>
        ))}

        {/* The trailing ghost. Requirement 2 made visible: there is always one more spread, so the
            student is never asked how many pages they need and `next` is never disabled. */}
        <button
          type="button"
          className="nbi-spread"
          aria-label={`Start a new spread — pages ${pageLabel(ghostL)}-${pageLabel(ghostR)}`}
          onClick={() => onSpread(count)}
        >
          <span className="nbi-sheet nbi-sheet--new">
            <span className="nbi-ghost">
              <Icon name="plus" className="nbi-ghost-plus" />
            </span>
          </span>
          <span className="nbi-spread-label t-mono-small">new</span>
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── §6c Notebook ──────────────── */

function NotebookTab({
  notebook,
  subjects,
  onMeta,
  onExport,
  onDelete,
}: {
  notebook: NbEntry;
  subjects: Subject[];
  onMeta: (meta: NbAuthored) => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const killRef = useRef<HTMLButtonElement>(null);
  const warnId = useId();

  // Focus the destructive button once it appears, so the keyboard path is the same length as the
  // pointer path and the warning is what gets announced on arrival.
  useEffect(() => {
    if (confirming) killRef.current?.focus();
  }, [confirming]);

  /**
   * `NbEntry` carries five fields `nbMetaSave` does not take, so a patch is applied to a fresh
   * `NbAuthored` rather than spread off the entry. That is not defensive typing for its own sake:
   * `pages` and `bytes` are answered by the filesystem, and posting them back as authored data is
   * how a derived value turns into a stored one.
   */
  const authored = (patch: Partial<NbAuthored>): NbAuthored => ({
    name: notebook.name,
    cover: notebook.cover,
    sticker: notebook.sticker,
    paper: notebook.paper,
    margin: notebook.margin,
    subject: notebook.subject,
    ...patch,
  });

  const linked = notebook.subject;
  /* `NbAuthored.subject` stores a code and a name and nothing else — codes, not ids, because a
     catalogue resync replaces `catalog_*` wholesale and would orphan an id. The chip's palette is the
     one thing it cannot store, so it is looked up; an unindexed subject falls back to neutral rather
     than guessing a qualification. */
  const indexed = linked ? subjects.find((s) => s.code === linked.code) : undefined;
  const palette: ChipPalette = indexed ? QUAL_PALETTE[indexed.qualification] : 'neutral';

  return (
    <div className="nbi-tab" role="tabpanel" aria-label="Notebook">
      {/* §6c `identity` — the 95 x 120 cover mini, the name, and the linked subject. */}
      <Card className="nbi-card">
        <SectionLabel label="Notebook" />
        <CoverMini cover={notebook.cover} />
        <Field
          className="nbi-input nbi-name"
          value={notebook.name}
          placeholder="Untitled notebook"
          aria-label="Notebook name"
          onChange={(e) => onMeta(authored({ name: e.currentTarget.value }))}
        />
        {linked ? (
          /* One handler, so the pill is one button and its accessible name becomes "Remove Physics".
             Unlink then link again is the whole edit — two controls in a 200px row to swap a subject
             would be the more complicated answer to the same question. */
          <Chip
            className="nbi-subject"
            label={linked.name}
            code={linked.code}
            palette={palette}
            filled
            icon={<SubjectIcon code={linked.code} size={18} />}
            onClose={() => onMeta(authored({ subject: null }))}
          />
        ) : (
          /* No subject yet. A native `<select>` laid transparently over a chip-shaped face: it is
             keyboard-operable and screen-reader-labelled for free, and unlike a popover it cannot be
             trapped by this panel's own `backdrop-filter` containing block. */
          <span className="nbi-link">
            <Icon name="plus" className="nbi-link-plus" />
            <span className="nbi-link-label t-body-chip">Link a subject</span>
            <select
              className="nbi-link-sel"
              aria-label="Link a subject"
              value=""
              onChange={(e) => {
                const picked = subjects.find((s) => s.code === e.currentTarget.value);
                if (picked) onMeta(authored({ subject: { code: picked.code, name: picked.name } }));
              }}
            >
              <option value="">Link a subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.code}>
                  {s.name} · {s.code}
                </option>
              ))}
            </select>
          </span>
        )}
      </Card>

      {/* §6c `paper` — four 32 x 40 minis, drawn differently because a generic page four times over
          would say the four styles are the same. Then the margin switch. */}
      <Card className="nbi-card">
        <SectionLabel label="Paper" />
        <div className="nbi-styles" role="group" aria-label="Paper style">
          {PAPER_STYLES.map((style) => (
            <button
              key={style}
              type="button"
              className="nbi-style"
              aria-pressed={style === notebook.paper}
              onClick={() => onMeta(authored({ paper: style }))}
            >
              <span
                className="nbi-page nbi-style-page"
                data-paper={style}
                data-margin={notebook.margin ? '' : undefined}
              />
              <span className="nbi-style-name t-body-small">{PAPER_LABEL[style]}</span>
            </button>
          ))}
        </div>
        <div className="nbi-swrow">
          <span className="nbi-swrow-label t-body-small">Margin rule</span>
          <span className="nbi-gap" />
          <Switch
            checked={notebook.margin}
            onChange={(on) => onMeta(authored({ margin: on }))}
            label="Margin rule"
          />
        </div>
      </Card>

      {/* §6c `details` — three measured rows. Every value is read, none is invented. */}
      <Card className="nbi-card">
        <SectionLabel label="Details" />
        <dl className="nbi-details">
          <div className="nbi-detail">
            <dt className="t-body-small">Pages</dt>
            <dd className="t-mono-small">{notebook.pages}</dd>
          </div>
          <div className="nbi-detail">
            <dt className="t-body-small">On this device</dt>
            <dd className="t-mono-small">{fileSize(notebook.bytes)}</dd>
          </div>
          <div className="nbi-detail" title={fullDate(notebook.createdAt)}>
            <dt className="t-body-small">Created</dt>
            <dd className="t-mono-small">{shortDate(notebook.createdAt)}</dd>
          </div>
        </dl>
      </Card>

      {/* §6c's FILL 40 spacer. It collapses to nothing when the column is shorter than its content,
          which is what keeps the actions reachable in a short window rather than pushed off. */}
      <span className="nbi-spacer" aria-hidden="true" />

      <div className="nbi-actions">
        {/* SPEC DIVERGENCE, reported upstream. §6c labels this `Export PDF`. `nbExport` copies the
            notebook's directory — `meta.json`, the page JSON and the PNG assets — into
            `<app data>\exports\<name>`. There is no PDF writer anywhere in `src-tauri`. A button
            whose label promises a file format the app cannot produce is worse than a plain one. */}
        <Button className="nbi-export" icon="doc" label="Export notebook…" onClick={onExport} />
        <p className="nbi-hint t-body-meta">Copies the pages and images to a folder. Not a PDF.</p>

        {confirming ? (
          <div
            className="nbi-kill-confirm"
            role="group"
            aria-label="Confirm delete"
            onKeyDown={(e) => {
              if (e.key !== 'Escape') return;
              e.stopPropagation();
              setConfirming(false);
            }}
          >
            <p id={warnId} className="nbi-kill-warn t-body-small">
              {notebook.pages} pages of your handwriting. This cannot be undone.
            </p>
            <div className="nbi-kill-pair">
              <button
                type="button"
                className="nbi-keep t-body-small"
                onClick={() => setConfirming(false)}
              >
                Keep it
              </button>
              <button
                ref={killRef}
                type="button"
                className="nbi-kill"
                aria-describedby={warnId}
                onClick={() => {
                  setConfirming(false);
                  onDelete();
                }}
              >
                <Icon name="trash" />
                <span className="t-body-small">Delete</span>
              </button>
            </div>
          </div>
        ) : (
          /* §6c: 232 x 34, r `--r-btn`, `--danger-soft` fill, `trash` + `Body/Small` in `--danger`,
             both centred. `--danger` and never `--d5`: borrowing the difficulty heat ramp for state
             is what rule 3 forbids outright, and closing that gap is why these two tokens exist. */
          <button type="button" className="nbi-kill" onClick={() => setConfirming(true)}>
            <Icon name="trash" />
            <span className="t-body-small">Delete notebook</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * §6c's `cover mini` — a `Notebook Cover` instance at `rescale(0.4)`, so 237 x 300 lands on 95 x 120.
 *
 * TEMPORARY, AND ONLY IN ITS OWNERSHIP: `@ui/NotebookCover` is being written in parallel, so this is
 * built from §4e's own parts — `--cover-N` book, a `--cover-shade` spine, seven `--cover-wire` coils,
 * the three-strip `--paper` page edge. Collapse this onto that component the moment it lands; nothing
 * outside this function needs to change.
 *
 * It carries no text. §4e's cover prints its name in Title/Card and its meta in Mono/Small, and at
 * 0.4 those would be 0.4 of a named ramp step — re-deriving type metrics, which the contract forbids.
 * The name is in the field directly below this anyway.
 */
function CoverMini({ cover }: { cover: NbEntry['cover'] }) {
  return (
    <div className="nbi-cover" aria-hidden="true" style={{ background: `var(--cover-${cover})` }}>
      <span className="nbi-cover-spine" />
      {/* Seven coils, first centre y 48 and last 252 in a 300-tall book — 48px symmetric margins,
          so at 0.4 that is 19.2 and 100.8 in 120. */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <span key={i} className="nbi-cover-coil" style={{ top: `${19.2 + i * 13.6 - 1.6}px` }} />
      ))}
      <span className="nbi-cover-edges" />
    </div>
  );
}

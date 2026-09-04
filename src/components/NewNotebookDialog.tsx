/**
 * New Notebook — the sheet the shelf raises to make one. Spec: `design/specs/screen-notebooks.md`
 * §7 (`New Notebook — Night` `653:1263` / `— Day` `653:1362`), measured over the live shelf rather
 * than over a flat plate.
 *
 * **NOT `@ui/Dialog`, and this is the one place in the app that says so.** That component is a
 * 420-wide FIXED column: VERTICAL, `align-items: center`, a `--glass-strong` fill, a centred
 * `Title/Toolbar` heading, a body wired through `aria-describedby`, and an action row whose two
 * children are `flex: 1 0 0` so they measure 181 each. §7's sheet is 520 wide and HORIZONTAL — a
 * cover preview beside a left-aligned form — filled `--card` rather than glass, with no heading at
 * all, and an action row MAX-aligned at 72 + 166. Hosting that as `children` would mean overriding
 * the width, the direction, the alignment, the fill and the action row from outside, which is
 * re-authoring every rule in Dialog.css while still inheriting a heading node this sheet has not
 * got. So the shape is built here, and everything that is behaviour rather than shape is copied
 * from it verbatim: the `--scrim` over a 6px blur at z-index 60, focus in on open and back to the
 * opener on close, Escape and Tab handled on the scrim rather than at the window, and dismissal on
 * `mousedown` rather than `click` so a drag that starts inside the panel cannot close it.
 *
 * **`--card`, not glass** (§7): a sheet this size in chrome glass reads muddy and gives text no
 * stable ground — the same refinement onboarding landed on, and the exception CLAUDE.md's rule 1
 * already records for the 1040 x 640 onboarding panel.
 *
 * **`rescale`, never `resize`** (§7 and TRAP 7): `resize` scales geometry and leaves `fontSize`
 * alone, so the cover's title wraps and clips. `transform: scale()` is the CSS analogue — it takes
 * the type with it, and the radius and the inner gap too, which is why the measured preview reports
 * a book radius of 8.775 (13 x 0.675) and an inner gap of 5.4 (8 x 0.675).
 *
 * TWO DEVIATIONS FROM §7's FORM, both because the code contract will not carry what the drawing
 * offers:
 *
 *   1. The seventh sticker tile is **No sticker**, not `browse`. `browse` is the photo route, and
 *      `NbAuthored.sticker` deliberately cannot hold an asset sha (`notebooks.ts`: "Deliberately not
 *      an asset sha"), nor is there a prop here to hand a file to — so that tile would be a control
 *      that does nothing. The slot keeps its 34 x 34 and the row its pitch of 42; what changes is
 *      that the seventh tile clears the sticker, which is the one thing this form otherwise cannot
 *      do once a sticker has been picked.
 *   2. **"Link a subject" is a native `<select>`** styled into the chip, not a popover. Inside a
 *      focus-trapped modal that is the better control by some distance: no second Escape owner
 *      competing with the sheet's, no outside-press listener, no z-index against the panel, and
 *      arrow keys and type-ahead come free for a list that is ten subjects on this machine and could
 *      be twenty. The cost is width — a `<select>`'s intrinsic width is its widest option, so the
 *      chip sits wider than §7's 130; the row is HUG in a 288 column, so nothing else moves. Options
 *      name the subject only, and its code appears where the file puts it: on the cover preview's
 *      `Meta` line, live.
 *
 * The five subject stickers are the student's own subjects, deduped by glyph, rather than five names
 * picked here — §7 measures five tiles and does not say which. Where there are fewer than five (a
 * fresh install, before a catalogue sync) the row fills from §4d's own eight notebooks, in the
 * file's built order.
 */
import './NewNotebookDialog.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import Button from '@ui/Button';
import Field from '@ui/Field';
import NotebookCover, { StickerGlyph } from '@ui/NotebookCover';
import SectionLabel from '@ui/SectionLabel';
import SubjectIcon, { SUBJECT_GLYPH_BY_CODE } from '@ui/icons/SubjectIcon';
import Icon from './Icon';
import {
  COVER_IDS,
  DEFAULT_AUTHORED,
  PAPER_STYLES,
  type CoverId,
  type NbAuthored,
  type NbEntry,
  type PaperStyle,
  type StickerId,
} from '@/lib/notebooks';
import type { Subject } from '@/lib/types';

/** Enough for this sheet's own controls. Copied from Dialog.tsx so the trap behaves identically —
 *  note that `[aria-disabled]` is deliberately still focusable, which is the whole reason the Create
 *  button is inert that way rather than `disabled`. */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** §7 scales the preview instance by this. `237 x 0.675 = 159.98` and `300 x 0.675 = 202.5`, which
 *  is the 160 x 202 box the file measures — the book alone, because a notebook that does not exist
 *  yet has no `edited` line to state. */
const PREVIEW_SCALE = 0.675;

/** §4d names all eight, and a colour-only control needs a text name. */
const COVER_NAMES: Record<CoverId, string> = {
  1: 'Indigo',
  2: 'Teal',
  3: 'Forest',
  4: 'Ochre',
  5: 'Crimson',
  6: 'Slate',
  7: 'Graphite',
  8: 'Rust',
};

/** §6c / §7's four columns, in the file's order. */
const PAPER_LABELS: Record<PaperStyle, string> = {
  blank: 'Blank',
  ruled: 'Ruled',
  grid: 'Grid',
  dotted: 'Dotted',
};

/** The first five stickers §4d's eight notebooks use, with their real syllabus names — the fallback
 *  when the catalogue has not arrived and there are no subjects to offer instead. */
const FALLBACK_STICKERS: { id: string; name: string }[] = [
  { id: 'physics', name: 'Physics' },
  { id: 'biology', name: 'Biology' },
  { id: 'maths', name: 'Mathematics' },
  { id: 'chemistry', name: 'Chemistry' },
  { id: 'accounting', name: 'Accounting' },
];

/**
 * The paper styles, drawn as real miniature pages — which is why §6b records that the four of them
 * "need no new glyphs". Iconic rather than to scale: the spread's own ruling is 22 lines at pitch 26
 * in a 644-tall page (§5c), and at 40px that would be a 1.6px pitch. Five rows and four columns on a
 * 6px lattice inside a 32 x 40 page is the same picture at a size a person can read.
 *
 * The page itself — `--paper` on a hairline, radius 3 — is the CSS box around this; only the ruling
 * is drawn here, in `--page-line`, the mode-invariant 14% the real page rules with.
 */
const MINI_ROWS = [11, 17, 23, 29, 35];
const MINI_COLS = [8, 14, 20, 26];

function PaperMini({ style }: { style: PaperStyle }) {
  if (style === 'blank') return null;
  return (
    <svg className="nnd-mini" viewBox="0 0 32 40" aria-hidden="true">
      {style === 'dotted'
        ? MINI_ROWS.flatMap((y) =>
            MINI_COLS.map((x) => <circle key={`${x}:${y}`} cx={x} cy={y} r={0.7} />),
          )
        : MINI_ROWS.map((y) => <line key={y} x1={5} y1={y} x2={27} y2={y} />)}
      {style === 'grid' &&
        MINI_COLS.map((x) => <line key={`v${x}`} x1={x} y1={8} x2={x} y2={38} />)}
    </svg>
  );
}

export interface Props {
  open: boolean;
  /** The shelf's own list, for "Link a subject". Codes, not ids, are what a notebook stores. */
  subjects: Subject[];
  /** Escape, Cancel, a press on the scrim — and a successful create, which closes through here too
   *  so that one owner decides when the sheet goes. */
  onClose: () => void;
  /** Resolves with the row Rust wrote, or null if the write failed — on null the sheet stays open
   *  holding what was typed, rather than throwing the student's choices away behind a scrim. */
  onCreate: (meta: NbAuthored) => Promise<NbEntry | null>;
}

export default function NewNotebookDialog({ open, subjects, onClose, onCreate }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [meta, setMeta] = useState<NbAuthored>(DEFAULT_AUTHORED);
  const [busy, setBusy] = useState(false);

  const patch = (p: Partial<NbAuthored>) => setMeta((m) => ({ ...m, ...p }));

  /* Reset on every open rather than on mount: the sheet stays mounted between openings, and a
     half-filled form from last time is not what "New notebook" means. The name field takes focus in
     the same pass — §7 draws it `State=Focus` — and the cleanup hands focus back to whatever raised
     the sheet, exactly as Dialog does. */
  useEffect(() => {
    if (!open) return;
    setMeta(DEFAULT_AUTHORED);
    setBusy(false);
    const opener = document.activeElement as HTMLElement | null;
    nameRef.current?.focus();
    return () => opener?.focus?.();
  }, [open]);

  /** Five subject glyphs: the student's own subjects, deduped by glyph, then §4d's own. */
  const stickers = useMemo(() => {
    const out: { id: string; name: string }[] = [];
    const has = (id: string) => out.some((s) => s.id === id);
    for (const s of subjects) {
      if (out.length === 5) break;
      // Padded for the same reason SubjectIcon pads: a three-character code means an IGCSE
      // syllabus lost its leading zero to a numeric round-trip somewhere upstream.
      const glyph = SUBJECT_GLYPH_BY_CODE[s.code.trim().padStart(4, '0')];
      if (glyph && !has(glyph)) out.push({ id: glyph, name: s.name });
    }
    for (const f of FALLBACK_STICKERS) {
      if (out.length === 5) break;
      if (!has(f.id)) out.push(f);
    }
    return out;
  }, [subjects]);

  if (!open) return null;

  const name = meta.name.trim();
  const canCreate = name.length > 0 && !busy;

  const submit = async () => {
    if (!canCreate) return;
    setBusy(true);
    const entry = await onCreate({ ...meta, name });
    // Closed by the same hand that opened it. On a failure the sheet stays put and the typed name
    // with it; `useNotebooks` has already put the reason on the shelf's own Notice.
    if (entry) return onClose();
    setBusy(false);
  };

  /* Escape closes and Tab is held inside, both on the scrim rather than at the window — so this
     sheet can never reach past something above it, and the palette (which captures Escape at the
     window while it is open) still wins when both are up. Verbatim from Dialog.tsx. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (nodes.length === 0) {
      e.preventDefault(); // nothing to move to, and Tab must not walk out of a modal
      return;
    }
    // −1 means focus is on the panel itself, so Shift+Tab wraps to the last control.
    const i = nodes.indexOf(document.activeElement as HTMLElement);
    if (!e.shiftKey && i === nodes.length - 1) {
      e.preventDefault();
      nodes[0]?.focus();
    } else if (e.shiftKey && i <= 0) {
      e.preventDefault();
      nodes[nodes.length - 1]?.focus();
    }
  };

  /* mousedown, not click: a click event fires on the common ancestor of its down and up targets, so
     a drag that starts inside the sheet and ends outside it would otherwise dismiss it. */
  const onScrimMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const stickerTiles: { id: StickerId; name: string }[] = [
    ...stickers,
    { id: 'bell', name: 'Mr. Bell' },
  ];

  return (
    <div className="nnd-scrim" onKeyDown={onKeyDown} onMouseDown={onScrimMouseDown}>
      <div
        ref={panelRef}
        className="nnd-sheet"
        role="dialog"
        aria-modal="true"
        /* §7's sheet has no heading node — the form opens on the name field — so the accessible
           name is stated here rather than pointed at a title that does not exist. */
        aria-label="New notebook"
        tabIndex={-1}
      >
        {/* `preview` 160 x 202 @(24,24). One number drives it: the box reserves the scaled size so
            the row cannot collapse, and the tile inside keeps its own 237 and is scaled onto it. */}
        <div
          className="nnd-preview"
          style={{ '--nnd-scale': PREVIEW_SCALE } as CSSProperties}
          aria-hidden="true"
        >
          <div className="nnd-preview-tile">
            <NotebookCover
              cover={meta.cover}
              name={name}
              meta={meta.subject ? `${meta.subject.name} ${meta.subject.code}` : undefined}
              showSticker={meta.sticker !== null}
              sticker={<StickerGlyph id={meta.sticker} />}
            />
          </div>
        </div>

        {/* `form` 288 x 374 @(208,24) — VERTICAL gap 16, in §7's order. */}
        <div className="nnd-form">
          <Field
            ref={nameRef}
            className="nnd-name"
            value={meta.name}
            onChange={(e) => patch({ name: e.target.value })}
            onKeyDown={(e) => {
              // Enter creates. Guarded on the same condition the button is, so a return on an
              // empty field does nothing rather than writing a nameless notebook.
              if (e.key !== 'Enter') return;
              e.preventDefault();
              void submit();
            }}
            placeholder="Notebook name"
            aria-label="Notebook name"
            maxLength={80}
          />

          <div className="nnd-row">
            <SectionLabel label="Cover" />
            <div className="nnd-covers">
              {COVER_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="nnd-swatch"
                  aria-pressed={meta.cover === id}
                  aria-label={`${COVER_NAMES[id]} cover`}
                  title={`${COVER_NAMES[id]} cover`}
                  onClick={() => patch({ cover: id })}
                >
                  <span
                    className="nnd-swatch-chip"
                    style={{ background: `var(--cover-${id})` }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="nnd-row">
            <SectionLabel label="Sticker" />
            <div className="nnd-stickers">
              {stickerTiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  className="nnd-sticker"
                  aria-pressed={meta.sticker === tile.id}
                  aria-label={`${tile.name} sticker`}
                  title={`${tile.name} sticker`}
                  onClick={() => patch({ sticker: tile.id })}
                >
                  <StickerGlyph id={tile.id} size={22} />
                </button>
              ))}
              {/* The seventh slot — see the deviation note at the top of the file. */}
              <button
                type="button"
                className="nnd-sticker nnd-sticker--none"
                aria-pressed={meta.sticker === null}
                aria-label="No sticker"
                title="No sticker"
                onClick={() => patch({ sticker: null })}
              >
                <Icon name="x" />
              </button>
            </div>
          </div>

          <div className="nnd-row">
            <SectionLabel label="Paper" />
            <div className="nnd-papers">
              {PAPER_STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  className="nnd-paper"
                  aria-pressed={meta.paper === style}
                  onClick={() => patch({ paper: style })}
                >
                  <span className="nnd-page">
                    <PaperMini style={style} />
                  </span>
                  <span className="nnd-paper-label t-body-small">{PAPER_LABELS[style]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* `link a subject` — `Chip` `State=Default, Palette=Neutral`, filled once a subject is
              chosen, which is how §6c draws the same relationship in the inspector. */}
          <span className="nnd-link" data-filled={meta.subject ? '' : undefined}>
            <span className="nnd-link-glyph" aria-hidden="true">
              {meta.subject ? (
                <SubjectIcon code={meta.subject.code} size={18} />
              ) : (
                <Icon name="plus" />
              )}
            </span>
            <select
              className="nnd-link-select t-body-chip"
              aria-label="Link a subject"
              value={meta.subject?.code ?? ''}
              disabled={subjects.length === 0}
              title={
                subjects.length === 0
                  ? 'Sync the catalogue from the top bar to link a subject'
                  : undefined
              }
              onChange={(e) => {
                const picked = subjects.find((s) => s.code === e.target.value);
                patch({ subject: picked ? { code: picked.code, name: picked.name } : null });
              }}
            >
              <option value="">Link a subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </span>

          {/* `actions` — H gap 10, align MAX / CENTER. Centred because Primary is 38 tall and
              Secondary 34: equalising them destroys the intended look (§7, Dialog TRAP 5). */}
          <div className="nnd-actions">
            <Button label="Cancel" onClick={onClose} />
            <Button
              variant="primary"
              label={busy ? 'Creating…' : 'Create notebook'}
              onClick={() => void submit()}
              /* aria-disabled rather than disabled: a real `disabled` drops focus to <body>, where
                 the scrim's key handler can no longer hold Tab inside the modal — the call
                 App.tsx's reset dialog documents. `submit` gates on the same condition. */
              aria-disabled={canCreate ? undefined : 'true'}
              aria-busy={busy ? true : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


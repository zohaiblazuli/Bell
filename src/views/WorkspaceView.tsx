/**
 * The Reader. Spec: `design/specs/screen-reader.md` — §2's layout map (page rail 140, the paper
 * well, tool panel 268), §4's topbar, §5's page rail, §6's paper, §7's tool panel and §8's
 * floating tool bar. `WorkspaceView.css` also carries the CSS for `PaperCanvas` and
 * `MarkSchemeSheet`: both are the Reader's own pieces and are mounted nowhere else.
 *
 * ONE TOP BAR. The bar is `components/TopBar`, filled through its `right` slot. Three things §4
 * asks for cannot be placed from that slot — the back button at x 77, the three-style title group,
 * and the fact that the Reader has no search field — so they are named as outside requests rather
 * than worked around by inlining a second bar.
 *
 * WHAT THE FILE DRAWS AND THE APP CANNOT MEASURE. §7a's `exam timer` card prints `01:12:38`, `of
 * 1h 45m` and `On pace · question 4 of 7`; §7c's rows print a time per question. The app measures
 * exactly one of those — focused seconds per paper — and `FocusTimer` already owns it and banks it
 * to disk, so the timer stays in the bar with the shipped feature instead of being re-mocked as a
 * second card full of invented numbers. The QUESTIONS card *is* built, takes its rows as a prop,
 * and says so when there are none: nothing parses question boundaries out of a paper yet.
 */
import './WorkspaceView.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import Card from '@ui/Card';
import IconButton from '@ui/IconButton';
import Notice from '@ui/Notice';
import SectionLabel from '@ui/SectionLabel';
import type { Tone } from '@ui/TonePill';
import FocusTimer from '../components/FocusTimer';
import Icon, { type IconName } from '../components/Icon';
import MarkSchemeSheet from '../components/MarkSchemeSheet';
import PaperCanvas from '../components/PaperCanvas';
import TopBar from '../components/TopBar';
import { readDocument } from '../lib/api';
import {
  DEFAULT_OPACITY,
  DEFAULT_STROKE,
  INK_SWATCHES,
  STROKE_WIDTHS,
  type InkSettings,
  type Mark,
  type PageInk,
  type StrokeWidth,
  type Tool,
} from '../lib/annotations';
import { sessionLabel } from '../lib/difficulty';
import { openPdf, renderPage } from '../lib/pdf';
import { loadInk, loadPref, paperKey, saveInk, savePref } from '../lib/store';
import type { PaperRow } from '../lib/types';

/** The demo's page is 720 logical pixels wide; zoom multiplies that. */
const BASE_WIDTH = 720;
const ZOOMS = [0.7, 0.85, 1, 1.2, 1.45, 1.75, 2.1];

/** §5's thumbnail sheet is 96 x 136 — and 96 × 1.414 lands on 136, so A4 fills it exactly. */
const THUMB_WIDTH = 96;
/**
 * How far either side of the current page the rail rasterises. pdf.js runs a single worker, so a
 * rail that eagerly rendered forty thumbnails would queue in front of the page being read.
 */
const THUMB_REACH = 5;

/** §8's tool group, in the file's order. */
const TOOLS: { tool: Tool; icon: IconName; label: string }[] = [
  { tool: 'pen', icon: 'pen', label: 'Pen' },
  { tool: 'hl', icon: 'hl', label: 'Highlighter' },
  { tool: 'er', icon: 'eraser', label: 'Eraser' },
];

const toolLabel = (tool: Tool) => TOOLS.find((t) => t.tool === tool)?.label ?? 'Pen';

/** `252` -> `4:12`, the form §7c prints. */
const mmss = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export interface ReaderQuestion {
  /** The label as printed on the paper — `1`, `4`, `4(a)`. */
  label: string;
  /** 1-based page the question starts on, so a row can jump to it. */
  page: number;
  /** Seconds attributed to it. Absent renders §7c's em dash rather than a dishonest zero. */
  seconds?: number;
  /** Answered — this is what lights §7c's check marker. */
  done?: boolean;
}

export interface Props {
  paper: PaperRow;
  onBack: () => void;
  /** Focus mode lives on `.app`, because it also recedes the sidebar. */
  focus: boolean;
  onToggleFocus: () => void;
  /* The shared top bar's own props, passed straight through — see the header note. */
  tone: Tone;
  onTone: () => void;
  /** The library index is rebuilding: the bar's reindex button spins and is disabled. */
  busy: boolean;
  onReindex: () => void;
  onSearch: () => void;
  /**
   * Rows for the QUESTIONS card. Nothing derives question boundaries from a PDF yet, so the app
   * passes nothing and the card renders its empty state; a parser landing later fills this in and
   * the card lights up unchanged.
   */
  questions?: ReaderQuestion[] | null;
}

/** One entry in §5's rail: a `--paper` sheet, the real page drawn into it, and its number. */
function PageThumb({
  doc,
  page,
  active,
  render,
  onSelect,
}: {
  doc: PDFDocumentProxy;
  page: number;
  active: boolean;
  /** False keeps the sheet blank — an honest "not rasterised yet", never mock page furniture. */
  render: boolean;
  onSelect: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLButtonElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (!render || drawn) return;
    const el = canvas.current;
    if (!el) return;
    let cancelled = false;
    void renderPage(doc, page, el, THUMB_WIDTH)
      .then(() => {
        if (!cancelled) setDrawn(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [doc, page, render, drawn]);

  // `nearest`, and no smooth behaviour: paging with the arrow keys should reveal the thumb, not
  // animate the rail past every page in between. It is also the reduced-motion-safe default.
  useEffect(() => {
    if (active) box.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <li>
      <button
        ref={box}
        type="button"
        className="rd-thumb"
        aria-current={active ? 'page' : undefined}
        aria-label={`Page ${page}`}
        onClick={onSelect}
      >
        <span className="rd-thumb-sheet">
          <canvas ref={canvas} className="rd-thumb-canvas" aria-hidden="true" />
        </span>
        <span className="rd-thumb-num t-mono-small">{page}</span>
      </button>
    </li>
  );
}

export default function WorkspaceView({
  paper,
  onBack,
  focus,
  onToggleFocus,
  tone,
  onTone,
  busy,
  onReindex,
  onSearch,
  questions,
}: Props) {
  const id = paperKey(paper.subjectCode, paper.scode, paper.variant);
  const code = `${paper.subjectCode}${paper.variant ? ` /${paper.variant}` : ''}`;
  const session = sessionLabel(paper.scode);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  /**
   * Index into `ZOOMS`, not a factor. 1 (0.85 -> 612px) rather than the 2 the reader shipped with:
   * §2's frame spends 408px on the rail and the tool panel, so at the design's own 1320 width a
   * 720px page would open already overflowing the well sideways.
   */
  const [zoom, setZoom] = useState(1);
  const [msOpen, setMsOpen] = useState(false);
  /** Held back until the page being read has rasterised — see `THUMB_REACH`. */
  const [thumbsLive, setThumbsLive] = useState(false);

  // The tool is never null; `armed` is what "press it again to just read" toggles. Keeping the two
  // apart is what lets the tools card always describe a real tool's ink, even with the pen down.
  const [tool, setTool] = useState<Tool>('hl');
  const [armed, setArmed] = useState(true);

  // Ink settings persist across papers: the colour you write in is yours, not the paper's. All three
  // are plain prefs, so nothing new is needed in the store. Stored values are read key by key
  // rather than spread, so a file written by an older build simply has gaps and gets the defaults.
  const [swatch, setSwatch] = useState(() => loadPref('ink.swatch', INK_SWATCHES[0].token));
  const [stroke, setStroke] = useState<StrokeWidth>(() => loadPref('ink.stroke', DEFAULT_STROKE));
  const [opacity, setOpacity] = useState<Record<Tool, number>>(() => {
    const stored = loadPref<Partial<Record<Tool, number>>>('ink.opacity', {});
    return {
      pen: stored.pen ?? DEFAULT_OPACITY.pen,
      hl: stored.hl ?? DEFAULT_OPACITY.hl,
      er: stored.er ?? DEFAULT_OPACITY.er,
    };
  });

  const [ink, setInk] = useState<PageInk>(() => loadInk<PageInk>(id, {}));
  /** Marks lifted by undo, per page, so redo has something to put back. Never written to disk. */
  const [undone, setUndone] = useState<PageInk>({});

  const well = useRef<HTMLDivElement>(null);

  // --- the paper ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let closer: (() => Promise<void>) | null = null;
    setDoc(null);
    setError(null);
    setPage(1);
    setThumbsLive(false);
    setInk(loadInk<PageInk>(id, {}));
    setUndone({});

    void (async () => {
      if (!paper.qpPath) {
        setError('This sitting has no question paper in the library.');
        return;
      }
      try {
        const opened = await openPdf(new Uint8Array(await readDocument(paper.qpPath)));
        if (cancelled) {
          await opened.close();
          return;
        }
        closer = opened.close;
        setDoc(opened.doc);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();

    return () => {
      cancelled = true;
      if (closer) void closer();
    };
  }, [paper.qpPath, id]);

  const pageCount = doc?.numPages ?? 1;
  const marks = useMemo(() => ink[page] ?? [], [ink, page]);
  const nib = useMemo<InkSettings>(
    () => ({ token: swatch, strokePx: stroke, opacity: opacity[tool] }),
    [swatch, stroke, opacity, tool],
  );

  // --- ink ------------------------------------------------------------------
  // These read `ink` and `undone` straight rather than through an updater callback, because each
  // of them has to touch both: a `setState(prev => …)` updater runs twice under StrictMode, which
  // would push the same lifted mark onto the redo stack twice.
  const commit = useCallback(
    (mark: Mark) => {
      const next = { ...ink, [page]: [...(ink[page] ?? []), mark] };
      saveInk(id, next);
      setInk(next);
      // Drawing again is the end of that redo branch — the standard undo model, and the only one
      // where the button's enabled state cannot lie about what it will put back.
      if (undone[page]?.length) setUndone({ ...undone, [page]: [] });
    },
    [ink, undone, id, page],
  );

  const undo = useCallback(() => {
    const current = ink[page] ?? [];
    if (current.length === 0) return;
    const next = { ...ink, [page]: current.slice(0, -1) };
    saveInk(id, next);
    setInk(next);
    setUndone({ ...undone, [page]: [...(undone[page] ?? []), current[current.length - 1]] });
  }, [ink, undone, id, page]);

  const redo = useCallback(() => {
    const stack = undone[page] ?? [];
    if (stack.length === 0) return;
    const next = { ...ink, [page]: [...(ink[page] ?? []), stack[stack.length - 1]] };
    saveInk(id, next);
    setInk(next);
    setUndone({ ...undone, [page]: stack.slice(0, -1) });
  }, [ink, undone, id, page]);

  const pickSwatch = (token: string) => {
    setSwatch(token);
    savePref('ink.swatch', token);
  };

  const pickStroke = (px: StrokeWidth) => {
    setStroke(px);
    savePref('ink.stroke', px);
  };

  /** The opacity control edits the current tool's value, so picking up a pen is never 45% ink. */
  const pickOpacity = (value: number) => {
    const next: Record<Tool, number> = { pen: opacity.pen, hl: opacity.hl, er: opacity.er };
    next[tool] = value;
    setOpacity(next);
    savePref('ink.opacity', next);
  };

  // --- pages ----------------------------------------------------------------
  const goTo = useCallback(
    (target: number) => {
      setPage(Math.min(pageCount, Math.max(1, target)));
      well.current?.scrollTo({ top: 0 });
    },
    [pageCount],
  );

  const go = useCallback(
    (delta: number) => {
      setPage((p) => Math.min(pageCount, Math.max(1, p + delta)));
      well.current?.scrollTo({ top: 0 });
    },
    [pageCount],
  );

  // --- keyboard -------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The opacity slider is a real range input and owns its own arrow keys.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const mod = e.ctrlKey || e.metaKey;
      if (mod) {
        // Only the history pair is ours. Ctrl-K and the rest belong to App, so anything else with
        // a modifier is left alone rather than swallowed here.
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (key === 'y') {
          e.preventDefault();
          redo();
        }
        return;
      }

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Escape') {
        if (msOpen) setMsOpen(false);
        else if (focus) onToggleFocus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, go, msOpen, focus, onToggleFocus]);

  const width = Math.round(BASE_WIDTH * ZOOMS[zoom]);
  const rows = questions ?? [];
  const answered = rows.filter((q) => q.done).length;
  /** The question you are on: the last one that starts at or before this page. */
  const here = rows.reduce<string | null>((found, q) => (q.page <= page ? q.label : found), null);
  const inkPercent = Math.round(opacity[tool] * 100);

  return (
    <>
      <TopBar
        /* §4's title is three type styles in one row: the subject in Body/Strong, the code in
           Mono/Meta, the session in Body/Small. TopBar takes a node for exactly this. */
        title={
          <span className="rd-ident">
            <span className="rd-ident-name">{paper.subjectName}</span>
            <span className="t-mono-meta rd-ident-code">{code}</span>
            <span className="rd-ident-sep" aria-hidden="true">
              ·
            </span>
            <span className="t-body-small rd-ident-session">{session}</span>
          </span>
        }
        tone={tone}
        onTone={onTone}
        busy={busy}
        onReindex={onReindex}
        onSearch={onSearch}
        /* §4 puts back at x 77, before the title. */
        left={<IconButton icon="left" label="Back to the library" onClick={onBack} />}
        /* The Reader's composition has no search field, and its own controls need the room. */
        showSearch={false}
        right={
          <div className="rd-tbr">
            {/* §4 `docs` `195:20`: word badges, not the `DocBadge` two-glyph box. The mark scheme's
                is the sheet's trigger; the report's states that the library holds one, because
                nothing in the app opens an examiner report yet. */}
            <span className="rd-badges">
              <button
                type="button"
                className="rd-badge t-body-meta"
                aria-pressed={msOpen}
                disabled={!paper.msPath}
                title={paper.msPath ? 'Open the mark scheme' : 'No mark scheme for this sitting'}
                onClick={() => setMsOpen((open) => !open)}
              >
                mark scheme
              </button>
              {paper.erPath && (
                <span className="rd-badge t-body-meta" title="An examiner report is in the library">
                  report
                </span>
              )}
            </span>

            <FocusTimer paper={id} />

            <span className="rd-zoom" role="group" aria-label="Zoom">
              <IconButton
                icon="zout"
                label="Zoom out"
                disabled={zoom === 0}
                onClick={() => setZoom((z) => Math.max(0, z - 1))}
              />
              <span className="rd-zoom-read t-mono-small">{Math.round(ZOOMS[zoom] * 100)}%</span>
              <IconButton
                icon="zin"
                label="Zoom in"
                disabled={zoom === ZOOMS.length - 1}
                onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
              />
            </span>

            <IconButton
              icon="focus"
              label="Focus mode"
              active={focus}
              title="Focus mode — everything but the paper recedes"
              onClick={onToggleFocus}
            />
          </div>
        }
      />

      <section className="view rd" data-ms={msOpen ? 'open' : undefined}>
        {/* §5 page rail `194:732`. The eyebrow is pinned and the thumbs scroll: the file draws five
            pages, the real index hands us as many as the paper has. */}
        <nav className="rd-rail" aria-label="Pages">
          <div className="rd-rail-head t-label-section">Pages</div>
          {doc ? (
            <ol className="rd-thumbs">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <PageThumb
                  /* Keyed by the paper as well as the page: two papers with the same page count
                     would otherwise reuse these components, and a thumb that has already drawn
                     would keep showing the previous paper's page. */
                  key={`${id}-${n}`}
                  doc={doc}
                  page={n}
                  active={n === page}
                  render={thumbsLive && Math.abs(n - page) <= THUMB_REACH}
                  onSelect={() => goTo(n)}
                />
              ))}
            </ol>
          ) : (
            <p className="rd-rail-empty t-body-meta">{error ? 'No pages.' : 'Opening…'}</p>
          )}
        </nav>

        {/* §6 paper `194:741`, centred in the well. The well is the only scroller: the page itself
            is a fixed box, so a zoomed page pans rather than reflowing. */}
        <div className="rd-well" ref={well}>
          <div className="rd-stage">
            {error ? (
              <Notice className="rd-error">{error}</Notice>
            ) : (
              <PaperCanvas
                doc={doc}
                page={page}
                width={width}
                tool={armed ? tool : null}
                ink={nib}
                marks={marks}
                onCommit={commit}
                onRendered={() => setThumbsLive(true)}
              />
            )}
          </div>
        </div>

        {/* §8 `tool bar` `201:30` — one floating pill carrying three groups. The old `.pagepill`
            is absorbed into its third group, which is where the file puts page navigation. The
            wrapper spans the frame and a transform shifts the pill onto the well's centre, so
            focus mode can recentre it without animating a layout property. */}
        <div className="rd-barwrap">
          <div className="rd-bar">
            <div className="rd-bar-grp" role="group" aria-label="Annotation tools">
              {TOOLS.map((t) => (
                <IconButton
                  key={t.tool}
                  icon={t.icon}
                  label={t.label}
                  active={armed && tool === t.tool}
                  title={`${t.label} — press again to just read`}
                  onClick={() => {
                    if (tool === t.tool) setArmed((on) => !on);
                    else {
                      setTool(t.tool);
                      setArmed(true);
                    }
                  }}
                />
              ))}
            </div>

            <span className="rd-bar-sep" aria-hidden="true" />

            <div className="rd-bar-grp" role="group" aria-label="History">
              <IconButton
                icon="ret"
                label="Undo the last mark"
                disabled={(ink[page] ?? []).length === 0}
                onClick={undo}
              />
              {/* Mirrored, the way §8 makes `next page` out of the `left` glyph rotated 180°. */}
              <IconButton
                icon="ret"
                className="rd-flip"
                label="Redo"
                disabled={(undone[page] ?? []).length === 0}
                onClick={redo}
              />
            </div>

            <span className="rd-bar-sep" aria-hidden="true" />

            <div className="rd-bar-grp" role="group" aria-label="Page">
              <IconButton
                icon="left"
                label="Previous page"
                disabled={page === 1}
                onClick={() => go(-1)}
              />
              <span className="rd-bar-count t-mono-small">
                {page} / {pageCount}
              </span>
              <IconButton
                icon="left"
                className="rd-flip"
                label="Next page"
                disabled={page === pageCount}
                onClick={() => go(1)}
              />
            </div>
          </div>
        </div>

        {/* §7 tool panel `194:733` — glass frame, opaque cards. */}
        <aside className="rd-panel">
          {/* §7b `tools` `198:27`. */}
          <Card className="rd-card rd-tools">
            <div className="rd-cardhead">
              <span className="t-label-section">Tools</span>
              <span className="rd-cardhead-gap" />
              <span className="rd-cardhead-meta t-body-meta">
                {armed ? toolLabel(tool) : `${toolLabel(tool)} — off`}
              </span>
            </div>

            {/* §1's six swatches. The value is a token; the literal is frozen into each mark at the
                draw site, which is why an existing stroke never retones or migrates. */}
            <div className="rd-swatches" role="group" aria-label="Ink colour">
              {INK_SWATCHES.map((s) => (
                <button
                  key={s.token}
                  type="button"
                  className="rd-swatch"
                  style={{ background: `var(${s.token})` }}
                  aria-label={s.label}
                  aria-pressed={s.token === swatch}
                  title={s.label}
                  onClick={() => pickSwatch(s.token)}
                />
              ))}
            </div>

            {/* §7b's stroke row. The file draws bare 5 / 8 / 12 px dots; each one here sits in a
                22px button, because a 5px hit target is not operable. */}
            <div className="rd-strokes" role="group" aria-label="Stroke width">
              {STROKE_WIDTHS.map((px) => (
                <button
                  key={px}
                  type="button"
                  className="rd-stroke"
                  aria-label={`${px} px`}
                  aria-pressed={px === stroke}
                  onClick={() => pickStroke(px)}
                >
                  <span className="rd-stroke-dot" style={{ width: px, height: px }} />
                </button>
              ))}
              <span className="rd-strokes-gap" />
              <span className="rd-strokes-read t-mono-small">{stroke} px</span>
            </div>

            {/* §7b's opacity meter, made operable: a range input painted as the measured 4px bar,
                so it keeps arrow keys, Home/End and a real accessible value. */}
            <div className="rd-opacity">
              <span className="rd-opacity-label t-body-meta">Opacity</span>
              <input
                className="rd-opacity-range"
                type="range"
                min={10}
                max={100}
                step={5}
                value={inkPercent}
                aria-label={`${toolLabel(tool)} ink opacity`}
                /* Without this a reader announces the bare number; the visible readout is "45%". */
                aria-valuetext={`${inkPercent}%`}
                style={{
                  background: `linear-gradient(to right, var(--iris-3) 0 ${inkPercent}%, var(--hair) ${inkPercent}% 100%)`,
                }}
                onChange={(e) => pickOpacity(Number(e.target.value) / 100)}
              />
              <span className="rd-opacity-read t-mono-small">{inkPercent}%</span>
            </div>
          </Card>

          {/* §7c `questions` `198:51`. The head's meta is answered-of-total, which is what the
              file's "4 / 7" is counting. */}
          <Card padding={14} className="rd-card rd-questions">
            <SectionLabel
              label="Questions"
              meta={rows.length ? `${answered} / ${rows.length}` : undefined}
              rule={false}
            />
            {rows.length === 0 ? (
              <p className="rd-empty t-body-meta">
                Nothing reads question boundaries out of a question paper yet, so there is no list
                to show. Every page is still here — the rail on the left walks them.
              </p>
            ) : (
              <ol className="rd-qs">
                {rows.map((q) => {
                  const state = q.done ? 'done' : q.label === here ? 'here' : 'todo';
                  const time = q.seconds != null ? mmss(q.seconds) : '—';
                  return (
                    <li key={q.label}>
                      <button
                        type="button"
                        className="rd-q"
                        data-state={state}
                        aria-current={state === 'here' ? 'step' : undefined}
                        /* The marker is the only thing carrying "answered" visually, so the state
                           has to be in the name rather than left to colour and a glyph. */
                        aria-label={`Question ${q.label}, ${
                          state === 'done' ? 'answered' : state === 'here' ? 'current' : 'not started'
                        }${q.seconds != null ? `, ${time}` : ''}`}
                        onClick={() => goTo(q.page)}
                      >
                        <span className="rd-q-label t-mono-small">{q.label}</span>
                        <span className="rd-q-mark" aria-hidden="true">
                          {state === 'done' && <Icon name="check" />}
                        </span>
                        <span className="rd-q-gap" />
                        <span className="rd-q-time t-mono-small">{time}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </aside>

        <MarkSchemeSheet
          path={paper.msPath}
          label={`${code} · ${paper.scode}`}
          open={msOpen}
          onClose={() => setMsOpen(false)}
        />
      </section>
    </>
  );
}

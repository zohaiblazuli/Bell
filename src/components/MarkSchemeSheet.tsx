/**
 * The mark-scheme sheet — glass, because it is chrome sliding over the paper rather than the paper
 * itself (design-system rule 1). Loaded the first time it is opened, then kept.
 *
 * NOT in the Figma Reader composition, and that is deliberate: `design/specs/screen-reader.md`
 * TRAP 10 records that the file ships a `badge mark scheme` chip in the topbar (§4 `195:20`) and a
 * `questions` card instead of a sheet. The badge has since moved to §8's floating tool bar at
 * Zohaib's instruction — a chip that opens half the screen was too quiet for what it does — but the
 * sheet behind it stays, because it reads a real `ms` PDF out of the index and deleting a shipped
 * feature to match a mock is not a port. So it takes its material from the design system's sheet
 * recipe rather than from a measured node: `--glass-strong`, `blur(30px) saturate(170%)`, a
 * `--glass-brd` hairline and the specular inset.
 *
 * THE MARK SCHEME IS A WRITING SURFACE TOO. Its pages are `PaperCanvas`, the same component the
 * Reader draws the question paper with, so the pen and the eraser work here with the same nib, the
 * same colour and the same fraction-of-the-page geometry. The ink is stored under its own key
 * (`<paper>/ms` — see WorkspaceView), never mixed into the question paper's, and `onPage` reports
 * which page the sheet is looking at so the bar's undo acts on the page you can actually see.
 *
 * ZOOM IS THE SHEET'S OWN, and it is a multiple of the width that FITS THE PANE, not of the Reader's
 * 720px reference. 100% therefore means "as wide as the panel", which is the only useful default for
 * a side-by-side pane that is itself only 360–620 wide; the Reader's 100% still means 720px. The two
 * readouts are measured against different things on purpose, and each control sits next to the pane
 * it acts on so there is nothing to mistake.
 *
 * Its CSS lives in `src/views/WorkspaceView.css` with the rest of the Reader.
 */
import { useEffect, useRef, useState } from 'react';
import Notice from '@ui/Notice';
import IconButton from '@ui/IconButton';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import Icon from './Icon';
import PaperCanvas from './PaperCanvas';
import { openPdf } from '../lib/pdf';
import type { InkSettings, Mark, PageInk, Tool } from '../lib/annotations';

/** Zoom steps, as multiples of the fitted width. 1 — index 2 — fills the pane, as it always did. */
const ZOOMS = [0.7, 0.85, 1, 1.25, 1.5, 1.8, 2.2];
const FIT = 2;

/** Below this the pane is too narrow to have been measured yet, or too narrow to draw into at all. */
const MIN_PAGE = 200;

/**
 * The measured pane width is quantised to this before it becomes a render width.
 *
 * `--ms-w` is `clamp(360px, 40%, 620px)`, so dragging the window edge changes it continuously — and
 * every distinct width would otherwise re-rasterise every visible page through pdf.js's single
 * worker. 16px steps make a resize cost at most a handful of re-renders instead of hundreds, and no
 * one can see a page that is 8px narrower than it could be. FLOORED, not rounded: rounding up would
 * make the 100% page a few pixels wider than the pane it is meant to fit and leave a horizontal
 * scrollbar sitting there permanently.
 */
const PANE_STEP = 16;

/**
 * One page, rasterised when it is close to being looked at.
 *
 * Not on mount: a mark scheme runs to twenty-odd pages and pdf.js has a single worker, so mounting
 * them all used to queue twenty renders at once and make the first page wait behind the twentieth.
 * Until a page is near, a blank `--paper` box of the A4 estimate holds its scroll height so nothing
 * jumps as pages render in — the same arrangement `ReaderPage` uses in the well.
 *
 * A failure is reported rather than swallowed. The `.catch(() => {})` this replaces is why a
 * destroyed document showed up as a column of blank sheets instead of an error — see the note on
 * the loader below, and `PaperCanvas`'s `onError`.
 */
function MarkSchemePage({
  doc,
  page,
  width,
  tool,
  ink,
  marks,
  onCommit,
  onError,
}: {
  doc: PDFDocumentProxy;
  page: number;
  width: number;
  tool: Tool | null;
  ink: InkSettings;
  marks: Mark[];
  onCommit: (mark: Mark) => void;
  onError: (message: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(page <= 2);

  useEffect(() => {
    if (near) return;
    const el = box.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      // A screen of slack, so a page is drawn just before it is scrolled to.
      { root: el.closest('.rd-ms-body'), rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  return (
    <div ref={box} className="rd-ms-page" data-page={page}>
      {near ? (
        <PaperCanvas
          doc={doc}
          page={page}
          width={width}
          tool={tool}
          ink={ink}
          marks={marks}
          onCommit={onCommit}
          onError={onError}
        />
      ) : (
        <div className="rd-paper" style={{ width, height: Math.round(width * 1.414) }} />
      )}
    </div>
  );
}

export interface Props {
  /** The mark scheme's path in the index, or null when this paper has none. */
  path: string | null;
  /** e.g. `9709/12 · s24` */
  label: string;
  open: boolean;
  onClose: () => void;
  /**
   * Read the bytes at `path`. A prop rather than a direct `readDocument` call because the Reader hands
   * in a version that re-downloads a file whose `download` row outlived it — the index and the papers
   * live in different places, so a recorded path can dangle, and a mark scheme that will not open is
   * not a reason to show an OS error.
   */
  read: (path: string) => Promise<ArrayBuffer>;
  /** The armed tool, or null for read-only — exactly as the Reader's own pages take it. */
  tool: Tool | null;
  /** Colour, nib and opacity as the tool popover has them set. Frozen into each new mark. */
  ink: InkSettings;
  /** This mark scheme's ink, keyed by page. */
  marks: PageInk;
  onCommit: (page: number, mark: Mark) => void;
  /** The page spanning the pane's midpoint, so undo and redo act on what is on screen. */
  onPage: (page: number) => void;
}

export default function MarkSchemeSheet({
  path,
  label,
  open,
  onClose,
  read,
  tool,
  ink,
  marks,
  onCommit,
  onPage,
}: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(FIT);
  /** The pane's content width, quantised — 0 until the first measurement lands. */
  const [pane, setPane] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  /** Held in a ref so a fresh closure from the parent cannot re-run the loader below. */
  const reader = useRef(read);
  reader.current = read;

  /**
   * Set the first time the sheet is opened, and never cleared.
   *
   * This is what makes the load lazy without making it repeat: the document is fetched on the first
   * open and survives closing the sheet, which is what the header means by "loaded the first time
   * it is opened, then kept".
   */
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!open) return;
    setArmed(true);
    // Clear a failure from a previous visit. A page that could not be drawn last time usually can
    // be this time, and an error banner sitting above freshly rendered pages is worse than none.
    setError(null);
  }, [open]);

  /**
   * Load the document. **`doc` must not be a dependency here.**
   *
   * It used to be, and that was the bug behind a sheet full of blank pages: setting `doc` re-ran
   * this effect, the cleanup destroyed the loading task it had just created, and every subsequent
   * `page.render` failed against a dead document. `numPages` still read off the stale proxy, so the
   * right number of empty sheets appeared and nothing said why. Keyed on the path instead, so the
   * document is torn down when the paper changes or the Reader unmounts — and at no other time.
   */
  useEffect(() => {
    if (!armed || !path) return;
    let closer: (() => Promise<void>) | null = null;
    let cancelled = false;
    setDoc(null);
    setError(null);
    void (async () => {
      try {
        const opened = await openPdf(new Uint8Array(await reader.current(path)));
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
  }, [armed, path]);

  // `contentRect` on a default ResizeObserver is already the CONTENT box, so the sheet's 18px padding
  // is out of it and this is exactly the width a page has to fill.
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setPane(Math.floor(width / PANE_STEP) * PANE_STEP);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The page being read, derived from scroll the way the Reader's well does it: the page whose box
  // spans the pane's vertical midpoint, measured on a rAF so a fast scroll cannot setState per event.
  const report = useRef(onPage);
  report.current = onPage;
  useEffect(() => {
    const el = body.current;
    if (!el || !doc) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const mid = el.getBoundingClientRect().top + el.clientHeight / 2;
      let current = 1;
      el.querySelectorAll<HTMLElement>('.rd-ms-page').forEach((p) => {
        if (p.getBoundingClientRect().top <= mid) current = Number(p.dataset.page);
      });
      report.current(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [doc]);

  const width = Math.max(MIN_PAGE, Math.round(pane * ZOOMS[zoom]));

  return (
    // The sheet stays mounted so its slide is a transform rather than a mount, and the closed
    // state is `visibility: hidden` in CSS — which is what takes the close button out of the tab
    // order. `aria-hidden` alone would leave a focusable control parked off-screen.
    <aside className="rd-ms" data-open={open ? 'true' : undefined} aria-hidden={!open}>
      <div className="rd-ms-head">
        <Icon name="book" className="rd-ms-glyph" />
        <b className="t-title-card">Mark scheme</b>
        <span className="rd-ms-tag t-mono-small">{label}</span>
        <span className="rd-ms-spacer" />
        {/* Its own zoom, because the pane it acts on is not the one the bar's zoom acts on. */}
        <span className="rd-zoom rd-ms-zoom" role="group" aria-label="Mark scheme zoom">
          <IconButton
            icon="zout"
            label="Zoom the mark scheme out"
            disabled={zoom === 0}
            onClick={() => setZoom((z) => Math.max(0, z - 1))}
          />
          <span className="rd-zoom-read t-mono-small">{Math.round(ZOOMS[zoom] * 100)}%</span>
          <IconButton
            icon="zin"
            label="Zoom the mark scheme in"
            disabled={zoom === ZOOMS.length - 1}
            onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
          />
        </span>
        <IconButton icon="x" label="Close the mark scheme" onClick={onClose} />
      </div>
      <div className="rd-ms-body" ref={body}>
        <div className="rd-ms-stage">
          {!path && (
            <p className="rd-ms-empty t-body-default">
              This sitting has no mark scheme in the library.
            </p>
          )}
          {error && <Notice>{error}</Notice>}
          {path && !doc && !error && <p className="rd-ms-empty t-body-default">Opening…</p>}
          {doc &&
            pane > 0 &&
            Array.from({ length: doc.numPages }, (_, i) => i + 1).map((n) => (
              <MarkSchemePage
                key={`${path ?? 'none'}-${n}`}
                doc={doc}
                page={n}
                width={width}
                tool={tool}
                ink={ink}
                marks={marks[n] ?? []}
                onCommit={(mark) => onCommit(n, mark)}
                onError={setError}
              />
            ))}
        </div>
      </div>
    </aside>
  );
}

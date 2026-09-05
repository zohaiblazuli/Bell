/**
 * The mark-scheme sheet — glass, because it is chrome sliding over the paper rather than the paper
 * itself (design-system rule 1). Loaded the first time it is opened, then kept.
 *
 * NOT in the Figma Reader composition, and that is deliberate: `design/specs/screen-reader.md`
 * TRAP 10 records that the file ships a `badge mark scheme` chip in the topbar (§4 `195:20`) and a
 * `questions` card instead of a sheet. The badge is built as the trigger, per the file — but the
 * sheet behind it stays, because it reads a real `ms` PDF out of the index and deleting a shipped
 * feature to match a mock is not a port. So it takes its material from the design system's sheet
 * recipe rather than from a measured node: `--glass-strong`, `blur(30px) saturate(170%)`, a
 * `--glass-brd` hairline and the specular inset.
 *
 * Its CSS lives in `src/views/WorkspaceView.css` with the rest of the Reader.
 */
import { useEffect, useRef, useState } from 'react';
import Notice from '@ui/Notice';
import IconButton from '@ui/IconButton';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import Icon from './Icon';
import { readDocument } from '../lib/api';
import { openPdf, renderPage } from '../lib/pdf';

/** MS pages rasterise at this width and CSS scales them to fill the split pane — see `.rd-ms-page`.
 *  640 is the widest the pane ever gets, so the raster only ever downscales and stays sharp. */
const SHEET_PAGE_WIDTH = 640;

/**
 * One page, rasterised when it is close to being looked at.
 *
 * Not on mount: a mark scheme runs to twenty-odd pages and pdf.js has a single worker, so mounting
 * them all used to queue twenty renders at once and make the first page wait behind the twentieth.
 * The page rail in the Reader solves the same problem with a fixed reach; here an observer is
 * simpler, because the sheet is its own scroller.
 *
 * A failure is reported rather than swallowed. The `.catch(() => {})` this replaces is why a
 * destroyed document showed up as a column of blank sheets instead of an error — see the note on
 * the loader below.
 */
function MarkSchemePage({
  doc,
  page,
  onError,
}: {
  doc: PDFDocumentProxy;
  page: number;
  onError: (message: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(page <= 2);

  useEffect(() => {
    if (near) return;
    const el = canvas.current;
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

  useEffect(() => {
    if (!near) return;
    const el = canvas.current;
    if (!el) return;
    let cancelled = false;
    void renderPage(doc, page, el, SHEET_PAGE_WIDTH).catch((e: unknown) => {
      if (!cancelled) onError(String(e));
    });
    return () => {
      cancelled = true;
    };
  }, [doc, page, near, onError]);

  return <canvas ref={canvas} className="rd-ms-page" />;
}

export interface Props {
  /** The mark scheme's path in the index, or null when this paper has none. */
  path: string | null;
  /** e.g. `9709/12 · s24` */
  label: string;
  open: boolean;
  onClose: () => void;
}

export default function MarkSchemeSheet({ path, label, open, onClose }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        const opened = await openPdf(new Uint8Array(await readDocument(path)));
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
        <IconButton icon="x" label="Close the mark scheme" onClick={onClose} />
      </div>
      <div className="rd-ms-body">
        {!path && (
          <p className="rd-ms-empty t-body-default">
            This sitting has no mark scheme in the library.
          </p>
        )}
        {error && <Notice>{error}</Notice>}
        {path && !doc && !error && <p className="rd-ms-empty t-body-default">Opening…</p>}
        {doc &&
          Array.from({ length: doc.numPages }, (_, i) => (
            <MarkSchemePage key={i + 1} doc={doc} page={i + 1} onError={setError} />
          ))}
      </div>
    </aside>
  );
}

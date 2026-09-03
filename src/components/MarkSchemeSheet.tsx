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

const SHEET_PAGE_WIDTH = 356;

function MarkSchemePage({ doc, page }: { doc: PDFDocumentProxy; page: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (el) void renderPage(doc, page, el, SHEET_PAGE_WIDTH).catch(() => {});
  }, [doc, page]);
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

  useEffect(() => {
    setDoc(null);
    setError(null);
  }, [path]);

  useEffect(() => {
    if (!open || !path || doc) return;
    let closer: (() => Promise<void>) | null = null;
    let cancelled = false;
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
  }, [open, path, doc]);

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
            <MarkSchemePage key={i + 1} doc={doc} page={i + 1} />
          ))}
      </div>
    </aside>
  );
}

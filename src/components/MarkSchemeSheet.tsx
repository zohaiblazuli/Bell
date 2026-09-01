import { useEffect, useRef, useState } from 'react';
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
  return <canvas ref={canvas} className="ms-page" />;
}

interface Props {
  /** The mark scheme's path in the index, or null when this paper has none. */
  path: string | null;
  /** e.g. `9709/12 · s24` */
  label: string;
  open: boolean;
  onClose: () => void;
}

/**
 * The mark-scheme sheet: glass, because it is chrome sliding over the paper rather than the
 * paper itself. Loaded the first time it is opened, then kept.
 */
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
    <aside className="ms" aria-hidden={!open}>
      <div className="ms-head">
        <Icon name="book" style={{ width: 18, height: 18, color: 'var(--accent)' }} />
        <b>Mark scheme</b>
        <span className="tag mono">{label}</span>
        <span className="spacer" />
        <button type="button" className="icobtn" aria-label="Close the mark scheme" onClick={onClose}>
          <Icon name="x" />
        </button>
      </div>
      <div className="ms-body">
        {!path && <p className="ms-empty">This sitting has no mark scheme in the library.</p>}
        {error && <div className="err">{error}</div>}
        {path && !doc && !error && <p className="ms-empty">Opening…</p>}
        {doc &&
          Array.from({ length: doc.numPages }, (_, i) => (
            <MarkSchemePage key={i + 1} doc={doc} page={i + 1} />
          ))}
      </div>
    </aside>
  );
}

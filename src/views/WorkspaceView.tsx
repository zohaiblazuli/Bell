import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import Icon from '../components/Icon';
import FocusTimer from '../components/FocusTimer';
import MarkSchemeSheet from '../components/MarkSchemeSheet';
import PaperCanvas from '../components/PaperCanvas';
import { readDocument } from '../lib/api';
import type { Mark, PageInk, Tool } from '../lib/annotations';
import { openPdf } from '../lib/pdf';
import { loadInk, paperKey, saveInk } from '../lib/store';
import type { PaperRow } from '../lib/types';

/** The demo's page is 720 logical pixels wide; zoom multiplies that. */
const BASE_WIDTH = 720;
const ZOOMS = [0.7, 0.85, 1, 1.2, 1.45, 1.75, 2.1];

interface Props {
  paper: PaperRow;
  onBack: () => void;
  focus: boolean;
  onToggleFocus: () => void;
}

export default function WorkspaceView({ paper, onBack, focus, onToggleFocus }: Props) {
  const id = paperKey(paper.subjectCode, paper.scode, paper.variant);
  const code = `${paper.subjectCode}${paper.variant ? `/${paper.variant}` : ''}`;

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(2);
  const [tool, setTool] = useState<Tool | null>('pen');
  const [ink, setInk] = useState<PageInk>(() => loadInk<PageInk>(id, {}));
  const [msOpen, setMsOpen] = useState(false);
  const body = useRef<HTMLDivElement>(null);

  // --- the paper ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let closer: (() => Promise<void>) | null = null;
    setDoc(null);
    setError(null);
    setPage(1);
    setInk(loadInk<PageInk>(id, {}));

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

  const commit = useCallback(
    (mark: Mark) => {
      setInk((prev) => {
        const next = { ...prev, [page]: [...(prev[page] ?? []), mark] };
        saveInk(id, next);
        return next;
      });
    },
    [id, page],
  );

  const undo = useCallback(() => {
    setInk((prev) => {
      const current = prev[page] ?? [];
      if (current.length === 0) return prev;
      const next = { ...prev, [page]: current.slice(0, -1) };
      saveInk(id, next);
      return next;
    });
  }, [id, page]);

  const go = useCallback(
    (delta: number) => {
      setPage((p) => Math.min(pageCount, Math.max(1, p + delta)));
      body.current?.scrollTo({ top: 0 });
    },
    [pageCount],
  );

  // --- keyboard -------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        go(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        go(-1);
      } else if (e.key === 'Escape') {
        if (msOpen) setMsOpen(false);
        else if (focus) onToggleFocus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, go, msOpen, focus, onToggleFocus]);

  const width = Math.round(BASE_WIDTH * ZOOMS[zoom]);

  return (
    <>
      <div className="topbar" data-tauri-drag-region>
        <div className="tb tb-ws">
          <button type="button" className="btn ws-back" onClick={onBack}>
            <Icon name="left" /> Library
          </button>
          <span className="ws-code mono">{code}</span>
          <span className="ws-name">{paper.subjectName}</span>
          <span className="ws-sess mono">{paper.scode}</span>
          <span className="spacer" />

          <FocusTimer paper={id} />

          <div className="seg" role="group" aria-label="Zoom">
            <button
              type="button"
              aria-label="Zoom out"
              disabled={zoom === 0}
              onClick={() => setZoom((z) => Math.max(0, z - 1))}
            >
              <Icon name="zout" />
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              disabled={zoom === ZOOMS.length - 1}
              onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
            >
              <Icon name="zin" />
            </button>
          </div>

          <div className="tools" role="group" aria-label="Annotation tools">
            {(
              [
                ['pen', 'Pen'],
                ['hl', 'Highlighter'],
                ['er', 'Eraser'],
              ] as [Tool, string][]
            ).map(([t, label]) => (
              <button
                type="button"
                key={t}
                className={`tool${tool === t ? ' on' : ''}`}
                aria-label={label}
                aria-pressed={tool === t}
                title={`${label} — click again to just read`}
                onClick={() => setTool(tool === t ? null : t)}
              >
                <Icon name={t === 'pen' ? 'pen' : t === 'hl' ? 'hl' : 'eraser'} />
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`btn msbtn${msOpen ? ' on' : ''}`}
            onClick={() => setMsOpen((o) => !o)}
            disabled={!paper.msPath}
            title={paper.msPath ? 'Mark scheme' : 'No mark scheme for this sitting'}
          >
            <Icon name="book" /> Mark scheme
          </button>
          <button
            type="button"
            className={`btn${focus ? ' on' : ''}`}
            aria-label="Focus mode"
            aria-pressed={focus}
            title="Focus mode — everything but the paper recedes"
            onClick={onToggleFocus}
          >
            <Icon name="focus" />
          </button>
        </div>
      </div>

      <section className="view view-ws" data-ms={msOpen ? 'open' : 'closed'}>
        <div className="ws-body" ref={body}>
          <div className="paper-wrap">
            {error ? (
              <div className="err" style={{ maxWidth: 460 }}>
                <Icon name="warn" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> {error}
              </div>
            ) : (
              <PaperCanvas
                doc={doc}
                page={page}
                width={width}
                tool={tool}
                marks={marks}
                onCommit={commit}
              />
            )}

            {doc && (
              <div className="pagepill">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={page === 1}
                  onClick={() => go(-1)}
                >
                  <Icon name="left" />
                </button>
                <span className="pg mono">
                  Page {page} / {pageCount}
                </span>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={page === pageCount}
                  onClick={() => go(1)}
                >
                  <Icon name="left" style={{ transform: 'rotate(180deg)' }} />
                </button>
              </div>
            )}
          </div>
        </div>

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

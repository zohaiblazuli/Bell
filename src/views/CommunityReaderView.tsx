import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import Icon, { type IconName } from '../components/Icon';
import IconButton from '@ui/IconButton';
import Notice from '@ui/Notice';
import Slider from '@ui/Slider';
import type { Tone } from '@ui/TonePill';
import FocusTimer from '../components/FocusTimer';
import PaperCanvas from '../components/PaperCanvas';
import ClipPicker from '../components/ClipPicker';
import TopBar from '../components/TopBar';
import NotebookSheet from '../components/NotebookSheet';
import PageJumper from '../components/PageJumper';
import { readCommunityDocument } from '../lib/api';
import { placeImage } from '../lib/clip';
import { pageLabel, type NbEntry } from '../lib/notebooks';
import {
  DEFAULT_OPACITY,
  DEFAULT_STROKE,
  INK_SWATCHES,
  STROKE_MAX,
  STROKE_MIN,
  type InkSettings,
  type Mark,
  type PageInk,
  type StrokeWidth,
  type Tool,
} from '../lib/annotations';
import { openPdf, renderPage } from '../lib/pdf';
import { loadInk, loadPref, saveInk, savePref } from '../lib/store';
import { communityTypeLabel, resourceInkKey, type CommunityResource } from '../lib/community';
import './WorkspaceView.css';
import './CommunityReaderView.css';

const SHOW_FOCUS_TOGGLE = false;
const SHOW_CLIP_TOOL = false;

const BASE_WIDTH = 720;
const ZOOMS = [0.7, 0.85, 1, 1.2, 1.45, 1.75, 2.1];
const THUMB_WIDTH = 96;

const TOOLS: { tool: Tool; icon: IconName; label: string }[] = [
  { tool: 'pen', icon: 'pen', label: 'Pen' },
  { tool: 'hl', icon: 'hl', label: 'Highlighter' },
  { tool: 'er', icon: 'eraser', label: 'Eraser' },
];

function PageThumb({
  doc,
  page,
  active,
  live,
  onSelect,
}: {
  doc: PDFDocumentProxy;
  page: number;
  active: boolean;
  live: boolean;
  onSelect: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLButtonElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [near, setNear] = useState(page <= 6);

  useEffect(() => {
    if (near) return;
    const el = box.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (el.closest('.app-tab-pane')?.getAttribute('data-active') === 'false') return;
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { root: el.closest('.rd-thumbs'), rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  useEffect(() => {
    if (!live || !near || drawn) return;
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
  }, [doc, page, live, near, drawn]);

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

function ReaderPage({
  doc,
  page,
  width,
  tool,
  ink,
  marks,
  onCommit,
  onRendered,
  clipping,
  onClip,
}: {
  doc: PDFDocumentProxy;
  page: number;
  width: number;
  tool: Tool | null;
  ink: InkSettings;
  marks: Mark[];
  onCommit: (mark: Mark) => void;
  onRendered: () => void;
  clipping: boolean;
  onClip: (png: Blob) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(page <= 2);

  useEffect(() => {
    if (near) return;
    const el = box.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (el.closest('.app-tab-pane')?.getAttribute('data-active') === 'false') return;
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      // A screen of slack, so a page rasterises just before it is scrolled to.
      { root: el.closest('.rd-well'), rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  return (
    <div ref={box} className="rd-page" data-page={page}>
      {near ? (
        <PaperCanvas
          doc={doc}
          page={page}
          width={width}
          tool={tool}
          ink={ink}
          marks={marks}
          onCommit={onCommit}
          onRendered={onRendered}
          clipping={clipping}
          onClip={onClip}
        />
      ) : (
        <div className="rd-paper" style={{ width, height: Math.round(width * 1.414) }} />
      )}
    </div>
  );
}

export interface Props {
  resource: CommunityResource;
  onBack: () => void;
  tone: Tone;
  onTone: () => void;
  busy?: boolean;
  onReindex?: () => void;
  onSearch?: () => void;
  focus?: boolean;
  onToggleFocus?: () => void;
  onDownload?: (resource: CommunityResource) => Promise<CommunityResource | null>;
  notebooks?: NbEntry[] | null;
  onNewNotebook?: () => void;
  onOpenNotebook?: (id: string, page: number) => void;
  onRefreshNotebooks?: () => Promise<void> | void;
  readDocument?: (path: string) => Promise<ArrayBuffer>;
  inkKey?: string;
  backLabel?: string;
  startNotebookOpen?: boolean;
}

export default function CommunityReaderView({
  resource,
  onBack,
  tone,
  onTone,
  busy,
  onReindex,
  onSearch,
  focus,
  onToggleFocus,
  onDownload,
  notebooks,
  onNewNotebook,
  onOpenNotebook,
  onRefreshNotebooks,
  readDocument = readCommunityDocument,
  inkKey,
  backLabel = 'Back to Community',
  startNotebookOpen = false,
}: Props) {
  const id = resource.id;
  const key = useMemo(() => inkKey ?? resourceInkKey(resource), [inkKey, resource]);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(2);
  const [thumbsLive, setThumbsLive] = useState(false);
  const [nbOpen, setNbOpen] = useState(startNotebookOpen);
  const DEFAULT_NB_WIDTH = 620;
  const [nbWidth, setNbWidth] = useState<number>(() =>
    loadPref<number>('pref.viewer.nb-width', DEFAULT_NB_WIDTH),
  );
  const [isResizing, setIsResizing] = useState(false);

  const [tool, setTool] = useState<Tool>('pen');
  const [armed, setArmed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const [ink, setInk] = useState<PageInk>(() => loadInk<PageInk>(key, {}));
  const [undone, setUndone] = useState<PageInk>({});

  const [picking, setPicking] = useState(false);
  const [clipTo, setClipTo] = useState<NbEntry | null>(null);
  const [clipped, setClipped] = useState<{ id: string; name: string; page: number } | null>(null);
  const [clipError, setClipError] = useState<string | null>(null);

  const well = useRef<HTMLDivElement>(null);
  const barwrap = useRef<HTMLDivElement>(null);

  const takeClip = useCallback(
    (png: Blob) => {
      const target = clipTo;
      if (!target) return;
      setClipError(null);
      void placeImage(target.id, Math.max(0, target.pages - 1), png)
        .then(({ page: landed }) => setClipped({ id: target.id, name: target.name, page: landed }))
        .catch((e) => setClipError(String(e)));
    },
    [clipTo],
  );

  useEffect(() => {
    let cancelled = false;
    let closer: (() => Promise<void>) | null = null;
    setDoc(null);
    setError(null);
    setFetching(false);
    setPage(1);
    setThumbsLive(false);
    setInk(loadInk<PageInk>(key, {}));
    setUndone({});

    void (async () => {
      let bytes: ArrayBuffer | null = null;

      if (resource.localPath) {
        try {
          bytes = await readDocument(resource.localPath);
        } catch {
          // Path might have outlived the local file
        }
        if (cancelled) return;
      }

      if (!bytes && onDownload) {
        setFetching(true);
        try {
          const fresh = await onDownload(resource);
          if (cancelled) return;
          if (fresh?.localPath) {
            bytes = await readDocument(fresh.localPath);
          }
        } catch (e) {
          if (!cancelled) setError(String(e));
          return;
        } finally {
          if (!cancelled) setFetching(false);
        }
        if (cancelled) return;
      }

      if (!bytes) {
        if (!cancelled) {
          setError(
            resource.localPath
              ? 'This community PDF could not be read. Try downloading it again.'
              : 'This community PDF is not on this machine. Return to the catalogue and download it again.',
          );
        }
        return;
      }

      try {
        const opened = await openPdf(new Uint8Array(bytes));
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
  }, [resource.id, resource.localPath, key, onDownload, readDocument]);

  const pageCount = doc?.numPages ?? 1;

  const nib = useMemo<InkSettings>(
    () => ({
      token: tool === 'hl' ? (swatch === INK_SWATCHES[0].token ? '--d2' : swatch) : swatch,
      strokePx: tool === 'hl' ? Math.max(14, stroke * 2) : stroke,
      opacity: opacity[tool],
    }),
    [swatch, stroke, opacity, tool],
  );

  const commit = useCallback(
    (pageNum: number, mark: Mark) => {
      setInk((current) => {
        const next = { ...current, [pageNum]: [...(current[pageNum] ?? []), mark] };
        saveInk(key, next);
        return next;
      });
      setUndone((current) => {
        if (!current[pageNum]?.length) return current;
        return { ...current, [pageNum]: [] };
      });
    },
    [key],
  );

  const undo = useCallback(() => {
    setInk((current) => {
      const marks = current[page] ?? [];
      if (marks.length === 0) return current;
      const lastMark = marks[marks.length - 1];
      const next = { ...current, [page]: marks.slice(0, -1) };
      saveInk(key, next);
      setUndone((u) => ({
        ...u,
        [page]: [...(u[page] ?? []), lastMark],
      }));
      return next;
    });
  }, [key, page]);

  const redo = useCallback(() => {
    setUndone((current) => {
      const stack = current[page] ?? [];
      if (stack.length === 0) return current;
      const markToRestore = stack[stack.length - 1];
      const nextUndone = { ...current, [page]: stack.slice(0, -1) };
      setInk((inkState) => {
        const nextInk = {
          ...inkState,
          [page]: [...(inkState[page] ?? []), markToRestore],
        };
        saveInk(key, nextInk);
        return nextInk;
      });
      return nextUndone;
    });
  }, [key, page]);

  const pickSwatch = (token: string) => {
    setSwatch(token);
    savePref('ink.swatch', token);
  };

  const pickStroke = (px: StrokeWidth) => {
    setStroke(px);
    savePref('ink.stroke', px);
  };

  const pickOpacity = (value: number) => {
    const next: Record<Tool, number> = { pen: opacity.pen, hl: opacity.hl, er: opacity.er };
    next[tool] = value;
    setOpacity(next);
    savePref('ink.opacity', next);
  };

  const takeTool = (next: Tool) => {
    if (tool === next) {
      const on = !armed;
      setArmed(on);
      setSettingsOpen(on);
      return;
    }
    setTool(next);
    setArmed(true);
    setSettingsOpen(true);
  };

  const goTo = useCallback(
    (target: number) => {
      const el = well.current;
      if (!el) return;
      const n = Math.min(pageCount, Math.max(1, target));
      const node = el.querySelector<HTMLElement>(`.rd-page[data-page="${n}"]`);
      if (!node) return;
      el.scrollTo({
        top: el.scrollTop + node.getBoundingClientRect().top - el.getBoundingClientRect().top - 20,
      });
    },
    [pageCount],
  );

  const go = useCallback((delta: number) => goTo(page + delta), [goTo, page]);

  useEffect(() => {
    const el = well.current;
    if (!el || !doc) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const mid = el.getBoundingClientRect().top + el.clientHeight / 2;
      let current = 1;
      el.querySelectorAll<HTMLElement>('.rd-page').forEach((p) => {
        if (p.getBoundingClientRect().top <= mid) current = Number(p.dataset.page);
      });
      setPage(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [doc]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDown = (e: PointerEvent) => {
      const wrap = barwrap.current;
      if (wrap && !wrap.contains(e.target as Node)) setSettingsOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [settingsOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.target instanceof Element && e.target.closest('.rd-nb')) return;

      const mod = e.ctrlKey || e.metaKey;
      if (mod) {
        const k = e.key.toLowerCase();
        if (k === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        } else if (k === 'y') {
          e.preventDefault();
          redo();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (settingsOpen) setSettingsOpen(false);
        else if (clipTo) {
          setClipTo(null);
          setClipped(null);
        } else if (nbOpen) setNbOpen(false);
        else if (focus && onToggleFocus) onToggleFocus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, focus, onToggleFocus, clipTo, settingsOpen, nbOpen]);

  const width = Math.round(BASE_WIDTH * ZOOMS[zoom]);
  const inkPercent = Math.round(opacity[tool] * 100);
  const toolName = TOOLS.find((t) => t.tool === tool)?.label ?? 'Tool';
  const typeLabel = communityTypeLabel(resource.resourceType);

  return (
    <>
      <TopBar
        title={
          <span className="rd-ident">
            <span className="rd-ident-name">{resource.title}</span>
            <span className="t-mono-meta rd-ident-code">{resource.subjectCode}</span>
            <span className="rd-ident-sep" aria-hidden="true">
              ·
            </span>
            <span className="t-body-small rd-ident-session">{typeLabel}</span>
          </span>
        }
        tone={tone}
        onTone={onTone}
        busy={Boolean(busy)}
        onReindex={onReindex ?? (() => {})}
        onSearch={onSearch ?? (() => {})}
        left={<IconButton icon="left" label={backLabel} onClick={onBack} />}
        showSearch={false}
        center={<FocusTimer paper={resource.id} />}
        right={
          SHOW_FOCUS_TOGGLE || SHOW_CLIP_TOOL ? (
            <div className="rd-tbr">
              {SHOW_FOCUS_TOGGLE && onToggleFocus && (
                <IconButton
                  icon="focus"
                  label="Focus mode"
                  active={focus}
                  title="Focus mode — everything but the document recedes"
                  onClick={onToggleFocus}
                />
              )}
              {SHOW_CLIP_TOOL && (
                <span className="rd-clipwrap">
                  <IconButton
                    icon="clip"
                    label={clipTo ? `Stop clipping to ${clipTo.name}` : 'Clip a region to a notebook'}
                    active={clipTo != null}
                    title={
                      clipTo
                        ? `Drag a box on the page to keep it in ${clipTo.name}`
                        : 'Clip part of this document into a notebook'
                    }
                    onClick={() => {
                      if (clipTo) {
                        setClipTo(null);
                        setClipped(null);
                      } else setPicking((p) => !p);
                    }}
                  />
                  <ClipPicker
                    open={picking}
                    notebooks={notebooks ?? []}
                    loading={notebooks == null}
                    onClose={() => setPicking(false)}
                    onNew={() => {
                      setPicking(false);
                      onNewNotebook?.();
                    }}
                    onPick={(entry) => {
                      setPicking(false);
                      setClipped(null);
                      setClipTo(entry);
                    }}
                  />
                </span>
              )}
            </div>
          ) : undefined
        }
      />

      <section
        className="view rd cr-reader"
        data-nb={nbOpen ? 'open' : undefined}
        data-resizing={isResizing ? 'true' : undefined}
        style={{
          ['--nb-w' as string]: `${nbWidth}px`,
        }}
      >
        <nav className="rd-rail" aria-label="Pages">
          <div className="rd-rail-head t-label-section">Pages</div>
          {doc ? (
            <ol className="rd-thumbs">
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <PageThumb
                  key={`${id}-${n}`}
                  doc={doc}
                  page={n}
                  active={n === page}
                  live={thumbsLive}
                  onSelect={() => goTo(n)}
                />
              ))}
            </ol>
          ) : (
            <p className="rd-rail-empty t-body-meta">
              {error ? 'No pages.' : fetching ? 'Downloading…' : 'Opening…'}
            </p>
          )}
        </nav>

        <div className="rd-well" ref={well}>
          <div className="rd-stage">
            {error ? (
              <Notice className="rd-error">{error}</Notice>
            ) : fetching && !doc ? (
              <div className="rd-loading-stage" role="status" aria-label="Downloading document">
                <div className="rd-loading-card">
                  <div className="rd-loading-icon">
                    <Icon name="book" />
                  </div>
                  <h3 className="rd-loading-title">{resource.title}</h3>
                  <div className="rd-loading-sub">
                    <span className="rd-loading-badge">{resource.subjectCode}</span>
                    <span>Downloading document from community repository…</span>
                  </div>
                  <div className="rd-loading-track">
                    <div className="rd-loading-bar-pulse" />
                  </div>
                </div>
              </div>
            ) : doc ? (
              Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <ReaderPage
                  key={`${id}-${n}`}
                  doc={doc}
                  page={n}
                  width={width}
                  tool={armed ? tool : null}
                  ink={nib}
                  marks={ink[n] ?? []}
                  onCommit={(mark) => commit(n, mark)}
                  onRendered={() => setThumbsLive(true)}
                  clipping={clipTo != null}
                  onClip={takeClip}
                />
              ))
            ) : (
              <div className="rd-loading-stage" role="status" aria-label="Opening document">
                <div className="rd-loading-card">
                  <div className="rd-loading-icon">
                    <Icon name="book" />
                  </div>
                  <h3 className="rd-loading-title">{resource.title}</h3>
                  <div className="rd-loading-sub">
                    <span className="rd-loading-badge">{resource.subjectCode}</span>
                    <span>Opening document & preparing digital ink canvas…</span>
                  </div>
                  <div className="rd-loading-track">
                    <div className="rd-loading-bar-pulse" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {clipTo && (
          <div className="rd-cliphint" role="status">
            <div className="rd-cliphint-pill">
              {clipError ? (
                <span className="rd-cliphint-bad t-body-small">{clipError}</span>
              ) : clipped ? (
                <>
                  <span className="t-body-small">
                    Kept in <strong>{clipped.name}</strong>, page {pageLabel(clipped.page)}
                  </span>
                  {onOpenNotebook && (
                    <button
                      type="button"
                      className="rd-cliphint-go t-body-small"
                      onClick={() => onOpenNotebook(clipped.id, clipped.page)}
                    >
                      Go there
                    </button>
                  )}
                </>
              ) : (
                <span className="t-body-small">
                  Drag a box around what you want to keep in <strong>{clipTo.name}</strong>
                  <span className="rd-cliphint-esc t-body-meta">Esc to stop</span>
                </span>
              )}
            </div>
          </div>
        )}

        <div className="rd-barwrap" ref={barwrap}>
          <div
            className="rd-tool-pop"
            role="group"
            aria-label={`${toolName} settings`}
            data-open={armed && settingsOpen ? 'true' : undefined}
            inert={!(armed && settingsOpen)}
          >
            <div className="rd-tool-pop-head">
              <Icon name={tool === 'er' ? 'eraser' : tool === 'hl' ? 'hl' : 'pen'} className="rd-tool-pop-glyph" />
              <b className="t-body-strong">{toolName}</b>
              <span className="rd-tool-pop-gap" />
              <IconButton
                icon="x"
                label={`Hide the ${toolName.toLowerCase()} settings`}
                title="Hide these controls — the tool stays in your hand"
                onClick={() => setSettingsOpen(false)}
              />
            </div>

            {tool !== 'er' && (
              <>
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
                <div className="rd-pen-preview-box">
                  <span
                    className="rd-pen-preview"
                    style={{
                      width: stroke,
                      height: stroke,
                      background: `var(${swatch})`,
                      opacity: opacity[tool],
                    }}
                    aria-hidden="true"
                  />
                </div>
              </>
            )}

            <div className="rd-pen-row">
              <span className="rd-pen-rowlabel t-body-meta">Size</span>
              <Slider
                value={stroke}
                min={STROKE_MIN}
                max={STROKE_MAX}
                step={1}
                label={`${toolName} size`}
                aria-valuetext={`${stroke} px`}
                onChange={(v) => pickStroke(Math.round(v))}
              />
              <span className="rd-pen-val t-mono-small">{stroke} px</span>
            </div>

            {tool !== 'er' && (
              <div className="rd-pen-row">
                <span className="rd-pen-rowlabel t-body-meta">Opacity</span>
                <Slider
                  value={inkPercent}
                  min={10}
                  max={100}
                  step={5}
                  label={`${toolName} opacity`}
                  aria-valuetext={`${inkPercent}%`}
                  onChange={(v) => pickOpacity(v / 100)}
                />
                <span className="rd-pen-val t-mono-small">{inkPercent}%</span>
              </div>
            )}
          </div>

          <div className="rd-bar">
            <div className="rd-bar-grp" role="group" aria-label="Annotation tools">
              {TOOLS.map((t) => (
                <IconButton
                  key={t.tool}
                  icon={t.icon}
                  label={t.label}
                  active={armed && tool === t.tool}
                  title={`${t.label} — press again to disarm`}
                  onClick={() => takeTool(t.tool)}
                />
              ))}
              <IconButton
                icon="chev"
                className={settingsOpen ? 'rd-caret rd-caret--open' : 'rd-caret'}
                label={settingsOpen ? `Hide the ${toolName.toLowerCase()} settings` : `${toolName} settings`}
                active={armed && settingsOpen}
                disabled={!armed}
                onClick={() => setSettingsOpen((open) => !open)}
              />
            </div>

            <span className="rd-bar-sep" aria-hidden="true" />

            <div className="rd-bar-grp" role="group" aria-label="History">
              <IconButton
                icon="ret"
                label="Undo the last mark"
                disabled={(ink[page] ?? []).length === 0}
                onClick={undo}
              />
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
              <PageJumper
                page={page}
                pageCount={pageCount}
                onJump={goTo}
              />
              <IconButton
                icon="left"
                className="rd-flip"
                label="Next page"
                disabled={page === pageCount}
                onClick={() => go(1)}
              />
            </div>

            <span className="rd-bar-sep" aria-hidden="true" />

            <div className="rd-bar-grp rd-zoom" role="group" aria-label="Zoom">
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
            </div>

            <span className="rd-bar-sep" aria-hidden="true" />

            <button
              type="button"
              className="rd-msbtn rd-nbbtn t-body-strong"
              aria-pressed={nbOpen}
              title={nbOpen ? 'Hide side notebook' : 'Open notebook on the side'}
              onClick={() => setNbOpen((o) => !o)}
            >
              <Icon name="pen" />
              <span>Notebook</span>
            </button>
          </div>
        </div>

        <NotebookSheet
          open={nbOpen}
          onClose={() => setNbOpen(false)}
          notebooks={notebooks ?? []}
          resource={resource}
          onRefreshNotebooks={onRefreshNotebooks}
          onOpenNotebook={onOpenNotebook}
          sheetWidth={nbWidth}
          minWidth={420}
          onResize={setNbWidth}
          onResizeStart={() => setIsResizing(true)}
          resizing={isResizing}
          onResizeEnd={(w) => {
            setIsResizing(false);
            setNbWidth(w);
            savePref('pref.viewer.nb-width', w);
          }}
        />
      </section>
    </>
  );
}

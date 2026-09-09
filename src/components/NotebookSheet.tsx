/**
 * The side notebook sheet for the Community Reader — allows reading a community resource
 * (book, notes, past paper) side-by-side with a synchronized notebook.
 *
 * Supports PDF-style vertical scrolling through all pages of the notebook,
 * a brush/pen/eraser size slider with live preview, palette swatches,
 * and 100% synchronized disk persistence via `useNotebook`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon, { type IconName } from './Icon';
import IconButton from '@ui/IconButton';
import Notice from '@ui/Notice';
import Slider from '@ui/Slider';
import NotebookPage from './NotebookPage';
import SideResizeHandle from './SideResizeHandle';
import { useNotebook } from '../state/useNotebook';
import { StickerGlyph } from '@ui/NotebookCover';
import {
  DEFAULT_AUTHORED,
  nbCreate,
  pageLabel,
  type CoverId,
  type NbEntry,
  type NbInkSettings,
  type NbPage,
  type NbTool,
  type PaperStyle,
} from '../lib/notebooks';
import type { InkCommand, Ruler } from '../lib/ink';
import type { CommunityResource } from '../lib/community';
import '../views/NotebookView.css';

const NO_SELECTION: readonly string[] = Object.freeze([]);

const NB_SWATCHES: { token: string; label: string }[] = [
  { token: '--page-ink', label: 'Ink' },
  { token: '--iris-3', label: 'Blue' },
  { token: '--cover-2', label: 'Indigo' },
  { token: '--cover-3', label: 'Emerald' },
  { token: '--cover-4', label: 'Amber' },
  { token: '--cover-5', label: 'Rose' },
  { token: '--cover-8', label: 'Purple' },
];

const NB_TOOLS: { tool: NbTool; icon: IconName; label: string; title: string }[] = [
  { tool: 'pen', icon: 'pen', label: 'Pen', title: 'Pen — pressure and taper' },
  { tool: 'pencil', icon: 'pencil', label: 'Pencil', title: 'Pencil — textured line' },
  { tool: 'hl', icon: 'hl', label: 'Highlighter', title: 'Highlighter — translucent tint' },
  { tool: 'er', icon: 'eraser', label: 'Eraser', title: 'Eraser' },
  { tool: 'lasso', icon: 'lasso', label: 'Select', title: 'Select — lasso strokes' },
  { tool: 'text', icon: 'text', label: 'Text', title: 'Text — type notes' },
  { tool: 'sticky', icon: 'sticky', label: 'Sticky', title: 'Sticky Note' },
];

/**
 * Single page wrapper for the vertical scroll list.
 * Uses IntersectionObserver to mount backing canvases only when near the viewport,
 * preserving memory while maintaining fixed aspect-ratio layout for smooth scrolling.
 */
function NotebookScrollPage({
  index,
  notebookId,
  paper,
  margin,
  scale,
  tool,
  ink,
  ruler,
  onRuler,
  onCommand,
  selection,
  onSelection,
  page,
  ensurePage,
}: {
  index: number;
  notebookId: string;
  paper: PaperStyle;
  margin: boolean;
  scale: number;
  tool: NbTool;
  ink: NbInkSettings;
  ruler: Ruler | null;
  onRuler: (ruler: Ruler | null) => void;
  onCommand: (command: InkCommand) => void;
  selection: readonly string[];
  onSelection: (ids: string[]) => void;
  page: NbPage;
  ensurePage: (index: number) => Promise<NbPage>;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(index <= 2);

  useEffect(() => {
    if (near) {
      void ensurePage(index);
      return;
    }
    const el = boxRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          void ensurePage(index);
        }
      },
      { root: el.closest('.rd-nb-body'), rootMargin: '800px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ensurePage, index, near]);

  const scaledW = Math.round(580 * scale);
  const scaledH = Math.round(644 * scale);

  return (
    <div
      ref={boxRef}
      className="rd-nb-page-slot"
      data-page-index={index}
      style={{
        width: scaledW,
        height: scaledH,
        ['--nb-page-scale' as string]: scale,
      }}
    >
      <div className="rd-nb-page-badge t-mono-meta">
        Page {pageLabel(index)}
      </div>

      {near ? (
        <NotebookPage
          key={`${notebookId}-${index}`}
          index={index}
          side="l"
          page={page}
          notebook={notebookId}
          paper={paper}
          margin={margin}
          scale={scale}
          tool={tool}
          ink={ink}
          ruler={ruler}
          onRuler={onRuler}
          onCommand={onCommand}
          selection={selection}
          onSelection={onSelection}
        />
      ) : (
        <div className="rd-nb-page-placeholder" aria-hidden="true" />
      )}
    </div>
  );
}

export interface NotebookCompanionContext {
  title: string;
  subjectCode?: string | null;
  subjectName?: string | null;
}

interface PaneSessionProps {
  notebook: NbEntry;
  resource: NotebookCompanionContext | CommunityResource;
  onClose: () => void;
  onOpenNotebook?: (id: string, page: number) => void;
  onSwitchNotebook: () => void;
  dropdown: React.ReactNode;
  resizing: boolean;
}

function NotebookPaneSession({
  notebook,
  onClose,
  onOpenNotebook,
  onSwitchNotebook,
  dropdown,
  resizing,
}: PaneSessionProps) {
  const nb = useNotebook(notebook, 0);
  const [userPages, setUserPages] = useState(0);
  const totalPages = Math.max(nb.pages, userPages, 2);

  const [currentPage, setCurrentPage] = useState(0);
  const [selection, setSelection] = useState<{ page: number; ids: readonly string[] }>({
    page: -1,
    ids: NO_SELECTION,
  });
  const [ruler, setRuler] = useState<Ruler | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const [paneWidth, setPaneWidth] = useState(500);
  const resizingRef = useRef(resizing);
  resizingRef.current = resizing;

  // Measure pane width to dynamically compute scale factor
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0 && !resizingRef.current) setPaneWidth(Math.floor(w));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (resizing) return;
    const width = bodyRef.current?.getBoundingClientRect().width ?? 0;
    if (width > 0) setPaneWidth(Math.floor(width));
  }, [resizing]);

  // Clamped scale so canvas is sharp and fits generously inside the side sheet
  const scale = useMemo(() => {
    const available = Math.max(300, paneWidth - 24);
    return Math.max(0.65, Math.min(2.2, available / 580));
  }, [paneWidth]);

  // Track currently visible page during vertical scrolling
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const slots = el.querySelectorAll<HTMLElement>('.rd-nb-page-slot');
        const bodyTop = el.getBoundingClientRect().top;
        const threshold = bodyTop + el.clientHeight / 3;
        let current = 0;
        slots.forEach((slot) => {
          const rect = slot.getBoundingClientRect();
          if (rect.top <= threshold) {
            const idx = Number(slot.dataset.pageIndex);
            if (!isNaN(idx)) current = idx;
          }
        });
        setCurrentPage(current);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [totalPages]);

  // Scroll to a specific page index
  const scrollToPage = useCallback((idx: number) => {
    const el = bodyRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(`[data-page-index="${idx}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Append a new page and scroll to it
  const handleAddPage = useCallback(() => {
    const next = totalPages + 1;
    setUserPages(next);
    setTimeout(() => {
      scrollToPage(next - 1);
    }, 60);
  }, [scrollToPage, totalPages]);

  const handleOpenFull = useCallback(async () => {
    await nb.flush();
    onOpenNotebook?.(notebook.id, currentPage);
  }, [currentPage, nb, notebook.id, onOpenNotebook]);

  const handleClose = useCallback(async () => {
    await nb.flush();
    onClose();
  }, [nb, onClose]);

  const handleSwitch = useCallback(async () => {
    await nb.flush();
    onSwitchNotebook();
  }, [nb, onSwitchNotebook]);

  // Handle Ctrl+Z / Ctrl+Y within notebook pane
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!(e.target instanceof Element) || !e.target.closest('.rd-nb')) return;

      const mod = e.ctrlKey || e.metaKey;
      if (mod) {
        const k = e.key.toLowerCase();
        if (k === 'z') {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) nb.redo();
          else nb.undo();
        } else if (k === 'y') {
          e.preventDefault();
          e.stopPropagation();
          nb.redo();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nb]);

  const isInk = nb.ink.tool === 'pen' || nb.ink.tool === 'pencil' || nb.ink.tool === 'hl';
  const hasSize = isInk || nb.ink.tool === 'er';

  return (
    <>
      <div className="rd-nb-head">
        <button
          type="button"
          className="rd-nb-btn-switch t-body-small"
          title="Choose a different notebook"
          onClick={handleSwitch}
        >
          <Icon name="left" />
          <span>Switch</span>
        </button>

        {dropdown}

        <div
          className="nbs-save rd-nb-save"
          data-state={nb.saveState}
          role="status"
          title={
            nb.saveState === 'error'
              ? 'Could not save'
              : nb.saveState === 'saving'
                ? 'Saving to disk…'
                : 'Saved on this device'
          }
        >
          <span className="nbs-save-dot" aria-hidden="true" />
          <span className="nbs-save-label">
            {nb.saveState === 'error' ? 'Error' : nb.saveState === 'saving' ? 'Saving…' : 'Saved'}
          </span>
        </div>
        <span className="rd-ms-spacer" />
        {onOpenNotebook && (
          <IconButton
            icon="clip"
            label="Open full notebook"
            title="Open in full notebook view"
            onClick={handleOpenFull}
          />
        )}
        <IconButton icon="x" label="Close notebook" onClick={handleClose} />
      </div>

      <div className="rd-nb-toolbar">
        <div className="rd-nb-tools-row">
          <div className="rd-nb-tools" role="group" aria-label="Notebook tools">
            {NB_TOOLS.map((t) => (
              <IconButton
                key={t.tool}
                icon={t.icon}
                label={t.label}
                title={t.title}
                active={nb.ink.tool === t.tool}
                onClick={() => nb.patchInk({ tool: t.tool })}
              />
            ))}
            <span className="rd-nb-sep" aria-hidden="true" />
            <IconButton
              icon="ret"
              label="Undo stroke"
              disabled={!nb.canUndo}
              onClick={nb.undo}
            />
            <IconButton
              icon="redo"
              label="Redo stroke"
              disabled={!nb.canRedo}
              onClick={nb.redo}
            />
          </div>

          <div className="rd-nb-pagenav" role="group" aria-label="Page navigation">
            <IconButton
              icon="chev"
              className="rd-nb-chev-up"
              label="Scroll to previous page"
              disabled={currentPage === 0}
              onClick={() => scrollToPage(currentPage - 1)}
            />
            <span className="rd-nb-page-read t-mono-small">
              p. {pageLabel(currentPage)} / {totalPages}
            </span>
            <IconButton
              icon="chev"
              label="Scroll to next page"
              disabled={currentPage >= totalPages - 1}
              onClick={() => scrollToPage(currentPage + 1)}
            />
            <button
              type="button"
              className="rd-nb-btn-addpage t-mono-small"
              title="Add a new page at the bottom"
              onClick={handleAddPage}
            >
              + Page
            </button>
          </div>
        </div>

        {hasSize && (
          <div className="rd-nb-subrow">
            {isInk && (
              <div className="rd-nb-swatches" role="group" aria-label="Ink color">
                {NB_SWATCHES.map((s) => (
                  <button
                    key={s.token}
                    type="button"
                    className="rd-nb-swatch"
                    style={{ background: `var(${s.token})` }}
                    aria-pressed={nb.ink.colour === s.token}
                    title={s.label}
                    onClick={() => nb.patchInk({ colour: s.token })}
                  />
                ))}
              </div>
            )}

            <div className="rd-nb-size-ctrl">
              <div
                className="rd-nb-preview-wrap"
                title={`Size preview: ${nb.ink.strokePx}px`}
              >
                <span
                  className="rd-nb-preview-circle"
                  style={{
                    width: Math.max(2, Math.min(nb.ink.strokePx, 24)),
                    height: Math.max(2, Math.min(nb.ink.strokePx, 24)),
                    background:
                      nb.ink.tool === 'er'
                        ? 'var(--ink-2)'
                        : `var(${nb.ink.colour})`,
                    opacity: nb.ink.tool === 'hl' ? 0.45 : (nb.ink.opacity ?? 1),
                  }}
                  aria-hidden="true"
                />
              </div>
              <Slider
                value={nb.ink.strokePx}
                min={1}
                max={40}
                step={1}
                label="Size"
                aria-valuetext={`${nb.ink.strokePx} px`}
                onChange={(v) => nb.patchInk({ strokePx: Math.round(v) })}
              />
              <span className="rd-nb-size-val t-mono-small">{nb.ink.strokePx}px</span>
            </div>
          </div>
        )}
      </div>

      <div className="rd-nb-body" ref={bodyRef}>
        <div className="rd-nb-stage">
          {Array.from({ length: totalPages }, (_, i) => i).map((idx) => (
            <NotebookScrollPage
              key={`${notebook.id}-${idx}`}
              index={idx}
              notebookId={notebook.id}
              paper={notebook.paper ?? 'ruled'}
              margin={notebook.margin ?? true}
              scale={scale}
              tool={nb.ink.tool}
              ink={nb.ink}
              ruler={ruler}
              onRuler={setRuler}
              onCommand={nb.commit}
              selection={selection.page === idx ? selection.ids : NO_SELECTION}
              onSelection={(ids) => setSelection({ page: idx, ids })}
              page={nb.page(idx)}
              ensurePage={nb.ensure}
            />
          ))}

          <button
            type="button"
            className="rd-nb-addpage-card t-body-small"
            onClick={handleAddPage}
          >
            <Icon name="plus" />
            <span>Add Page {pageLabel(totalPages)}</span>
          </button>
        </div>
      </div>
    </>
  );
}

export interface NotebookSheetProps {
  open: boolean;
  onClose: () => void;
  notebooks: NbEntry[];
  resource: NotebookCompanionContext | CommunityResource;
  onRefreshNotebooks?: () => Promise<void> | void;
  onOpenNotebook?: (id: string, page: number) => void;
  /** Current panel width in pixels, if controlled */
  sheetWidth?: number;
  /** Minimum panel width (defaults to 420) */
  minWidth?: number;
  /** Callback fired while user is dragging the resize handle */
  onResize?: (width: number) => void;
  /** Callback fired when drag starts */
  onResizeStart?: () => void;
  /** Callback fired when drag ends */
  onResizeEnd?: (width: number) => void;
  resizing?: boolean;
}

export default function NotebookSheet({
  open,
  onClose,
  notebooks,
  resource,
  onRefreshNotebooks,
  onOpenNotebook,
  sheetWidth,
  minWidth,
  onResize,
  onResizeStart,
  onResizeEnd,
  resizing = false,
}: NotebookSheetProps) {
  // Initially null so the user is asked which notebook they want to open first
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');

  const suggestedCover: CoverId = useMemo(() => {
    if (!resource.subjectCode) return 2;
    const num = resource.subjectCode.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return (((num % 8) + 1) as CoverId);
  }, [resource.subjectCode]);

  const handleCreateCompanion = useCallback(async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const companionName = resource.subjectName
        ? `Notes · ${resource.subjectName}`
        : `Notes · ${resource.title}`.slice(0, 80);
      const created = await nbCreate({
        ...DEFAULT_AUTHORED,
        name: companionName,
        cover: suggestedCover,
        subject: resource.subjectCode
          ? { name: resource.subjectName || resource.subjectCode, code: resource.subjectCode }
          : null,
      });
      await onRefreshNotebooks?.();
      setSelectedId(created.id);
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  }, [onRefreshNotebooks, resource, suggestedCover]);

  const handleCreateBlank = useCallback(async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const created = await nbCreate({
        ...DEFAULT_AUTHORED,
        name: 'Untitled Notebook',
        cover: 1,
        subject: null,
      });
      await onRefreshNotebooks?.();
      setSelectedId(created.id);
    } catch (e) {
      setCreateError(String(e));
    } finally {
      setCreating(false);
    }
  }, [onRefreshNotebooks]);

  const selectedNotebook = useMemo(() => {
    return notebooks.find((n) => n.id === selectedId) ?? null;
  }, [notebooks, selectedId]);

  const filteredNotebooks = useMemo(() => {
    let list = notebooks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          (n.subject &&
            (n.subject.name.toLowerCase().includes(q) || n.subject.code.toLowerCase().includes(q))),
      );
    }
    return list;
  }, [notebooks, searchQuery]);

  const { matchingSubject, otherNotebooks } = useMemo(() => {
    if (!resource.subjectCode) {
      return { matchingSubject: [], otherNotebooks: filteredNotebooks };
    }
    const matching: NbEntry[] = [];
    const other: NbEntry[] = [];
    for (const n of filteredNotebooks) {
      if (n.subject?.code === resource.subjectCode) {
        matching.push(n);
      } else {
        other.push(n);
      }
    }
    return { matchingSubject: matching, otherNotebooks: other };
  }, [filteredNotebooks, resource.subjectCode]);

  const formatEdited = (timestamp: number): string => {
    if (!timestamp) return 'Recently';
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const dropdown = (
    <div className="rd-nb-select-wrap">
      <select
        className="rd-nb-select t-body-small"
        value={selectedId ?? ''}
        onChange={(e) => {
          if (e.target.value === '__switch__') {
            setSelectedId(null);
          } else if (e.target.value === '__new__') {
            void handleCreateCompanion();
          } else {
            setSelectedId(e.target.value);
          }
        }}
        aria-label="Select notebook"
      >
        <option value="__switch__">← Choose notebook…</option>
        {notebooks.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name} ({n.pages} {n.pages === 1 ? 'page' : 'pages'})
          </option>
        ))}
        <option value="__new__">+ Create new companion…</option>
      </select>
    </div>
  );

  const renderGridTile = (n: NbEntry) => (
    <button
      key={n.id}
      type="button"
      className="rd-nb-tile"
      onClick={() => setSelectedId(n.id)}
      aria-label={`Open notebook ${n.name}`}
    >
      <div
        className="rd-nb-tile-book"
        style={{ background: `var(--cover-${n.cover})` }}
      >
        <div className="rd-nb-tile-spine" aria-hidden="true" />
        <svg className="rd-nb-tile-rings" viewBox="0 0 10 90" aria-hidden="true">
          <circle cx="5" cy="12" r="3" />
          <circle cx="5" cy="27" r="3" />
          <circle cx="5" cy="42" r="3" />
          <circle cx="5" cy="57" r="3" />
          <circle cx="5" cy="72" r="3" />
          <circle cx="5" cy="87" r="3" />
        </svg>
        <div className="rd-nb-tile-edges" aria-hidden="true">
          <span />
          <span />
        </div>

        <div className="rd-nb-tile-sticker">
          {n.sticker ? (
            <StickerGlyph id={n.sticker} size={20} />
          ) : (
            <Icon name="pen" />
          )}
        </div>

        <div className="rd-nb-tile-badge">
          <span>{n.pages} {n.pages === 1 ? 'page' : 'pages'}</span>
        </div>
      </div>

      <div className="rd-nb-tile-info">
        <span className="rd-nb-tile-name" title={n.name}>{n.name}</span>
        <span className="rd-nb-tile-meta">
          {n.subject ? (
            <span className="rd-nb-tile-subject">{n.subject.code}</span>
          ) : (
            <span>General</span>
          )}
          <span className="rd-nb-tile-dot">·</span>
          <span>{formatEdited(n.updatedAt)}</span>
        </span>
      </div>
    </button>
  );

  const renderListRow = (n: NbEntry) => (
    <button
      key={n.id}
      type="button"
      className="rd-nb-item"
      onClick={() => setSelectedId(n.id)}
      aria-label={`Open notebook ${n.name}`}
    >
      <div
        className="rd-nb-item-cover"
        style={{ background: `var(--cover-${n.cover})` }}
        aria-hidden="true"
      >
        <div className="rd-nb-item-cover-spine" />
      </div>
      <div className="rd-nb-item-info">
        <div className="rd-nb-item-name">{n.name}</div>
        <div className="rd-nb-item-meta">
          {n.subject && <span className="rd-nb-tag">{n.subject.name || n.subject.code}</span>}
          <span>{n.pages} {n.pages === 1 ? 'page' : 'pages'}</span>
          <span className="rd-nb-tile-dot">·</span>
          <span>{formatEdited(n.updatedAt)}</span>
        </div>
      </div>
      <Icon name="right" className="rd-nb-item-arrow" />
    </button>
  );

  return (
    <aside
      className="rd-nb"
      data-open={open ? 'true' : undefined}
      aria-hidden={!open}
      inert={!open}
    >
      {open && onResize && (
        <SideResizeHandle
          currentWidth={sheetWidth ?? 620}
          minWidth={minWidth ?? 420}
          defaultWidth={620}
          onResize={onResize}
          onResizeStart={onResizeStart}
          onResizeEnd={onResizeEnd}
          label="Resize side notebook"
        />
      )}
      {createError && <Notice>{createError}</Notice>}

      {selectedNotebook ? (
        <NotebookPaneSession
          key={selectedNotebook.id}
          notebook={selectedNotebook}
          resource={resource}
          onClose={onClose}
          onOpenNotebook={onOpenNotebook}
          onSwitchNotebook={() => setSelectedId(null)}
          dropdown={dropdown}
          resizing={resizing}
        />
      ) : (
        <div className="rd-nb-picker-container">
          <div className="rd-nb-head">
            <Icon name="pen" className="rd-ms-glyph" />
            <b className="t-title-card">Open Notebook</b>
            <span className="rd-ms-spacer" />
            <IconButton icon="x" label="Close notebook" onClick={onClose} />
          </div>

          <div className="rd-nb-picker">
            {/* Hero Companion Card */}
            <div className="rd-nb-companion-card">
              <div className="rd-nb-companion-glow" aria-hidden="true" />

              <div className="rd-nb-companion-left">
                <div className="rd-nb-companion-pill">
                  <Icon name="checkc" />
                  <span>STUDY COMPANION</span>
                </div>
                <h3 className="rd-nb-companion-title">
                  {resource.subjectName ? `${resource.subjectName} Notes` : 'Companion Notebook'}
                </h3>
                <p className="rd-nb-companion-desc">
                  Dedicated notebook linked to <strong>{resource.subjectName || resource.subjectCode || resource.title}</strong>. Synchronized with your library.
                </p>
                <button
                  type="button"
                  className="rd-nb-companion-btn"
                  disabled={creating}
                  onClick={handleCreateCompanion}
                >
                  <Icon name="plus" />
                  <span>{creating ? 'Creating…' : 'Create & Open Companion'}</span>
                </button>
              </div>

              <div className="rd-nb-companion-right" aria-hidden="true">
                <div
                  className="rd-nb-mini-book"
                  style={{ background: `var(--cover-${suggestedCover})` }}
                >
                  <div className="rd-nb-mini-spine" />
                  <svg className="rd-nb-mini-coils" viewBox="0 0 10 70">
                    <circle cx="5" cy="11" r="3.2" />
                    <circle cx="5" cy="23" r="3.2" />
                    <circle cx="5" cy="35" r="3.2" />
                    <circle cx="5" cy="47" r="3.2" />
                    <circle cx="5" cy="59" r="3.2" />
                  </svg>
                  <div className="rd-nb-mini-edges">
                    <span />
                    <span />
                  </div>
                  <div className="rd-nb-mini-sticker">
                    <Icon name="pen" />
                  </div>
                  <div className="rd-nb-mini-label">
                    {resource.subjectCode || 'Notes'}
                  </div>
                </div>
              </div>
            </div>

            {/* Search & Layout Controls (when user has multiple notebooks) */}
            {notebooks.length > 2 && (
              <div className="rd-nb-controls">
                <div className="rd-nb-search-wrap">
                  <Icon name="search" />
                  <input
                    type="text"
                    placeholder="Search notebooks…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search notebooks"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="rd-nb-search-clear"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                    >
                      <Icon name="x" />
                    </button>
                  )}
                </div>
                <div className="rd-nb-view-toggle" role="group" aria-label="Layout view">
                  <button
                    type="button"
                    className={`rd-nb-toggle-btn ${layout === 'grid' ? 'active' : ''}`}
                    onClick={() => setLayout('grid')}
                    title="Grid view"
                    aria-pressed={layout === 'grid'}
                  >
                    <Icon name="grid" />
                  </button>
                  <button
                    type="button"
                    className={`rd-nb-toggle-btn ${layout === 'list' ? 'active' : ''}`}
                    onClick={() => setLayout('list')}
                    title="List view"
                    aria-pressed={layout === 'list'}
                  >
                    <Icon name="list" />
                  </button>
                </div>
              </div>
            )}

            {/* Matching Subject Section */}
            {matchingSubject.length > 0 && (
              <div className="rd-nb-section">
                <div className="rd-nb-section-header">
                  <span className="rd-nb-section-title">
                    Matching Subject ({resource.subjectCode})
                  </span>
                  <span className="rd-nb-section-badge">{matchingSubject.length}</span>
                </div>

                {layout === 'grid' ? (
                  <div className="rd-nb-grid">
                    {matchingSubject.map((n) => renderGridTile(n))}
                  </div>
                ) : (
                  <div className="rd-nb-list">
                    {matchingSubject.map((n) => renderListRow(n))}
                  </div>
                )}
              </div>
            )}

            {/* All / Other Notebooks Section */}
            <div className="rd-nb-section">
              <div className="rd-nb-section-header">
                <span className="rd-nb-section-title">
                  {matchingSubject.length > 0
                    ? `Other Notebooks (${otherNotebooks.length})`
                    : `All Notebooks (${filteredNotebooks.length})`}
                </span>
              </div>

              {filteredNotebooks.length === 0 && searchQuery ? (
                <div className="rd-nb-empty-search">
                  <p>No notebooks match "{searchQuery}"</p>
                  <button
                    type="button"
                    className="rd-nb-btn-subtle"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear filter
                  </button>
                </div>
              ) : layout === 'grid' ? (
                <div className="rd-nb-grid">
                  {/* + New Blank Notebook Tile */}
                  <button
                    type="button"
                    className="rd-nb-tile rd-nb-tile-create"
                    onClick={handleCreateBlank}
                    disabled={creating}
                    aria-label="Create new blank notebook"
                  >
                    <div className="rd-nb-tile-book rd-nb-tile-dashed">
                      <div className="rd-nb-tile-spine rd-nb-tile-spine-dashed" />
                      <div className="rd-nb-tile-plus-center">
                        <Icon name="plus" />
                        <span>Blank</span>
                      </div>
                    </div>
                    <div className="rd-nb-tile-info">
                      <span className="rd-nb-tile-name">+ New Notebook</span>
                      <span className="rd-nb-tile-meta">Blank notebook</span>
                    </div>
                  </button>

                  {otherNotebooks.map((n) => renderGridTile(n))}
                </div>
              ) : (
                <div className="rd-nb-list">
                  {otherNotebooks.map((n) => renderListRow(n))}
                </div>
              )}
            </div>

            {/* Study Tips & Guide card to eliminate empty void when notebooks are few */}
            {notebooks.length <= 2 && (
              <div className="rd-nb-tips">
                <div className="rd-nb-tips-head">
                  <Icon name="book" />
                  <span>Split-Screen Study Mode</span>
                </div>
                <div className="rd-nb-tips-grid">
                  <div className="rd-nb-tip-item">
                    <div className="rd-nb-tip-icon">
                      <Icon name="doc" />
                    </div>
                    <div>
                      <strong>Dual Reading & Writing</strong>
                      <p>Read your Cambridge resource on the left while taking revision notes side-by-side on the right.</p>
                    </div>
                  </div>
                  <div className="rd-nb-tip-item">
                    <div className="rd-nb-tip-icon">
                      <Icon name="pen" />
                    </div>
                    <div>
                      <strong>Stylus, Highlighter & Eraser</strong>
                      <p>Full digital ink with thickness sliders, eraser, and instant undo/redo with Ctrl+Z.</p>
                    </div>
                  </div>
                  <div className="rd-nb-tip-item">
                    <div className="rd-nb-tip-icon">
                      <Icon name="sync" />
                    </div>
                    <div>
                      <strong>Synced Everywhere</strong>
                      <p>All notes taken here are stored locally and accessible anytime from the main Notebooks library.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

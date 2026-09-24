/**
 * Workspace — the student's own PDFs, imported onto this machine (Bell App v2, Shape Kit).
 *
 * Composed from the shelves around it rather than drawn fresh: the Notebooks head (a big title, a
 * one-line count, the layout toggle and one primary action), Past Papers' filter bar (a framed search
 * and a joined sort toggle whose chosen segment inverts to ink), and Paper Card's frame, hover lift
 * and footer. Each card shows the document's first page on a paper sheet that bleeds off the foot of
 * its well, as Community's carousel does — the document earns trust, not the chrome.
 *
 * The list layout is Recent's ruled list. Empty, it is Hush sighing beside one Import button.
 * Dropping PDFs anywhere on the view imports them.
 */
import { useMemo, useState, type CSSProperties, type DragEvent } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import Icon from '@/components/Icon';
import Button from '@ui/Button';
import Dialog from '@ui/Dialog';
import Notice from '@ui/Notice';
import PdfThumbnail from '@/components/PdfThumbnail';
import Mascot from '@/components/Mascot';
import type { WorkspaceDocument } from '@/lib/workspace';
import { useWorkspace } from '@/state/useWorkspace';
import './LocalWorkspaceView.css';

interface Props {
  workspace: ReturnType<typeof useWorkspace>;
  onOpen: (document: WorkspaceDocument, notebook?: boolean) => void;
}

type ViewMode = 'grid' | 'list';
type SortKey = 'recent' | 'imported' | 'name' | 'size';

const SORTS: { key: SortKey; label: string; title: string }[] = [
  { key: 'recent', label: 'Recent', title: 'Most recently opened first' },
  { key: 'imported', label: 'Added', title: 'Most recently imported first' },
  { key: 'name', label: 'A–Z', title: 'By title' },
  { key: 'size', label: 'Size', title: 'Largest first' },
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const shortDate = (at: number) => new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  }
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

function timeAgo(at: number | null): string {
  if (!at) return 'never';
  const diff = Date.now() - at;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function LocalWorkspaceView({ workspace, onOpen }: Props) {
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [importing, setImporting] = useState(false);
  const [confirmDoc, setConfirmDoc] = useState<WorkspaceDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Filter & Sort documents
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let docs = needle
      ? workspace.documents.filter((doc) =>
          `${doc.title} ${doc.originalName}`.toLowerCase().includes(needle),
        )
      : [...workspace.documents];

    docs.sort((a, b) => {
      switch (sortKey) {
        case 'recent': {
          const aTime = a.lastOpenedAt ?? a.importedAt;
          const bTime = b.lastOpenedAt ?? b.importedAt;
          return bTime - aTime;
        }
        case 'imported':
          return b.importedAt - a.importedAt;
        case 'name':
          return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
        case 'size':
          return b.size - a.size;
        default:
          return 0;
      }
    });

    return docs;
  }, [query, sortKey, workspace.documents]);

  // Overall metrics
  const totalBytes = useMemo(
    () => workspace.documents.reduce((sum, d) => sum + d.size, 0),
    [workspace.documents],
  );

  const handlePickFiles = async () => {
    try {
      const selected = await openDialog({
        multiple: true,
        filters: [{ name: 'PDF documents', extensions: ['pdf'] }],
      });

      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      if (paths.length === 0) return;

      setImporting(true);
      workspace.setError(null);
      await workspace.importDocuments(paths);
    } catch (reason) {
      workspace.setError(String(reason));
    } finally {
      setImporting(false);
    }
  };

  const runDelete = async () => {
    if (!confirmDoc || deleting) return;
    setDeleting(true);
    try {
      await workspace.remove(confirmDoc.id);
    } catch (reason) {
      workspace.setError(String(reason));
    } finally {
      setDeleting(false);
      setConfirmDoc(null);
    }
  };

  // Drag and drop handlers
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Moving between the view's own children fires leave too; only leaving the view ends the drag.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDragOver(false);
  };

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    );

    const paths: string[] = [];
    for (const file of pdfFiles) {
      const filePath = (file as unknown as { path?: string }).path;
      if (filePath) paths.push(filePath);
    }

    if (paths.length > 0) {
      setImporting(true);
      workspace.setError(null);
      try {
        await workspace.importDocuments(paths);
      } catch (reason) {
        workspace.setError(String(reason));
      } finally {
        setImporting(false);
      }
    }
  };

  const total = workspace.documents.length;
  const busyLabel = importing ? 'Importing…' : 'Import PDFs';
  const pick = () => void handlePickFiles();

  const actions = (doc: WorkspaceDocument, row = false) => (
    <div className={row ? 'lw-row-actions' : 'lw-card-actions'}>
      <button type="button" className="lw-read" onClick={() => onOpen(doc)} title={`Read “${doc.title}”`}>
        Read
        <i aria-hidden="true" />
      </button>
      <button
        type="button"
        className="lw-icon-btn"
        onClick={() => onOpen(doc, true)}
        title="Read beside a notebook"
        aria-label={`Read ${doc.title} beside a notebook`}
      >
        <Icon name="notebook" />
      </button>
      <button
        type="button"
        className="lw-icon-btn lw-icon-btn--danger"
        onClick={() => setConfirmDoc(doc)}
        title="Remove from Workspace"
        aria-label={`Remove ${doc.title} from Workspace`}
      >
        <Icon name="trash" />
      </button>
    </div>
  );

  return (
    <>
      <div
        className="view"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(e) => void onDrop(e)}
      >
        <div className="lw">
          <header className="lw-head">
            <div className="lw-greeting">
              <h2 className="lw-title">Your workspace</h2>
              <p className="lw-subline">
                {plural(total, 'document')}
                {total > 0 && ` · ${formatBytes(totalBytes)}`}
                {' · '}
                stored on this device
              </p>
            </div>
            {total > 0 && (
              <Button variant="primary" icon="plus" label={busyLabel} onClick={pick} disabled={importing} />
            )}
          </header>

          {workspace.error && <Notice className="lw-error">{workspace.error}</Notice>}

          {total > 0 && (
            <div className="lw-bar">
              <label className="lw-search">
                <Icon name="search" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find by title or file name"
                  aria-label="Search documents"
                />
                {query && (
                  <button type="button" className="lw-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                    <Icon name="x" />
                  </button>
                )}
              </label>
              <div className="lw-sort" role="group" aria-label="Sort documents">
                <span>Sort</span>
                {SORTS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={sortKey === o.key}
                    title={o.title}
                    onClick={() => setSortKey(o.key)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <span className="lw-strut" />
              <div className="lw-toggle" role="group" aria-label="Workspace layout">
                <button type="button" aria-pressed={viewMode === 'grid'} title="Show as cards" onClick={() => setViewMode('grid')}>
                  <i className="lw-toggle-cards" />
                </button>
                <button type="button" aria-pressed={viewMode === 'list'} title="Show as a list" onClick={() => setViewMode('list')}>
                  <i className="lw-toggle-list" />
                </button>
              </div>
            </div>
          )}

          {workspace.loading && total === 0 ? (
            <p className="lw-status" role="status">
              Reading your workspace…
            </p>
          ) : total === 0 ? (
            <div className="lw-empty">
              <Mascot size={108} mood="empty" />
              <span className="lw-empty-head">Nothing on the desk yet</span>
              <span className="lw-empty-detail">
                Bring in textbooks, class notes or revision guides as PDFs — or drop them anywhere here. They stay
                on this computer, and each one can be read beside a notebook.
              </span>
              <Button variant="primary" icon="plus" label={busyLabel} onClick={pick} disabled={importing} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="lw-empty">
              <span className="lw-empty-head">Nothing matches “{query}”</span>
              <button type="button" className="lw-clear" onClick={() => setQuery('')}>
                Clear the search
              </button>
            </div>
          ) : (
            <section className="lw-group" aria-label="Documents">
              <div className="lw-group-head">
                <span className="lw-group-label">Shelf</span>
                <span className="lw-group-meta">
                  {filtered.length === total ? plural(total, 'file') : `${filtered.length} of ${total}`}
                </span>
                <i />
              </div>

              {viewMode === 'grid' ? (
                <div className="lw-grid" role="list">
                  {filtered.map((doc, index) => (
                    <article
                      key={doc.id}
                      className="lw-card"
                      role="listitem"
                      style={{ '--deal': `${Math.min(index, 8) * 45}ms` } as CSSProperties}
                    >
                      <button
                        type="button"
                        className="lw-card-open"
                        onClick={() => onOpen(doc)}
                        aria-label={`Read ${doc.title}`}
                      />
                      <div className="lw-well" aria-hidden="true">
                        <div className="lw-sheet">
                          <PdfThumbnail path={doc.path} title={doc.title} size="card" targetWidth={420} />
                        </div>
                      </div>
                      <div className="lw-card-id">
                        <span className="lw-card-title" title={doc.title}>
                          {doc.title}
                        </span>
                        <span className="lw-card-file" title={doc.originalName}>
                          {doc.originalName}
                        </span>
                      </div>
                      <div className="lw-card-meta">
                        {doc.lastOpenedAt ? `Opened ${timeAgo(doc.lastOpenedAt)}` : `Added ${shortDate(doc.importedAt)}`}
                        <span>{formatBytes(doc.size)}</span>
                      </div>
                      {actions(doc)}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="lw-list" role="list">
                  {filtered.map((doc) => (
                    <div key={doc.id} className="lw-row" role="listitem">
                      <button type="button" className="lw-row-open" onClick={() => onOpen(doc)} title={`Read “${doc.title}”`}>
                        <span className="lw-row-sheet" aria-hidden="true">
                          <PdfThumbnail path={doc.path} title={doc.title} size="mini" targetWidth={80} />
                        </span>
                        <span className="lw-row-name">
                          <b>{doc.title}</b>
                          <small>{doc.originalName}</small>
                        </span>
                        <span className="lw-row-mono">{formatBytes(doc.size)}</span>
                        <span className="lw-row-mono">{doc.lastOpenedAt ? timeAgo(doc.lastOpenedAt) : 'unopened'}</span>
                        <span className="lw-row-mono">{shortDate(doc.importedAt)}</span>
                      </button>
                      {actions(doc, true)}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {isDragOver && (
          <div className="lw-drop" aria-hidden="true">
            <div className="lw-drop-box">
              <Mascot size={72} mood="download" />
              <b>Drop to import</b>
              <span>PDFs only · they stay on this computer</span>
            </div>
          </div>
        )}
      </div>

      {/* A sibling of `.view`, not a child — see NotebooksView: the view's entrance transform would
          otherwise position the fixed scrim against the view instead of the window. */}
      <Dialog
        open={confirmDoc !== null}
        title="Remove from Workspace?"
        onClose={() => setConfirmDoc(null)}
        art={<Mascot size={72} mood="alarm" />}
        actions={
          <>
            <Button label="Keep it" onClick={() => setConfirmDoc(null)} />
            <Button
              variant="primary"
              className="dlg-danger"
              onClick={() => void runDelete()}
              aria-disabled={deleting ? 'true' : undefined}
              aria-busy={deleting ? true : undefined}
              label={deleting ? 'Removing…' : 'Remove'}
            />
          </>
        }
      >
        “{confirmDoc?.title}” comes off your Workspace shelf. The original file on your computer is not touched.
      </Dialog>
    </>
  );
}

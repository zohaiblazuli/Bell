/**
 * THESIS: Private study material should feel like a calm workbench, not a cloud drive.
 * OWN-WORLD: Bell's paper planes, compact metadata, blue live line and bookish restraint continue.
 * STORY: Import at the top, scan the local shelf, then read alone or open a notebook beside it.
 * FIRST VIEWPORT: A welcoming hero with quick stats, search/sort toolbar, and a rich visual shelf.
 */
import { useMemo, useState, type DragEvent } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import Icon, { type IconName } from '@/components/Icon';
import Button from '@ui/Button';
import Dialog from '@ui/Dialog';
import Notice from '@ui/Notice';
import SegmentedControl from '@ui/SegmentedControl';
import PdfThumbnail from '@/components/PdfThumbnail';
import type { WorkspaceDocument } from '@/lib/workspace';
import { useWorkspace } from '@/state/useWorkspace';
import './LocalWorkspaceView.css';

interface Props {
  workspace: ReturnType<typeof useWorkspace>;
  onOpen: (document: WorkspaceDocument, notebook?: boolean) => void;
}

type ViewMode = 'grid' | 'list';
type SortKey = 'recent' | 'imported' | 'name' | 'size';

const VIEW_SEGMENTS = [
  { icon: 'grid' as IconName, label: 'Grid view' },
  { icon: 'list' as IconName, label: 'List view' },
] as const;

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
  if (!at) return 'Never';
  const diff = Date.now() - at;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
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

  const lastActivity = useMemo(() => {
    if (workspace.documents.length === 0) return null;
    let latest = 0;
    for (const doc of workspace.documents) {
      const stamp = doc.lastOpenedAt ?? doc.importedAt;
      if (stamp > latest) latest = stamp;
    }
    return latest > 0 ? latest : null;
  }, [workspace.documents]);

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

  return (
    <section
      className={`view lw ${isDragOver ? 'lw-drag-active' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => void onDrop(e)}
    >
      {/* Drop zone overlay */}
      {isDragOver && (
        <div className="lw-drop-scrim">
          <div className="lw-drop-box">
            <span className="lw-drop-icon">
              <Icon name="doc" />
            </span>
            <b>Drop PDF documents here</b>
            <p>They will be imported privately into your local Workspace</p>
          </div>
        </div>
      )}

      {/* Hero Banner */}
      <header className="lw-hero">
        <div className="lw-hero-content">
          <div className="lw-hero-tags">
            <span className="lw-pill-badge">
              <Icon name="checkc" /> Offline &amp; Private
            </span>
          </div>
          <h1 className="lw-hero-title">Private Workspace</h1>
          <p className="lw-hero-subtitle">
            Your personal study shelf. Textbooks, syllabus guides, and class handouts stored securely
            on this device.
          </p>
        </div>

        <div className="lw-hero-actions">
          <Button
            variant="primary"
            icon="plus"
            label={importing ? 'Importing…' : 'Import PDFs'}
            onClick={() => void handlePickFiles()}
            disabled={importing}
          />
          <SegmentedControl
            items={VIEW_SEGMENTS}
            value={viewMode === 'grid' ? 0 : 1}
            onChange={(v) => setViewMode(v === 0 ? 'grid' : 'list')}
            label="View format"
          />
        </div>
      </header>

      {/* Workspace Insight Metrics */}
      <div className="lw-metrics-grid">
        <div className="lw-metric-card">
          <span className="lw-metric-icon">
            <Icon name="doc" />
          </span>
          <div className="lw-metric-body">
            <span className="lw-metric-value">{workspace.documents.length}</span>
            <span className="lw-metric-label">
              {workspace.documents.length === 1 ? 'Document' : 'Documents'}
            </span>
          </div>
        </div>

        <div className="lw-metric-card">
          <span className="lw-metric-icon">
            <Icon name="folder" />
          </span>
          <div className="lw-metric-body">
            <span className="lw-metric-value">{formatBytes(totalBytes)}</span>
            <span className="lw-metric-label">Storage Used</span>
          </div>
        </div>

        <div className="lw-metric-card">
          <span className="lw-metric-icon">
            <Icon name="clock" />
          </span>
          <div className="lw-metric-body">
            <span className="lw-metric-value">{lastActivity ? timeAgo(lastActivity) : '—'}</span>
            <span className="lw-metric-label">Last Activity</span>
          </div>
        </div>

        <div className="lw-metric-card">
          <span className="lw-metric-icon">
            <Icon name="notebook" />
          </span>
          <div className="lw-metric-body">
            <span className="lw-metric-value">Companion</span>
            <span className="lw-metric-label">Notebook Ready</span>
          </div>
        </div>
      </div>

      {workspace.error && (
        <div className="lw-error-wrap">
          <Notice>{workspace.error}</Notice>
        </div>
      )}

      {/* Toolbar: Search, Sort & Count */}
      <div className="lw-toolbar">
        <div className="lw-search-wrap">
          <Icon name="search" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find in Workspace by title or filename…"
            aria-label="Search documents"
          />
          {query && (
            <button
              type="button"
              className="lw-search-clear"
              onClick={() => setQuery('')}
              title="Clear search"
              aria-label="Clear search"
            >
              <Icon name="x" />
            </button>
          )}
        </div>

        <div className="lw-toolbar-meta">
          <div className="lw-sort-group">
            <span className="lw-sort-label">Sort by:</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="lw-sort-select"
              aria-label="Sort documents"
            >
              <option value="recent">Recently Opened</option>
              <option value="imported">Recently Imported</option>
              <option value="name">Title (A–Z)</option>
              <option value="size">File Size (Largest)</option>
            </select>
          </div>

          <span className="lw-count-label">
            {filtered.length === workspace.documents.length
              ? `${workspace.documents.length} ${workspace.documents.length === 1 ? 'file' : 'files'}`
              : `${filtered.length} of ${workspace.documents.length} matching`}
          </span>
        </div>
      </div>

      {/* Content Area */}
      {workspace.loading && workspace.documents.length === 0 ? (
        <div className="lw-state-card">
          <div className="lw-state-spinner" />
          <b>Reading your Workspace…</b>
          <span>Loading local documents from disk.</span>
        </div>
      ) : workspace.documents.length === 0 ? (
        <div className="lw-empty-desk">
          <div className="lw-empty-art">
            <span className="lw-empty-art-icon">
              <Icon name="doc" />
            </span>
          </div>
          <h2>Your private study shelf is empty</h2>
          <p>
            Add textbooks, lecture notes, syllabus handbooks, or revision guides.
            <br />
            Documents stay 100% on this computer and can be studied beside companion notebooks.
          </p>
          <div className="lw-empty-actions">
            <Button
              variant="primary"
              icon="plus"
              label={importing ? 'Importing…' : 'Import your first PDF'}
              onClick={() => void handlePickFiles()}
              disabled={importing}
            />
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="lw-state-card">
          <Icon name="search" />
          <b>No documents match “{query}”</b>
          <span>Try a different keyword or clear your filter.</span>
          <button type="button" className="lw-text-btn" onClick={() => setQuery('')}>
            Clear filter
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Visual Grid View */
        <div className="lw-grid" role="list" aria-label="Workspace documents grid">
          {filtered.map((doc) => (
            <article key={doc.id} className="lw-card" role="listitem">
              {/* Card visual cover with extracted page-1 thumbnail */}
              <div
                className="lw-card-cover"
                onClick={() => onOpen(doc)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpen(doc);
                  }
                }}
                title={`Open “${doc.title}”`}
              >
                <div className="lw-cover-spine" />
                <PdfThumbnail
                  path={doc.path}
                  title={doc.title}
                  size="card"
                  targetWidth={500}
                  className="lw-card-thumb"
                />
                <div className="lw-cover-badge">
                  <Icon name="doc" />
                  <span>PDF</span>
                </div>
                <div className="lw-cover-size">{formatBytes(doc.size)}</div>
                <div className="lw-cover-hover-prompt">
                  <Icon name="book" />
                  <span>Read Now</span>
                </div>
              </div>

              {/* Card body */}
              <div className="lw-card-body">
                <h3 className="lw-card-title" title={doc.title}>
                  {doc.title}
                </h3>
                <span className="lw-card-file" title={doc.originalName}>
                  {doc.originalName}
                </span>

                <div className="lw-card-timestamps">
                  <span>
                    <Icon name="clock" /> {doc.lastOpenedAt ? `Opened ${timeAgo(doc.lastOpenedAt)}` : 'Unopened'}
                  </span>
                  <span>
                    Imported {new Date(doc.importedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {/* Card Action Buttons */}
                <div className="lw-card-actions">
                  <button
                    type="button"
                    className="lw-btn-primary"
                    onClick={() => onOpen(doc)}
                    title={`Open “${doc.title}”`}
                  >
                    <Icon name="book" />
                    <span>Open</span>
                  </button>

                  <button
                    type="button"
                    className="lw-btn-ghost"
                    onClick={() => onOpen(doc, true)}
                    title="Open side-by-side with companion notebook"
                    aria-label={`Open ${doc.title} with notebook`}
                  >
                    <Icon name="notebook" />
                  </button>

                  <button
                    type="button"
                    className="lw-btn-danger"
                    onClick={() => setConfirmDoc(doc)}
                    title="Remove from Workspace"
                    aria-label={`Remove ${doc.title} from Workspace`}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        /* Detailed List View */
        <div className="lw-list-wrapper">
          <div className="lw-list-header">
            <span>Document</span>
            <span>Size</span>
            <span>Last Opened</span>
            <span>Imported</span>
            <span className="lw-col-actions">Actions</span>
          </div>
          <div className="lw-list-body" role="list" aria-label="Workspace documents list">
            {filtered.map((doc) => (
              <div key={doc.id} className="lw-list-row" role="listitem">
                <div className="lw-list-primary">
                  <PdfThumbnail
                    path={doc.path}
                    title={doc.title}
                    size="mini"
                    targetWidth={80}
                    className="lw-list-thumb"
                  />
                  <div className="lw-list-info">
                    <b
                      className="lw-list-title"
                      title={doc.title}
                      onClick={() => onOpen(doc)}
                      role="button"
                      tabIndex={0}
                    >
                      {doc.title}
                    </b>
                    <small className="lw-list-filename" title={doc.originalName}>
                      {doc.originalName}
                    </small>
                  </div>
                </div>

                <span className="lw-list-size">{formatBytes(doc.size)}</span>
                <span className="lw-list-activity">{timeAgo(doc.lastOpenedAt)}</span>
                <span className="lw-list-date">
                  {new Date(doc.importedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>

                <div className="lw-list-actions">
                  <button
                    type="button"
                    className="lw-list-btn-open"
                    onClick={() => onOpen(doc)}
                    title="Open document"
                  >
                    <Icon name="book" /> Open
                  </button>
                  <button
                    type="button"
                    className="lw-list-btn-icon"
                    onClick={() => onOpen(doc, true)}
                    title="Open side-by-side with companion notebook"
                    aria-label={`Open ${doc.title} with notebook`}
                  >
                    <Icon name="notebook" />
                  </button>
                  <button
                    type="button"
                    className="lw-list-btn-icon lw-danger-hover"
                    onClick={() => setConfirmDoc(doc)}
                    title="Remove from Workspace"
                    aria-label={`Remove ${doc.title} from Workspace`}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bell Dialog confirmation modal */}
      <Dialog
        open={confirmDoc !== null}
        title="Remove from Workspace?"
        onClose={() => setConfirmDoc(null)}
        art={
          <div className="lw-dialog-badge">
            <Icon name="trash" />
          </div>
        }
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmDoc(null)}
              label="Keep in Workspace"
            />
            <Button
              variant="primary"
              onClick={() => void runDelete()}
              disabled={deleting}
              label={deleting ? 'Removing…' : 'Remove Document'}
            />
          </>
        }
      >
        “{confirmDoc?.title}” will be removed from your Workspace shelf. The original file on your
        computer remains untouched.
      </Dialog>
    </section>
  );
}

/**
 * THESIS: Community material earns trust through the document itself; the selected first page owns
 * the workspace instead of a social feed or a promotional card grid.
 * OWN-WORLD: Bell's opaque content planes, white paper, restrained blue live line, SF UI type and
 * Geist metadata extend here unchanged.
 * STORY: Narrow the catalogue, inspect authorship and file facts, then keep the PDF locally.
 * FIRST VIEWPORT: Search and compact filters span the top; a resource rail sits left of a large
 * paper preview whose actions and provenance remain visible beside it.
 * FORM: Preview-led paper desk, the fifth grounded structure selected for this Operate surface
 * (seed 135520f6); admin work replaces the desk only after privileged authentication.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import Button from '@ui/Button';
import Chip from '@ui/Chip';
import Icon from '@/components/Icon';
import * as api from '@/lib/api';
import { openPdf, renderPage } from '@/lib/pdf';
import {
  COMMUNITY_QUALIFICATIONS,
  COMMUNITY_RESOURCE_TYPES,
  COMMUNITY_SORTS,
  communityQualificationLabel,
  communitySortLabel,
  communityTypeLabel,
  formatResourceBytes,
  formatTransferEta,
  formatTransferSpeed,
  getTransferPercent,
  mfaQrImageSource,
  type CommunityCreateInput,
  type CommunityResource,
  type CommunityUpdateInput,
  type TransferProgress,
} from '@/lib/community';
import type { Subject } from '@/lib/types';
import { useCommunity, useCommunityAdmin } from '@/state/useCommunity';
import './CommunityView.css';

interface Props {
  community: ReturnType<typeof useCommunity>;
  subjects: Subject[];
  onOpen: (resource: CommunityResource) => void;
}

/** Render page 1 of a PDF into a PNG blob and data URL for instant thumbnail previews */
async function generatePdfThumbnail(pdfBytes: Uint8Array): Promise<{ blob: Blob; dataUrl: string }> {
  const { doc, close } = await openPdf(pdfBytes);
  try {
    const canvas = document.createElement('canvas');
    await renderPage(doc, 1, canvas, 480);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create thumbnail blob from canvas'));
          return;
        }
        const dataUrl = canvas.toDataURL('image/png');
        resolve({ blob, dataUrl });
      }, 'image/png');
    });
  } finally {
    await close();
  }
}

/** Module-level cache: deduplicates in-flight thumbnail fetches so ListThumbnail
 *  and CommunityThumbnail for the same resource share a single API call. */
const thumbnailPromises = new Map<string, Promise<ArrayBuffer>>();

export function invalidateThumbnailCache(resourceId?: string) {
  if (resourceId) {
    thumbnailPromises.delete(resourceId);
  } else {
    thumbnailPromises.clear();
  }
  void api.invalidateCommunityThumbnail(resourceId).catch(() => {});
}

function fetchThumbnail(resourceId: string): Promise<ArrayBuffer> {
  const existing = thumbnailPromises.get(resourceId);
  if (existing) return existing;
  const promise = api.communityThumbnail(resourceId).finally(() => {
    // Rust keeps a small bounded byte cache; JS only needs to deduplicate concurrent requests.
    thumbnailPromises.delete(resourceId);
  });
  thumbnailPromises.set(resourceId, promise);
  return promise;
}

/** Shared hook – fetches a thumbnail blob URL for a given resource. */
function useThumbnailUrl(resource: CommunityResource, eager = true) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [rev, setRev] = useState(0);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(eager);
  const ref = useCallback((node: HTMLElement | null) => setHost(node), []);

  useEffect(() => {
    if (eager || !host || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { rootMargin: '500px' },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [eager, host, visible]);

  useEffect(() => {
    const onCatalogueChanged = (e: Event) => {
      const custom = e as CustomEvent<{ resourceId?: string }>;
      if (!custom.detail?.resourceId || custom.detail.resourceId === resource.id) {
        invalidateThumbnailCache(custom.detail?.resourceId);
        setRev((r) => r + 1);
      }
    };
    window.addEventListener('community:catalogue-changed', onCatalogueChanged);
    return () => window.removeEventListener('community:catalogue-changed', onCatalogueChanged);
  }, [resource.id]);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setFailed(false);
    void fetchThumbnail(resource.id).then((bytes) => {
      if (!live) return;
      objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
      setUrl(objectUrl);
    }).catch(async () => {
      if (!live) return;
      if (resource.localPath) {
        try {
          const bytes = await api.communityAdminReadLocalFile(resource.localPath);
          if (!live) return;
          const { dataUrl } = await generatePdfThumbnail(new Uint8Array(bytes));
          if (!live) return;
          setUrl(dataUrl);
          return;
        } catch {
          // Ignore
        }
      }
      setFailed(true);
    });
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [resource.id, resource.version, resource.updatedAt, resource.localPath, rev, visible]);

  return { url, failed, ref };
}

/** Small thumbnail shown in each sidebar list item. */
function ListThumbnail({ resource }: { resource: CommunityResource }) {
  const { url, ref } = useThumbnailUrl(resource, false);

  return (
    <span ref={ref} className="cr-resource-mark" data-has-thumb={url ? '' : undefined}>
      {url ? <img src={url} alt="" /> : <Icon name="doc" />}
    </span>
  );
}

function CommunityThumbnail({ resource }: { resource: CommunityResource }) {
  const { url, failed } = useThumbnailUrl(resource);

  return (
    <div className="cr-preview-sheet" data-empty={!url || undefined}>
      {url ? <img src={url} alt={`First page of ${resource.title}`} /> : (
        <div className="cr-preview-placeholder" aria-label={failed ? 'Preview unavailable' : 'Loading preview'}>
          <Icon name={failed ? 'warn' : 'doc'} />
          <span>{failed ? 'Preview unavailable' : 'Preparing first page…'}</span>
        </div>
      )}
    </div>
  );
}

function statusLabel(status: CommunityResource['status']) {
  return status.replace(/_/g, ' ').replace(/^./, (letter: string) => letter.toUpperCase());
}

function AdminLogin({
  admin,
  onDone,
  onClose,
}: {
  admin: ReturnType<typeof useCommunityAdmin>;
  onDone: () => void;
  onClose: () => void;
}) {
  const [username, setUsername] = useState(admin.savedUsername || '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!username && admin.savedUsername) {
      setUsername(admin.savedUsername);
    }
  }, [admin.savedUsername, username]);
  const needsCode = Boolean(admin.identity?.requiresMfa);
  const isEnrollment = Boolean(admin.identity?.mfaEnrollment);
  const enrollmentQr = useMemo(
    () => mfaQrImageSource(admin.identity?.mfaEnrollment),
    [admin.identity?.mfaEnrollment],
  );
  const dialogRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !admin.busy) {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('input, button:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? [])];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [admin.busy, onClose]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const okay = needsCode
      ? await admin.verifyMfa(code)
      : await admin.signIn(username, password);
    if (okay && needsCode) onDone();
  }

  return (
    <div className="cr-auth-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !admin.busy && onClose()}>
      <form ref={dialogRef} className="cr-auth" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="cr-auth-title">
        <div className="cr-auth-mark"><Icon name="checkc" /></div>
        <h2 id="cr-auth-title">{needsCode ? (isEnrollment ? 'Secure administrator access' : 'Two-step verification') : 'Administrator sign in'}</h2>
        <p>
          {needsCode
            ? isEnrollment
              ? 'Scan this once with an authenticator app, then enter its six-digit code.'
              : 'Enter the six-digit code from the administrator’s authenticator.'
            : 'Only the manually approved Bell administrator can continue.'}
        </p>
        {needsCode ? (
          <>
            {isEnrollment && enrollmentQr && (
              <img className="cr-auth-qr" src={enrollmentQr} alt="Authenticator setup QR code" />
            )}
            {isEnrollment && !enrollmentQr && (
              <div className="cr-inline-error" role="alert">The setup QR could not be prepared. Cancel and sign in again.</div>
            )}
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              aria-label="Authenticator code"
              autoFocus
            />
          </>
        ) : (
          <>
            <input value={username} onChange={(event) => setUsername(event.target.value)} type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={64} placeholder="Administrator username" aria-label="Administrator username" autoFocus />
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="Password" aria-label="Administrator password" />
          </>
        )}
        {admin.error && <div className="cr-inline-error" role="alert">{admin.error}</div>}
        <div className="cr-auth-actions">
          <Button label="Cancel" onClick={onClose} disabled={admin.busy} />
          <Button variant="primary" label={admin.busy ? 'Checking…' : needsCode ? (isEnrollment ? 'Enable & continue' : 'Verify') : 'Continue'} disabled={admin.busy || (needsCode ? code.length !== 6 : !username.trim() || !password)} type="submit" />
        </div>
      </form>
    </div>
  );
}

function UploadForm({
  admin,
  subjects,
}: {
  admin: ReturnType<typeof useCommunityAdmin>;
  subjects: Subject[];
}) {
  const initialQualification = 'a_level' as const;
  const firstSubject = subjects.find((subject) => subject.qualification === initialQualification);
  const [filePath, setFilePath] = useState('');
  const [thumbPath, setThumbPath] = useState('');
  const [customThumbUrl, setCustomThumbUrl] = useState<string | null>(null);
  const [pageOneThumb, setPageOneThumb] = useState<{ blob: Blob; dataUrl: string } | null>(null);
  const [thumbLoading, setThumbLoading] = useState(false);
  const [form, setForm] = useState<CommunityCreateInput>({
    title: '',
    description: '',
    qualification: initialQualification,
    subjectCode: firstSubject?.code ?? '',
    subjectName: firstSubject?.name ?? '',
    resourceType: 'notes',
    authorName: '',
    uploaderName: 'Bell Admin',
    contributorCredit: '',
    sourceUrl: '',
    rightsConfirmed: false,
  });

  useEffect(() => {
    return () => {
      if (customThumbUrl) URL.revokeObjectURL(customThumbUrl);
    };
  }, [customThumbUrl]);

  const availableSubjects = useMemo(
    () => subjects.filter((subject) => subject.qualification === form.qualification),
    [subjects, form.qualification],
  );

  async function chooseFile() {
    const result = await openDialog({ multiple: false, filters: [{ name: 'PDF document', extensions: ['pdf'] }] });
    if (typeof result === 'string') {
      setFilePath(result);
      setPageOneThumb(null);
      setThumbLoading(true);
      try {
        const bytes = await api.communityAdminReadLocalFile(result);
        const generated = await generatePdfThumbnail(new Uint8Array(bytes));
        setPageOneThumb(generated);
        setForm((current) => {
          if (!current.title.trim()) {
            const baseName = result.split(/[\\/]/).pop()?.replace(/\.pdf$/i, '') ?? '';
            const cleanName = baseName.replace(/[-_]+/g, ' ').trim();
            if (cleanName) return { ...current, title: cleanName };
          }
          return current;
        });
      } catch (err) {
        console.error('Failed to extract page 1 thumbnail:', err);
      } finally {
        setThumbLoading(false);
      }
    }
  }

  async function chooseThumb() {
    const result = await openDialog({
      multiple: false,
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (typeof result === 'string') {
      setThumbPath(result);
      try {
        const bytes = await api.communityAdminReadLocalFile(result);
        const blob = new Blob([new Uint8Array(bytes)]);
        if (customThumbUrl) URL.revokeObjectURL(customThumbUrl);
        setCustomThumbUrl(URL.createObjectURL(blob));
      } catch {
        setCustomThumbUrl(null);
      }
    }
  }

  function clearCustomThumb() {
    setThumbPath('');
    if (customThumbUrl) URL.revokeObjectURL(customThumbUrl);
    setCustomThumbUrl(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!filePath) return;
    const id = await admin.createAndUpload(form, filePath);
    if (id) {
      if (thumbPath) {
        await admin.uploadThumbnail(id, thumbPath);
      } else if (pageOneThumb) {
        try {
          const arrayBuffer = await pageOneThumb.blob.arrayBuffer();
          const bytes = Array.from(new Uint8Array(arrayBuffer));
          const tempPath = await api.communityAdminSaveTempThumbnail(bytes);
          await admin.uploadThumbnail(id, tempPath);
        } catch (err) {
          console.error('Failed to auto-upload default thumbnail from page 1:', err);
        }
      }
      setFilePath('');
      clearCustomThumb();
      setPageOneThumb(null);
      setForm((current) => ({ ...current, title: '', description: '', authorName: '', contributorCredit: '', sourceUrl: '', rightsConfirmed: false }));
    }
  }

  const filename = filePath.split(/[\\/]/).pop();
  const activePreviewUrl = customThumbUrl || pageOneThumb?.dataUrl || null;

  return (
    <form className="cr-upload" onSubmit={submit}>
      <div className="cr-admin-section-head">
        <div>
          <h2>Upload a resource</h2>
          <p>The PDF will be available for review after upload. Publish it when ready.</p>
        </div>
        <div className="cr-upload-buttons">
          <Button icon="folder" label={filename || 'Choose PDF'} onClick={() => void chooseFile()} />
        </div>
      </div>

      <div className="cr-thumb-preview-box">
        <div className="cr-thumb-preview-frame">
          {activePreviewUrl ? (
            <img src={activePreviewUrl} alt="Thumbnail preview" />
          ) : thumbLoading ? (
            <div className="cr-thumb-preview-placeholder">
              <Icon name="sync" />
              <span>Extracting page 1…</span>
            </div>
          ) : (
            <div className="cr-thumb-preview-placeholder">
              <Icon name="doc" />
              <span>{filePath ? 'Preparing preview' : 'No PDF selected'}</span>
            </div>
          )}
        </div>
        <div className="cr-thumb-preview-details">
          <div className="cr-thumb-preview-badge">
            {customThumbUrl ? (
              <span className="cr-badge cr-badge-custom">Custom thumbnail</span>
            ) : pageOneThumb ? (
              <span className="cr-badge cr-badge-auto">Default: First page of book</span>
            ) : thumbLoading ? (
              <span className="cr-badge cr-badge-busy">Generating default…</span>
            ) : (
              <span className="cr-badge">No thumbnail</span>
            )}
          </div>
          <p className="cr-thumb-preview-note">
            {customThumbUrl
              ? 'Using your custom thumbnail image for this upload.'
              : pageOneThumb
                ? 'Page 1 has been automatically captured as the default thumbnail. You can keep it or choose a custom image.'
                : filePath
                  ? 'Generating default thumbnail from the first page of the document…'
                  : 'Select a PDF to automatically use its first page as the default thumbnail.'}
          </p>
          <div className="cr-thumb-preview-actions">
            <Button
              icon="doc"
              label={customThumbUrl ? 'Change custom thumbnail' : 'Choose custom thumbnail (optional)'}
              onClick={() => void chooseThumb()}
            />
            {customThumbUrl && (
              <Button label="Revert to first page" onClick={clearCustomThumb} />
            )}
          </div>
        </div>
      </div>

      <div className="cr-upload-grid">
        <label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required maxLength={160} /></label>
        <label>Author<input value={form.authorName} onChange={(event) => setForm({ ...form, authorName: event.target.value })} required maxLength={120} /></label>
        <label>Qualification<select value={form.qualification} onChange={(event) => {
          const qualification = event.target.value as CommunityCreateInput['qualification'];
          const subject = subjects.find((entry) => entry.qualification === qualification);
          setForm({ ...form, qualification, subjectCode: subject?.code ?? '', subjectName: subject?.name ?? '' });
        }}>{COMMUNITY_QUALIFICATIONS.map((qualification) => <option key={qualification} value={qualification}>{communityQualificationLabel(qualification)}</option>)}</select></label>
        <label>Subject<select value={form.subjectCode} onChange={(event) => {
          const subject = availableSubjects.find((entry) => entry.code === event.target.value);
          setForm({ ...form, subjectCode: event.target.value, subjectName: subject?.name ?? '' });
        }} required>{availableSubjects.map((subject) => <option key={`${subject.qualification}-${subject.code}`} value={subject.code}>{subject.name} · {subject.code}</option>)}</select></label>
        <label>Resource type<select value={form.resourceType} onChange={(event) => setForm({ ...form, resourceType: event.target.value as CommunityCreateInput['resourceType'] })}>{COMMUNITY_RESOURCE_TYPES.map((type) => <option key={type} value={type}>{communityTypeLabel(type)}</option>)}</select></label>
        <label>Uploader name<input value={form.uploaderName} onChange={(event) => setForm({ ...form, uploaderName: event.target.value })} required maxLength={80} /></label>
        <label>Contributor credit <span>optional</span><input value={form.contributorCredit ?? ''} onChange={(event) => setForm({ ...form, contributorCredit: event.target.value })} maxLength={120} /></label>
        <label>Source URL <span>optional</span><input value={form.sourceUrl ?? ''} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} type="url" maxLength={1000} /></label>
        <label className="cr-upload-description">Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required minLength={10} maxLength={2000} rows={4} /></label>
      </div>
      <label className="cr-rights"><input type="checkbox" checked={form.rightsConfirmed} onChange={(event) => setForm({ ...form, rightsConfirmed: event.target.checked })} />I confirm Bell has permission to distribute this material.</label>
      {admin.error && <div className="cr-inline-error" role="alert">{admin.error}</div>}
      <div className="cr-upload-actions">
        <span>{filename ? `${filename}${customThumbUrl ? ' · Custom thumbnail' : pageOneThumb ? ' · Default thumbnail (Page 1)' : ''} · PDF up to 200 MB` : 'Choose one PDF, up to 200 MB. First page used as thumbnail automatically.'}</span>
        <Button variant="primary" icon="plus" label={admin.busy ? 'Uploading…' : 'Upload'} type="submit" disabled={admin.busy || !filePath || !form.rightsConfirmed || !form.subjectCode} />
      </div>
    </form>
  );
}

function AdminEditModal({
  resource,
  subjects,
  admin,
  onClose,
}: {
  resource: CommunityResource;
  subjects: Subject[];
  admin: ReturnType<typeof useCommunityAdmin>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CommunityUpdateInput>({
    title: resource.title,
    description: resource.description,
    qualification: resource.qualification,
    subjectCode: resource.subjectCode,
    subjectName: resource.subjectName,
    resourceType: resource.resourceType,
    authorName: resource.authorName,
    uploaderName: resource.uploaderName ?? '',
    contributorCredit: resource.contributorCredit ?? '',
    sourceUrl: resource.sourceUrl ?? '',
  });
  const { url: currentThumbUrl } = useThumbnailUrl(resource);
  const [newThumbPath, setNewThumbPath] = useState('');
  const [newThumbUrl, setNewThumbUrl] = useState<string | null>(null);
  const [extractedThumb, setExtractedThumb] = useState<{ blob: Blob; dataUrl: string } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const dialogRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    return () => {
      if (newThumbUrl) URL.revokeObjectURL(newThumbUrl);
    };
  }, [newThumbUrl]);

  const availableSubjects = useMemo(
    () => subjects.filter((subject) => subject.qualification === form.qualification),
    [subjects, form.qualification],
  );

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !admin.busy) {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('input, select, textarea, button:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? [])];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [admin.busy, onClose]);

  async function chooseThumb() {
    const result = await openDialog({
      multiple: false,
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (typeof result === 'string') {
      setNewThumbPath(result);
      setExtractedThumb(null);
      try {
        const bytes = await api.communityAdminReadLocalFile(result);
        const blob = new Blob([new Uint8Array(bytes)]);
        if (newThumbUrl) URL.revokeObjectURL(newThumbUrl);
        setNewThumbUrl(URL.createObjectURL(blob));
      } catch {
        setNewThumbUrl(null);
      }
    }
  }

  async function extractPageOne() {
    setExtracting(true);
    try {
      let localPdfPath = resource.localPath;
      if (!localPdfPath) {
        const ready = await admin.preview(resource);
        if (ready?.localPath) {
          localPdfPath = ready.localPath;
        }
      }
      if (localPdfPath) {
        const bytes = await api.communityAdminReadLocalFile(localPdfPath);
        const generated = await generatePdfThumbnail(new Uint8Array(bytes));
        setExtractedThumb(generated);
        setNewThumbPath('');
        if (newThumbUrl) URL.revokeObjectURL(newThumbUrl);
        setNewThumbUrl(null);
      }
    } catch (err) {
      console.error('Failed to extract page 1:', err);
    } finally {
      setExtracting(false);
    }
  }

  function resetThumbnail() {
    setNewThumbPath('');
    if (newThumbUrl) URL.revokeObjectURL(newThumbUrl);
    setNewThumbUrl(null);
    setExtractedThumb(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const updated = await admin.updateResource(resource.id, form);
    if (!updated) return;
    if (newThumbPath) {
      const ok = await admin.uploadThumbnail(resource.id, newThumbPath);
      if (!ok) return;
      invalidateThumbnailCache(resource.id);
    } else if (extractedThumb) {
      try {
        const arrayBuffer = await extractedThumb.blob.arrayBuffer();
        const bytes = Array.from(new Uint8Array(arrayBuffer));
        const tempPath = await api.communityAdminSaveTempThumbnail(bytes);
        const ok = await admin.uploadThumbnail(resource.id, tempPath);
        if (!ok) return;
        invalidateThumbnailCache(resource.id);
      } catch (err) {
        console.error('Failed to upload extracted page 1 thumbnail:', err);
      }
    }
    onClose();
  }

  const activeThumbUrl = newThumbUrl || extractedThumb?.dataUrl || currentThumbUrl;

  return (
    <div className="cr-auth-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !admin.busy && onClose()}>
      <form ref={dialogRef} className="cr-edit-dialog" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="cr-edit-title">
        <div className="cr-admin-section-head">
          <div>
            <h2 id="cr-edit-title">Edit resource</h2>
            <p>Update metadata or replace the preview thumbnail for “{resource.title}”.</p>
          </div>
        </div>

        <div className="cr-thumb-field cr-edit-span-2">
          <label>Thumbnail preview</label>
          <div className="cr-thumb-preview-box cr-thumb-preview-inline">
            <div className="cr-thumb-preview-frame">
              {activeThumbUrl ? (
                <img src={activeThumbUrl} alt="Thumbnail preview" />
              ) : extracting ? (
                <div className="cr-thumb-preview-placeholder">
                  <Icon name="sync" />
                  <span>Extracting page 1…</span>
                </div>
              ) : (
                <div className="cr-thumb-preview-placeholder">
                  <Icon name="doc" />
                  <span>No thumbnail</span>
                </div>
              )}
            </div>
            <div className="cr-thumb-preview-details">
              <div className="cr-thumb-preview-badge">
                {newThumbUrl ? (
                  <span className="cr-badge cr-badge-custom">New image selected</span>
                ) : extractedThumb ? (
                  <span className="cr-badge cr-badge-auto">Generated from page 1</span>
                ) : extracting ? (
                  <span className="cr-badge cr-badge-busy">Extracting from PDF…</span>
                ) : currentThumbUrl ? (
                  <span className="cr-badge">Current thumbnail</span>
                ) : (
                  <span className="cr-badge">No thumbnail</span>
                )}
              </div>
              <p className="cr-thumb-preview-note">
                {newThumbUrl
                  ? 'A new image file has been chosen and will be saved as the thumbnail on update.'
                  : extractedThumb
                    ? 'Page 1 has been extracted from the book and will be saved on update.'
                    : 'Admins and learners see this cover in the catalogue and reader desk.'}
              </p>
              <div className="cr-thumb-preview-actions">
                <Button icon="doc" label={newThumbUrl ? 'Choose different image' : 'Choose new thumbnail'} onClick={() => void chooseThumb()} />
                <Button icon="image" label={extracting ? 'Extracting…' : 'Extract from page 1'} disabled={extracting || admin.busy} onClick={() => void extractPageOne()} />
                {(newThumbUrl || extractedThumb) && <Button label="Revert" onClick={resetThumbnail} />}
              </div>
            </div>
          </div>
        </div>

        <div className="cr-edit-grid">
          <label className="cr-edit-span-2">Title<input value={form.title ?? ''} onChange={(event) => setForm({ ...form, title: event.target.value })} required maxLength={160} /></label>
          <label>Author<input value={form.authorName ?? ''} onChange={(event) => setForm({ ...form, authorName: event.target.value })} required maxLength={120} /></label>
          <label>Uploader name<input value={form.uploaderName ?? ''} onChange={(event) => setForm({ ...form, uploaderName: event.target.value })} required maxLength={80} /></label>
          <label>Qualification<select value={form.qualification} onChange={(event) => {
            const qualification = event.target.value as CommunityUpdateInput['qualification'];
            const subject = subjects.find((entry) => entry.qualification === qualification);
            setForm({ ...form, qualification, subjectCode: subject?.code ?? '', subjectName: subject?.name ?? '' });
          }}>{COMMUNITY_QUALIFICATIONS.map((qualification) => <option key={qualification} value={qualification}>{communityQualificationLabel(qualification)}</option>)}</select></label>
          <label>Subject<select value={form.subjectCode} onChange={(event) => {
            const subject = availableSubjects.find((entry) => entry.code === event.target.value);
            setForm({ ...form, subjectCode: event.target.value, subjectName: subject?.name ?? '' });
          }} required>{availableSubjects.map((subject) => <option key={`${subject.qualification}-${subject.code}`} value={subject.code}>{subject.name} · {subject.code}</option>)}</select></label>
          <label>Resource type<select value={form.resourceType} onChange={(event) => setForm({ ...form, resourceType: event.target.value as CommunityUpdateInput['resourceType'] })}>{COMMUNITY_RESOURCE_TYPES.map((type) => <option key={type} value={type}>{communityTypeLabel(type)}</option>)}</select></label>
          <label>Contributor credit <span>optional</span><input value={form.contributorCredit ?? ''} onChange={(event) => setForm({ ...form, contributorCredit: event.target.value })} maxLength={120} /></label>
          <label>Source URL <span>optional</span><input value={form.sourceUrl ?? ''} onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })} type="url" maxLength={1000} /></label>
          <label className="cr-edit-span-2">Description<textarea value={form.description ?? ''} onChange={(event) => setForm({ ...form, description: event.target.value })} required minLength={10} maxLength={2000} rows={4} /></label>
        </div>
        {admin.error && <div className="cr-inline-error" role="alert">{admin.error}</div>}
        <div className="cr-edit-actions">
          <Button label="Cancel" onClick={onClose} disabled={admin.busy} />
          <Button variant="primary" label={admin.busy ? 'Saving…' : 'Save changes'} type="submit" disabled={admin.busy || !form.title?.trim() || !form.authorName?.trim() || !form.uploaderName?.trim() || !form.subjectCode} />
        </div>
      </form>
    </div>
  );
}

function AdminWorkspace({
  admin,
  subjects,
  onBrowse,
  onOpen,
}: {
  admin: ReturnType<typeof useCommunityAdmin>;
  subjects: Subject[];
  onBrowse: () => void;
  onOpen: (resource: CommunityResource) => void;
}) {
  const stats = admin.stats;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingResource, setEditingResource] = useState<CommunityResource | null>(null);

  async function toggleInspection(resourceId: string) {
    if (expandedId === resourceId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(resourceId);
    if (!admin.inspections[resourceId]) await admin.inspect(resourceId);
  }

  return (
    <div className="cr-admin">
      <div className="cr-admin-head">
        <button type="button" onClick={onBrowse}><Icon name="left" /> Community catalogue</button>
        <div className="cr-admin-person"><span>{admin.identity?.username}</span><Button label="Sign out" onClick={() => void admin.signOut()} /></div>
      </div>
      <div className="cr-statline" aria-label="Community resource statistics">
        <div><strong>{stats?.published ?? '—'}</strong><span>Published</span></div>
        <div><strong>{stats?.drafts ?? '—'}</strong><span>Awaiting review</span></div>
        <div><strong>{stats?.quarantined ?? '—'}</strong><span>Quarantined</span></div>
        <div><strong>{stats ? formatResourceBytes(stats.storageBytes) : '—'}</strong><span>Stored</span></div>
        <div><strong>{stats?.opens30d ?? '—'}</strong><span>Opens · 30d</span></div>
        <div><strong>{stats?.downloads30d ?? '—'}</strong><span>Downloads · 30d</span></div>
        <div><strong>{stats?.upvotes30d ?? '—'}</strong><span>Upvotes · 30d</span></div>
      </div>
      <UploadForm admin={admin} subjects={subjects} />
      <section className="cr-admin-resources">
        <div className="cr-admin-section-head"><div><h2>Resources</h2><p>Review the complete file before making it public.</p></div><Button icon="sync" label="Refresh" disabled={admin.busy} onClick={() => void admin.refresh()} /></div>
        {admin.resources.length === 0 ? <div className="cr-admin-empty">No uploads yet.</div> : (
          <div className="cr-admin-table" role="table" aria-label="Managed resources">
            {admin.resources.map((resource) => {
              const progress = admin.uploadProgress[resource.id];
              const inspection = admin.inspections[resource.id];
              return (
                <div className="cr-admin-item" key={resource.id}>
                  <div className="cr-admin-row" role="row">
                    <div className="cr-admin-title-cell">
                      <ListThumbnail resource={resource} />
                      <div className="cr-admin-title-text">
                        <strong>{resource.title}</strong>
                        <span>{resource.subjectName} · {communityTypeLabel(resource.resourceType)}</span>
                      </div>
                    </div>
                    <span className="cr-status" data-status={resource.status}>{statusLabel(resource.status)}</span>
                    <span>{progress ? `${Math.round(progress.uploaded / progress.total * 100)}%` : resource.version !== 0 ? statusLabel(resource.status) : 'No file'}</span>
                    <div className="cr-admin-row-actions">
                      <Button label={expandedId === resource.id ? 'Hide details' : admin.inspectionLoading === resource.id ? 'Loading…' : 'Inspect'} disabled={admin.inspectionLoading === resource.id} onClick={() => void toggleInspection(resource.id)} />
                      <Button label="Edit" disabled={admin.busy} onClick={() => setEditingResource(resource)} />
                      {resource.version !== 0 && <Button label="Review PDF" onClick={() => void admin.preview(resource).then((ready) => ready && onOpen(ready))} />}
                      {resource.status === 'ready_for_review' && <Button variant="primary" label="Publish" onClick={() => void admin.setStatus(resource.id, 'published')} />}
                      {resource.status === 'published' && <Button label="Unpublish" onClick={() => void admin.setStatus(resource.id, 'unpublished')} />}
                      <Button
                        className="cr-btn-delete"
                        label="Delete"
                        disabled={admin.busy}
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete "${resource.title}"? This cannot be undone.`)) {
                            void admin.deleteResource(resource.id);
                          }
                        }}
                      />
                    </div>
                  </div>
                  {expandedId === resource.id && inspection && (
                    <div className="cr-inspection">
                      <section>
                        <h3>Private upload activity</h3>
                        <p>IP addresses are encrypted at rest, visible only here, and expire after 30 days.</p>
                        {inspection.securityEvents.length ? <ul>{inspection.securityEvents.map((event, index) => <li key={`${event.createdAt}-${index}`}><code>{event.ip}</code><span>{event.action.replace(/_/g, ' ')} · {new Date(event.createdAt).toLocaleString()}</span></li>)}</ul> : <p>No retained IP events.</p>}
                      </section>
                      <section>
                        <h3>Audit trail</h3>
                        {inspection.auditTrail.length ? <ul>{inspection.auditTrail.map((event, index) => <li key={`${event.createdAt}-${index}`}><strong>{event.action}</strong><span>{new Date(event.createdAt).toLocaleString()}</span></li>)}</ul> : <p>No actions recorded.</p>}
                      </section>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
      {editingResource && (
        <AdminEditModal
          resource={editingResource}
          subjects={subjects}
          admin={admin}
          onClose={() => setEditingResource(null)}
        />
      )}
    </div>
  );
}

interface BookCardProps {
  resource: CommunityResource;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  transfer: TransferProgress | null;
}

function BookCard({ resource, isSelected, onSelect, onOpen, transfer }: BookCardProps) {
  const { url, failed, ref } = useThumbnailUrl(resource, false);
  const pct = transfer ? getTransferPercent(transfer.uploaded, transfer.total || resource.sizeBytes) : null;
  const isTransferring = Boolean(transfer);
  const transferLabel = transfer
    ? transfer.phase === 'opening'
      ? 'Opening…'
      : transfer.phase === 'verifying'
        ? 'Verifying…'
        : transfer.phase === 'starting'
          ? 'Starting…'
          : pct != null
            ? `${pct}%`
            : `${formatResourceBytes(transfer.uploaded)}`
    : resource.localPath
      ? 'Open'
      : 'Get';

  return (
    <div
      ref={ref}
      className="cr-card"
      data-selected={isSelected || undefined}
      onClick={onSelect}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-label={`${resource.title} by ${resource.authorName}`}
    >
      <div className="cr-card-cover-stage">
        <div className="cr-card-cover">
          {url ? (
            <img src={url} alt={`Cover of ${resource.title}`} loading="lazy" />
          ) : (
            <div className="cr-card-placeholder">
              <Icon name={failed ? 'warn' : 'doc'} />
              <span className="cr-card-placeholder-code">{resource.subjectCode}</span>
              <span className="cr-card-placeholder-label">
                {failed ? 'No preview' : 'Loading…'}
              </span>
            </div>
          )}
          {/* Realistic spine fold highlight */}
          <div className="cr-card-spine" aria-hidden="true" />
          {/* Badge overlays */}
          <div className="cr-card-badges">
            <span className={`cr-tag-qual cr-tag-${resource.qualification.replace('_', '-')}`}>
              {communityQualificationLabel(resource.qualification)}
            </span>
          </div>
          <div className="cr-card-type-tag">
            {communityTypeLabel(resource.resourceType)}
          </div>
          <div className="cr-card-votes">
            <span>↑ {resource.upvotes.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="cr-card-info">
        <h3 className="cr-card-title" title={resource.title}>
          {resource.title}
        </h3>
        <p className="cr-card-author">By {resource.authorName}</p>
        <div className="cr-card-meta">
          <span className="cr-card-subject">
            {resource.subjectName} · {resource.subjectCode}
          </span>
          <span className="cr-card-size">
            {resource.pageCount ? `${resource.pageCount}p · ` : ''}
            {formatResourceBytes(resource.sizeBytes)}
          </span>
        </div>
        <div className="cr-card-actions" onClick={(e) => e.stopPropagation()}>
          <Button
            variant={resource.localPath ? 'primary' : undefined}
            icon={resource.localPath ? 'book' : 'folder'}
            label={transferLabel}
            disabled={isTransferring}
            onClick={onOpen}
          />
          <Button
            label="Details"
            onClick={onSelect}
          />
        </div>
      </div>

      {transfer && (
        <div className="cr-card-progress-track" aria-hidden="true">
          <div
            className={`cr-card-progress-bar ${pct == null ? 'indeterminate' : ''}`}
            style={pct != null ? { width: `${pct}%` } : undefined}
          />
        </div>
      )}
    </div>
  );
}

interface HeroSpotlightProps {
  resources: CommunityResource[];
  onSelect: (resource: CommunityResource) => void;
  onOpen: (resource: CommunityResource) => void;
  progress: Record<string, TransferProgress>;
}

function HeroSpotlight({ resources, onSelect, onOpen, progress }: HeroSpotlightProps) {
  const [index, setIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Keep index within bounds if resources change
  const activeIndex = index >= resources.length ? 0 : index;
  const current = resources[activeIndex];

  // Auto-advance timer (every 6.5s), pauses on hover
  useEffect(() => {
    if (resources.length <= 1 || isHovered) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % resources.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [resources.length, isHovered]);

  if (!current) return null;

  const { url } = useThumbnailUrl(current);
  const transfer = progress[current.id] ?? null;
  const pct = transfer ? getTransferPercent(transfer.uploaded, transfer.total || current.sizeBytes) : null;
  const isTransferring = Boolean(transfer);
  const heroButtonLabel = transfer
    ? transfer.phase === 'opening'
      ? 'Opening in Bell…'
      : transfer.phase === 'verifying'
        ? 'Verifying…'
        : transfer.phase === 'starting'
          ? 'Connecting…'
          : pct != null
            ? `Downloading ${pct}%${transfer.secondsLeft ? ` · ~${transfer.secondsLeft}s` : ''}`
            : `Downloading (${formatResourceBytes(transfer.uploaded)})`
    : current.localPath
      ? 'Read in Bell'
      : 'Download & Read';

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((prev) => (prev - 1 + resources.length) % resources.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((prev) => (prev + 1) % resources.length);
  };

  return (
    <section
      className="cr-hero"
      aria-label="Featured community resources"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="cr-hero-glow" aria-hidden="true" />

      {/* Navigation arrows (when more than 1 item) */}
      {resources.length > 1 && (
        <>
          <button
            type="button"
            className="cr-hero-arrow cr-hero-arrow-prev"
            onClick={handlePrev}
            aria-label="Previous featured resource"
          >
            <Icon name="left" />
          </button>
          <button
            type="button"
            className="cr-hero-arrow cr-hero-arrow-next"
            onClick={handleNext}
            aria-label="Next featured resource"
          >
            <Icon name="right" />
          </button>
        </>
      )}

      <div className="cr-hero-content-slider" key={current.id}>
        <div className="cr-hero-left">
          <div className="cr-hero-badge-pill">
            <Icon name="checkc" />
            <span>
              Featured Resource {resources.length > 1 ? `· ${activeIndex + 1} of ${resources.length}` : ''}
            </span>
          </div>
          <div className="cr-hero-qual">
            {communityQualificationLabel(current.qualification)} · {current.subjectName} ({current.subjectCode})
          </div>
          <h2 className="cr-hero-title">{current.title}</h2>
          <p className="cr-hero-author">By {current.authorName}</p>
          <p className="cr-hero-desc">{current.description}</p>
          <div className="cr-hero-meta-row">
            <span className="cr-hero-meta-item">
              <Icon name="doc" /> {communityTypeLabel(current.resourceType)}
            </span>
            <span className="cr-hero-meta-item">
              {current.pageCount ? `${current.pageCount} pages · ` : ''}
              {formatResourceBytes(current.sizeBytes)}
            </span>
            <span className="cr-hero-meta-item cr-hero-upvotes">
              ↑ {current.upvotes.toLocaleString()} upvotes
            </span>
          </div>
          <div className="cr-hero-actions">
            <Button
              variant="primary"
              icon={current.localPath ? 'book' : 'folder'}
              label={heroButtonLabel}
              disabled={isTransferring}
              onClick={() => onOpen(current)}
            />
            <Button
              label="Inspect Details"
              onClick={() => onSelect(current)}
            />
          </div>

          {transfer && (
            <div className="cr-hero-transfer-card" role="status">
              <div className="cr-hero-transfer-track">
                <div
                  className={`cr-hero-transfer-bar ${pct == null ? 'indeterminate' : ''}`}
                  style={pct != null ? { width: `${pct}%` } : undefined}
                />
              </div>
              <div className="cr-hero-transfer-meta">
                <span>
                  {transfer.phase === 'opening'
                    ? 'Opening in Bell…'
                    : transfer.phase === 'verifying'
                      ? 'Verifying document checksum…'
                      : transfer.phase === 'starting'
                        ? 'Connecting to repository…'
                        : `${formatResourceBytes(transfer.uploaded)}${
                            (transfer.total || current.sizeBytes) > 0
                              ? ` / ${formatResourceBytes(transfer.total || current.sizeBytes)}`
                              : ''
                          }`}
                </span>
                <span>
                  {[formatTransferSpeed(transfer.speed), formatTransferEta(transfer.secondsLeft)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            </div>
          )}
        </div>

        <div
          className="cr-hero-right"
          onClick={() => onSelect(current)}
          role="button"
          tabIndex={0}
          aria-label={`Inspect ${current.title}`}
        >
          <div className="cr-hero-book-wrap">
            <div className="cr-hero-book">
              {url ? (
                <img src={url} alt={`Cover of ${current.title}`} />
              ) : (
                <div className="cr-hero-book-fallback">
                  <Icon name="doc" />
                  <span>{current.subjectCode}</span>
                </div>
              )}
              <div className="cr-hero-book-spine" aria-hidden="true" />
            </div>
            <div className="cr-hero-shadow" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Pagination indicators / dots */}
      {resources.length > 1 && (
        <div className="cr-hero-dots" role="tablist" aria-label="Featured slides">
          {resources.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className="cr-hero-dot"
              data-active={idx === activeIndex || undefined}
              aria-selected={idx === activeIndex}
              aria-label={`Slide ${idx + 1}: ${item.title}`}
              onClick={(e) => {
                e.stopPropagation();
                setIndex(idx);
              }}
            >
              <span className="cr-hero-dot-bar" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

interface DetailsDrawerProps {
  resource: CommunityResource | null;
  onClose: () => void;
  onVote: (resource: CommunityResource) => void;
  onOpen: (resource: CommunityResource) => void;
  transfer: TransferProgress | null;
}

function DetailsDrawer({ resource, onClose, onVote, onOpen, transfer }: DetailsDrawerProps) {
  useEffect(() => {
    if (!resource) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resource, onClose]);

  if (!resource) return null;

  const displayTotal = transfer?.total && transfer.total > 0 ? transfer.total : resource.sizeBytes;
  const pct = transfer ? getTransferPercent(transfer.uploaded, displayTotal) : null;
  const isTransferring = Boolean(transfer);

  const drawerButtonLabel = transfer
    ? transfer.phase === 'starting'
      ? 'Connecting…'
      : transfer.phase === 'verifying'
        ? 'Verifying checksum…'
        : transfer.phase === 'opening'
          ? 'Opening in Bell…'
          : pct != null
            ? `Downloading ${pct}%${transfer.secondsLeft ? ` · ~${transfer.secondsLeft}s left` : ''}`
            : `Downloading (${formatResourceBytes(transfer.uploaded)})`
    : resource.localPath
      ? 'Open in Bell'
      : 'Download & open in Bell';

  return (
    <div className="cr-drawer-scrim" onClick={onClose} role="presentation">
      <aside
        className="cr-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cr-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cr-drawer-head">
          <div className="cr-drawer-head-tag">
            <span>{communityQualificationLabel(resource.qualification)} · {resource.subjectCode}</span>
          </div>
          <button
            type="button"
            className="cr-drawer-close"
            onClick={onClose}
            aria-label="Close details"
          >
            <Icon name="x" />
          </button>
        </div>

        <div className="cr-drawer-body">
          <div className="cr-drawer-cover-stage">
            <div className="cr-drawer-cover-frame">
              <CommunityThumbnail resource={resource} />
            </div>
          </div>

          <div className="cr-drawer-info">
            <h2 id="cr-drawer-title" className="cr-drawer-title">{resource.title}</h2>
            <p className="cr-drawer-author">By {resource.authorName}</p>

            <div className="cr-drawer-pills">
              <span className="cr-drawer-pill">{communityTypeLabel(resource.resourceType)}</span>
              <span className="cr-drawer-pill">
                {resource.pageCount ? `${resource.pageCount} pages · ` : ''}
                {formatResourceBytes(resource.sizeBytes)}
              </span>
              <span className="cr-drawer-pill">↑ {resource.upvotes.toLocaleString()} upvotes</span>
            </div>

            <p className="cr-drawer-desc">{resource.description}</p>

            <div className="cr-drawer-specs">
              <div className="cr-spec-row">
                <span className="cr-spec-dt">Subject</span>
                <span className="cr-spec-dd">{resource.subjectName} ({resource.subjectCode})</span>
              </div>
              <div className="cr-spec-row">
                <span className="cr-spec-dt">Qualification</span>
                <span className="cr-spec-dd">{communityQualificationLabel(resource.qualification)}</span>
              </div>
              <div className="cr-spec-row">
                <span className="cr-spec-dt">Uploaded by</span>
                <span className="cr-spec-dd">{resource.uploaderName}</span>
              </div>
              {resource.contributorCredit && (
                <div className="cr-spec-row">
                  <span className="cr-spec-dt">Contributor credit</span>
                  <span className="cr-spec-dd">{resource.contributorCredit}</span>
                </div>
              )}
              <div className="cr-spec-row">
                <span className="cr-spec-dt">Published</span>
                <span className="cr-spec-dd">
                  {resource.publishedAt ? new Date(resource.publishedAt).toLocaleDateString() : 'Recently'}
                </span>
              </div>
            </div>

            <div className="cr-drawer-trust">
              <Icon name="checkc" />
              <span>PDF validated and approved before community publication.</span>
            </div>
          </div>
        </div>

        {transfer && (
          <div className="cr-drawer-transfer" role="status" aria-live="polite">
            <div className="cr-transfer-header">
              <div className="cr-transfer-status">
                <span className="cr-transfer-spinner" />
                <span className="cr-transfer-phase">
                  {transfer.phase === 'starting' && 'Connecting to repository…'}
                  {transfer.phase === 'downloading' && 'Downloading document…'}
                  {transfer.phase === 'verifying' && 'Verifying document integrity…'}
                  {transfer.phase === 'opening' && 'Preparing reader in Bell…'}
                </span>
              </div>
              {pct != null && <span className="cr-transfer-pct">{pct}%</span>}
            </div>

            <div className="cr-transfer-track">
              <div
                className={`cr-transfer-bar ${pct == null ? 'indeterminate' : ''}`}
                style={pct != null ? { width: `${pct}%` } : undefined}
              />
            </div>

            <div className="cr-transfer-meta">
              <span className="cr-transfer-bytes">
                {formatResourceBytes(transfer.uploaded)}
                {displayTotal > 0 ? ` / ${formatResourceBytes(displayTotal)}` : ''}
              </span>
              <span className="cr-transfer-speed-eta">
                {[formatTransferSpeed(transfer.speed), formatTransferEta(transfer.secondsLeft)]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
          </div>
        )}

        <div className="cr-drawer-footer">
          <Button
            variant="toggle"
            active={resource.hasVoted}
            label={`Upvote · ${resource.upvotes.toLocaleString()}`}
            onClick={() => onVote(resource)}
          />
          <Button
            variant="primary"
            icon={resource.localPath ? 'book' : 'folder'}
            label={drawerButtonLabel}
            disabled={isTransferring}
            onClick={() => onOpen(resource)}
          />
        </div>
      </aside>
    </div>
  );
}

export default function CommunityView({ community, subjects, onOpen }: Props) {
  const [adminMode, setAdminMode] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const adminButtonRef = useRef<HTMLButtonElement>(null);
  const admin = useCommunityAdmin(adminMode || loginOpen, community.refresh);
  const selected = community.selected;
  const filteredSubjects = community.filters.qualification
    ? subjects.filter((subject) => subject.qualification === community.filters.qualification)
    : subjects;
  const transfer = selected ? community.progress[selected.id] : null;

  // Refresh public catalog whenever exiting admin mode
  const prevAdminMode = useRef(adminMode);
  useEffect(() => {
    if (prevAdminMode.current && !adminMode) {
      void community.refresh();
    }
    prevAdminMode.current = adminMode;
  }, [adminMode, community.refresh]);

  const featuredList = useMemo(() => {
    if (community.filters.query.trim() || community.result.items.length === 0) return [];
    const sorted = [...community.result.items].sort(
      (a, b) => b.upvotes - a.upvotes || b.opens - a.opens,
    );
    return sorted.slice(0, Math.min(5, sorted.length));
  }, [community.filters.query, community.result.items]);

  async function enterAdmin() {
    if (admin.identity && !admin.identity.requiresMfa) {
      setAdminMode(true);
      return;
    }
    const status = await api.communityAdminStatus();
    if (status && !status.requiresMfa) {
      admin.setIdentity(status);
      setAdminMode(true);
    } else {
      setLoginOpen(true);
    }
  }

  function closeLogin() {
    setLoginOpen(false);
    requestAnimationFrame(() => adminButtonRef.current?.focus());
  }

  if (adminMode && admin.identity && !admin.identity.requiresMfa) {
    return (
      <div className="view">
        <AdminWorkspace
          admin={admin}
          subjects={subjects}
          onBrowse={() => {
            setAdminMode(false);
            void community.refresh();
          }}
          onOpen={onOpen}
        />
      </div>
    );
  }

  return (
    <div className="view cr-view">
      <div className="cr-head">
        <div className="cr-brand">
          <div className="cr-brand-badge">
            <Icon name="book" />
          </div>
          <div className="cr-brand-text">
            <h1>Community Library</h1>
            <p>Curated Cambridge textbooks, revision guides & notes</p>
          </div>
        </div>
        <div className="cr-search-wrap">
          <Icon name="search" />
          <input
            value={community.filters.query}
            onChange={(event) => community.patchFilters({ query: event.target.value })}
            placeholder="Search notes, authors, subjects or syllabus codes…"
            aria-label="Search community resources"
          />
          {community.filters.query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => community.patchFilters({ query: '' })}
            >
              <Icon name="x" />
            </button>
          )}
        </div>
        <Button ref={adminButtonRef} label="Admin" icon="sliders" onClick={enterAdmin} />
      </div>

      <div className="cr-filters">
        <div role="group" aria-label="Qualification">
          {COMMUNITY_QUALIFICATIONS.map((qualification) => (
            <Chip
              key={qualification}
              label={communityQualificationLabel(qualification)}
              palette={
                qualification === 'a_level'
                  ? 'a-level'
                  : qualification === 'igcse'
                    ? 'igcse'
                    : 'o-level'
              }
              filled={community.filters.qualification === qualification}
              onClick={() =>
                community.patchFilters({
                  qualification:
                    community.filters.qualification === qualification ? null : qualification,
                  subjectCode: null,
                })
              }
            />
          ))}
        </div>
        <label>
          Subject
          <select
            value={community.filters.subjectCode ?? ''}
            onChange={(event) =>
              community.patchFilters({ subjectCode: event.target.value || null })
            }
          >
            <option value="">All subjects</option>
            {filteredSubjects.map((subject) => (
              <option
                key={`${subject.qualification}-${subject.code}`}
                value={subject.code}
              >
                {subject.name} · {subject.code}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select
            value={community.filters.resourceType ?? ''}
            onChange={(event) =>
              community.patchFilters({
                resourceType: (event.target.value || null) as typeof community.filters.resourceType,
              })
            }
          >
            <option value="">All resources</option>
            {COMMUNITY_RESOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {communityTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select
            value={community.filters.sort}
            onChange={(event) =>
              community.patchFilters({ sort: event.target.value as typeof community.filters.sort })
            }
          >
            {COMMUNITY_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {communitySortLabel(sort)}
              </option>
            ))}
          </select>
        </label>
        <span className="cr-count">
          {community.loading
            ? 'Looking…'
            : `${community.result.total.toLocaleString()} resource${
                community.result.total === 1 ? '' : 's'
              }`}
        </span>
      </div>

      <div className="cr-main-scroll">
        {community.error && community.result.items.length === 0 ? (
          <div className="cr-state" role="status">
            <Icon name={community.configured === false ? 'folder' : 'warn'} />
            <h2>
              {community.configured === false
                ? 'Community Resources needs its home'
                : 'The catalogue is out of reach'}
            </h2>
            <p>{community.error}</p>
            <Button label="Try again" icon="sync" onClick={() => void community.refresh()} />
          </div>
        ) : community.result.items.length === 0 && !community.loading ? (
          <div className="cr-state">
            <Icon name="search" />
            <h2>No resources match</h2>
            <p>Clear a filter or try a broader search.</p>
            <Button
              label="Clear filters"
              onClick={() =>
                community.patchFilters({
                  query: '',
                  qualification: null,
                  subjectCode: null,
                  resourceType: null,
                })
              }
            />
          </div>
        ) : (
          <div className="cr-catalog">
            {featuredList.length > 0 && (
              <HeroSpotlight
                resources={featuredList}
                onSelect={(r) => community.setSelectedId(r.id)}
                onOpen={(r) =>
                  void community.open(r).then((ready) => ready && onOpen(ready))
                }
                progress={community.progress}
              />
            )}

            <div className="cr-grid-section">
              <div className="cr-section-bar">
                <div className="cr-section-text">
                  <h2>
                    {community.filters.query
                      ? `Search Results for "${community.filters.query}"`
                      : 'All Resources'}
                  </h2>
                  <p>Browse books, revision guides, and notes</p>
                </div>
                <span className="cr-section-count">
                  {community.result.total.toLocaleString()}{' '}
                  {community.result.total === 1 ? 'resource' : 'resources'}
                </span>
              </div>

              <div className="cr-card-grid">
                {community.result.items.map((resource) => (
                  <BookCard
                    key={resource.id}
                    resource={resource}
                    isSelected={selected?.id === resource.id}
                    onSelect={() => community.setSelectedId(resource.id)}
                    onOpen={() =>
                      void community.open(resource).then((ready) => ready && onOpen(ready))
                    }
                    transfer={community.progress[resource.id] ?? null}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <DetailsDrawer
          resource={selected}
          onClose={() => community.setSelectedId(null)}
          onVote={(r) => void community.vote(r)}
          onOpen={(r) =>
            void community.open(r).then((ready) => ready && onOpen(ready))
          }
          transfer={transfer}
        />
      )}

      {loginOpen && (
        <AdminLogin
          admin={admin}
          onClose={closeLogin}
          onDone={() => {
            setLoginOpen(false);
            setAdminMode(true);
          }}
        />
      )}
    </div>
  );
}

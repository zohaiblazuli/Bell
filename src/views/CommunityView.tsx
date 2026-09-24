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
import Faces from '@ui/shapekit/Faces';
import Mascot from '@/components/Mascot';
import { loadPref, savePref } from '@/lib/store';
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

/** Your own reaction to a resource, kept on this machine. There is no shared reaction service, so
 *  Bell shows no counts rather than invent them; the faces are how you file a resource for yourself. */
const REACTIONS = [
  { id: 'helpful', label: 'Helpful', kind: 'sun' as const },
  { id: 'wow', label: 'Wow', kind: 'blob' as const },
  { id: 'clear', label: 'Clear', kind: 'box' as const },
  { id: 'confusing', label: 'Confusing', kind: 'tri' as const },
];

function useMyReactions(resourceId: string | null) {
  const key = resourceId ? `react.${resourceId}` : null;
  const [mine, setMine] = useState<string[]>(() => (key ? loadPref<string[]>(key, []) : []));
  useEffect(() => setMine(key ? loadPref<string[]>(key, []) : []), [key]);
  const toggle = (id: string) => {
    if (!key) return;
    const next = mine.includes(id) ? mine.filter((m) => m !== id) : [...mine, id];
    setMine(next);
    savePref(key, next);
  };
  return { picked: new Set(mine), toggle };
}

function transferLabel(resource: CommunityResource, transfer: TransferProgress | null | undefined): string {
  if (!transfer) return resource.localPath ? 'Open in the reader' : 'Download to this machine';
  const total = transfer.total && transfer.total > 0 ? transfer.total : resource.sizeBytes;
  const pct = getTransferPercent(transfer.uploaded, total);
  if (transfer.phase === 'starting') return 'Connecting…';
  if (transfer.phase === 'verifying') return 'Verifying checksum…';
  if (transfer.phase === 'opening') return 'Opening in Bell…';
  return pct != null ? `Downloading ${pct}%` : `Downloading (${formatResourceBytes(transfer.uploaded)})`;
}

/** The desk's right-hand column: who made it, the file, the approval note, the upvote, your reaction
 *  and the one action that matters — getting it onto this machine. */
function DeskDetails({
  resource,
  transfer,
  onVote,
  onOpen,
}: {
  resource: CommunityResource;
  transfer: TransferProgress | null | undefined;
  onVote: () => void;
  onOpen: () => void;
}) {
  const reactions = useMyReactions(resource.id);
  const total = transfer?.total && transfer.total > 0 ? transfer.total : resource.sizeBytes;
  const pct = transfer ? getTransferPercent(transfer.uploaded, total) : null;
  return (
    <aside className="crd-details" aria-label="Resource details">
      <div className="crd-id">
        <span className="crd-eyebrow">
          {resource.subjectName} · {resource.subjectCode}
        </span>
        <span className="crd-title">{resource.title}</span>
      </div>
      <dl className="crd-facts">
        <dt>Author</dt>
        <dd>{resource.authorName}</dd>
        <dt>Uploaded by</dt>
        <dd>{resource.uploaderName}</dd>
        {resource.contributorCredit && (
          <>
            <dt>Credit</dt>
            <dd>{resource.contributorCredit}</dd>
          </>
        )}
        <dt>File</dt>
        <dd>
          PDF · {formatResourceBytes(resource.sizeBytes)}
          {resource.pageCount ? ` · ${resource.pageCount} pages` : ''}
        </dd>
        <dt>Published</dt>
        <dd>{resource.publishedAt ? new Date(resource.publishedAt).toLocaleDateString() : 'Recently'}</dd>
      </dl>
      {resource.description && <p className="crd-desc">{resource.description}</p>}
      <div className="crd-trust">
        <i aria-hidden="true" />
        <span>
          <b>Validated, scanned and approved.</b> Nothing here goes public until the administrator publishes it.
        </span>
      </div>
      <div className="crd-vote">
        <button type="button" aria-pressed={resource.hasVoted} onClick={onVote} title={resource.hasVoted ? 'Remove your upvote' : 'Upvote'}>
          <i aria-hidden="true" />
          {resource.upvotes.toLocaleString()}
        </button>
        <span>Votes help others judge. They don't vouch for accuracy.</span>
      </div>
      <div className="crd-react">
        <div className="crd-rule">
          <span>REACTIONS</span>
          <i />
        </div>
        <Faces label="Your reaction to this resource" options={REACTIONS} picked={reactions.picked} onPick={reactions.toggle} />
      </div>
      {transfer && (
        <div className="crd-transfer" role="status" aria-live="polite">
          <div className="crd-transfer-track">
            <i style={pct != null ? { width: `${pct}%` } : undefined} data-indeterminate={pct == null ? 'true' : undefined} />
          </div>
          <span>
            {formatResourceBytes(transfer.uploaded)}
            {total > 0 ? ` / ${formatResourceBytes(total)}` : ''}
            {' · '}
            {[formatTransferSpeed(transfer.speed), formatTransferEta(transfer.secondsLeft)].filter(Boolean).join(' · ')}
          </span>
        </div>
      )}
      <button type="button" className="crd-get" disabled={Boolean(transfer)} onClick={onOpen}>
        {!resource.localPath && <i aria-hidden="true" />}
        {transferLabel(resource, transfer)}
      </button>
      <span className="crd-get-note">
        {resource.localPath ? 'It is on this machine and opens offline.' : 'Once downloaded it opens in the reader, offline.'}
      </span>
    </aside>
  );
}

export default function CommunityView({ community, subjects, onOpen }: Props) {
  const [adminMode, setAdminMode] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const adminButtonRef = useRef<HTMLButtonElement>(null);
  const admin = useCommunityAdmin(adminMode || loginOpen, community.refresh);
  // The desk always shows something: the chosen resource, or the first in the list.
  const selected = community.selected ?? community.result.items[0] ?? null;
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

  const openResource = (r: CommunityResource) => void community.open(r).then((ready) => ready && onOpen(ready));

  return (
    <div className="view cr-view crd">
      {/* Bell App v2's Community desk: filters across the top, then the resource rail, a large
          first-page preview, and the details column. The preview is the biggest thing on screen —
          the resource earns trust, not the chrome around it (DESIGN.md, Community Resources). */}
      <div className="crd-bar">
        <label className="crd-search">
          <i aria-hidden="true" />
          <input
            value={community.filters.query}
            onChange={(event) => community.patchFilters({ query: event.target.value })}
            placeholder="Search community resources"
            aria-label="Search community resources"
          />
          {community.filters.query && (
            <button type="button" aria-label="Clear search" onClick={() => community.patchFilters({ query: '' })}>
              ✕
            </button>
          )}
        </label>
        <div className="crd-quals" role="group" aria-label="Qualification">
          {COMMUNITY_QUALIFICATIONS.map((qualification) => (
            <button
              key={qualification}
              type="button"
              aria-pressed={community.filters.qualification === qualification}
              onClick={() =>
                community.patchFilters({
                  qualification: community.filters.qualification === qualification ? null : qualification,
                  subjectCode: null,
                })
              }
            >
              {communityQualificationLabel(qualification)}
            </button>
          ))}
        </div>
        <select
          className="crd-select"
          aria-label="Subject"
          value={community.filters.subjectCode ?? ''}
          onChange={(event) => community.patchFilters({ subjectCode: event.target.value || null })}
        >
          <option value="">All subjects</option>
          {filteredSubjects.map((subject) => (
            <option key={`${subject.qualification}-${subject.code}`} value={subject.code}>
              {subject.name} · {subject.code}
            </option>
          ))}
        </select>
        <select
          className="crd-select"
          aria-label="Type"
          value={community.filters.resourceType ?? ''}
          onChange={(event) =>
            community.patchFilters({ resourceType: (event.target.value || null) as typeof community.filters.resourceType })
          }
        >
          <option value="">All types</option>
          {COMMUNITY_RESOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {communityTypeLabel(type)}
            </option>
          ))}
        </select>
        <span className="crd-gap" />
        <span className="crd-sort-label">Sort</span>
        <select
          className="crd-select"
          aria-label="Sort"
          value={community.filters.sort}
          onChange={(event) => community.patchFilters({ sort: event.target.value as typeof community.filters.sort })}
        >
          {COMMUNITY_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {communitySortLabel(sort)}
            </option>
          ))}
        </select>
        <span className="crd-online" data-online={community.error ? undefined : 'true'}>
          <i aria-hidden="true" />
          {community.error ? 'Offline' : 'Online'}
        </span>
        <Button ref={adminButtonRef} label="Admin" onClick={enterAdmin} />
      </div>

      {community.error && community.result.items.length === 0 ? (
        <div className="crd-state" role="status">
          <Mascot size={108} mood="empty" />
          <h2>{community.configured === false ? 'Community Resources needs its home' : 'The catalogue is out of reach'}</h2>
          <p>{community.error}</p>
          <Button label="Try again" icon="sync" onClick={() => void community.refresh()} />
        </div>
      ) : community.result.items.length === 0 && !community.loading ? (
        <div className="crd-state">
          <Mascot size={108} mood="empty" />
          <h2>No resources match</h2>
          <p>Clear a filter or try a broader search.</p>
          <Button
            label="Clear filters"
            onClick={() => community.patchFilters({ query: '', qualification: null, subjectCode: null, resourceType: null })}
          />
        </div>
      ) : (
        <div className="crd-desk">
          <nav className="crd-rail" aria-label="Resources">
            <div className="crd-rail-head">
              {community.loading ? 'LOOKING…' : `${community.result.total.toLocaleString()} RESOURCE${community.result.total === 1 ? '' : 'S'} · ADMIN-APPROVED`}
            </div>
            {community.result.items.map((resource) => (
              <button
                key={resource.id}
                type="button"
                className="crd-item"
                aria-current={selected?.id === resource.id ? 'true' : undefined}
                onClick={() => community.setSelectedId(resource.id)}
                onDoubleClick={() => openResource(resource)}
              >
                <ListThumbnail resource={resource} />
                <span className="crd-item-text">
                  <b>{resource.title}</b>
                  <span>
                    {resource.subjectName} · {communityTypeLabel(resource.resourceType)}
                  </span>
                </span>
                <span className="crd-item-votes">▲ {resource.upvotes.toLocaleString()}</span>
              </button>
            ))}
          </nav>

          <div className="crd-preview">
            {selected && (
              <div className="crd-sheet" key={selected.id}>
                <span className="crd-sheet-code">
                  {selected.subjectCode} · {communityTypeLabel(selected.resourceType).toUpperCase()}
                </span>
                <span className="crd-sheet-title">{selected.title}</span>
                <span className="crd-sheet-author">{selected.authorName}</span>
                <i className="crd-sheet-rule" />
                <div className="crd-sheet-page">
                  <CommunityThumbnail resource={selected} />
                </div>
              </div>
            )}
          </div>

          {selected && (
            <DeskDetails
              resource={selected}
              transfer={transfer}
              onVote={() => void community.vote(selected)}
              onOpen={() => openResource(selected)}
            />
          )}
        </div>
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

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
import SubjectIcon from '@ui/icons/SubjectIcon';
import { coverColours } from '@ui/NotebookCover';
import Mascot from '@/components/Mascot';
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
  getTransferPercent,
  mfaQrImageSource,
  type CommunityCreateInput,
  type CommunitySort,
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
  /** The syllabus codes the student sits (onboarding step 03) — the "My subjects" chip. */
  mySubjects: string[];
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

/** Small thumbnail shown in each admin table row. */
function ListThumbnail({ resource }: { resource: CommunityResource }) {
  const { url, ref } = useThumbnailUrl(resource, false);

  return (
    <span ref={ref} className="cr-resource-mark" data-has-thumb={url ? '' : undefined}>
      {url ? <img src={url} alt="" /> : <Icon name="doc" />}
    </span>
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


function transferLabel(resource: CommunityResource, transfer: TransferProgress | null | undefined): string {
  if (!transfer) return resource.localPath ? 'Open in the reader' : 'Download to this machine';
  const total = transfer.total && transfer.total > 0 ? transfer.total : resource.sizeBytes;
  const pct = getTransferPercent(transfer.uploaded, total);
  if (transfer.phase === 'starting') return 'Connecting…';
  if (transfer.phase === 'verifying') return 'Verifying checksum…';
  if (transfer.phase === 'opening') return 'Opening in Bell…';
  return pct != null ? `Downloading ${pct}%` : `Downloading (${formatResourceBytes(transfer.uploaded)})`;
}

/** Most downloaded is worked out here; the other orders are the server's. */
type ViewSort = 'downloads' | CommunitySort;
const VIEW_SORTS: readonly ViewSort[] = ['downloads', ...COMMUNITY_SORTS];
const viewSortLabel = (sort: ViewSort) => (sort === 'downloads' ? 'Most downloaded' : communitySortLabel(sort));

/** The carousel's auto-advance, and how many of your subjects' best it cycles through. */
const SLIDE_MS = 6000;
const TOP_PICKS = 4;

/** A subject's colours, the same pairings its exercise books wear. */
const subjectColours = (r: CommunityResource) =>
  coverColours({ code: r.subjectCode, name: r.subjectName }, 1);

/** The resource's first page on a paper sheet: code and type, title, a rule, then the page. */
function PosterSheet({ resource, size }: { resource: CommunityResource; size: 'hero' | 'card' }) {
  const { url, ref } = useThumbnailUrl(resource, size === 'hero');
  return (
    <div ref={ref} className={size === 'hero' ? 'cxp-sheet cxp-sheet--hero' : 'cxp-sheet cxp-sheet--card'}>
      <span className="cxp-sheet__code">
        {resource.subjectCode} · {communityTypeLabel(resource.resourceType)}
      </span>
      <span className="cxp-sheet__title">{resource.title}</span>
      <i className="cxp-sheet__rule" />
      <div className="cxp-sheet__page" data-has-thumb={url ? '' : undefined}>
        {url ? <img src={url} alt={`First page of ${resource.title}`} /> : <span>first-page preview</span>}
      </div>
    </div>
  );
}

function motionOff(): boolean {
  if (typeof window === 'undefined') return true;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return true;
  return document.querySelector('.app[data-motion="off"]') !== null;
}

export default function CommunityView({ community, subjects, mySubjects, onOpen }: Props) {
  const [adminMode, setAdminMode] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const adminButtonRef = useRef<HTMLButtonElement>(null);
  const admin = useCommunityAdmin(adminMode || loginOpen, community.refresh);
  /* Poster (Bell App v2): subject chips over a carousel of the most downloaded resources in your
     subjects, then every resource in the chosen scope as a card, most downloaded first. Pressing a
     card puts it in the carousel. */
  const [scope, setScope] = useState<'mine' | 'all'>(mySubjects.length ? 'mine' : 'all');
  const [viewSort, setViewSort] = useState<ViewSort>('downloads');
  const [slide, setSlide] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const hold = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);

  const mine = useMemo(() => new Set(mySubjects), [mySubjects]);
  const subjectName = (code: string) => subjects.find((s) => s.code === code)?.name ?? code;
  const byDownloads = (a: CommunityResource, b: CommunityResource) => b.downloads - a.downloads;
  const items = useMemo(() => {
    const all = community.result.items;
    const scoped = community.filters.subjectCode || scope === 'all' ? all : all.filter((r) => mine.has(r.subjectCode));
    return viewSort === 'downloads' ? scoped.slice().sort(byDownloads) : scoped;
  }, [community.result.items, community.filters.subjectCode, scope, mine, viewSort]);
  const top = useMemo(
    () => community.result.items.filter((r) => mine.size === 0 || mine.has(r.subjectCode)).slice().sort(byDownloads).slice(0, TOP_PICKS),
    [community.result.items, mine],
  );
  const pickedResource = picked ? community.result.items.find((r) => r.id === picked) ?? null : null;
  const slides = pickedResource && !top.includes(pickedResource) ? [...top, pickedResource] : top;
  const n = slides.length;
  const index = n ? ((slide % n) + n) % n : 0;

  // The carousel turns itself every six seconds, unless it is being hovered or motion is off.
  useEffect(() => {
    if (n < 2 || motionOff()) return;
    const timer = window.setInterval(() => {
      if (!hold.current) setSlide((i) => i + 1);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [n]);

  const feature = (r: CommunityResource) => {
    const k = top.indexOf(r);
    if (k >= 0) {
      setPicked(null);
      setSlide(k);
    } else {
      setPicked(r.id);
      setSlide(top.length);
    }
    scroller.current?.scrollTo({ top: 0, behavior: motionOff() ? 'auto' : 'smooth' });
  };
  const chipScope = community.filters.subjectCode ?? scope;
  const scopeLabel =
    chipScope === 'all' ? 'ALL SUBJECTS' : chipScope === 'mine' ? 'YOUR SUBJECTS' : subjectName(chipScope).toUpperCase();

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
  const chips: [string, string][] = [
    ['mine', 'My subjects'],
    ['all', 'All subjects'],
    ...mySubjects.map((code): [string, string] => [code, subjectName(code)]),
  ];

  return (
    <div className="view cr-view cxp">
      <div className="cxp-bar">
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
        <div className="cxp-chips" role="group" aria-label="Subjects">
          {chips.map(([key, label]) => {
            const on = chipScope === key;
            const dot = /^\d{4}$/.test(key) ? coverColours({ code: key, name: label }, 1).bg : null;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setPicked(null);
                  setSlide(0);
                  if (key === 'mine' || key === 'all') {
                    setScope(key);
                    community.patchFilters({ subjectCode: null });
                  } else {
                    community.patchFilters({ subjectCode: key });
                  }
                }}
              >
                {dot && <i style={{ background: dot }} aria-hidden="true" />}
                {label}
              </button>
            );
          })}
        </div>
        {/* Sort, the online light and Admin stay together when the bar wraps. */}
        <div className="cxp-end">
          <span className="crd-sort-label">Sort</span>
          <select
            className="crd-select"
            aria-label="Sort"
            value={viewSort}
            onChange={(event) => {
              const next = event.target.value as ViewSort;
              setViewSort(next);
              community.patchFilters({ sort: next === 'downloads' ? 'popular' : next });
            }}
          >
            {VIEW_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {viewSortLabel(sort)}
              </option>
            ))}
          </select>
          <span
            className="crd-online cxp-online"
            data-online={community.error ? undefined : 'true'}
            title={community.error ? 'Offline' : 'Online'}
          >
            <i aria-hidden="true" />
            <span className="cxp-sr">{community.error ? 'Offline' : 'Online'}</span>
          </span>
          <Button ref={adminButtonRef} label="Admin" onClick={enterAdmin} />
        </div>
      </div>

      {community.error && community.result.items.length === 0 ? (
        <div className="crd-state" role="status">
          <Mascot size={108} mood="empty" />
          <h2>{community.configured === false ? 'Community Resources needs its home' : 'The catalogue is out of reach'}</h2>
          <p>{community.error}</p>
          <Button label="Try again" icon="sync" onClick={() => void community.refresh()} />
        </div>
      ) : items.length === 0 && !community.loading ? (
        <div className="crd-state">
          <Mascot size={108} mood="empty" />
          <h2>No resources match</h2>
          <p>Try all subjects, or a broader search.</p>
          <Button
            label="Show everything"
            onClick={() => {
              setScope('all');
              community.patchFilters({ query: '', subjectCode: null });
            }}
          />
        </div>
      ) : (
        <div className="cxp-scroll" ref={scroller}>
          <div className="cxp-page">
            {n > 0 && (
              <>
                <section
                  className="cxp-hero"
                  aria-roledescription="carousel"
                  aria-label="Top picks for your subjects"
                  onMouseEnter={() => (hold.current = true)}
                  onMouseLeave={() => (hold.current = false)}
                  onFocus={() => (hold.current = true)}
                  onBlur={() => (hold.current = false)}
                >
                  <div className="cxp-track" style={{ transform: `translateX(${-index * 100}%)` }}>
                    {slides.map((r, k) => {
                      const { bg, fg } = subjectColours(r);
                      const transfer = community.progress[r.id];
                      const kicker =
                        k < top.length
                          ? `#${k + 1} ${mine.size ? 'FOR YOUR SUBJECTS' : 'MOST DOWNLOADED'} · ${r.subjectName.toUpperCase()}`
                          : `YOU PICKED · ${r.subjectName.toUpperCase()}`;
                      return (
                        <div
                          key={r.id}
                          className="cxp-slide"
                          style={{ background: bg, color: fg }}
                          aria-hidden={k !== index}
                          role="group"
                          aria-roledescription="slide"
                          aria-label={`${k + 1} of ${n}: ${r.title}`}
                        >
                          <div className="cxp-slide__text">
                            <div className="cxp-kicker">
                              <SubjectIcon code={r.subjectCode} size={26} />
                              <span>{kicker}</span>
                            </div>
                            <h2 className="cxp-slide__title">{r.title}</h2>
                            <span className="cxp-slide__meta">
                              {r.authorName} · {communityTypeLabel(r.resourceType)}
                              {r.pageCount ? ` · ${r.pageCount} pages` : ''} · {formatResourceBytes(r.sizeBytes)}
                            </span>
                            <div className="cxp-count">
                              <b>{r.downloads.toLocaleString('en-GB')}</b>
                              <span>downloads</span>
                            </div>
                            <button
                              type="button"
                              className="cxp-get"
                              tabIndex={k === index ? 0 : -1}
                              disabled={Boolean(transfer)}
                              onClick={() => openResource(r)}
                            >
                              {!r.localPath && !transfer && <i aria-hidden="true" />}
                              {transferLabel(r, transfer)}
                            </button>
                          </div>
                          <div className="cxp-slide__sheet">
                            <PosterSheet resource={r} size="hero" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
                <div className="cxp-nav">
                  <span className="cxp-label">YOUR SUBJECTS · TOP PICKS</span>
                  <div className="cxp-dots">
                    {slides.map((r, k) => (
                      <button
                        key={r.id}
                        type="button"
                        title={r.title}
                        aria-label={`Show ${r.title}`}
                        aria-current={k === index ? 'true' : undefined}
                        onClick={() => setSlide(k)}
                      />
                    ))}
                  </div>
                  <span className="crd-gap" />
                  <span className="cxp-counter">
                    {String(index + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
                  </span>
                  <div className="cxp-arrows">
                    <button type="button" aria-label="Previous" onClick={() => setSlide(index - 1)}>
                      <i className="cxp-arrow cxp-arrow--prev" />
                    </button>
                    <button type="button" aria-label="Next" onClick={() => setSlide(index + 1)}>
                      <i className="cxp-arrow cxp-arrow--next" />
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="cxp-rule">
              <span className="cxp-label">
                {community.loading ? 'LOOKING…' : `${items.length.toLocaleString()} RESOURCE${items.length === 1 ? '' : 'S'} · ${scopeLabel}`}
              </span>
              <i />
            </div>
            <div className="cxp-grid">
              {items.map((r, k) => {
                const { bg, fg } = subjectColours(r);
                return (
                  <button
                    key={r.id}
                    type="button"
                    className="cxp-card"
                    style={{ animationDelay: `${Math.min(k, 12) * 50}ms` }}
                    onClick={() => feature(r)}
                    onDoubleClick={() => openResource(r)}
                    title={`Feature ${r.title}`}
                  >
                    <span className="cxp-card__face" style={{ background: bg, color: fg }}>
                      <SubjectIcon code={r.subjectCode} size={26} className="cxp-card__glyph" />
                      <PosterSheet resource={r} size="card" />
                    </span>
                    <span className="cxp-card__text">
                      <b>{r.title}</b>
                      <span className="cxp-card__sub">
                        {r.subjectName} · {communityTypeLabel(r.resourceType)}
                      </span>
                      <span className="cxp-card__count">
                        <b>{r.downloads.toLocaleString('en-GB')}</b>
                        <span>downloads</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
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

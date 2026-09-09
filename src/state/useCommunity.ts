import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import * as api from '@/lib/api';
import {
  emptyCommunityFilters,
  type CommunityAdminIdentity,
  type CommunityAdminInspection,
  type CommunityAdminStats,
  type CommunityCreateInput,
  type CommunityUpdateInput,
  type CommunityFilters,
  type CommunityListResponse,
  type CommunityResource,
  type CommunityResourceStatus,
  type TransferProgress,
} from '@/lib/community';

export function notifyCommunityCatalogueChanged(resourceId?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('community:catalogue-changed', { detail: { resourceId } }),
    );
  }
}

export function useCommunity(active: boolean) {
  const [filters, setFilters] = useState<CommunityFilters>(emptyCommunityFilters);
  const [result, setResult] = useState<CommunityListResponse>({ items: [], total: 0, nextCursor: null });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<Record<string, TransferProgress>>({});
  const hasLoadedRef = useRef(false);
  const lastFiltersRef = useRef<string>('');

  const selected = useMemo(
    () => (selectedId ? result.items.find((resource) => resource.id === selectedId) : null) ?? null,
    [result.items, selectedId],
  );

  const refresh = useCallback(async (showLoading = true) => {
    if (!active) return;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const status = await api.communityStatus();
      setConfigured(status.configured);
      if (!status.configured) {
        setResult({ items: [], total: 0, nextCursor: null });
        setError(status.message ?? 'Community Resources has not been connected yet.');
        return;
      }
      const next = await api.listCommunityResources(filters);
      setResult(next);
      hasLoadedRef.current = true;
      setSelectedId((current) =>
        current && next.items.some((resource) => resource.id === current)
          ? current
          : null,
      );
    } catch (reason) {
      setError(String(reason));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [active, filters]);

  useEffect(() => {
    if (!active) return;
    const filtersKey = JSON.stringify(filters);
    const filtersChanged = filtersKey !== lastFiltersRef.current;
    lastFiltersRef.current = filtersKey;

    if (hasLoadedRef.current && !filtersChanged) {
      return;
    }

    const timer = window.setTimeout(() => void refresh(!hasLoadedRef.current), filters.query ? 260 : 0);
    return () => window.clearTimeout(timer);
  }, [active, filters, refresh]);

  useEffect(() => {
    const handleCatalogueChanged = () => {
      void refresh(false);
    };
    window.addEventListener('community:catalogue-changed', handleCatalogueChanged);
    return () => window.removeEventListener('community:catalogue-changed', handleCatalogueChanged);
  }, [refresh]);

  useEffect(() => {
    const unlisten = listen<TransferProgress>('community:download-progress', (event) => {
      const next = event.payload;
      const now = Date.now();
      setProgress((current) => {
        const prev = current[next.resourceId];
        const startedAt = prev?.startedAt ?? (now - 500);
        const elapsedSec = Math.max(0.2, (now - startedAt) / 1000);
        const speed = next.uploaded > 0 ? Math.round(next.uploaded / elapsedSec) : 0;
        let secondsLeft: number | null = null;
        if (next.total > next.uploaded && speed > 0) {
          secondsLeft = Math.max(1, Math.round((next.total - next.uploaded) / speed));
        }
        return {
          ...current,
          [next.resourceId]: {
            ...next,
            phase: next.phase ?? (next.total > 0 && next.uploaded >= next.total ? 'verifying' : 'downloading'),
            speed,
            secondsLeft,
            startedAt,
          },
        };
      });
    });
    return () => { void unlisten.then((stop) => stop()); };
  }, []);

  const patchFilters = useCallback((patch: Partial<CommunityFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  const vote = useCallback(async (resource: CommunityResource) => {
    const desired = !resource.hasVoted;
    setResult((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === resource.id
          ? { ...item, hasVoted: desired, upvotes: Math.max(0, item.upvotes + (desired ? 1 : -1)) }
          : item,
      ),
    }));
    try {
      const saved = await api.setCommunityVote(resource.id, desired);
      setResult((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === resource.id ? { ...item, ...saved } : item,
        ),
      }));
    } catch (reason) {
      setResult((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === resource.id ? resource : item,
        ),
      }));
      setError(String(reason));
    }
  }, []);

  const open = useCallback(async (resource: CommunityResource): Promise<CommunityResource | null> => {
    setError(null);
    const now = Date.now();
    // Immediately display active feedback
    setProgress((current) => ({
      ...current,
      [resource.id]: {
        resourceId: resource.id,
        uploaded: 0,
        total: resource.sizeBytes || 0,
        phase: resource.localPath ? 'opening' : 'starting',
        startedAt: now,
      },
    }));
    try {
      const downloaded = await api.downloadCommunityResource(resource);
      // Mark as opening so reader transition state is clear
      setProgress((current) => ({
        ...current,
        [resource.id]: {
          resourceId: resource.id,
          uploaded: downloaded.size,
          total: downloaded.size,
          phase: 'opening',
          startedAt: now,
        },
      }));
      const ready = { ...resource, localPath: downloaded.path };
      setResult((current) => ({
        ...current,
        items: current.items.map((item) => item.id === resource.id ? ready : item),
      }));
      void api.recordCommunityOpen(resource.id).catch(() => {});
      return ready;
    } catch (reason) {
      setError(String(reason));
      setProgress((current) => {
        const next = { ...current };
        delete next[resource.id];
        return next;
      });
      return null;
    }
  }, []);

  return {
    filters,
    patchFilters,
    result,
    selected,
    setSelectedId,
    loading,
    error,
    configured,
    progress,
    refresh,
    vote,
    open,
  };
}

export function useCommunityAdmin(active: boolean, onMutate?: () => void) {
  const [identity, setIdentity] = useState<CommunityAdminIdentity | null>(null);
  const [savedUsername, setSavedUsername] = useState<string | null>(null);
  const [resources, setResources] = useState<CommunityResource[]>([]);
  const [stats, setStats] = useState<CommunityAdminStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, TransferProgress>>({});
  const [inspections, setInspections] = useState<Record<string, CommunityAdminInspection>>({});
  const [inspectionLoading, setInspectionLoading] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!active || !identity || identity.requiresMfa) return;
    setBusy(true);
    setError(null);
    try {
      const [nextResources, nextStats] = await Promise.all([
        api.listCommunityAdminResources(),
        api.communityAdminStats(),
      ]);
      setResources(nextResources);
      setStats(nextStats);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  }, [active, identity]);

  useEffect(() => {
    void api.communityAdminSavedUsername().then(setSavedUsername).catch(() => {});
    void api.communityAdminStatus().then(setIdentity).catch(() => setIdentity(null));
  }, []);

  useEffect(() => {
    if (!active) return;
    void api.communityAdminStatus().then(setIdentity).catch(() => setIdentity(null));
  }, [active]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const unlisten = listen<TransferProgress>('community:upload-progress', (event) => {
      const next = event.payload;
      setUploadProgress((current) => ({ ...current, [next.resourceId]: next }));
    });
    return () => { void unlisten.then((stop) => stop()); };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    setBusy(true);
    setError(null);
    try {
      const next = await api.communityAdminSignIn(username, password);
      setIdentity(next);
      return true;
    } catch (reason) {
      setError(String(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const verifyMfa = useCallback(async (code: string) => {
    setBusy(true);
    setError(null);
    try {
      const next = await api.communityAdminVerifyMfa(code);
      setIdentity(next);
      return true;
    } catch (reason) {
      setError(String(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await api.communityAdminSignOut();
    setIdentity(null);
    setResources([]);
    setStats(null);
    void api.communityAdminSavedUsername().then(setSavedUsername).catch(() => {});
  }, []);

  const createAndUpload = useCallback(async (input: CommunityCreateInput, filePath: string) => {
    setBusy(true);
    setError(null);
    try {
      const resource = await api.createCommunityResource(input);
      await api.uploadCommunityResource(resource, filePath);
      await refresh();
      notifyCommunityCatalogueChanged(resource.id);
      onMutate?.();
      return resource.id;
    } catch (reason) {
      setError(String(reason));
      return null;
    } finally {
      setBusy(false);
    }
  }, [refresh, onMutate]);

  const setStatus = useCallback(async (
    resourceId: string,
    status: Extract<CommunityResourceStatus, 'published' | 'unpublished' | 'rejected' | 'archived'>,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.setCommunityResourceStatus(resourceId, status);
      setResources((current) => current.map((resource) => resource.id === resourceId ? updated : resource));
      await refresh();
      notifyCommunityCatalogueChanged(resourceId);
      onMutate?.();
      return updated;
    } catch (reason) {
      setError(String(reason));
      return null;
    } finally {
      setBusy(false);
    }
  }, [refresh, onMutate]);

  const preview = useCallback(async (resource: CommunityResource) => {
    setBusy(true);
    setError(null);
    try {
      const downloaded = await api.previewCommunityAdminResource(resource);
      return { ...resource, localPath: downloaded.path };
    } catch (reason) {
      setError(String(reason));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const inspect = useCallback(async (resourceId: string) => {
    setInspectionLoading(resourceId);
    setError(null);
    try {
      const inspection = await api.communityAdminInspection(resourceId);
      setInspections((current) => ({ ...current, [resourceId]: inspection }));
      return inspection;
    } catch (reason) {
      setError(String(reason));
      return null;
    } finally {
      setInspectionLoading(null);
    }
  }, []);

  const deleteResource = useCallback(async (resourceId: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteCommunityResource(resourceId);
      setResources((current) => current.filter((resource) => resource.id !== resourceId));
      await refresh();
      notifyCommunityCatalogueChanged(resourceId);
      onMutate?.();
      return true;
    } catch (reason) {
      setError(String(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }, [refresh, onMutate]);

  const updateResource = useCallback(async (resourceId: string, input: CommunityUpdateInput) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.updateCommunityResource(resourceId, input);
      setResources((current) => current.map((res) => res.id === resourceId ? updated : res));
      await refresh();
      notifyCommunityCatalogueChanged(resourceId);
      onMutate?.();
      return updated;
    } catch (reason) {
      setError(String(reason));
      return null;
    } finally {
      setBusy(false);
    }
  }, [refresh, onMutate]);

  const uploadThumbnail = useCallback(async (resourceId: string, filePath: string) => {
    setBusy(true);
    setError(null);
    try {
      await api.uploadCommunityThumbnail(resourceId, filePath);
      await refresh();
      notifyCommunityCatalogueChanged(resourceId);
      onMutate?.();
      return true;
    } catch (reason) {
      setError(String(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }, [refresh, onMutate]);

  return {
    identity,
    savedUsername,
    setIdentity,
    resources,
    stats,
    busy,
    error,
    uploadProgress,
    inspections,
    inspectionLoading,
    signIn,
    verifyMfa,
    signOut,
    refresh,
    createAndUpload,
    updateResource,
    uploadThumbnail,
    setStatus,
    preview,
    inspect,
    deleteResource,
  };
}


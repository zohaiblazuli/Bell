import { useCallback, useEffect, useRef, useState } from 'react';
import * as workspace from '@/lib/workspace';

export function useWorkspace(active: boolean) {
  const [documents, setDocuments] = useState<workspace.WorkspaceDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      setDocuments(await workspace.listWorkspaceDocuments());
      hasLoaded.current = true;
    } catch (reason) {
      setError(String(reason));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active && !hasLoaded.current) void refresh(true);
  }, [active, refresh]);

  const importDocument = useCallback(async (path: string) => {
    setError(null);
    const document = await workspace.importWorkspaceDocument(path);
    setDocuments((current) => [document, ...current]);
    return document;
  }, []);

  const importDocuments = useCallback(async (paths: string[]) => {
    setError(null);
    const added: workspace.WorkspaceDocument[] = [];
    let lastError: string | null = null;
    for (const p of paths) {
      try {
        const doc = await workspace.importWorkspaceDocument(p);
        added.push(doc);
      } catch (reason) {
        lastError = String(reason);
      }
    }
    if (added.length > 0) {
      setDocuments((current) => [...added, ...current]);
    }
    if (lastError && added.length === 0) {
      setError(lastError);
    }
    return added;
  }, []);

  const remove = useCallback(async (id: string) => {
    await workspace.deleteWorkspaceDocument(id);
    setDocuments((current) => current.filter((document) => document.id !== id));
  }, []);

  return { documents, loading, error, setError, refresh, importDocument, importDocuments, remove };
}

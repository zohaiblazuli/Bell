import { invoke } from '@tauri-apps/api/core';
import type { CommunityResource } from './community';

export interface WorkspaceDocument {
  id: string;
  title: string;
  originalName: string;
  path: string;
  size: number;
  importedAt: number;
  lastOpenedAt: number | null;
}

export const listWorkspaceDocuments = () => invoke<WorkspaceDocument[]>('workspace_list');
export const importWorkspaceDocument = (sourcePath: string) =>
  invoke<WorkspaceDocument>('workspace_import', { sourcePath });
export const recordWorkspaceOpen = (id: string) => invoke<void>('workspace_record_open', { id });
export const deleteWorkspaceDocument = (id: string) =>
  invoke<boolean>('workspace_delete', { id });

const reads = new Map<string, Promise<ArrayBuffer>>();
export function readWorkspaceDocument(path: string): Promise<ArrayBuffer> {
  const pending = reads.get(path);
  if (pending) return pending;
  const request = invoke<ArrayBuffer>('workspace_read_document', { path }).finally(() => {
    reads.delete(path);
  });
  reads.set(path, request);
  return request;
}

export function workspaceReaderResource(document: WorkspaceDocument): CommunityResource {
  const stamp = new Date(document.importedAt).toISOString();
  return {
    id: `workspace-${document.id}`,
    title: document.title,
    description: 'A private document imported into this device’s Workspace.',
    qualification: 'a_level',
    level: '',
    subjectCode: 'LOCAL',
    subjectName: 'Workspace',
    resourceType: 'other',
    authorName: 'You',
    uploaderName: 'You',
    contributorCredit: null,
    sourceUrl: null,
    rightsConfirmed: true,
    pageCount: null,
    sizeBytes: document.size,
    sha256: null,
    version: 1,
    upvotes: 0,
    downloads: 0,
    opens: 0,
    popularityScore: 0,
    publishedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
    status: 'published',
    scanStatus: null,
    hasVoted: false,
    localPath: document.path,
  };
}

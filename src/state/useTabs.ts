import { useCallback, useEffect, useReducer } from 'react';
import type { PaperRow } from '@/lib/types';
import type { CommunityResource } from '@/lib/community';
import type { View } from '@/components/Sidebar';
import type { WorkspaceDocument } from '@/lib/workspace';

export type TabKind = 'shelf' | 'paper' | 'book' | 'notebook' | 'workspace-doc';

export interface TabItem {
  id: string;
  kind: TabKind;
  title: string;
  subtitle?: string;
  icon: string;
  closable: boolean;
  pinned?: boolean;

  shelfView?: View;
  paper?: PaperRow;
  community?: CommunityResource;
  notebook?: { id: string; page: number };
  workspace?: WorkspaceDocument;
  notebookOpen?: boolean;

  lastPage?: number;
  zoom?: number;
  hasTimer?: boolean;
}

export interface TabsState {
  tabs: TabItem[];
  activeId: string;
}

export type TabAction =
  | { type: 'SELECT_TAB'; id: string }
  | { type: 'OPEN_PAPER'; paper: PaperRow; background?: boolean }
  | { type: 'OPEN_BOOK'; resource: CommunityResource; background?: boolean }
  | { type: 'OPEN_NOTEBOOK'; id: string; name?: string; page?: number; background?: boolean }
  | { type: 'OPEN_WORKSPACE_DOCUMENT'; document: WorkspaceDocument; notebook?: boolean; background?: boolean }
  | { type: 'OPEN_SHELF'; view: View }
  | { type: 'CLOSE_TAB'; id: string }
  | { type: 'CLOSE_OTHER_TABS'; keepId: string }
  | { type: 'CLOSE_TABS_TO_RIGHT'; id: string }
  | { type: 'REORDER_TABS'; startIndex: number; endIndex: number }
  | { type: 'NEXT_TAB' }
  | { type: 'PREV_TAB' }
  | { type: 'SELECT_BY_INDEX'; index: number };

const STORAGE_KEY = 'bell:tabs:v1';

export const DEFAULT_LIBRARY_TAB: TabItem = {
  id: 'shelf:library',
  kind: 'shelf',
  title: 'Library',
  subtitle: 'Catalogue',
  icon: 'lib',
  closable: false,
  pinned: true,
  shelfView: 'library',
};

export function shelfIcon(view: View): string {
  switch (view) {
    case 'community':
      return 'book';
    case 'workspace':
      return 'folder';
    case 'dashboard':
      return 'dash';
    case 'bookmarks':
      return 'bm';
    case 'recent':
      return 'clock';
    case 'notebooks':
      return 'notebook';
    case 'settings':
      return 'sliders';
    default:
      return 'lib';
  }
}

export function shelfTitle(view: View): string {
  switch (view) {
    case 'community':
      return 'Community';
    case 'workspace':
      return 'Workspace';
    case 'dashboard':
      return 'Dashboard';
    case 'bookmarks':
      return 'Bookmarks';
    case 'recent':
      return 'Recent';
    case 'notebooks':
      return 'Notebooks';
    case 'settings':
      return 'Settings';
    default:
      return 'Library';
  }
}

export function tabReducer(state: TabsState, action: TabAction): TabsState {
  switch (action.type) {
    case 'SELECT_TAB': {
      if (!state.tabs.some((t) => t.id === action.id)) return state;
      return { ...state, activeId: action.id };
    }

    case 'OPEN_PAPER': {
      const tabId = `paper:${action.paper.id}`;
      const code = `${action.paper.subjectCode}/${action.paper.paperNumber}`;
      const subtitle = action.paper.scode;

      const existing = state.tabs.find((t) => t.id === tabId);
      if (existing) {
        return {
          ...state,
          activeId: action.background ? state.activeId : tabId,
        };
      }

      const newTab: TabItem = {
        id: tabId,
        kind: 'paper',
        title: `${action.paper.subjectName} · ${code}`,
        subtitle,
        icon: 'doc',
        closable: true,
        paper: action.paper,
      };

      return {
        tabs: [...state.tabs, newTab],
        activeId: action.background ? state.activeId : tabId,
      };
    }

    case 'OPEN_BOOK': {
      const tabId = `book:${action.resource.id}`;
      const subtitle = action.resource.subjectCode
        ? `${action.resource.subjectCode} · ${action.resource.resourceType}`
        : action.resource.resourceType;

      const existing = state.tabs.find((t) => t.id === tabId);
      if (existing) {
        return {
          ...state,
          activeId: action.background ? state.activeId : tabId,
        };
      }

      const newTab: TabItem = {
        id: tabId,
        kind: 'book',
        title: action.resource.title,
        subtitle,
        icon: 'book',
        closable: true,
        community: action.resource,
      };

      return {
        tabs: [...state.tabs, newTab],
        activeId: action.background ? state.activeId : tabId,
      };
    }

    case 'OPEN_NOTEBOOK': {
      const tabId = `notebook:${action.id}`;
      const page = action.page ?? 0;

      const existing = state.tabs.find((t) => t.id === tabId);
      if (existing) {
        const updatedTabs = state.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                notebook: { id: action.id, page },
                title: action.name || t.title,
                subtitle: `Page ${page + 1}`,
              }
            : t,
        );
        return {
          tabs: updatedTabs,
          activeId: action.background ? state.activeId : tabId,
        };
      }

      const newTab: TabItem = {
        id: tabId,
        kind: 'notebook',
        title: action.name || 'Notebook',
        subtitle: `Page ${page + 1}`,
        icon: 'notebook',
        closable: true,
        notebook: { id: action.id, page },
      };

      return {
        tabs: [...state.tabs, newTab],
        activeId: action.background ? state.activeId : tabId,
      };
    }

    case 'OPEN_WORKSPACE_DOCUMENT': {
      const tabId = `workspace:${action.document.id}`;
      const existing = state.tabs.find((t) => t.id === tabId);
      if (existing) {
        return {
          tabs: state.tabs.map((tab) => tab.id === tabId
            ? { ...tab, workspace: action.document, notebookOpen: action.notebook || tab.notebookOpen }
            : tab),
          activeId: action.background ? state.activeId : tabId,
        };
      }
      return {
        tabs: [...state.tabs, {
          id: tabId,
          kind: 'workspace-doc',
          title: action.document.title,
          subtitle: 'LOCAL',
          icon: 'doc',
          closable: true,
          workspace: action.document,
          notebookOpen: action.notebook,
        }],
        activeId: action.background ? state.activeId : tabId,
      };
    }

    case 'OPEN_SHELF': {
      const shelfIndex = state.tabs.findIndex((t) => t.kind === 'shelf');
      if (shelfIndex >= 0) {
        const updatedTabs = [...state.tabs];
        updatedTabs[shelfIndex] = {
          ...updatedTabs[shelfIndex],
          shelfView: action.view,
          title: shelfTitle(action.view),
          icon: shelfIcon(action.view),
        };
        return {
          tabs: updatedTabs,
          activeId: updatedTabs[shelfIndex].id,
        };
      }

      const newShelfTab: TabItem = {
        ...DEFAULT_LIBRARY_TAB,
        shelfView: action.view,
        title: shelfTitle(action.view),
        icon: shelfIcon(action.view),
      };

      return {
        tabs: [newShelfTab, ...state.tabs],
        activeId: newShelfTab.id,
      };
    }

    case 'CLOSE_TAB': {
      const tabToClose = state.tabs.find((t) => t.id === action.id);
      if (!tabToClose || !tabToClose.closable) return state;

      const closingIndex = state.tabs.findIndex((t) => t.id === action.id);
      const newTabs = state.tabs.filter((t) => t.id !== action.id);

      if (state.activeId !== action.id) {
        return { ...state, tabs: newTabs };
      }

      const nextIndex = Math.min(closingIndex, newTabs.length - 1);
      const nextActiveId = newTabs[nextIndex]?.id ?? DEFAULT_LIBRARY_TAB.id;

      return {
        tabs: newTabs.length > 0 ? newTabs : [DEFAULT_LIBRARY_TAB],
        activeId: nextActiveId,
      };
    }

    case 'CLOSE_OTHER_TABS': {
      const newTabs = state.tabs.filter((t) => !t.closable || t.id === action.keepId);
      return {
        tabs: newTabs,
        activeId: action.keepId,
      };
    }

    case 'CLOSE_TABS_TO_RIGHT': {
      const index = state.tabs.findIndex((t) => t.id === action.id);
      if (index === -1) return state;
      const newTabs = state.tabs.filter((t, i) => i <= index || !t.closable);
      const activeStillExists = newTabs.some((t) => t.id === state.activeId);
      return {
        tabs: newTabs,
        activeId: activeStillExists ? state.activeId : action.id,
      };
    }

    case 'REORDER_TABS': {
      const { startIndex, endIndex } = action;
      if (
        startIndex < 0 ||
        startIndex >= state.tabs.length ||
        endIndex < 0 ||
        endIndex >= state.tabs.length ||
        startIndex === endIndex
      ) {
        return state;
      }
      const newTabs = [...state.tabs];
      const [removed] = newTabs.splice(startIndex, 1);
      newTabs.splice(endIndex, 0, removed);
      return { ...state, tabs: newTabs };
    }

    case 'NEXT_TAB': {
      if (state.tabs.length <= 1) return state;
      const idx = state.tabs.findIndex((t) => t.id === state.activeId);
      const nextIdx = (idx + 1) % state.tabs.length;
      return { ...state, activeId: state.tabs[nextIdx].id };
    }

    case 'PREV_TAB': {
      if (state.tabs.length <= 1) return state;
      const idx = state.tabs.findIndex((t) => t.id === state.activeId);
      const prevIdx = (idx - 1 + state.tabs.length) % state.tabs.length;
      return { ...state, activeId: state.tabs[prevIdx].id };
    }

    case 'SELECT_BY_INDEX': {
      if (action.index < 0 || action.index >= state.tabs.length) return state;
      return { ...state, activeId: state.tabs[action.index].id };
    }

    default:
      return state;
  }
}

export function loadSavedTabs(): TabsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tabs: [DEFAULT_LIBRARY_TAB], activeId: DEFAULT_LIBRARY_TAB.id };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0 && typeof parsed.activeId === 'string') {
      const restored = (parsed.tabs as TabItem[]).map((tab) => {
        if (tab.kind !== 'paper' || !tab.paper) return tab;
        const code = `${tab.paper.subjectCode}/${tab.paper.paperNumber}`;
        return { ...tab, title: `${tab.paper.subjectName} · ${code}` };
      });
      const hasLibrary = restored.some((t) => t.id === DEFAULT_LIBRARY_TAB.id);
      const tabs = hasLibrary ? restored : [DEFAULT_LIBRARY_TAB, ...restored];
      const activeId = tabs.some((t: TabItem) => t.id === parsed.activeId)
        ? parsed.activeId
        : tabs[0].id;
      return { tabs, activeId };
    }
  } catch {
    // Ignore corrupt storage and fall back to default
  }
  return { tabs: [DEFAULT_LIBRARY_TAB], activeId: DEFAULT_LIBRARY_TAB.id };
}

export function useTabs() {
  const [tabsState, dispatch] = useReducer(tabReducer, undefined, loadSavedTabs);
  const { tabs, activeId } = tabsState;

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0] ?? DEFAULT_LIBRARY_TAB;

  // Save tabs to local storage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeId }));
    } catch {
      // Storage quota or disabled; safely ignore
    }
  }, [tabs, activeId]);

  const selectTab = useCallback((id: string) => {
    dispatch({ type: 'SELECT_TAB', id });
  }, []);

  const openPaper = useCallback((paper: PaperRow, options?: { background?: boolean }) => {
    dispatch({ type: 'OPEN_PAPER', paper, background: options?.background });
  }, []);

  const openBook = useCallback((resource: CommunityResource, options?: { background?: boolean }) => {
    dispatch({ type: 'OPEN_BOOK', resource, background: options?.background });
  }, []);

  const openNotebook = useCallback(
    (id: string, name?: string, page = 0, options?: { background?: boolean }) => {
      dispatch({ type: 'OPEN_NOTEBOOK', id, name, page, background: options?.background });
    },
    [],
  );

  const openWorkspaceDocument = useCallback(
    (document: WorkspaceDocument, options?: { background?: boolean; notebook?: boolean }) => {
      dispatch({ type: 'OPEN_WORKSPACE_DOCUMENT', document, ...options });
    },
    [],
  );

  const openShelf = useCallback((view: View) => {
    dispatch({ type: 'OPEN_SHELF', view });
  }, []);

  const closeTab = useCallback((id: string) => {
    dispatch({ type: 'CLOSE_TAB', id });
  }, []);

  const closeOtherTabs = useCallback((keepId: string) => {
    dispatch({ type: 'CLOSE_OTHER_TABS', keepId });
  }, []);

  const closeTabsToRight = useCallback((id: string) => {
    dispatch({ type: 'CLOSE_TABS_TO_RIGHT', id });
  }, []);

  const reorderTabs = useCallback((startIndex: number, endIndex: number) => {
    dispatch({ type: 'REORDER_TABS', startIndex, endIndex });
  }, []);

  const nextTab = useCallback(() => {
    dispatch({ type: 'NEXT_TAB' });
  }, []);

  const prevTab = useCallback(() => {
    dispatch({ type: 'PREV_TAB' });
  }, []);

  const selectTabByIndex = useCallback((index: number) => {
    dispatch({ type: 'SELECT_BY_INDEX', index });
  }, []);

  return {
    tabs,
    activeId,
    activeTab,
    dispatch,
    selectTab,
    selectTabByIndex,
    openPaper,
    openBook,
    openNotebook,
    openWorkspaceDocument,
    openShelf,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    reorderTabs,
    nextTab,
    prevTab,
  };
}

import { useRef, useState } from 'react';
import NavGlyph, { type NavGlyphName } from '@ui/shapekit/NavGlyph';
import SubjectIcon from '@ui/icons/SubjectIcon';
import type { TabItem } from '../state/useTabs';
import type { View } from './Sidebar';
import './TabBar.css';

/** A shelf tab wears its page's sidebar glyph, so the row reads the same as the nav it mirrors. */
const SHELF_GLYPH: Partial<Record<View, NavGlyphName>> = {
  dashboard: 'home',
  library: 'papers',
  notebooks: 'notebooks',
  workspace: 'workspace',
  bookmarks: 'bookmarks',
  recent: 'recent',
  settings: 'settings',
  community: 'community',
};

/**
 * The icon of whatever the tab has open: the page's own glyph for a shelf, the subject's mark for a
 * paper (the card it was opened from carries the same one), and the nav glyph of the place a
 * notebook, community resource or workspace document lives.
 */
function TabIcon({ tab }: { tab: TabItem }) {
  if (tab.kind === 'paper' && tab.paper) return <SubjectIcon code={tab.paper.subjectCode} size={18} />;
  if (tab.kind === 'book') {
    return tab.community?.subjectCode ? <SubjectIcon code={tab.community.subjectCode} size={18} /> : <NavGlyph name="community" />;
  }
  if (tab.kind === 'notebook') return <NavGlyph name="notebooks" />;
  if (tab.kind === 'workspace-doc') return <NavGlyph name="workspace" />;
  return <NavGlyph name={SHELF_GLYPH[tab.shelfView ?? 'library'] ?? 'papers'} />;
}

interface TabBarProps {
  tabs: TabItem[];
  activeId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  /** The + at the end of the row: a new tab on Home, like a browser's new tab page. */
  onNewTab: () => void;
  onReorderTabs?: (fromIndex: number, toIndex: number) => void;
}

/**
 * The document tab row (Bell App v2 · reader tabs): a 40px pale strip that is now ALWAYS on screen,
 * above every shelf and every open document (Zohaib, 2026-09-24). It reads like a browser's:
 * [ Home ] [ open papers/notebooks/pages… ] [ + ]. The first shelf tab is pinned and cannot close;
 * + opens another shelf tab on Home, and the sidebar navigates whichever shelf tab you are on. Every
 * tab wears the icon of what it has open (`TabIcon`). The open one sits on the page colour with a red
 * bar along its top and ink rules either side, like a folder tab.
 */
export default function TabBar({ tabs, activeId, onSelectTab, onCloseTab, onNewTab, onReorderTabs }: TabBarProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const onWheel = (e: React.WheelEvent) => {
    if (stripRef.current && e.deltaY !== 0) stripRef.current.scrollLeft += e.deltaY;
  };

  return (
    <header className="doctabs" ref={stripRef} onWheel={onWheel} data-tauri-drag-region>
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeId;
        const paper = tab.kind === 'paper' ? tab.paper : undefined;
        const title = paper ? paper.subjectName : tab.title;
        const sub = paper ? `${paper.subjectCode}/${paper.component}` : tab.subtitle;
        const tip = paper
          ? `${paper.subjectName} ${paper.subjectCode}/${paper.component} · ${paper.scode}`
          : tab.subtitle
          ? `${tab.title} (${tab.subtitle})`
          : tab.title;

        return (
          <div
            key={tab.id}
            className="doctab"
            role="tab"
            aria-selected={isActive}
            data-kind={tab.kind}
            draggable={tab.closable}
            onClick={() => onSelectTab(tab.id)}
            onMouseDown={(e) => {
              // Middle click closes a tab.
              if (e.button === 1 && tab.closable) {
                e.preventDefault();
                onCloseTab(tab.id);
              }
            }}
            onDragStart={(e) => {
              setDraggedIndex(index);
              e.dataTransfer.setData('text/plain', String(index));
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              if (draggedIndex !== null && draggedIndex !== index) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedIndex !== null && draggedIndex !== index && onReorderTabs) onReorderTabs(draggedIndex, index);
              setDraggedIndex(null);
            }}
            onDragEnd={() => setDraggedIndex(null)}
            title={tip}
          >
            <span className="doctab__icon" aria-hidden="true">
              <TabIcon tab={tab} />
            </span>
            <span className="doctab__title">{title}</span>
            {sub && <span className="doctab__sub">{sub}</span>}
            {tab.hasTimer && <span className="doctab__timer" title="Focus timer active" />}
            {tab.closable && (
              <button
                type="button"
                className="doctab__close"
                aria-label={`Close ${title}`}
                title="Close tab (Ctrl+W)"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}

      <button type="button" className="doctabs__new" aria-label="New tab (Ctrl+T)" title="New tab (Ctrl+T)" onClick={onNewTab}>
        +
      </button>
    </header>
  );
}

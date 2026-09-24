import { useRef, useState } from 'react';
import PaperShape from '@ui/shapekit/PaperShape';
import type { TabItem } from '../state/useTabs';
import './TabBar.css';

interface TabBarProps {
  tabs: TabItem[];
  activeId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  /** The + at the end of the row: opens the command palette to pick another paper. */
  onNewTab: () => void;
  /** The grid button at the start of the row: back to the shelf (Past Papers). */
  onBack: () => void;
  onReorderTabs?: (fromIndex: number, toIndex: number) => void;
}

/**
 * The document tab row (Bell App v2 · reader tabs): a 40px pale strip at the top of an open paper,
 * notebook or community document. The shelf itself is not a tab — the sidebar is how you move
 * between shelves — so the row lists only what is open, with a back-to-Past-Papers button in front
 * and a + that opens the palette. Each paper tab carries its paper-number shape; the open one sits on
 * the page colour with a red bar along its top and ink rules either side, like a folder tab.
 */
export default function TabBar({ tabs, activeId, onSelectTab, onCloseTab, onNewTab, onBack, onReorderTabs }: TabBarProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const onWheel = (e: React.WheelEvent) => {
    if (stripRef.current && e.deltaY !== 0) stripRef.current.scrollLeft += e.deltaY;
  };

  return (
    <header className="doctabs" ref={stripRef} onWheel={onWheel} data-tauri-drag-region>
      <button type="button" className="doctabs__back" title="Past Papers" aria-label="Back to Past Papers" onClick={onBack}>
        <i />
      </button>

      {tabs.map((tab, index) => {
        if (tab.kind === 'shelf') return null;
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
            {paper ? (
              <PaperShape n={paper.paperNumber} size={10} />
            ) : (
              <span className={`doctab__mark doctab__mark--${tab.kind}`} aria-hidden="true" />
            )}
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

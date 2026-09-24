import { useRef, useState } from 'react';
import WindowLights from './WindowLights';
import Icon, { type IconName } from './Icon';
import TonePill, { type Tone } from '@ui/TonePill';
import type { TabItem } from '../state/useTabs';
import './TabBar.css';

interface TabBarProps {
  tabs: TabItem[];
  activeId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onReorderTabs?: (fromIndex: number, toIndex: number) => void;
  tone: Tone;
  onTone: () => void;
  /** Kept for callers; search lives in each screen's top bar now. */
  onSearch?: () => void;
}

export default function TabBar({
  tabs,
  activeId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onReorderTabs,
  tone,
  onTone,
}: TabBarProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const onWheel = (e: React.WheelEvent) => {
    if (stripRef.current && e.deltaY !== 0) {
      stripRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <header className="tabbar" data-tauri-drag-region>
      {/* The tab strip */}
      <div className="tabbar-strip" ref={stripRef} onWheel={onWheel}>
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeId;
          const tooltip = tab.subtitle ? `${tab.title} (${tab.subtitle})` : tab.title;

          return (
            <div
              key={tab.id}
              className="tab-item"
              data-active={isActive ? 'true' : undefined}
              data-kind={tab.kind}
              draggable={tab.closable}
              onClick={() => onSelectTab(tab.id)}
              onMouseDown={(e) => {
                // Middle click closes tab
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
                if (draggedIndex !== null && draggedIndex !== index && onReorderTabs) {
                  onReorderTabs(draggedIndex, index);
                }
                setDraggedIndex(null);
              }}
              onDragEnd={() => setDraggedIndex(null)}
              title={tooltip}
            >
              <span className="tab-icon">
                <Icon name={tab.icon as IconName} />
              </span>

              <span className="tab-title">{tab.title}</span>

              {tab.subtitle && <span className="tab-sub">{tab.subtitle}</span>}

              {tab.hasTimer && <span className="tab-timer-dot" title="Focus timer active" />}

              {tab.closable && (
                <button
                  type="button"
                  className="tab-close"
                  aria-label={`Close ${tab.title}`}
                  title="Close tab (Ctrl+W)"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                >
                  <Icon name="x" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          className="tab-new"
          aria-label="New tab (Ctrl+T)"
          title="New tab (Ctrl+T)"
          onClick={onNewTab}
        >
          <Icon name="plus" />
        </button>
      </div>

      {/* Draggable empty region */}
      <div className="tabbar-drag" data-tauri-drag-region />

      {/* Right: Day/Night, then the window controls — Bell App v2 keeps both at the window's edge. */}
      <div className="tabbar-actions">
        <TonePill tone={tone} onToggle={onTone} />
        <WindowLights />
      </div>
    </header>
  );
}

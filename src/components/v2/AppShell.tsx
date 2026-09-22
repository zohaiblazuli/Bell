/**
 * AppShell (Design System v2) — §4/§5. The three-region desktop frame: a persistent top bar over
 * [ resizable sidebar | main | optional right inspector ]. Flat, opaque surfaces separated by 1px
 * rules — no glass, no wallpaper. Built as a new component so the live app can keep running on the
 * legacy shell until the App.tsx cutover.
 *
 * Responsive (§5) is keyed off the shell's OWN width (a ResizeObserver bucket), not the media query,
 * because this is a window pane: >=1440 xl, 1200–1439 lg (both dock the inspector as a column),
 * 960–1199 md and <960 sm (inspector becomes a right-side drawer; sm also forces the sidebar to its
 * 52px rail).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import SideResizeHandle from '../SideResizeHandle';
import './AppShell.css';

type WidthBucket = 'xl' | 'lg' | 'md' | 'sm';

export interface AppShellProps {
  topBar: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
  inspector?: ReactNode;
  /** Traffic-light window controls, rendered at the top-left of the top bar. */
  windowControls?: ReactNode;
  sidebarWidth?: number;
  onSidebarWidthChange?: (w: number) => void;
  sidebarCollapsed?: boolean;
  inspectorOpen?: boolean;
  /** Called when the drawer scrim is dismissed on narrow widths. */
  onInspectorClose?: () => void;
  className?: string;
}

function bucketFor(w: number): WidthBucket {
  if (w >= 1440) return 'xl';
  if (w >= 1200) return 'lg';
  if (w >= 960) return 'md';
  return 'sm';
}

export default function AppShell({
  topBar, sidebar, children, inspector, windowControls,
  sidebarWidth = 232, onSidebarWidthChange, sidebarCollapsed, inspectorOpen, onInspectorClose, className,
}: AppShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [bucket, setBucket] = useState<WidthBucket>('xl');

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      setBucket(bucketFor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const railed = sidebarCollapsed || bucket === 'sm';
  const inspectorMode = bucket === 'xl' || bucket === 'lg' ? 'column' : 'drawer';
  const showInspector = Boolean(inspector) && Boolean(inspectorOpen);

  return (
    <div
      ref={rootRef}
      className={['v2-shell', className].filter(Boolean).join(' ')}
      data-width={bucket}
      data-railed={railed || undefined}
      data-inspector={showInspector && inspectorMode === 'column' ? 'column' : undefined}
      style={{ ['--v2-sidebar-w' as string]: railed ? '52px' : `${sidebarWidth}px` }}
    >
      <header className="v2-shell__topbar" data-tauri-drag-region>
        {windowControls ? <div className="v2-shell__lights">{windowControls}</div> : null}
        <div className="v2-shell__topbar-content">{topBar}</div>
      </header>

      <div className="v2-shell__sidebar">
        {sidebar}
        {!railed && onSidebarWidthChange ? (
          <SideResizeHandle
            currentWidth={sidebarWidth}
            minWidth={208}
            maxWidth={280}
            defaultWidth={232}
            side="right"
            label="Resize sidebar"
            onResize={onSidebarWidthChange}
          />
        ) : null}
      </div>

      <main className="v2-shell__main">{children}</main>

      {showInspector && inspectorMode === 'column' ? (
        <aside className="v2-shell__inspector">{inspector}</aside>
      ) : null}

      {showInspector && inspectorMode === 'drawer' ? (
        <>
          <div className="v2-shell__scrim" onClick={onInspectorClose} />
          <aside className="v2-shell__inspector v2-shell__inspector--drawer">{inspector}</aside>
        </>
      ) : null}
    </div>
  );
}

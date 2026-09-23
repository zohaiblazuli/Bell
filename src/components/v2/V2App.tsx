/**
 * V2App — the assembled Design System v2 application, mounted behind the `?v2` flag so it runs live
 * without disturbing the legacy shell. Composes AppShell + NavSidebar (config-driven routing) + all
 * v2 screens + the command palette + toasts. Flipping the default to this is the eventual cutover;
 * legacy is removed only once parity holds (Phase 8).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import AppShell from './AppShell';
import NavSidebar from './NavSidebar';
import Inspector from './Inspector';
import CommandPalette, { type CommandGroup } from './CommandPalette';
import { NAV_GROUPS, NAV_UTILITY, type NavItem } from './navConfig';
import { ToastProvider, useToast } from '@ui/v2/Toast';
import Button from '@ui/v2/Button';
import Icon from '@/components/Icon';
import Sprite from '@/components/Sprite';
import LibraryView, { PaperInspectorBody } from '@/views/v2/LibraryView';
import { SAMPLE_PAPERS } from '@/views/v2/LibraryPreview';
import Analytics from '@/views/v2/Analytics';
import Home from '@/views/v2/Home';
import Practice from '@/views/v2/Practice';
import Collections from '@/views/v2/Collections';
import MyStuff from '@/views/v2/MyStuff';
import type { PaperRow } from '@/lib/types';
import './V2App.css';

const ALL_NAV: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), ...NAV_UTILITY];
const labelFor = (id: string) => ALL_NAV.find((n) => n.id === id)?.label ?? 'Bell';

/** A calm placeholder for routes whose full v2 build is out of this pass (Notebooks/Settings/Help). */
function Placeholder({ title }: { title: string }) {
  return (
    <div className="v2app__placeholder">
      <div className="v2app__placeholder-title t-page-title">{title}</div>
      <p className="v2app__placeholder-body t-body">This screen keeps its existing Bell implementation; the v2 pass covers it after the reference screens.</p>
    </div>
  );
}

function Shell() {
  // Initial screen/theme can be deep-linked via `?screen=` and `?theme=` — handy for QA, demos and
  // sharing a specific view.
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [active, setActive] = useState(() => params.get('screen') ?? 'library');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (params.get('theme') === 'dark' ? 'dark' : 'light'));
  const [selected, setSelected] = useState<PaperRow | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(232);
  const { toast } = useToast();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (id: string) => {
    setActive(id);
    setSelected(null);
  };

  const screen = ((): ReactNode => {
    switch (active) {
      case 'home': return <Home />;
      case 'library':
        return (
          <LibraryView
            papers={SAMPLE_PAPERS}
            onOpen={(p) => toast({ tone: 'info', title: 'Opening paper', message: `${p.subjectCode}/${p.component}` })}
            onDownload={(p) => toast({ tone: 'success', title: 'Downloaded', message: `${p.subjectCode}/${p.component}` })}
            selectedKey={selected ? String(selected.id) : undefined}
            onSelect={setSelected}
          />
        );
      case 'practice': return <Practice />;
      case 'analytics': return <Analytics />;
      case 'collections': return <Collections />;
      case 'bookmarks': return <MyStuff mode="bookmarks" />;
      case 'downloads': return <MyStuff mode="downloads" />;
      case 'history': return <MyStuff mode="history" />;
      default: return <Placeholder title={labelFor(active)} />;
    }
  })();
  /* V2APP_MARKER */

  const paletteGroups: CommandGroup[] = useMemo(
    () => [
      {
        id: 'goto',
        label: 'Go to',
        items: ALL_NAV.map((n) => ({ id: `go-${n.id}`, label: `Go to ${n.label}`, icon: n.icon, run: () => go(n.id) })),
      },
      {
        id: 'actions',
        label: 'Actions',
        items: [
          { id: 'theme', label: 'Toggle light / dark theme', icon: theme === 'light' ? 'moon' : 'sun', run: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')) },
          { id: 'sync', label: 'Sync the catalogue', icon: 'sync', run: () => toast({ tone: 'success', title: 'Catalogue synced', message: 'Up to date.' }) },
        ],
      },
    ],
    [theme, toast],
  );

  const topBar = (
    <div className="v2app__topbar">
      <span className="v2app__brand t-ui">Bell</span>
      <Icon name="chev" className="v2app__crumb-sep" />
      <span className="v2app__crumb t-ui">{labelFor(active)}</span>
      <div className="v2app__topbar-spacer" />
      <button type="button" className="v2app__search t-caption" onClick={() => setPaletteOpen(true)}>
        <Icon name="search" />
        <span>Search…</span>
        <kbd className="t-micro">⌘K</kbd>
      </button>
      <Button variant="ghost" size="dense" iconOnly icon={theme === 'light' ? 'moon' : 'sun'} aria-label="Toggle theme" onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))} />
    </div>
  );

  const inspectorNode =
    active === 'library' && selected ? (
      <Inspector
        title={`${selected.subjectCode}/${selected.scode}/${selected.component}`}
        onClose={() => setSelected(null)}
        footer={<Button variant="primary" icon="doc" label="Open paper" onClick={() => toast({ tone: 'info', title: 'Opening paper' })} />}
      >
        <PaperInspectorBody paper={selected} />
      </Inspector>
    ) : undefined;

  return (
    <div className="v2app" data-theme={theme}>
      <Sprite />
      <AppShell
        topBar={topBar}
        sidebar={
          <NavSidebar
            activeId={active}
            onNavigate={go}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((c) => !c)}
            header={<span className="v2app__logo t-section-title">Bell</span>}
          />
        }
        inspector={inspectorNode}
        inspectorOpen={Boolean(inspectorNode)}
        onInspectorClose={() => setSelected(null)}
        sidebarWidth={sidebarWidth}
        onSidebarWidthChange={setSidebarWidth}
        sidebarCollapsed={collapsed}
      >
        {screen}
      </AppShell>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} groups={paletteGroups} />
    </div>
  );
}

export default function V2App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

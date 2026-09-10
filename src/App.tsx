import { useCallback, useEffect, useMemo, useState } from 'react';
import Sprite from './components/Sprite';
import AppBackground from './components/AppBackground';
import Sidebar, { type View } from './components/Sidebar';
import TopBar from './components/TopBar';
import TabBar from './components/TabBar';
import CommandPalette, { screenCommands, type PaletteCommand } from './components/CommandPalette';
import Button from '@ui/Button';
import Dialog from '@ui/Dialog';
import Mascot from './components/Mascot';
import * as api from './lib/api';
import Splash, { type SplashPhase } from './components/Splash';
import { startupWatchdogMs } from './lib/startup';
import { UpdateCorner, UpdateDialog } from './components/UpdateFlow';
import LibraryView from './views/LibraryView';
import DashboardView from './views/DashboardView';
import WorkspaceView from './views/WorkspaceView';
import NotebooksView from './views/NotebooksView';
import NotebookView from './views/NotebookView';
import SettingsView from './views/SettingsView';
import CommunityView from './views/CommunityView';
import CommunityReaderView from './views/CommunityReaderView';
import LocalWorkspaceView from './views/LocalWorkspaceView';
import OnboardingView, { type SessionOption } from './views/OnboardingView';
import StarGateView from './views/StarGateView';
import { usePrefs } from './state/usePrefs';
import { useLibraryIndex } from './state/useLibraryIndex';
import { useStudyState } from './state/useStudyState';
import { useUpdates } from './state/useUpdates';
import { useNotebooks } from './state/useNotebooks';
import { useMascot } from './state/useMascot';
import { useCommunity } from './state/useCommunity';
import { useTabs } from './state/useTabs';
import { useWorkspace } from './state/useWorkspace';
import { UPDATES_CONFIGURED } from './lib/updates';
import { windowsBetween } from './lib/sessions';
import { loadRecent, type MarkFilter } from './lib/store';
import type { PaperRow } from './lib/types';
import type { CommunityResource } from './lib/community';
import { readWorkspaceDocument, recordWorkspaceOpen, workspaceReaderResource, type WorkspaceDocument } from './lib/workspace';
import { APP_VERSION, APP_BUILD } from './lib/version';

/**
 * The router, and nothing else.
 *
 * The state that used to live here — the index and its queries, marks and recents, the two persisted
 * records, the update machine — is in `src/state/`, four hooks that each read in one sitting. The views
 * kept their explicit `Props` rather than becoming context consumers: their authors documented those
 * interfaces carefully, and making the dependencies implicit would cost that documentation and the
 * ability to test a screen on its own. See `state/usePrefs.ts`.
 */

/** The bar's title per route. The Reader and the open notebook compose their own, so both are here
 *  only because the union demands it — neither renders `TopBar` from `screens()`. */
const TITLES: Record<View, string> = {
  library: 'Library',
  community: 'Community Resources',
  workspace: 'Workspace',
  'community-reader': 'Community Resource',
  bookmarks: 'Bookmarks',
  recent: 'Recent',
  dashboard: 'Dashboard',
  notebooks: 'Notebooks',
  notebook: 'Notebook',
  settings: 'Settings',
  reader: 'Reader',
  onboarding: 'Welcome',
};

/**
 * How many sittings the onboarding flow's step 04 offers. Two years of series is four or five windows,
 * which is as far ahead as anyone plans a syllabus.
 */
const PLAN_HORIZON_DAYS = 730;

export default function App() {
  const prefs = usePrefs();
  const { settings, onboarding, tone, toggleTone } = prefs;

  const tabsMgr = useTabs();
  const [newNotebook, setNewNotebook] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [palette, setPalette] = useState(false);

  const currentView: View = !onboarding.done
    ? 'onboarding'
    : tabsMgr.activeTab.kind === 'paper'
    ? 'reader'
    : tabsMgr.activeTab.kind === 'book'
    ? 'community-reader'
    : tabsMgr.activeTab.kind === 'workspace-doc'
    ? 'workspace'
    : tabsMgr.activeTab.kind === 'notebook'
    ? 'notebook'
    : tabsMgr.activeTab.shelfView ?? 'library';

  const inReader = tabsMgr.activeTab.kind === 'paper';
  const inCommunityReader = tabsMgr.activeTab.kind === 'book' || tabsMgr.activeTab.kind === 'workspace-doc';
  const inNotebook = tabsMgr.activeTab.kind === 'notebook';
  const inStudyArea = inReader || inCommunityReader || inNotebook;
  const isBare = inNotebook;

  const lib = useLibraryIndex(currentView === 'onboarding');
  const community = useCommunity(currentView === 'community');
  const workspace = useWorkspace(currentView === 'workspace');

  /**
   * The sidebar lists the subjects you sit, not the whole catalogue.
   *
   * `onboarding.subjects` holds syllabus codes — answered in the flow's step 03, edited in
   * Settings, and stored as codes rather than ids so a resync cannot orphan them. With
   * nothing chosen the whole catalogue is shown rather than an empty rail: someone who
   * skipped the flow should still be able to reach a paper, and Settings says so.
   */
  const mySubjects = useMemo(() => {
    const chosen = new Set(onboarding.subjects);
    if (chosen.size === 0) return lib.subjects;
    return lib.subjects.filter((s) => chosen.has(s.code));
  }, [lib.subjects, onboarding.subjects]);

  /**
   * What the sidebar's Library row counts.
   *
   * The catalogue total would be a lie next to a filtered list — 2,605 beside a screen showing 126.
   * Summed from the subjects on show, so the number and the list always agree.
   */
  const visiblePapers = useMemo(
    () => mySubjects.reduce((total, s) => total + s.papers, 0),
    [mySubjects],
  );

  /** Add or drop one subject. Order is the catalogue's, not the order they were pressed. */
  const toggleSubject = useCallback(
    (code: string) => {
      const chosen = new Set(onboarding.subjects);
      if (chosen.has(code)) chosen.delete(code);
      else chosen.add(code);
      prefs.answerOnboarding(
        'subjects',
        lib.subjects.filter((s) => chosen.has(s.code)).map((s) => s.code),
      );
    },
    [onboarding.subjects, lib.subjects, prefs],
  );
  const study = useStudyState();
  const up = useUpdates(settings.updateAuto, lib.setError);
  const notebooks = useNotebooks();

  /**
   * The reset confirmation. Held here rather than in the palette because the command only
   * *asks* — a keystroke away from erasing everything is exactly the shape of accident this
   * dialog exists to prevent, so the palette closes and the decision happens in a modal.
   */
  /** True for the whole of onboarding's prepare pass — the catalogue sync and the downloads. */
  const [preparing, setPreparing] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [splash, setSplash] = useState<SplashPhase>('splash');

  /**
   * The sidebar mascot's mood. Failures, tone changes, direct interaction, active work, successful
   * completion, and one minute of inactivity all have distinct reactions. Onboarding drives its own
   * six from its step cursor.
   */
  const mascotWorking =
    preparing ||
    lib.busy ||
    lib.bulk != null ||
    Object.keys(lib.downloading).length > 0 ||
    up.state.phase === 'checking' ||
    up.state.phase === 'downloading' ||
    up.state.phase === 'installing';
  const mascot = useMascot(
    tone,
    lib.error,
    mascotWorking,
    inStudyArea,
  );

  /* ---- routing ----------------------------------------------------------- */

  /** A route change also settles which marked list the library is on — the two cannot disagree. */
  const go = useCallback(
    (v: View) => {
      study.setMarkFilter(v === 'bookmarks' ? 'bookmarks' : v === 'recent' ? 'recent' : null);
      tabsMgr.openShelf(v);
    },
    [study, tabsMgr],
  );

  /** `revision` has no nav row, so reaching it means the library route with the filter set. */
  const showMarked = useCallback(
    (filter: MarkFilter) => {
      study.setMarkFilter(filter);
      go(filter === 'bookmarks' ? 'bookmarks' : filter === 'recent' ? 'recent' : 'library');
    },
    [go, study],
  );

  const openPaperAt = useCallback(
    (paper: PaperRow, options?: { background?: boolean }) => {
      study.open(paper);
      setFocusMode(false);
      tabsMgr.openPaper(paper, options);
    },
    [study, tabsMgr],
  );

  const openCommunityAt = useCallback(
    (resource: CommunityResource, options?: { background?: boolean }) => {
      setFocusMode(false);
      tabsMgr.openBook(resource, options);
    },
    [tabsMgr],
  );

  const openWorkspaceAt = useCallback(
    (document: WorkspaceDocument, notebook = false) => {
      setFocusMode(false);
      tabsMgr.openWorkspaceDocument(document, { notebook });
      void recordWorkspaceOpen(document.id);
    },
    [tabsMgr],
  );

  /**
   * Open a notebook onto its spread. Called with a page index from the Reader's clip confirmation and
   * without one from the shelf, where the whole notebook is what was asked for.
   */
  const openNotebookAt = useCallback(
    (id: string, page = 0, options?: { background?: boolean }) => {
      setFocusMode(false);
      const nbEntry = notebooks.find(id);
      tabsMgr.openNotebook(id, nbEntry?.name, page, options);
      void notebooks.refresh();
    },
    [notebooks, tabsMgr],
  );

  const handleNewTab = useCallback(() => {
    if (tabsMgr.activeTab.kind === 'shelf' && tabsMgr.activeTab.shelfView === 'library') {
      setPalette(true);
    } else {
      tabsMgr.openShelf('library');
    }
  }, [tabsMgr]);

  /**
   * Wipe and start over.
   *
   * The reload is not laziness: `store.ts` hydrates every key into a module-level cache once
   * before the first render, and `usePrefs`, `useStudyState` and `useLibraryIndex` all hold
   * their own copies of what was just deleted. Resetting a dozen hooks by hand would leave one
   * of them carrying a stale set; a reload rebuilds the lot from an empty disk, `loadOnboarding`
   * finds no history, and the app comes up on onboarding exactly as a fresh install does.
   */
  const runReset = useCallback(async () => {
    setResetting(true);
    try {
      await api.resetApp();
      window.location.reload();
    } catch (e) {
      lib.setError(String(e));
      setResetting(false);
      setResetOpen(false);
    }
  }, [lib]);

  /**
   * Onboarding's step 05: fill the library before letting anyone in.
   *
   * The catalogue first, then every paper for the subjects just chosen — question papers only,
   * because Rust brings each mark scheme along on a task of its own. Subjects are re-read from
   * Rust rather than taken from `lib.subjects`, which is a render behind the sync that just ran.
   *
   * `preparing` is what holds the flow on step 05: it stands in for the whole pass, so the
   * existing "advance when busy drops with no error" rule needs no rewriting.
   */
  const prepareLibrary = useCallback(async () => {
    setPreparing(true);
    try {
      await lib.runSync();
      const chosen = new Set(onboarding.subjects);
      if (chosen.size === 0) return;

      const subjects = await api.listSubjects(null);
      const jobs: { paperId: number; kind: 'qp' }[] = [];
      for (const subject of subjects) {
        if (!chosen.has(subject.code)) continue;
        const papers = await api.listPapers({ subjectId: subject.id });
        for (const paper of papers) {
          // Skip what is already here, so a retry after a failure resumes rather than restarts.
          if (!paper.qpPath) jobs.push({ paperId: paper.id, kind: 'qp' });
        }
      }
      await lib.downloadAll(jobs);
    } finally {
      setPreparing(false);
    }
  }, [lib, onboarding.subjects]);

  const pickSubject = useCallback(
    (id: number | null) => {
      study.setMarkFilter(null);
      lib.setSubjectId(id);
      go('library');
    },
    [go, lib, study],
  );

  // Browser standard shortcuts: Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+W, Ctrl+T, Ctrl+1..9, Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const k = e.key.toLowerCase();

      // Ctrl + Tab / Ctrl + Shift + Tab (cycle tabs)
      if (k === 'tab') {
        e.preventDefault();
        if (e.shiftKey) tabsMgr.prevTab();
        else tabsMgr.nextTab();
        return;
      }

      // Ctrl + W (close active tab)
      if (k === 'w') {
        if (tabsMgr.activeTab.closable) {
          e.preventDefault();
          tabsMgr.closeTab(tabsMgr.activeId);
        }
        return;
      }

      // Ctrl + T (new tab / go to library)
      if (k === 't') {
        e.preventDefault();
        handleNewTab();
        return;
      }

      // Ctrl + 1..8
      if (e.key >= '1' && e.key <= '8') {
        const index = parseInt(e.key, 10) - 1;
        if (index < tabsMgr.tabs.length) {
          e.preventDefault();
          tabsMgr.selectTabByIndex(index);
        }
        return;
      }

      // Ctrl + 9
      if (e.key === '9') {
        e.preventDefault();
        tabsMgr.selectTabByIndex(tabsMgr.tabs.length - 1);
        return;
      }

      // Ctrl + K (palette)
      if (k === 'k') {
        e.preventDefault();
        if (currentView !== 'onboarding') setPalette((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentView, tabsMgr, handleNewTab]);

  /* ---- startup ------------------------------------------------------------ */

  /**
   * The splash reports each phase from its own `animationend`, which is the honest signal — and a
   * signal that can fail to arrive. If the webview suppresses animations (reduced motion at the OS
   * level does exactly that), or a slow first paint drops the event, nothing would ever advance and the
   * overlay would sit at `z-index: 90` swallowing every click on an app that looks perfectly fine. So
   * the timing lives here, as the component's own header asks: the event is the fast path, this is the
   * floor. The duration comes from the same timing module as Splash, plus recovery margin, so an
   * authored mascot sequence cannot be cut short by an older watchdog.
   */
  useEffect(() => {
    if (splash === 'done') return;
    const ms = startupWatchdogMs(splash, settings.pet, settings.reduceMotion);
    const timer = window.setTimeout(
      () => setSplash((p) => (p === 'splash' ? 'handoff' : 'done')),
      ms,
    );
    return () => window.clearTimeout(timer);
  }, [settings.pet, settings.reduceMotion, splash]);

  /* ---- derived ------------------------------------------------------------ */

  /**
   * What the Library lists.
   *
   * Narrowed to the subjects you sit, for the same reason the sidebar is: the catalogue holds every
   * paper Cambridge publishes for twenty-three subjects, and opening on somebody else's Accounting
   * papers is not a library. A marked list is left alone — a bookmark you set before changing your
   * subjects should still be reachable from Bookmarks, rather than silently disappearing.
   */
  const shown = useMemo(() => {
    const rows = study.rows(lib.papers);
    const chosen = new Set(onboarding.subjects);
    if (chosen.size === 0 || study.markFilter !== null) return rows;
    return rows.filter((p) => chosen.has(p.subjectCode));
  }, [study, lib.papers, onboarding.subjects]);

  /**
   * The sittings onboarding's step 04 offers. Dates come from `lib/sessions.ts`; `firstPaper` stays
   * null because Cambridge's timetable is not in the library and a month is not a date.
   */
  const planSessions = useMemo((): SessionOption[] => {
    const from = new Date();
    const to = new Date(from.getTime() + PLAN_HORIZON_DAYS * 86_400_000);
    return windowsBetween(from, to)
      .filter((w) => w.end >= from)
      .map((w) => ({ scode: w.code, firstPaper: null }));
  }, []);

  const commands = useMemo((): PaletteCommand[] => {
    const list = screenCommands(
      {
        onLibrary: () => go('library'),
        onCommunity: () => go('community'),
        onNotebooks: () => go('notebooks'),
        onDashboard: () => go('dashboard'),
        onBookmarks: () => go('bookmarks'),
        onRecent: () => go('recent'),
        onSettings: () => go('settings'),
        // Omitted while unconfigured, so the palette never offers a check that cannot happen.
        onCheckUpdates: UPDATES_CONFIGURED ? () => void up.check(true) : undefined,
      },
      {
        docs: lib.stats?.papers,
        bookmarks: study.marks.bookmarks.size,
        recent: study.recentCount,
        notebooks: notebooks.list?.length ?? null,
      },
    );
    if (study.marks.revision.size) {
      list.push({
        id: 'rev',
        label: 'Flagged for revision',
        hint: `${study.marks.revision.size} flagged`,
        icon: 'sync',
        keywords: 'revise again redo',
        run: () => showMarked('revision'),
      });
    }
    list.push(
      {
        id: 'tone',
        label: tone === 'day' ? 'Switch to Night' : 'Switch to Day',
        icon: 'sliders',
        keywords: 'theme dark light tone',
        run: toggleTone,
      },
      {
        id: 'reset',
        label: 'Reset Bell…',
        hint: 'Erase everything and start over',
        /* No trash glyph in the shipped sprite; `warn` is the honest stand-in and reads
           correctly for the one command in the palette that destroys something. */
        icon: 'warn',
        keywords: 'erase wipe clear start over factory',
        run: () => setResetOpen(true),
      },
      {
        id: 'sync',
        label: 'Sync the catalogue',
        hint: lib.busy ? 'Already running' : 'Check ShinyPapers for new papers',
        icon: 'folder',
        keywords: 'catalogue refresh update fetch',
        run: () => void lib.runSync(),
      },
    );
    return list;
  }, [go, lib, showMarked, study, toggleTone, tone, up, notebooks.list]);

  /* ---- render -------------------------------------------------------------- */

  const motion = settings.reduceMotion ? 'off' : 'on';

  const startup = (
    <Splash
      phase={splash}
      reduceMotion={settings.reduceMotion}
      onFinished={(finished) => setSplash(finished === 'splash' ? 'handoff' : 'done')}
    />
  );

  /**
   * Onboarding is its own shell: no sidebar, no top bar, and its own window lights, because the flow is
   * what a first run *is* rather than a screen inside the app.
   */
  if (currentView === 'onboarding') {
    return (
      <>
        <Sprite />
        <div className="app app-bare" data-startup={splash} data-view="onboarding" data-tone={tone} data-motion={motion}>
          <AppBackground />
          <OnboardingView
            answers={onboarding}
            onAnswer={prefs.answerOnboarding}
            subjects={lib.subjects}
            levels={lib.stats?.levels ?? []}
            sessions={planSessions}
            busy={preparing || lib.busy}
            progress={lib.progress}
            indexedPapers={lib.stats?.papers ?? null}
            download={lib.bulk}
            error={lib.error}
            onBuild={() => void prepareLibrary()}
            onFinish={() => {
              prefs.answerOnboarding('done', true);
              go('library');
            }}
          />
        </div>
        {startup}
      </>
    );
  }

  /**
   * One-time GitHub Star gate: once onboarding is complete, the user cannot continue
   * into the app until verifying or completing the star gate. Once verified, this
   * is saved to disk and never shown again.
   */
  if (!prefs.starGateVerified) {
    return (
      <>
        <Sprite />
        <div className="app app-bare" data-startup={splash} data-view="stargate" data-tone={tone} data-motion={motion}>
          <AppBackground />
          <StarGateView
            userName={onboarding.name}
            onComplete={() => {
              prefs.setStarGateVerified(true);
              go('library');
            }}
          />
        </div>
        {startup}
      </>
    );
  }

  return (
    <>
      <Sprite />
      <div
        className="app"
        data-startup={splash}
        data-view={currentView}
        data-tone={tone}
        data-motion={motion}
        data-focus={focusMode && (inReader || inCommunityReader || inNotebook) ? 'on' : 'off'}
      >
        <AppBackground />

        <TabBar
          tabs={tabsMgr.tabs}
          activeId={tabsMgr.activeId}
          onSelectTab={tabsMgr.selectTab}
          onCloseTab={tabsMgr.closeTab}
          onNewTab={handleNewTab}
          onReorderTabs={tabsMgr.reorderTabs}
          tone={tone}
          onTone={toggleTone}
          onSearch={() => setPalette(true)}
        />

        <div className={`app-stage ${isBare ? 'app-stage-bare' : ''}`}>
          {!isBare && (
            <Sidebar
              view={currentView}
              onView={go}
              version={APP_VERSION}
              build={APP_BUILD}
              subjects={mySubjects}
              activeSubject={lib.subjectId}
              onSubject={pickSubject}
              paperCount={lib.stats ? visiblePapers : null}
              bookmarkCount={study.marks.bookmarks.size}
              recentCount={loadRecent().length}
              notebookCount={notebooks.list?.length ?? null}
              mascot={mascot.mood}
              studying={mascot.studying}
              onPokeMascot={mascot.poke}
            />
          )}

          {renderTabPanes()}
        </div>

        <CommandPalette
          open={palette}
          onClose={() => setPalette(false)}
          onOpenPaper={openPaperAt}
          commands={commands}
        />

        <UpdateCorner
          state={up.state}
          onDownload={() => void up.download()}
          onInstall={() => void up.install()}
        />

        <Dialog
          open={resetOpen}
          onClose={() => (resetting ? undefined : setResetOpen(false))}
          title="Reset Bell?"
          art={<Mascot size={96} mood="alarm" />}
          actions={
            <>
              {/* Cancel first in DOM order, so Tab and the panel's initial focus reach the safe
                  choice before the destructive one. */}
              <Button label="Cancel" onClick={() => setResetOpen(false)} />
              <Button
                variant="primary"
                className="dlg-danger"
                label={resetting ? 'Resetting…' : 'Reset everything'}
                onClick={() => void runReset()}
                aria-disabled={resetting ? 'true' : undefined}
                aria-busy={resetting ? true : undefined}
              />
            </>
          }
        >
          Every bookmark, every mark, your focused minutes, your annotations and your settings go,
          and you start again at the welcome screen. This cannot be undone.
          <br />
          <br />
          The papers you have downloaded stay where they are, in your downloads folder.
        </Dialog>

        <UpdateDialog
          open={up.dialogOpen}
          state={up.state}
          onCheck={() => void up.check()}
          onDownload={() => void up.download()}
          onInstall={() => void up.install()}
          onDismiss={() => up.setDialogOpen(false)}
        />
      </div>
      {startup}
    </>
  );

  function renderTabPanes() {
    return tabsMgr.tabs.map((tab) => {
      const isSelected = tab.id === tabsMgr.activeId;
      // Preserve the live reader session when changing tabs. Page canvases are still viewport-evicted
      // by the reader itself; unmounting the whole tab made page position, open panels and timer state
      // disappear, which is not how tabs should behave.

      if (tab.kind === 'shelf') {
        const shelfView = tab.shelfView ?? 'library';
        return (
          <div
            key={tab.id}
            className="app-tab-pane"
            data-active={isSelected ? 'true' : 'false'}
          >
            <div className="main">
              {screens(shelfView)}
            </div>
          </div>
        );
      }

      if (tab.kind === 'paper' && tab.paper) {
        return (
          <div
            key={tab.id}
            className="app-tab-pane"
            data-active={isSelected ? 'true' : 'false'}
          >
            <div className="main">
              <WorkspaceView
                paper={tab.paper}
                focus={focusMode}
                onToggleFocus={() => setFocusMode((f) => !f)}
                onBack={() => {
                  setFocusMode(false);
                  tabsMgr.openShelf('library');
                }}
                tone={tone}
                onTone={toggleTone}
                busy={lib.busy}
                onReindex={() => void lib.runSync()}
                onSearch={() => setPalette(true)}
                onDownload={lib.download}
                notebooks={notebooks.list}
                onNewNotebook={() => {
                  setNewNotebook(true);
                  go('notebooks');
                }}
                onOpenNotebook={(id, page) => openNotebookAt(id, page)}
                onRefreshNotebooks={notebooks.refresh}
              />
            </div>
          </div>
        );
      }

      if (tab.kind === 'book' && tab.community) {
        return (
          <div
            key={tab.id}
            className="app-tab-pane"
            data-active={isSelected ? 'true' : 'false'}
          >
            <div className="main">
              <CommunityReaderView
                resource={tab.community}
                tone={tone}
                onTone={toggleTone}
                focus={focusMode}
                onToggleFocus={() => setFocusMode((f) => !f)}
                busy={lib.busy}
                onReindex={() => void lib.runSync()}
                onSearch={() => setPalette(true)}
                onBack={() => {
                  setFocusMode(false);
                  tabsMgr.openShelf('community');
                }}
                onDownload={community.open}
                notebooks={notebooks.list}
                onRefreshNotebooks={() => notebooks.refresh()}
                onNewNotebook={() => {
                  setNewNotebook(true);
                  go('notebooks');
                }}
                onOpenNotebook={(id, page) => openNotebookAt(id, page)}
              />
            </div>
          </div>
        );
      }

      if (tab.kind === 'workspace-doc' && tab.workspace) {
        return (
          <div
            key={tab.id}
            className="app-tab-pane"
            data-active={isSelected ? 'true' : 'false'}
          >
            <div className="main">
              <CommunityReaderView
                resource={workspaceReaderResource(tab.workspace)}
                readDocument={readWorkspaceDocument}
                inkKey={`workspace:${tab.workspace.id}`}
                backLabel="Back to Workspace"
                startNotebookOpen={Boolean(tab.notebookOpen)}
                tone={tone}
                onTone={toggleTone}
                focus={focusMode}
                onToggleFocus={() => setFocusMode((f) => !f)}
                onSearch={() => setPalette(true)}
                onBack={() => {
                  setFocusMode(false);
                  tabsMgr.openShelf('workspace');
                }}
                notebooks={notebooks.list}
                onRefreshNotebooks={() => notebooks.refresh()}
                onNewNotebook={() => {
                  setNewNotebook(true);
                  go('notebooks');
                }}
                onOpenNotebook={(id, page) => openNotebookAt(id, page)}
              />
            </div>
          </div>
        );
      }

      if (tab.kind === 'notebook' && tab.notebook) {
        const openNb = notebooks.find(tab.notebook.id);
        return (
          <div
            key={tab.id}
            className="app-tab-pane"
            data-active={isSelected ? 'true' : 'false'}
          >
            {openNb ? (
              <NotebookView
                notebook={openNb}
                startPage={tab.notebook.page}
                subjects={lib.subjects}
                focus={focusMode}
                onToggleFocus={() => setFocusMode((f) => !f)}
                onSearch={() => setPalette(true)}
                onSaveMeta={(meta) => notebooks.save(tab.notebook!.id, meta)}
                onDelete={async () => {
                  await notebooks.remove(tab.notebook!.id);
                  tabsMgr.closeTab(tab.id);
                  go('notebooks');
                }}
                onBack={() => {
                  tabsMgr.closeTab(tab.id);
                  setFocusMode(false);
                  go('notebooks');
                  void notebooks.refresh();
                }}
              />
            ) : (
              <div className="view">
                <div className="stub">
                  <div className="stub-inner">
                    <h2>{notebooks.list == null ? 'Opening…' : 'That notebook is not here'}</h2>
                    <p>
                      {notebooks.list == null
                        ? 'Reading it off this device.'
                        : 'It may have been deleted. The shelf has the rest.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isSelected && (
              <div className="notebook-mascot" aria-hidden="true" onPointerDown={mascot.poke}>
                <Mascot size={160} petSize="clamp(260px, 34vh, 400px)" mood={mascot.mood} studying={true} />
              </div>
            )}
          </div>
        );
      }

      return null;
    });
  }

  /** Everything that shares the top bar. Declared after the return as a closure, so the render reads
   *  as one shell with two halves rather than 150 lines of nested ternary. */
  function screens(screenView: View) {
    const libraryMode = screenView === 'bookmarks' ? 'bookmarks' : screenView === 'recent' ? 'recent' : 'library';
    const isLibraryRoute = screenView === 'library' || screenView === 'bookmarks' || screenView === 'recent';

    return (
      <>
        <TopBar
          title={TITLES[screenView]}
          tone={tone}
          onTone={toggleTone}
          busy={lib.busy}
          onReindex={() => void lib.runSync()}
          onSearch={() => setPalette(true)}
          showSearch={screenView !== 'community'}
          showSync={screenView !== 'community'}
        />

        {screenView === 'community' && (
          <CommunityView
            community={community}
            subjects={lib.subjects}
            onOpen={openCommunityAt}
          />
        )}

        {screenView === 'workspace' && (
          <LocalWorkspaceView workspace={workspace} onOpen={openWorkspaceAt} />
        )}

        {isLibraryRoute && (
          <LibraryView
            mode={libraryMode}
            papers={shown}
            subjects={lib.subjects}
            loading={lib.loading && !study.markFilter}
            level={lib.level}
            onLevel={lib.setLevel}
            season={lib.season}
            onSeason={lib.setSeason}
            paperNumber={lib.paperNumber}
            onPaperNumber={lib.setPaperNumber}
            subjectId={lib.subjectId}
            onSubject={lib.setSubjectId}
            downloadedOnly={lib.downloadedOnly}
            onDownloadedOnly={lib.setDownloadedOnly}
            marks={study.marks}
            onMark={study.toggleMark}
            markFilter={study.markFilter}
            onMarkFilter={showMarked}
            error={lib.error}
            onOpen={openPaperAt}
          />
        )}

        {screenView === 'notebooks' && (
          <NotebooksView
            notebooks={notebooks.list}
            error={notebooks.error}
            subjects={lib.subjects}
            openNew={newNotebook}
            onNewHandled={() => setNewNotebook(false)}
            onOpen={(id) => openNotebookAt(id)}
            onCreate={async (meta) => {
              const entry = await notebooks.create(meta);
              // Straight into it. A notebook you just named and gave a cover is one you intended to
              // write in, and the shelf you would land back on is the screen you were already on.
              if (entry) openNotebookAt(entry.id);
              return entry;
            }}
            onDelete={notebooks.remove}
          />
        )}

        {screenView === 'dashboard' && (
          <DashboardView
            now={new Date()}
            name={onboarding.name || undefined}
            seasons={settings.seasons}
            subjects={lib.subjects}
            marks={study.marks}
            onOpen={openPaperAt}
            sittingTotals={lib.sittingTotals}
            onSubject={pickSubject}
          />
        )}

        {screenView === 'settings' && (
          <SettingsView
            settings={settings}
            onChange={prefs.patchSettings}
            root={lib.downloadRoot ?? 'Resolving…'}
            stats={lib.stats}
            busy={lib.busy}
            progress={lib.progress}
            report={lib.report}
            onSync={() => void lib.runSync()}
            onRepair={() => void lib.repair()}
            onRevealDownloads={() => void lib.revealDownloads()}
            repairReport={lib.repairReport}
            error={lib.error}
            subjects={lib.subjects}
            board={onboarding.board}
            onBoard={(board) => prefs.answerOnboarding('board', board)}
            chosenSubjects={onboarding.subjects}
            onToggleSubject={toggleSubject}
            version={APP_VERSION}
            build={APP_BUILD}
            onCheckUpdates={() => void up.check(true)}
            checkingUpdates={up.state.phase === 'checking'}
            updateState={up.state}
            statePath={up.statePath}
            onExportData={() => void up.exportData()}
            onRevealData={() => void up.revealData()}
            onClearData={() => void up.clearData()}
          />
        )}
      </>
    );
  }
}

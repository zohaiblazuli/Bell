import { useCallback, useEffect, useMemo, useState } from 'react';
import Sprite from './components/Sprite';
import AppBackground from './components/AppBackground';
import Sidebar, { type View } from './components/Sidebar';
import TopBar from './components/TopBar';
import CommandPalette, { screenCommands, type PaletteCommand } from './components/CommandPalette';
import Splash, { type SplashPhase, type SplashTargets } from './components/Splash';
import { UpdateDialog, UpdatePill } from './components/UpdateFlow';
import LibraryView from './views/LibraryView';
import DashboardView from './views/DashboardView';
import WorkspaceView from './views/WorkspaceView';
import SettingsView from './views/SettingsView';
import OnboardingView, { type SessionOption } from './views/OnboardingView';
import { usePrefs } from './state/usePrefs';
import { useLibraryIndex } from './state/useLibraryIndex';
import { useStudyState } from './state/useStudyState';
import { useUpdates } from './state/useUpdates';
import { useMascot } from './state/useMascot';
import * as api from './lib/api';
import { UPDATES_CONFIGURED } from './lib/updates';
import { windowsBetween } from './lib/sessions';
import { loadRecent, type MarkFilter } from './lib/store';
import type { PaperRow } from './lib/types';

/**
 * The router, and nothing else.
 *
 * The state that used to live here — the index and its queries, marks and recents, the two persisted
 * records, the update machine — is in `src/state/`, four hooks that each read in one sitting. The views
 * kept their explicit `Props` rather than becoming context consumers: their authors documented those
 * interfaces carefully, and making the dependencies implicit would cost that documentation and the
 * ability to test a screen on its own. See `state/usePrefs.ts`.
 */

/** The bar's title per route. The Reader composes its own, so it is absent here. */
const TITLES: Record<View, string> = {
  library: 'Library',
  bookmarks: 'Bookmarks',
  recent: 'Recent',
  dashboard: 'Dashboard',
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

  const [view, setView] = useState<View>(() => (onboarding.done ? 'library' : 'onboarding'));
  const [openPaper, setOpenPaper] = useState<PaperRow | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [palette, setPalette] = useState(false);

  const lib = useLibraryIndex(view === 'onboarding');
  const study = useStudyState();
  const up = useUpdates(settings.updateAuto, lib.setError);

  const [splash, setSplash] = useState<SplashPhase>('splash');
  const [splashTargets, setSplashTargets] = useState<SplashTargets | null>(null);

  /**
   * The sidebar mascot's mood. Five triggers live in `state/useMascot.ts`: a failure alarms him, a tone
   * change crosses his lenses, a poke gets a double-take, a minute idle puts him to sleep, and
   * everything else is idle. Onboarding drives its own six from its step cursor.
   */
  const mascot = useMascot(tone, lib.error);

  /* ---- routing ----------------------------------------------------------- */

  /** A route change also settles which marked list the library is on — the two cannot disagree. */
  const go = useCallback(
    (v: View) => {
      study.setMarkFilter(v === 'bookmarks' ? 'bookmarks' : v === 'recent' ? 'recent' : null);
      setView(v);
    },
    [study],
  );

  /** `revision` has no nav row, so reaching it means the library route with the filter set. */
  const showMarked = useCallback(
    (filter: MarkFilter) => {
      study.setMarkFilter(filter);
      setView(filter === 'bookmarks' ? 'bookmarks' : filter === 'recent' ? 'recent' : 'library');
    },
    [study],
  );

  const openPaperAt = useCallback(
    (paper: PaperRow) => {
      study.open(paper);
      setOpenPaper(paper);
      setFocusMode(false);
      setView('reader');
    },
    [study],
  );

  const pickSubject = useCallback(
    (id: number | null) => {
      study.setMarkFilter(null);
      lib.setSubjectId(id);
      setView('library');
    },
    [lib, study],
  );

  // ⌘K / Ctrl-K from anywhere, including the Reader — but not out of onboarding, which has no
  // library behind it to search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (view !== 'onboarding') setPalette((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view]);

  /* ---- startup ------------------------------------------------------------ */

  /**
   * The splash's travelling pair lands on the sidebar's own mascot slot and lockup, so the targets are
   * measured from the live DOM rather than the design's coordinates — the sidebar's geometry moves with
   * the window and a hard-coded box would drift. If either element is missing (onboarding has no
   * sidebar) the splash cross-fades instead.
   */
  useEffect(() => {
    if (splash !== 'splash') return;
    const frame = requestAnimationFrame(() => {
      const slot = document.querySelector('.mascot')?.getBoundingClientRect();
      const lockup = document.querySelector('.logo-word')?.getBoundingClientRect();
      if (slot && lockup) setSplashTargets({ mascot: slot, lockup });
    });
    return () => cancelAnimationFrame(frame);
  }, [splash]);

  /**
   * The splash reports each phase from its own `animationend`, which is the honest signal — and a
   * signal that can fail to arrive. If the webview suppresses animations (reduced motion at the OS
   * level does exactly that), or a slow first paint drops the event, nothing would ever advance and the
   * overlay would sit at `z-index: 90` swallowing every click on an app that looks perfectly fine. So
   * the timing lives here, as the component's own header asks: the event is the fast path, this is the
   * floor. 2.0s hold and 0.9s handoff, plus margin.
   */
  useEffect(() => {
    if (splash === 'done') return;
    const ms = splash === 'splash' ? 3200 : 1800;
    const timer = window.setTimeout(
      () => setSplash((p) => (p === 'splash' ? 'handoff' : 'done')),
      ms,
    );
    return () => window.clearTimeout(timer);
  }, [splash]);

  /* ---- derived ------------------------------------------------------------ */

  const shown = useMemo(() => study.rows(lib.papers), [study, lib.papers]);

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
        onDashboard: () => go('dashboard'),
        onBookmarks: () => go('bookmarks'),
        onRecent: () => go('recent'),
        onSettings: () => go('settings'),
        // Omitted while unconfigured, so the palette never offers a check that cannot happen.
        onCheckUpdates: UPDATES_CONFIGURED ? () => void up.check() : undefined,
      },
      {
        docs: lib.stats?.docs,
        bookmarks: study.marks.bookmarks.size,
        recent: study.recentCount,
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
        id: 'reindex',
        label: 'Rebuild the library index',
        hint: lib.busy ? 'Already running' : 'Walk the library again',
        icon: 'folder',
        keywords: 'ingest scan refresh',
        run: () => void lib.runIngest(),
      },
    );
    return list;
  }, [go, lib, showMarked, study, toggleTone, tone, up]);

  /* ---- render -------------------------------------------------------------- */

  const inReader = view === 'reader' && openPaper != null;
  const libraryMode = view === 'bookmarks' ? 'bookmarks' : view === 'recent' ? 'recent' : 'library';
  const isLibraryRoute = view === 'library' || view === 'bookmarks' || view === 'recent';
  /** The motion gate, read by Mr. Bell's rig and by the tone crossfade. */
  const motion = settings.reduceMotion ? 'off' : 'on';

  const startup = (
    <Splash
      phase={splash}
      targets={splashTargets}
      reduceMotion={settings.reduceMotion}
      onFinished={(finished) => setSplash(finished === 'splash' ? 'handoff' : 'done')}
    />
  );

  /**
   * Onboarding is its own shell: no sidebar, no top bar, and its own window lights, because the flow is
   * what a first run *is* rather than a screen inside the app. It replaces the old
   * empty-index-means-Setup guess, which sent an established user back through Setup whenever the index
   * was rebuilt.
   */
  if (view === 'onboarding') {
    return (
      <>
        <Sprite />
        <div className="app app-bare" data-view="onboarding" data-tone={tone} data-motion={motion}>
          <AppBackground />
          <OnboardingView
            answers={onboarding}
            onAnswer={prefs.answerOnboarding}
            subjects={lib.subjects}
            levels={lib.stats?.levels ?? []}
            sessions={planSessions}
            busy={lib.busy}
            progress={lib.progress}
            indexedPapers={lib.stats?.docs ?? null}
            error={lib.error}
            onBuild={() => void lib.runIngest()}
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

  return (
    <>
      <Sprite />
      <div
        className="app"
        data-view={view}
        data-tone={tone}
        data-motion={motion}
        data-focus={focusMode && inReader ? 'on' : 'off'}
      >
        <AppBackground />

        <Sidebar
          view={view}
          onView={go}
          subjects={lib.subjects}
          activeSubject={lib.subjectId}
          onSubject={pickSubject}
          paperCount={lib.stats?.docs ?? null}
          bookmarkCount={study.marks.bookmarks.size}
          recentCount={loadRecent().length}
          mascot={mascot.mood}
          onPokeMascot={mascot.poke}
          update={
            up.state.phase === 'idle' || up.state.phase === 'checking' ? null : (
              <UpdatePill
                state={up.state}
                onDownload={() => void up.download()}
                onRestart={() => up.setDialogOpen(true)}
              />
            )
          }
        />

        <div className="main">{inReader ? reader() : screens()}</div>

        <CommandPalette
          open={palette}
          onClose={() => setPalette(false)}
          onOpenPaper={openPaperAt}
          commands={commands}
        />

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

  function reader() {
    if (!openPaper) return null;
    return (
      <WorkspaceView
        paper={openPaper}
        focus={focusMode}
        onToggleFocus={() => setFocusMode((f) => !f)}
        onBack={() => {
          setFocusMode(false);
          go('library');
        }}
        tone={tone}
        onTone={toggleTone}
        busy={lib.busy}
        onReindex={() => void lib.runIngest()}
        onSearch={() => setPalette(true)}
        questions={null}
      />
    );
  }

  /** Everything that shares the top bar. Declared after the return as a closure, so the render reads
   *  as one shell with two halves rather than 150 lines of nested ternary. */
  function screens() {
    return (
      <>
        <TopBar
          title={TITLES[view]}
          tone={tone}
          onTone={toggleTone}
          busy={lib.busy}
          onReindex={() => void lib.runIngest()}
          onSearch={() => setPalette(true)}
        />

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
            subjectId={lib.subjectId}
            onSubject={lib.setSubjectId}
            marks={study.marks}
            onMark={study.toggleMark}
            markFilter={study.markFilter}
            onMarkFilter={showMarked}
            error={lib.error}
            onOpen={openPaperAt}
          />
        )}

        {view === 'dashboard' && (
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

        {view === 'settings' && (
          <SettingsView
            settings={settings}
            onChange={prefs.patchSettings}
            root={lib.stats?.root ?? api.DEFAULT_ROOT}
            stats={lib.stats}
            busy={lib.busy}
            progress={lib.progress}
            report={lib.report}
            onIngest={() => void lib.runIngest()}
            diffBusy={lib.diffBusy}
            diffProgress={lib.diffProgress}
            diffResult={lib.diffResult}
            onBuildDifficulty={() => void lib.runDifficulty()}
            error={lib.error}
            version="0.1.0"
            build="dev"
            onCheckUpdates={() => void up.check()}
            checkingUpdates={up.state.phase === 'checking'}
            statePath={up.statePath}
            onExportData={() => void up.exportData()}
            onRevealData={() => void up.revealData()}
            onClearData={() => void up.clearData()}
          />
        )}

        {view === 'reader' && !openPaper && (
          <div className="view">
            <div className="stub">
              <div className="stub-inner">
                <h2>Pick a paper first</h2>
                <p>Open one from the library and it lands here with the timer running.</p>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
}

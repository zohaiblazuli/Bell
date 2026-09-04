import { useCallback, useEffect, useMemo, useState } from 'react';
import Sprite from './components/Sprite';
import AppBackground from './components/AppBackground';
import Sidebar, { type View } from './components/Sidebar';
import TopBar from './components/TopBar';
import CommandPalette, { screenCommands, type PaletteCommand } from './components/CommandPalette';
import Button from '@ui/Button';
import Dialog from '@ui/Dialog';
import MrBell from '@ui/brand/MrBell';
import * as api from './lib/api';
import Splash, { type SplashPhase, type SplashTargets } from './components/Splash';
import { UpdateDialog, UpdatePill } from './components/UpdateFlow';
import LibraryView from './views/LibraryView';
import DashboardView from './views/DashboardView';
import WorkspaceView from './views/WorkspaceView';
import NotebooksView from './views/NotebooksView';
import NotebookView from './views/NotebookView';
import SettingsView from './views/SettingsView';
import OnboardingView, { type SessionOption } from './views/OnboardingView';
import { usePrefs } from './state/usePrefs';
import { useLibraryIndex } from './state/useLibraryIndex';
import { useStudyState } from './state/useStudyState';
import { useUpdates } from './state/useUpdates';
import { useNotebooks } from './state/useNotebooks';
import { useMascot } from './state/useMascot';
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

/** The bar's title per route. The Reader and the open notebook compose their own, so both are here
 *  only because the union demands it — neither renders `TopBar` from `screens()`. */
const TITLES: Record<View, string> = {
  library: 'Library',
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

  const [view, setView] = useState<View>(() => (onboarding.done ? 'library' : 'onboarding'));
  const [openPaper, setOpenPaper] = useState<PaperRow | null>(null);
  /**
   * Which notebook is open, and at which disk page index.
   *
   * A pair rather than a bare id because the Reader's clip confirmation offers "Go there", and
   * landing on the shelf and making them find the page again would waste the one gesture that makes
   * clipping worth having. `page` seeds the spread; the notebook owns it from then on.
   */
  const [openNotebook, setOpenNotebook] = useState<{ id: string; page: number } | null>(null);
  /** Set when something elsewhere asked for the New Notebook dialog — the empty clip picker does. */
  const [newNotebook, setNewNotebook] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [palette, setPalette] = useState(false);

  const lib = useLibraryIndex(view === 'onboarding');

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

  /**
   * Open a notebook onto its spread. Called with a page index from the Reader's clip confirmation and
   * without one from the shelf, where the whole notebook is what was asked for.
   *
   * The shelf's row is re-read on the way in rather than trusted: `pages` is derived from the
   * filesystem, and a clip that just spilled onto a new page would otherwise open a spread the
   * cached row does not know exists.
   */
  const openNotebookAt = useCallback(
    (id: string, page = 0) => {
      setOpenNotebook({ id, page });
      setFocusMode(false);
      setView('notebook');
      void notebooks.refresh();
    },
    [notebooks],
  );

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
        onNotebooks: () => go('notebooks'),
        onDashboard: () => go('dashboard'),
        onBookmarks: () => go('bookmarks'),
        onRecent: () => go('recent'),
        onSettings: () => go('settings'),
        // Omitted while unconfigured, so the palette never offers a check that cannot happen.
        onCheckUpdates: UPDATES_CONFIGURED ? () => void up.check() : undefined,
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

  const inReader = view === 'reader' && openPaper != null;
  /**
   * The open spread. Its row comes from the shelf's list rather than being carried in the route,
   * because `pages` and `bytes` are derived from the filesystem — a clip that just spilled onto a new
   * page has to be reflected, and a stale copy would open a spread the notebook does not have.
   */
  const openNb = openNotebook ? notebooks.find(openNotebook.id) : null;
  const inNotebook = view === 'notebook' && openNotebook != null;
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
   * The open notebook is its own shell too, and for the same kind of reason: `screen-notebooks.md` §5
   * puts the window lights inside the notebook's own 1320-wide top bar, which is only possible if
   * there is no sidebar to hold them. The spread, the 64px dock and the 268px inspector then divide
   * the whole window, exactly as the file draws it. Getting back is the `back` button at x 78.
   *
   * The palette stays mounted, because jumping to a paper from a notebook is the same gesture in
   * reverse as clipping one into it — and it has to sit inside `.app`, where the tone vars live.
   */
  if (inNotebook && openNotebook) {
    return (
      <>
        <Sprite />
        <div
          className="app app-bare"
          data-view="notebook"
          data-tone={tone}
          data-motion={motion}
          data-focus={focusMode ? 'on' : 'off'}
        >
          <AppBackground />
          {openNb ? (
            <NotebookView
              notebook={openNb}
              startPage={openNotebook.page}
              subjects={lib.subjects}
              tone={tone}
              onTone={toggleTone}
              focus={focusMode}
              onToggleFocus={() => setFocusMode((f) => !f)}
              onSearch={() => setPalette(true)}
              onSaveMeta={(meta) => notebooks.save(openNotebook.id, meta)}
              onDelete={async () => {
                await notebooks.remove(openNotebook.id);
                setOpenNotebook(null);
                go('notebooks');
              }}
              onBack={() => {
                setOpenNotebook(null);
                setFocusMode(false);
                go('notebooks');
              }}
            />
          ) : (
            /* The shelf is still being read, or the notebook has gone. Both are momentary and both
               look the same from here, so say the honest thing rather than guessing which. */
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

          <CommandPalette
            open={palette}
            onClose={() => setPalette(false)}
            onOpenPaper={openPaperAt}
            commands={commands}
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
          subjects={mySubjects}
          activeSubject={lib.subjectId}
          onSubject={pickSubject}
          paperCount={lib.stats ? visiblePapers : null}
          bookmarkCount={study.marks.bookmarks.size}
          recentCount={loadRecent().length}
          notebookCount={notebooks.list?.length ?? null}
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

        <Dialog
          open={resetOpen}
          onClose={() => (resetting ? undefined : setResetOpen(false))}
          title="Reset Bell?"
          art={<MrBell size={96} mood="alarm" />}
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
                /* aria-disabled rather than disabled: a real `disabled` drops focus to <body>,
                   where Dialog's scrim-bound key handler can no longer hold Tab inside the
                   modal. Focusable and inert keeps the trap, and with no handler attached a
                   second press cannot fire a second reset. */
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
        onReindex={() => void lib.runSync()}
        onSearch={() => setPalette(true)}
        onDownload={lib.download}
        questions={null}
        notebooks={notebooks.list}
        onNewNotebook={() => {
          setNewNotebook(true);
          go('notebooks');
        }}
        onOpenNotebook={(id, page) => openNotebookAt(id, page)}
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
          onReindex={() => void lib.runSync()}
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

        {view === 'notebooks' && (
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

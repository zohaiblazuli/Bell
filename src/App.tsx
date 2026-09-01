import { useCallback, useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import Sprite from './components/Sprite';
import Sidebar, { type View } from './components/Sidebar';
import TopBar from './components/TopBar';
import SetupView from './views/SetupView';
import LibraryView from './views/LibraryView';
import WorkspaceView from './views/WorkspaceView';
import * as api from './lib/api';
import { buildDifficulty, type BuildProgress, type BuildResult } from './lib/buildDifficulty';
import { loadPref, loadSet, savePref, saveSet } from './lib/store';
import type { IngestProgress, IngestReport, LibraryStats, PaperRow, Subject } from './lib/types';

export default function App() {
  const [tone, setTone] = useState<'day' | 'night'>(() => loadPref('tone', 'day'));
  const [aurora, setAurora] = useState<'soft' | 'off'>(() => loadPref('aurora', 'soft'));
  const [view, setView] = useState<View>('library');

  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [level, setLevel] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<IngestProgress | null>(null);
  const [report, setReport] = useState<IngestReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [bookmarks, setBookmarks] = useState<Set<string>>(() => loadSet('bookmarks'));
  const [openPaper, setOpenPaper] = useState<PaperRow | null>(null);
  const [focusMode, setFocusMode] = useState(false);

  const [diffBusy, setDiffBusy] = useState(false);
  const [diffProgress, setDiffProgress] = useState<BuildProgress | null>(null);
  const [diffResult, setDiffResult] = useState<BuildResult | null>(null);

  useEffect(() => savePref('tone', tone), [tone]);
  useEffect(() => savePref('aurora', aurora), [aurora]);

  useEffect(() => {
    const un = listen<IngestProgress>('ingest:progress', (e) => setProgress(e.payload));
    return () => void un.then((f) => f());
  }, []);

  const refreshIndex = useCallback(async () => {
    const s = await api.libraryStats();
    setStats(s);
    setSubjects(await api.listSubjects(null));
    return s;
  }, []);

  // first load: an empty index means the app has nothing to show yet
  useEffect(() => {
    void (async () => {
      try {
        const s = await refreshIndex();
        if (s.docs === 0) setView('setup');
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [refreshIndex]);

  // papers follow the filters that the Rust query understands
  useEffect(() => {
    if (view === 'setup') return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const rows = await api.listPapers({
          subjectId,
          level,
          limit: subjectId ? 2500 : 600,
        });
        if (!cancelled) setPapers(rows);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectId, level, view, stats?.docs, stats?.thresholds]);

  const runIngest = useCallback(async () => {
    setBusy(true);
    setError(null);
    setReport(null);
    setProgress(null);
    try {
      const r = await api.ingestLibrary();
      setReport(r);
      await refreshIndex();
      if (r.docs > 0) setView('library');
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [refreshIndex]);

  const runDifficulty = useCallback(async () => {
    setDiffBusy(true);
    setError(null);
    setDiffResult(null);
    setDiffProgress(null);
    try {
      const r = await buildDifficulty(setDiffProgress);
      setDiffResult(r);
      await refreshIndex();
    } catch (e) {
      setError(String(e));
    } finally {
      setDiffBusy(false);
      setDiffProgress(null);
    }
  }, [refreshIndex]);

  const toggleBookmark = useCallback((key: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveSet('bookmarks', next);
      return next;
    });
  }, []);

  const inWorkspace = view === 'workspace' && openPaper != null;

  const title = view === 'setup' ? 'Setup' : view === 'dashboard' ? 'Dashboard' : 'Library';

  return (
    <>
      <Sprite />
      <div
        className="app"
        data-view={view}
        data-tone={tone}
        data-aurora={aurora}
        data-focus={focusMode && inWorkspace ? 'on' : 'off'}
      >
        <Sidebar
          view={view}
          onView={setView}
          subjects={subjects}
          activeSubject={subjectId}
          onSubject={setSubjectId}
          paperCount={stats?.docs ?? null}
        />

        <div className="main">
          <div className="lib-aurora" aria-hidden="true" />

          {inWorkspace ? (
            <WorkspaceView
              paper={openPaper}
              focus={focusMode}
              onToggleFocus={() => setFocusMode((f) => !f)}
              onBack={() => {
                setFocusMode(false);
                setView('library');
              }}
            />
          ) : (
            <>
              <TopBar
                title={title}
                tone={tone}
                onTone={() => setTone(tone === 'day' ? 'night' : 'day')}
                aurora={aurora}
                onAurora={() => setAurora(aurora === 'soft' ? 'off' : 'soft')}
                busy={busy}
                onReindex={() => void runIngest()}
              />

          {view === 'setup' && (
            <SetupView
              root={stats?.root ?? api.DEFAULT_ROOT}
              stats={stats}
              busy={busy}
              progress={progress}
              report={report}
              error={error}
              onIngest={() => void runIngest()}
              onOpenLibrary={() => setView('library')}
              diffBusy={diffBusy}
              diffProgress={diffProgress}
              diffResult={diffResult}
              onBuildDifficulty={() => void runDifficulty()}
            />
          )}

          {view === 'library' && (
            <LibraryView
              papers={papers}
              subjects={subjects}
              loading={loading}
              level={level}
              onLevel={setLevel}
              season={season}
              onSeason={setSeason}
              subjectId={subjectId}
              onSubject={setSubjectId}
              bookmarks={bookmarks}
              onBookmark={toggleBookmark}
              error={error}
              onOpen={(p) => {
                setOpenPaper(p);
                setView('workspace');
              }}
            />
          )}

          {view === 'workspace' && !openPaper && (
            <div className="view">
              <div className="stub">
                <div className="stub-inner">
                  <h2>Pick a paper first</h2>
                  <p>Open one from the library and it lands here with the timer running.</p>
                </div>
              </div>
            </div>
          )}

          {view === 'dashboard' && (
            <div className="view">
              <div className="stub">
                <div className="stub-inner">
                  <h2>Dashboard is next</h2>
                  <p>
                    Focus minutes are being banked now that the timer is real, so streaks and
                    up-next get built on measured sessions rather than invented ones.
                  </p>
                </div>
              </div>
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

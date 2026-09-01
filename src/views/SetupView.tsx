import Icon from '../components/Icon';
import type { BuildProgress, BuildResult } from '../lib/buildDifficulty';
import type { IngestProgress, IngestReport, LibraryStats } from '../lib/types';

interface Props {
  root: string;
  stats: LibraryStats | null;
  busy: boolean;
  progress: IngestProgress | null;
  report: IngestReport | null;
  error: string | null;
  onIngest: () => void;
  onOpenLibrary: () => void;
  diffBusy: boolean;
  diffProgress: BuildProgress | null;
  diffResult: BuildResult | null;
  onBuildDifficulty: () => void;
}

export default function SetupView({
  root,
  stats,
  busy,
  progress,
  report,
  error,
  onIngest,
  onOpenLibrary,
  diffBusy,
  diffProgress,
  diffResult,
  onBuildDifficulty,
}: Props) {
  const indexed = (stats?.docs ?? 0) > 0;

  return (
    <div className="view">
      <div className="setup">
        <div className="setup-panel">
          <h1>{indexed ? 'Your library is indexed' : 'Index your library'}</h1>
          <p>
            Foolscap reads the Cambridge tree in place and builds a local index of every subject,
            session and paper. Nothing on the drive is moved, renamed or written to.
          </p>

          <div className="setup-path">
            <Icon name="folder" />
            {root}
          </div>

          {busy ? (
            <>
              <div className="setup-row">
                <button type="button" className="btn primary" disabled>
                  <Icon name="sync" /> Indexing…
                </button>
              </div>
              <div className="ingest-line">
                <span className="mono">{(progress?.docs ?? 0).toLocaleString()} papers</span>
                <span className="bar">
                  <i style={{ width: '100%', opacity: 0.5 }} />
                </span>
                <span className="now">{progress?.current ?? 'walking the tree…'}</span>
              </div>
            </>
          ) : (
            <div className="setup-row">
              <button type="button" className="btn primary" onClick={onIngest}>
                <Icon name={indexed ? 'sync' : 'lib'} />
                {indexed ? 'Rebuild index' : 'Build index'}
              </button>
              {indexed && (
                <button type="button" className="btn" onClick={onOpenLibrary}>
                  <Icon name="ret" /> Open library
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="err">
              <Icon name="warn" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> {error}
            </div>
          )}

          {indexed && (
            <div className="stats">
              <div className="stat">
                <b>{stats!.subjects.toLocaleString()}</b>
                <small>Subjects</small>
              </div>
              <div className="stat">
                <b>{stats!.docs.toLocaleString()}</b>
                <small>Documents</small>
              </div>
              <div className="stat">
                <b>{stats!.sessions.toLocaleString()}</b>
                <small>Sessions</small>
              </div>
            </div>
          )}

          {report && report.skipped > 0 && (
            <div className="ingest-line">
              <span>
                {report.skipped.toLocaleString()} file
                {report.skipped === 1 ? '' : 's'} skipped — unrecognised names
                {report.skippedSamples.length > 0 && `, e.g. ${report.skippedSamples[0]}`}
              </span>
            </div>
          )}

          {report && (
            <div className="ingest-line">
              <span>
                Indexed in {(report.elapsedMs / 1000).toFixed(1)}s · {report.subjects} subjects ·{' '}
                {report.docs.toLocaleString()} documents
              </span>
            </div>
          )}
        </div>

        {indexed && (
          <div className="setup-panel">
            <h1 style={{ fontSize: 19 }}>Grade thresholds &amp; difficulty</h1>
            <p>
              Difficulty is computed locally from the library's own grade-threshold PDFs. Each
              sitting is scored against the history of that exact component, so 9702/11 is judged
              against other 9702/11 sittings — never against another subject.
            </p>

            {diffBusy ? (
              <>
                <div className="setup-row" style={{ marginTop: 16 }}>
                  <button type="button" className="btn primary" disabled>
                    <Icon name="sync" />
                    {diffProgress?.phase === 'parsing'
                      ? 'Reading thresholds…'
                      : diffProgress?.phase === 'scoring'
                        ? 'Scoring…'
                        : 'Saving…'}
                  </button>
                </div>
                <div className="ingest-line">
                  <span className="mono">
                    {diffProgress?.done ?? 0}/{diffProgress?.total ?? 0}
                  </span>
                  <span className="bar">
                    <i
                      style={{
                        width: `${Math.round(
                          (100 * (diffProgress?.done ?? 0)) / Math.max(1, diffProgress?.total ?? 1),
                        )}%`,
                      }}
                    />
                  </span>
                  <span className="now">{diffProgress?.current ?? ''}</span>
                </div>
              </>
            ) : (
              <div className="setup-row" style={{ marginTop: 16 }}>
                <button type="button" className="btn primary" onClick={onBuildDifficulty}>
                  <Icon name="checkc" />
                  {stats!.thresholds > 0 ? 'Recompute difficulty' : 'Parse thresholds & score'}
                </button>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                  {stats!.thresholds.toLocaleString()} boundaries stored
                </span>
              </div>
            )}

            {diffResult && (
              <div className="ingest-line">
                <span>
                  {diffResult.parsedDocs}/{diffResult.docs} threshold PDFs read ·{' '}
                  {diffResult.scored.toLocaleString()} sittings scored
                  {diffResult.failedDocs > 0 && ` · ${diffResult.failedDocs} failed`}
                </span>
              </div>
            )}
            {diffResult && diffResult.failures.length > 0 && (
              <div className="err">
                <Icon name="warn" style={{ width: 14, height: 14, verticalAlign: '-2px' }} />{' '}
                {diffResult.failures[0]}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

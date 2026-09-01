import { useMemo } from 'react';
import Icon from '../components/Icon';
import { bandFor, sessionLabel, variantLabel } from '../lib/difficulty';
import { paperKey } from '../lib/store';
import type { PaperRow, Subject } from '../lib/types';

const LEVELS = ['A Level', 'IGCSE', 'O Level'] as const;
const SEASONS = [
  { key: 's', label: 'May/June' },
  { key: 'w', label: 'Oct/Nov' },
  { key: 'm', label: 'Feb/March' },
] as const;

interface Props {
  papers: PaperRow[];
  subjects: Subject[];
  loading: boolean;
  level: string | null;
  onLevel: (l: string | null) => void;
  season: string | null;
  onSeason: (s: string | null) => void;
  subjectId: number | null;
  onSubject: (id: number | null) => void;
  bookmarks: Set<string>;
  onBookmark: (key: string) => void;
  onOpen: (p: PaperRow) => void;
  error: string | null;
}

export default function LibraryView({
  papers,
  subjects,
  loading,
  level,
  onLevel,
  season,
  onSeason,
  subjectId,
  onSubject,
  bookmarks,
  onBookmark,
  onOpen,
  error,
}: Props) {
  const activeSubject = subjects.find((s) => s.id === subjectId) ?? null;

  const groups = useMemo(() => {
    const filtered = season ? papers.filter((p) => p.scode.startsWith(season)) : papers;
    const byYear = new Map<number, PaperRow[]>();
    for (const p of filtered) {
      const list = byYear.get(p.year);
      if (list) list.push(p);
      else byYear.set(p.year, [p]);
    }
    return [...byYear.entries()].sort((a, b) => b[0] - a[0]);
  }, [papers, season]);

  const total = groups.reduce((n, [, list]) => n + list.length, 0);

  return (
    <div className="view">
      <div className="lib">
        {error && (
          <div className="err" style={{ marginBottom: 18, marginTop: 0 }}>
            <Icon name="warn" style={{ width: 14, height: 14, verticalAlign: '-2px' }} /> {error}
          </div>
        )}

        <div className="filters">
          <button
            type="button"
            className={`chip${level === null ? ' filled' : ''}`}
            onClick={() => onLevel(null)}
          >
            All levels
          </button>
          {LEVELS.map((l) => (
            <button
              type="button"
              key={l}
              className={`chip${level === l ? ' filled' : ''}`}
              onClick={() => onLevel(level === l ? null : l)}
            >
              {l}
            </button>
          ))}

          <span style={{ width: 8 }} />

          {SEASONS.map((s) => (
            <button
              type="button"
              key={s.key}
              className={`chip${season === s.key ? ' filled' : ''}`}
              onClick={() => onSeason(season === s.key ? null : s.key)}
            >
              {s.label}
            </button>
          ))}

          {activeSubject && (
            <button type="button" className="chip filled" onClick={() => onSubject(null)}>
              {activeSubject.name}
              <span className="mono" style={{ color: 'var(--ink-3)' }}>
                {activeSubject.code}
              </span>
              <Icon name="x" className="x" />
            </button>
          )}
        </div>

        {loading && <div className="sec-label">Loading…</div>}

        {!loading && total === 0 && (
          <div className="sec-label">No question papers match these filters</div>
        )}

        {groups.map(([year, list]) => (
          <section key={year}>
            <div className="sec-label">
              {year}
              <span className="mono" style={{ letterSpacing: 0, textTransform: 'none' }}>
                {list.length}
              </span>
            </div>
            <div className="grid">
              {list.map((p) => {
                const key = paperKey(p.subjectCode, p.scode, p.variant);
                const band = bandFor(p.difficulty);
                const marked = bookmarks.has(key);
                return (
                  <div className="card" key={key + p.level}>
                    <div className="card-top">
                      <span className="code">{p.subjectCode}</span>
                      {p.variant && <span className="pnum">/{p.variant}</span>}
                      <button
                        type="button"
                        className={`bm${marked ? ' on' : ''}`}
                        aria-label={marked ? 'Remove bookmark' : 'Bookmark this paper'}
                        aria-pressed={marked}
                        onClick={() => onBookmark(key)}
                      >
                        <Icon name="bm" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpen(p)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        textAlign: 'left',
                        cursor: 'default',
                      }}
                    >
                      <div>
                        <div className="card-title">{p.subjectName}</div>
                        <div className="card-sub" style={{ marginTop: 2 }}>
                          {variantLabel(p.variant)}
                        </div>
                      </div>

                      <div className="card-meta">
                        <Icon name="clock" />
                        {sessionLabel(p.scode)}
                        <span className="sc">{p.scode}</span>
                      </div>

                      <div className="docs">
                        {p.qpPath && <span className="doc">QP</span>}
                        {p.msPath && <span className="doc">MS</span>}
                        {p.erPath && <span className="doc">ER</span>}
                      </div>
                    </button>

                    <div className="card-foot">
                      <span className="meter" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <i
                            key={i}
                            style={i <= band.lit ? { background: band.color } : undefined}
                          />
                        ))}
                      </span>
                      <span className="diff-l" style={{ color: band.color }}>
                        {band.label}
                      </span>
                      {p.difficulty != null && (
                        <span className="diff-s">{p.difficulty.toFixed(0)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

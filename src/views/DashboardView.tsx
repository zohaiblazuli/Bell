import './DashboardView.css';
import { useEffect, useMemo, useState } from 'react';
import SubjectIcon from '@ui/icons/SubjectIcon';
import Heatmap, { heatStats } from '@ui/shapekit/Heatmap';
import Flame from '@ui/shapekit/Flame';
import { sessionLabel } from '@/lib/difficulty';
import { daysUntil, nextWindow, windowForCode, windowsBetween, type Season } from '@/lib/sessions';
import {
  loadFocus,
  loadOnboarding,
  loadReaderPos,
  loadRecent,
  loadRows,
  loadSettings,
  type SetName,
} from '@/lib/store';
import type { PaperRow, Subject } from '@/lib/types';

/**
 * Home — the Bell App v2 dashboard. One question answered first: what do I do now?
 *
 *   greeting    date eyebrow, "Good evening, Zohaib", and one sentence of advice
 *   hero        PICK UP WHERE YOU LEFT OFF (paper thumbnail, page strip, Resume) beside the black
 *               NEXT SITTING panel whose number counts down on arrival and whose red corner rings
 *   activity    the since-day-one heatmap and a 2 × 2 stat rail (streak with its flame, longest run,
 *               days studied, focused this week)
 *   standing    WHERE YOU STAND — subjects furthest behind first — and SESSION COVERAGE
 *
 * Everything is read from the local stores (focus log, recents, marks, rows); nothing is sample data.
 * Where the design showed something Bell does not record — the question you were on — the page you
 * were on stands in for it.
 */
export interface Props {
  now: Date;
  name?: string;
  seasons?: Season[];
  subjects: Subject[];
  marks: Record<SetName, Set<string>>;
  onOpen: (paper: PaperRow) => void;
  /** "Choose another paper" — Past Papers. */
  onBrowse?: () => void;
  onSubject?: (subjectId: number) => void;
  /** Papers per sitting (`9709/s25`), from the catalogue — coverage's denominator. */
  sittingTotals?: Record<string, number>;
}

const DAY_MS = 86_400_000;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_SEASON: Record<Season, string> = { m: 'Feb/Mar', s: 'May/June', w: 'Oct/Nov' };
const COV_SEASON: Record<string, string> = { m: 'F/M', s: 'M/J', w: 'O/N' };

const pad2 = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const midday = (d: Date, offsetDays = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays, 12);
const parseIso = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

function hm(minutes: number): string {
  const m = Math.round(minutes);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${pad2(m % 60)}m`;
}

function ago(atMs: number, nowMs: number): string {
  const minutes = Math.max(0, Math.round((nowMs - atMs) / 60_000));
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${plural(minutes, 'minute')} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${plural(hours, 'hour')} ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${plural(days, 'day')} ago`;
  return `${plural(Math.round(days / 7), 'week')} ago`;
}

/**
 * The current run is anchored on today, or on yesterday if today has not been counted YET, so the
 * streak does not read zero every morning. The longest run walks the sorted dates once.
 */
function streaksOf(active: Set<string>, clock: Date): { current: number; longest: number } {
  let current = 0;
  for (let i = active.has(isoOf(clock)) ? 0 : 1; i < 4000; i += 1) {
    if (!active.has(isoOf(midday(clock, -i)))) break;
    current += 1;
  }
  let longest = 0;
  let run = 0;
  let previous = 0;
  for (const date of [...active].sort()) {
    const at = parseIso(date).getTime();
    run = previous && Math.round((at - previous) / DAY_MS) === 1 ? run + 1 : 1;
    previous = at;
    longest = Math.max(longest, run);
  }
  return { current, longest };
}

const codeOf = (key: string) => key.split('/')[0] ?? '';
const sittingOf = (key: string) => key.split('/').slice(0, 2).join('/');

type Standing = 'Start here' | 'Catching up' | 'Ahead';
const STANDING_COLOUR: Record<Standing, string> = {
  'Start here': 'var(--red)',
  'Catching up': 'var(--sk-yellow)',
  Ahead: 'var(--blue)',
};

/** Counts 99 → n once on arrival (Bell App v2's countdown), unless motion is off. */
function useCountdown(target: number | null): number | null {
  const [shown, setShown] = useState(target);
  useEffect(() => {
    if (target == null) return setShown(null);
    const reduced = loadSettings().reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || target >= 99) return setShown(target);
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 1300);
      const e = 1 - Math.pow(1 - k, 4);
      setShown(Math.round(99 - (99 - target) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

export default function DashboardView({ now, name, seasons, subjects, marks, onOpen, onBrowse, onSubject, sittingTotals }: Props) {
  const nowMs = now.getTime();
  const clock = useMemo(() => new Date(nowMs), [nowMs]);

  const focus = useMemo(() => loadFocus(), []);
  const rows = useMemo(() => loadRows(), []);
  const recent = useMemo(() => loadRecent(), []);
  const settings = useMemo(() => loadSettings(), []);
  const onboarding = useMemo(() => loadOnboarding(), []);

  /* ---- the sitting ------------------------------------------------------
   * Onboarding's target session drives the countdown — its step 04 promises exactly that. Honour it
   * while it is still ahead (`daysUntil` is >= 0 from the sitting's first day through its last), and
   * only once it has passed, or was never chosen, fall back to the next series the student sits
   * (`settings.seasons`). The explicit target wins over the season filter on purpose: it is the
   * sitting they told us they are working towards.
   */
  const target = useMemo(
    () => (onboarding.plan.session ? windowForCode(onboarding.plan.session) : null),
    [onboarding.plan.session],
  );
  const sitting = useMemo(
    () => (target && daysUntil(clock, target) >= 0 ? target : nextWindow(clock, seasons ?? settings.seasons)),
    [target, clock, seasons, settings.seasons],
  );
  const daysToExam = sitting ? daysUntil(clock, sitting) : null;
  const countdown = useCountdown(daysToExam);

  /* ---- activity --------------------------------------------------------- */
  // Day one is the first thing Bell has on record — a focused minute or an opened paper.
  const since = useMemo(() => {
    const firsts = [...Object.keys(focus.days).map((d) => parseIso(d).getTime()), ...recent.map((r) => r.at)];
    return firsts.length ? midday(new Date(Math.min(...firsts))) : midday(clock);
  }, [focus.days, recent, clock]);
  const days = useMemo(() => heatStats(focus.days, since, clock), [focus.days, since, clock]);

  const counted = useMemo(() => {
    const floor = Math.max(1, settings.streakMinutes);
    return new Set(Object.entries(focus.days).filter(([, m]) => m >= floor).map(([d]) => d));
  }, [focus.days, settings.streakMinutes]);
  const streaks = useMemo(() => streaksOf(counted, clock), [counted, clock]);

  const weekMinutes = useMemo(() => {
    const monday = midday(clock, -((clock.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => focus.days[isoOf(midday(monday, i))] ?? 0).reduce((a, b) => a + b, 0);
  }, [clock, focus.days]);

  /* ---- resume ----------------------------------------------------------- */
  const resume = useMemo(() => {
    const live = recent.filter((r) => !marks.done.has(r.key) && Boolean(rows[r.key]));
    const pick = live.find((entry) => (focus.papers[entry.key] ?? 0) > 0) ?? live[0];
    if (!pick) return null;
    return { key: pick.key, at: pick.at, paper: rows[pick.key], seconds: focus.papers[pick.key] ?? 0, pos: loadReaderPos(pick.key) };
  }, [recent, marks.done, rows, focus.papers]);

  /* ---- standing --------------------------------------------------------- */
  const standing = useMemo(() => {
    const indexed = new Map<string, { id: number; name: string; papers: number }>();
    for (const s of subjects) {
      const seen = indexed.get(s.code);
      if (seen) seen.papers += s.papers;
      else indexed.set(s.code, { id: s.id, name: s.name, papers: s.papers });
    }
    const doneBy = new Map<string, number>();
    for (const key of marks.done) doneBy.set(codeOf(key), (doneBy.get(codeOf(key)) ?? 0) + 1);

    // Your subjects first; failing that, anything you have touched.
    const codes = new Set(onboarding.subjects);
    if (codes.size === 0) {
      for (const set of [marks.done, marks.revision, marks.bookmarks]) for (const key of set) codes.add(codeOf(key));
      for (const entry of recent) codes.add(codeOf(entry.key));
    }
    codes.delete('');

    const named = new Map<string, string>();
    for (const row of Object.values(rows)) named.set(row.subjectCode, row.subjectName);

    const list = [...codes].map((code) => {
      const index = indexed.get(code);
      const done = doneBy.get(code) ?? 0;
      const total = index?.papers ?? 0;
      return {
        code,
        id: index?.id ?? null,
        name: index?.name ?? named.get(code) ?? code,
        pct: total ? Math.round((done / total) * 100) : 0,
      };
    });
    list.sort((a, b) => a.pct - b.pct || a.name.localeCompare(b.name));
    return list.slice(0, 5).map((r, i, all) => ({
      ...r,
      band: (all.length > 1 && i === all.length - 1 ? 'Ahead' : i === 0 ? 'Start here' : 'Catching up') as Standing,
    }));
  }, [subjects, marks, recent, rows, onboarding.subjects]);

  /* ---- coverage --------------------------------------------------------- */
  const sessions = useMemo(() => {
    const back = new Date(clock.getFullYear() - 3, clock.getMonth(), clock.getDate());
    return windowsBetween(back, clock)
      .filter((w) => w.end.getTime() <= clock.getTime())
      .slice(-8);
  }, [clock]);

  const years = useMemo(() => {
    const out: { year: number; span: number }[] = [];
    for (const w of sessions) {
      const last = out[out.length - 1];
      if (last && last.year === w.year) last.span += 1;
      else out.push({ year: w.year, span: 1 });
    }
    return out;
  }, [sessions]);

  const coverage = useMemo(() => {
    const done = new Map<string, number>();
    for (const key of marks.done) done.set(sittingOf(key), (done.get(sittingOf(key)) ?? 0) + 1);
    return standing
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => {
        const cells = sessions.map((w) => {
          const marked = done.get(`${r.code}/${w.code}`) ?? 0;
          if (marked === 0) return 'none';
          const total = sittingTotals?.[`${r.code}/${w.code}`];
          return total != null && marked >= total ? 'done' : 'started';
        });
        return { code: r.code, cells, n: cells.filter((c) => c === 'done').length };
      });
  }, [standing, sessions, marks.done, sittingTotals]);
  const sat = coverage.reduce((t, r) => t + r.n, 0);
  const cells = coverage.length * sessions.length;

  /* ---- words ------------------------------------------------------------ */
  const hour = clock.getHours();
  const partOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const who = (name ?? onboarding.name).trim();
  const eyebrow = `${WEEKDAYS[clock.getDay()]} ${clock.getDate()} ${MONTHS[clock.getMonth()]} · ${partOfDay}`.toUpperCase();
  const behind = standing[0];
  const advice = resume
    ? `Finish the ${resume.paper.subjectName} paper you left open${
        behind && behind.code !== resume.paper.subjectCode ? `, then give ${behind.name} some time. It's furthest behind.` : '.'
      }`
    : behind
    ? `Nothing open yet. ${behind.name} is furthest behind — a timed paper there is a good start.`
    : 'Nothing open yet. Pick a paper from Past Papers and it lands here.';

  // The page strip: one segment per page, grouped once a paper runs past twelve.
  const pos = resume?.pos ?? null;
  const segs = pos ? Math.max(1, Math.min(pos.pages, 12)) : 0;
  const here = pos ? Math.max(1, Math.min(segs, Math.ceil((pos.page / pos.pages) * segs))) : 0;
  const thumbHere = pos ? Math.max(1, Math.ceil((here / segs) * 7)) : 0;

  const rail = [
    { v: String(streaks.current), cap: streaks.current === 1 ? 'day in a row' : 'days in a row', streak: true },
    { v: String(streaks.longest), cap: 'longest run' },
    { v: String(days.studied), cap: `days studied of ${days.past}` },
    { v: hm(weekMinutes), cap: 'focused this week' },
  ];

  return (
    <div className="view">
      <div className="home">
        <header className="home__greet">
          <span className="home__eyebrow">{eyebrow}</span>
          <h1 className="home__title">
            Good {partOfDay}
            {who ? `, ${who}` : ''}
          </h1>
          <p className="home__advice">{advice}</p>
        </header>

        <section className="home__hero" aria-label="Pick up where you left off">
          <div className="home__resume">
            <div className="home__rule">
              <span className="home__label">PICK UP WHERE YOU LEFT OFF</span>
              <i />
            </div>
            {resume ? (
              <div className="home__resume-body">
                <div className="home__thumb" aria-hidden="true">
                  <span className="home__thumb-code">
                    {resume.paper.subjectCode}/{resume.paper.component}
                  </span>
                  <i className="home__thumb-title" />
                  {Array.from({ length: 7 }, (_, i) => (
                    <span key={i} className="home__thumb-line" data-state={i + 1 < thumbHere ? 'past' : i + 1 === thumbHere ? 'here' : undefined}>
                      <b>{i + 1}</b>
                      <i />
                    </span>
                  ))}
                </div>
                <div className="home__resume-main">
                  <div className="home__resume-id">
                    <div className="home__resume-name">
                      <SubjectIcon code={resume.paper.subjectCode} size={26} />
                      <span>{resume.paper.subjectName}</span>
                    </div>
                    <span className="home__resume-code">
                      {resume.paper.subjectCode} / {resume.paper.component} · Paper {resume.paper.paperNumber} · {sessionLabel(resume.paper.scode)}
                    </span>
                  </div>
                  {pos && (
                    <div className="home__steps" style={{ gridTemplateColumns: `repeat(${segs}, minmax(0, 1fr))` }}>
                      {Array.from({ length: segs }, (_, i) => (
                        <div key={i} data-state={i + 1 < here ? 'past' : i + 1 === here ? 'here' : undefined}>
                          <i style={{ animationDelay: `${300 + (i + 1) * 50}ms` }} />
                          <span>{segs === pos.pages ? `p${i + 1}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="home__resume-meta">
                    {[pos ? `On page ${pos.page} of ${pos.pages}` : null, resume.seconds >= 60 ? `${hm(resume.seconds / 60)} in` : null, `opened ${ago(resume.at, nowMs)}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <div className="home__resume-actions">
                    <button type="button" className="home__go" onClick={() => onOpen(resume.paper)}>
                      {pos ? `Resume page ${pos.page}` : 'Resume'}
                      <i aria-hidden="true" />
                    </button>
                    {onBrowse && (
                      <button type="button" className="home__link" onClick={onBrowse}>
                        Choose another paper
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="home__resume-empty">
                <p>Nothing on the go. Open a paper and it waits here, with the minutes you have already put in, until you mark it done.</p>
                {onBrowse && (
                  <button type="button" className="home__go" onClick={onBrowse}>
                    Browse Past Papers
                    <i aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="home__sitting">
            <i className="home__sun" aria-hidden="true">
              <i />
            </i>
            <i className="home__bell" aria-hidden="true" />
            <span className="home__label">NEXT SITTING</span>
            {sitting ? (
              <>
                <span className="home__count">{countdown}</span>
                <span className="home__count-cap">
                  {daysToExam === 1 ? 'day' : 'days'} to {SHORT_SEASON[sitting.season]}
                </span>
                <div className="home__sitting-foot">
                  <b>
                    {WEEKDAYS[sitting.start.getDay()].slice(0, 3)} {sitting.start.getDate()} {MONTHS[sitting.start.getMonth()].slice(0, 3)}
                  </b>
                  <span>{sitting.label} opens</span>
                </div>
              </>
            ) : (
              <span className="home__count-cap">No sitting ahead. Pick your series in Settings.</span>
            )}
          </div>
        </section>

        <section className="home__activity" aria-label="Activity">
          <div className="home__heat">
            <div className="home__rule">
              <span className="home__label">SINCE DAY ONE</span>
              <span className="home__note">
                {since.getDate()} {MONTHS[since.getMonth()].slice(0, 3)} {since.getFullYear()} to today
              </span>
              <i />
              <span className="sk-heat-key">
                less
                <span>
                  <i style={{ background: 'var(--heat-1)' }} />
                  <i style={{ background: 'var(--heat-2)' }} />
                  <i style={{ background: 'var(--heat-3)' }} />
                  <i style={{ background: 'var(--heat-4)' }} />
                </span>
                more
              </span>
            </div>
            <Heatmap days={focus.days} since={since} now={clock} />
          </div>
          <div className="home__rail">
            {rail.map((r) => (
              <div key={r.cap} className="home__stat">
                <span className="home__stat-v">
                  {r.streak && streaks.current > 0 && <Flame title={`${plural(streaks.current, 'day')} streak. Keep it lit.`} />}
                  <b>{r.v}</b>
                </span>
                <span className="home__stat-cap">{r.cap}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="home__lower">
          <div className="home__standing">
            <div className="home__rule">
              <span className="home__label">WHERE YOU STAND</span>
              <span className="home__note">furthest behind first</span>
              <i />
            </div>
            {standing.length === 0 && <p className="home__empty">Pick your subjects in Settings and they line up here.</p>}
            {standing.map((r) => {
              const body = (
                <>
                  <span className="home__prow-top">
                    <SubjectIcon code={r.code} size={18} />
                    <span className="home__prow-name">{r.name}</span>
                    <span className="home__prow-band">
                      <i style={{ background: STANDING_COLOUR[r.band] }} />
                      {r.band}
                    </span>
                    <span className="home__prow-pct">{r.pct}%</span>
                  </span>
                  <span className="home__bar">
                    <i style={{ width: `${r.pct}%` }} />
                  </span>
                </>
              );
              const id = r.id;
              return onSubject && id != null ? (
                <button key={r.code} type="button" className="home__prow" title={`See ${r.name} papers`} onClick={() => onSubject(id)}>
                  {body}
                </button>
              ) : (
                <div key={r.code} className="home__prow">
                  {body}
                </div>
              );
            })}
            {standing.length > 0 && <span className="home__foot">Papers marked done fill these bars. Click a subject to see its papers.</span>}
          </div>

          <div className="home__coverage">
            <div className="home__rule">
              <span className="home__label">SESSION COVERAGE</span>
              {cells > 0 && (
                <span className="home__note">
                  {sat} of {cells} done
                </span>
              )}
              <i />
            </div>
            {coverage.length === 0 ? (
              <p className="home__empty">A subject appears here once you pick it or mark one of its papers done.</p>
            ) : (
              <>
                <div className="home__cov" style={{ gridTemplateColumns: `26px repeat(${sessions.length}, minmax(0, 1fr)) 36px` }}>
                  <span />
                  {years.map((y) => (
                    <span key={y.year} className="home__cov-year" style={{ gridColumn: `span ${y.span}` }}>
                      {y.year}
                    </span>
                  ))}
                  <span />
                  <span />
                  {sessions.map((w) => (
                    <span key={w.code} className="home__cov-sess" title={w.label}>
                      {COV_SEASON[w.season]}
                    </span>
                  ))}
                  <span />
                  {coverage.map((r) => (
                    <div key={r.code} className="home__cov-row">
                      <SubjectIcon code={r.code} size={18} />
                      {r.cells.map((c, i) => (
                        <i key={i} data-state={c} title={`${sessions[i].label}: ${c === 'none' ? 'not yet' : c}`} />
                      ))}
                      <span className="home__cov-n">
                        {r.n}/{sessions.length}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="home__cov-key">
                  <span>
                    <i data-state="done" /> done
                  </span>
                  <span>
                    <i data-state="started" /> started
                  </span>
                  <span>
                    <i data-state="none" /> not yet
                  </span>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * Onboarding — the six-step first run. Spec: `design/specs/screen-onboarding.md`, all of it. The
 * panel is §3, the rail state machine §3.2, the actions table §3.3, the shared selectable/input/chip
 * recipes §4, and the six bodies §5.1–§5.6.
 *
 * MOUNT IT AS A DIRECT CHILD OF `.app`, not inside `.main`. There is no sidebar and no topbar on
 * this screen (§1) — the traffic lights sit alone at (12, 14) — so the root positions itself over
 * the whole frame. Dropped inside `.main` it would be inset by a 238px sidebar column that this
 * screen does not have, and `.main::before` would draw the page recess at the Dashboard's size;
 * §2's recess is full-frame here (TRAP 6), so this file carries its own.
 *
 * WHAT IS LOCAL AND WHAT IS A PROP. The step cursor is the only state held here. Every answer is
 * the caller's, under the five `onboarding.*` keys, because the dashboard greeting, the library
 * filter and the countdown all read them long after this screen is gone.
 *
 * THE NUMBERS ARE REAL OR THEY ARE ABSENT. The spec draws `5,420 papers`, `Showing 12 of 34`,
 * `263 days`, `61%` and `13,447 papers indexed` because a mock has to draw something. Here the
 * board counts come from the index (`levels`), the subject grid from the index (`subjects`), the
 * countdown from a sitting's real first-paper date, the build progress from the ingest's own
 * events, and 06's footnote from the finished index. Each of them renders nothing — or says plainly
 * that it does not know — when the number is not there. There is no placeholder statistic on this
 * screen, and step 05 never draws a proportion it cannot measure.
 */
import './OnboardingView.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '@ui/Button';
import Chip from '@ui/Chip';
import Field from '@ui/Field';
import Kbd from '@ui/Kbd';
import Notice from '@ui/Notice';
import Rail from '@ui/Rail';
import MrBell, { type BellMood } from '@ui/brand/MrBell';
import SeasonIcon, { seasonKeyOf } from '@ui/icons/SeasonIcon';
import SubjectIcon from '@ui/icons/SubjectIcon';
import Icon from '@/components/Icon';
import WindowLights from '@/components/WindowLights';
import { sessionLabel } from '@/lib/difficulty';
import type { IngestProgress, LevelCount, Subject } from '@/lib/types';

/** How hard the user intends to work. Stored inside `onboarding.plan`. */
export type RhythmKey = 'casual' | 'steady' | 'intense';

export interface OnboardingPlan {
  /** Session code of the target sitting — `s27`. Null until 04 is answered. */
  session: string | null;
  rhythm: RhythmKey | null;
}

/** The five `onboarding.*` state keys, as one object. Field names ARE the key suffixes. */
export interface OnboardingAnswers {
  name: string;
  /** A level exactly as the index spells it: `A Level` · `IGCSE` · `O Level`. */
  board: string | null;
  /** Syllabus codes, not ids — a code survives a reindex and a level change does not orphan it. */
  subjects: string[];
  plan: OnboardingPlan;
  done: boolean;
}

/** One sitting offered on 04. */
export interface SessionOption {
  /** Session code — `s27`. The label is `sessionLabel(scode)`, so the two cannot drift. */
  scode: string;
  /**
   * ISO date of the first paper in that sitting. Cambridge's timetable is not in the library, so
   * this is null unless the caller has it from somewhere else — and then §5.4's countdown and 06's
   * "263 days away" are simply not drawn. A month is not a date, and rounding one into the other is
   * the invented number this screen refuses to print.
   */
  firstPaper?: string | null;
}

/**
 * The three qualifications, in the file's own order and copy (§5.2). The chip palette is Chip's
 * own `Palette` axis, which is where the Board/A Level wash lives; the paper count is not here
 * because the index knows it.
 */
const BOARDS = [
  {
    level: 'A Level',
    palette: 'a-level',
    chip: 'A Level',
    title: 'AS & A Level',
    blurb: 'The two-year route. Papers 1-5, AS and A2 sittings.',
  },
  {
    level: 'IGCSE',
    palette: 'igcse',
    chip: 'IGCSE',
    title: 'IGCSE',
    blurb: 'Core and Extended tiers, with all regional variants.',
  },
  {
    level: 'O Level',
    palette: 'o-level',
    chip: 'O Level',
    title: 'O Level',
    blurb: 'The traditional syllabus, still sat across South Asia.',
  },
] as const;

/**
 * The three rhythms (§5.4). `count` and `estimate` define what the choice MEANS — they are the
 * plan's own terms, not a measurement of the user — so they ship verbatim from the spec.
 */
const RHYTHMS = [
  { key: 'casual', name: 'Casual', count: 2, estimate: 'about 20 minutes a day' },
  { key: 'steady', name: 'Steady', count: 4, estimate: 'about 45 minutes a day' },
  { key: 'intense', name: 'Intense', count: 7, estimate: 'about 80 minutes a day' },
] as const;

/** Season code → the Chip palette that season's wash is authored under (§4). */
const SEASON_PALETTE = { s: 'may-june', w: 'oct-nov', m: 'feb-march' } as const;

/**
 * Which of the twelve `Motion — Mr. Bell` timelines each step plays, published as `data-anim` by
 * `MrBell`. The names are `BellMood`, so a mood that is renamed in the rig breaks here rather than
 * silently stopping. He reads your name back (specs push-up), cranes over the three boards
 * (periscope), puts his reading glasses on for the densest screen (lens draw-on), catches the light
 * as the plan lands (glint), scurries off to do the work (scuttle), and hops when it is done.
 */
const MOODS: Record<number, BellMood> = {
  1: 'specs-push-up',
  2: 'periscope',
  3: 'lens-draw-on',
  4: 'glint',
  5: 'scuttle',
  6: 'hop',
};

/** 4 columns x 3 rows — the measured grid (§5.3). Also what "Showing 12 of 34" counts. */
const TILES_PER_PAGE = 12;

/** 28 blocks at 24x10, gap 4 → the 780 bar of §5.5. */
const PROGRESS_BLOCKS = 28;

/** First focusable in a region: what takes focus when the step changes. */
const FOCUSABLE = 'input:not([disabled]), button:not([disabled]), [href]';

/**
 * `9 May 2027`. Pinned to en-GB rather than the host locale because every string on this screen is
 * British English and the spec's own copy is day-first; a US default would render "May 9, 2027"
 * beside "May/June 2027".
 */
const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** Whole days from today to an ISO date, or null when there is no date to count to. */
function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = Date.parse(`${iso}T00:00:00`);
  if (Number.isNaN(then)) return null;
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((then - midnight) / 86_400_000));
}

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** One row of 06's summary card. The three glyphs are a subset of the sprite's `IconName`. */
interface SummaryRow {
  icon: 'book' | 'clock' | 'focus';
  label: string;
  value: string;
}

export interface Props {
  /** The five stored answers. This screen never writes them itself — see `onAnswer`. */
  answers: OnboardingAnswers;
  /** One write, keyed by the field name, which is also the `onboarding.<key>` state key. */
  onAnswer: <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => void;
  /** Every subject in the index. Filtered to the chosen board here; empty means unindexed. */
  subjects: Subject[];
  /** `LibraryStats.levels` — the 02 cards' paper counts. A level absent here shows no count. */
  levels: LevelCount[];
  /** The sittings 04 offers, soonest first. Empty and the step says so and stops asking. */
  sessions: SessionOption[];
  /** True while the Rust ingest is walking the library. Drives 05, and 05 → 06 when it clears. */
  busy: boolean;
  /** The ingest's own progress events. Null before the first one arrives. */
  progress: IngestProgress | null;
  /**
   * Papers the ingest is expected to find, when that is genuinely known — a previous index's
   * `LibraryStats.docs` on a rebuild. On a true first run nothing knows it, so leave it null: 05
   * then shows counts and activity instead of a percentage, because a bar with no denominator is a
   * guess. `IngestProgress` carries no total, which is why this cannot be derived.
   */
  expectedPapers?: number | null;
  /** Papers in the index now — 06's footnote. Omitted when null. */
  indexedPapers?: number | null;
  /** Why the build failed, if it did. Shown on 05 with a retry; the flow does not advance. */
  error?: string | null;
  /** Start the real ingest. Fired by 04's "Build my library" and by 05's retry. */
  onBuild: () => void;
  /** Leave onboarding for the app. Fired by 05's "Run in the background" and 06's "Open Bell". */
  onFinish: () => void;
}

export default function OnboardingView({
  answers,
  onAnswer,
  subjects,
  levels,
  sessions,
  busy,
  progress,
  expectedPapers = null,
  indexedPapers = null,
  error = null,
  onBuild,
  onFinish,
}: Props) {
  /** 1..6. The cursor is the whole of this screen's own state. */
  const [step, setStep] = useState(1);
  /** 03 only: the filter box, and whether the grid has been opened past its first twelve. */
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const bodyRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  /** Set once `busy` has actually been true, so 05 only advances off a build it watched run. */
  const sawBusy = useRef(false);

  const boardSubjects = useMemo(
    // A subject code belongs to one level, so the board is the filter. Alphabetical because the
    // file's grid is (§5.3) — not selected-first, which would reshuffle the tiles under the cursor.
    () =>
      subjects
        .filter((s) => !answers.board || s.level === answers.board)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [subjects, answers.board],
  );

  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      needle
        ? boardSubjects.filter(
            (s) => s.name.toLowerCase().includes(needle) || s.code.includes(needle),
          )
        : boardSubjects,
    [boardSubjects, needle],
  );
  const tiles = showAll ? matches : matches.slice(0, TILES_PER_PAGE);
  /** Nothing to offer on 03, so it must say why and not block the flow. */
  const noSubjects = boardSubjects.length === 0;
  /** §5.3's `Search 34 A Level subjects`, with the index's own count and the chosen board. */
  const searchHint = `Search ${boardSubjects.length} ${answers.board ? `${answers.board} ` : ''}subjects`;

  const chosenSession = sessions.find((s) => s.scode === answers.plan.session) ?? null;
  const days = daysUntil(chosenSession?.firstPaper);

  /** §3.3: Continue is live only when the step it sits under has been answered. */
  const satisfied =
    step === 1
      ? answers.name.trim().length > 0
      : step === 2
        ? answers.board != null
        : step === 3
          ? noSubjects || answers.subjects.length > 0
          : step === 4
            ? answers.plan.rhythm != null && (answers.plan.session != null || sessions.length === 0)
            : true;

  const finish = useCallback(() => {
    onAnswer('done', true);
    onFinish();
  }, [onAnswer, onFinish]);

  const advance = useCallback(() => {
    if (step <= 3) setStep(step + 1);
    else if (step === 4) {
      // The one place the build starts. Doing it here rather than in an effect on 05 keeps it tied
      // to the press that says "Build my library", so a re-render cannot fire a second walk of G:.
      setStep(5);
      onBuild();
    } else finish();
  }, [step, onBuild, finish]);

  /**
   * 05 is a wait, and the wait ending is what ends it: the ingest raises `busy`, and when it drops
   * with no error the flow moves to 06. A failure holds the step so the retry is where the failure
   * is. There is no timer here — nothing about this screen is on a clock.
   */
  useEffect(() => {
    if (step !== 5) return;
    if (busy) {
      sawBusy.current = true;
      return;
    }
    if (sawBusy.current && !error) setStep(6);
  }, [step, busy, error]);

  /**
   * The first control of the new step takes focus. The body is tried first and the action row
   * second, because 05 and 06 have no control in the body at all — and it is a query rather than a
   * per-step ref so that "first" always means first in DOM order, which is what a keyboard user
   * arrives at.
   */
  useEffect(() => {
    const el =
      bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
      actionsRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    el?.focus();
  }, [step]);

  /**
   * Enter advances when the step is answered. Escape is deliberately unbound: there is no way out
   * of onboarding but through it, so the key that means "cancel" everywhere else means nothing here.
   *
   * The guard is what makes this safe on 02/03/04, where the choices are buttons: Enter on a button
   * is that button's own activation, and advancing as well would select a board and step past it in
   * one press. A text input has no Enter behaviour of its own, which is why 01 works.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return;
      if ((e.target as HTMLElement | null)?.closest('button, a, select, textarea, [role="button"]'))
        return;
      if (!satisfied) return;
      e.preventDefault();
      advance();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [satisfied, advance]);

  const chooseBoard = (level: string) => {
    onAnswer('board', level);
    // A code belongs to exactly one level, so switching board orphans every code from the old one.
    // Prune rather than carry a selection the 03 grid cannot show — but only when the index can say
    // what the new board holds, or an unbuilt index would silently clear a real answer.
    const codes = new Set(subjects.filter((s) => s.level === level).map((s) => s.code));
    if (codes.size === 0) return;
    const kept = answers.subjects.filter((c) => codes.has(c));
    if (kept.length !== answers.subjects.length) onAnswer('subjects', kept);
  };

  const toggleSubject = (code: string) => {
    const on = answers.subjects.includes(code);
    onAnswer(
      'subjects',
      on ? answers.subjects.filter((c) => c !== code) : [...answers.subjects, code],
    );
  };

  const setPlan = (patch: Partial<OnboardingPlan>) =>
    onAnswer('plan', { ...answers.plan, ...patch });

  const board = BOARDS.find((b) => b.level === answers.board) ?? null;
  const rhythm = RHYTHMS.find((r) => r.key === answers.plan.rhythm) ?? null;

  // §3.3, verbatim. 05's is the one Secondary — it leaves a build running rather than committing to
  // anything — and 01/02/03 carry no leading glyph (TRAP 14: the template's chevron points down).
  const continueLabel =
    step === 3 && !noSubjects
      ? `Continue with ${answers.subjects.length}`
      : step === 4
        ? 'Build my library'
        : step === 5
          ? 'Run in the background'
          : step === 6
            ? 'Open Bell'
            : 'Continue';

  /**
   * 05's one honest number. A percentage needs a denominator and `IngestProgress` has none — so
   * unless the caller knows what to expect, there is no percentage and no proportion of the bar to
   * light. That is the whole reason `expectedPapers` exists.
   */
  const pct =
    progress && expectedPapers && expectedPapers > 0
      ? Math.min(100, Math.round((progress.docs / expectedPapers) * 100))
      : null;
  const lit = pct == null ? 0 : Math.round((pct / 100) * PROGRESS_BLOCKS);

  /**
   * 06's three rows (§5.6). Each one is built from an answer, so a row whose answer never got made
   * — the target session, when there were no sittings to offer — is simply not in the list. The
   * values use Body/Strong even though they contain numbers; §5.6 is explicit that no Mono style
   * belongs here.
   */
  const summaryRows: SummaryRow[] = [];
  if (board)
    summaryRows.push({
      icon: 'book',
      label: 'qualification',
      value: `${board.title} — ${plural(answers.subjects.length, 'subject', 'subjects')}`,
    });
  if (chosenSession)
    summaryRows.push({
      icon: 'clock',
      label: 'target session',
      value:
        days != null
          ? `${sessionLabel(chosenSession.scode)} — ${plural(days, 'day', 'days')} away`
          : sessionLabel(chosenSession.scode),
    });
  if (rhythm)
    summaryRows.push({
      icon: 'focus',
      label: 'your rhythm',
      value: `${rhythm.count} papers a week`,
    });

  return (
    /* The drag handle. `decorations: false` makes the OS window ours, and with no topbar on this
       screen the frame around the sheet is the only thing left to drag it by; Tauri only starts a
       drag when the press lands on the element carrying the attribute, so the panel and every
       control inside it stay clickable. */
    <div className="onb" data-step={step} data-tauri-drag-region>
      <div className="onb__lights">
        <WindowLights />
      </div>

      {/* The stage is the panel's own 1040x640 box, and it exists so Mr. Bell can be positioned
          against the panel's edges rather than the window's — he overhangs it by 76px on the left
          and 16px below (§3.5), and nothing in this subtree may clip him (TRAP 5). */}
      <div className="onb__stage">
        <div className="onb__panel">
          <Rail
            current={Math.min(step, 4)}
            label={step === 5 ? 'Setting up' : step === 6 ? 'All set' : undefined}
          />
          {/* `key={step}` remounts the region, which is what replays its entrance; every step's
              content is a different shape, so there is nothing to preserve across the swap. The
              per-step gap, alignment and copy widths are all in the CSS under `[data-step]`. */}
          <div className="onb__body" data-step={step} key={step} ref={bodyRef}>
            {step === 1 && (
              <>
                <div className="onb-heading">
                  <h1 className="t-display-setup-title">What should I call you?</h1>
                  <p className="onb-sub t-body-default">
                    It only shows up in your dashboard greeting, and you can change it whenever you
                    like.
                  </p>
                </div>
                <Field
                  value={answers.name}
                  onChange={(e) => onAnswer('name', e.target.value)}
                  /* No visible label in the design — the headline is it (Field.tsx says so), so the
                     accessible name is the question itself. */
                  aria-label="What should I call you?"
                  autoComplete="off"
                  spellCheck={false}
                  /* A greeting is one line; this is the field's own bound, not a fact about names. */
                  maxLength={40}
                  hint={
                    <>
                      Press <Kbd>return</Kbd> to continue
                    </>
                  }
                />
              </>
            )}

            {step === 2 && (
              <>
                <div className="onb-heading">
                  <h1 className="t-display-setup-title">Which qualification are you studying?</h1>
                  <p className="onb-sub t-body-default">
                    This filters the library and the subject list. You can add another qualification
                    later.
                  </p>
                </div>
                <div className="onb-boards" role="group" aria-label="Qualification">
                  {BOARDS.map((b) => {
                    const on = answers.board === b.level;
                    /* The count is the index's, or there is no count. §5.2 draws `5,420 papers`
                       because a mock must; an unbuilt index has no number to print. */
                    const docs = levels.find((l) => l.level === b.level)?.docs ?? null;
                    return (
                      <button
                        key={b.level}
                        type="button"
                        className="onb-select onb-board"
                        aria-pressed={on}
                        onClick={() => chooseBoard(b.level)}
                      >
                        <Chip label={b.chip} palette={b.palette} filled={on} />
                        <span className="t-title-card">{b.title}</span>
                        <span className="onb-board__blurb t-body-small">{b.blurb}</span>
                        {docs != null && (
                          <span className="onb-board__stat">
                            <span className="t-mono-meta">{docs.toLocaleString()}</span>
                            <span className="t-body-meta">papers</span>
                          </span>
                        )}
                        {on && <Icon name="check" className="onb-board__check" />}
                      </button>
                    );
                  })}
                </div>
                <p className="onb-note t-body-meta">
                  Studying more than one? Pick the main one now — you can add the rest from Settings.
                </p>
              </>
            )}

            {step === 3 && (
              <>
                {/* Figma's `strut` (layoutGrow 1) between the heading and the count is an auto
                    margin in CSS, which is why the row carries no gap — §5.3. */}
                <div className="onb-headrow">
                  <div className="onb-heading">
                    <h1 className="t-display-setup-title">Pick your subjects</h1>
                    <p className="onb-sub t-body-default">
                      Only these appear in your library and your dashboard.
                    </p>
                  </div>
                  <div className="onb-count">
                    <span className="t-mono-stat">{answers.subjects.length}</span>
                    <span className="t-label-stat">selected</span>
                  </div>
                </div>

                {noSubjects ? (
                  /* The flow asks for subjects before it builds the index, so on a true first run
                     there is genuinely nothing to offer. Say which of the two silences it is —
                     an empty index reads nothing like a board the drive happens not to hold — and
                     let `satisfied` pass the step, because there is nothing here to answer. */
                  <p className="onb-empty t-body-default">
                    {subjects.length === 0
                      ? 'Nothing is indexed yet, so there are no subjects to pick from. Bell builds the index in a moment — choose your subjects from Settings once it has.'
                      : `The index holds no ${answers.board} subjects. Go back and pick another qualification, or rebuild the index from Settings.`}
                  </p>
                ) : (
                  <>
                    <div className="onb-search">
                      <Icon name="search" className="onb-search__glyph" />
                      <input
                        className="onb-search__input t-body-default"
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={searchHint}
                        aria-label="Search subjects"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>

                    {matches.length === 0 ? (
                      <p className="onb-empty t-body-default">Nothing matches “{query.trim()}”.</p>
                    ) : (
                      <div className="onb-grid" role="group" aria-label="Subjects">
                        {tiles.map((s) => {
                          const on = answers.subjects.includes(s.code);
                          return (
                            <button
                              key={s.code}
                              type="button"
                              className="onb-select onb-tile"
                              aria-pressed={on}
                              onClick={() => toggleSubject(s.code)}
                            >
                              <SubjectIcon code={s.code} size={22} className="onb-tile__glyph" />
                              <span className="onb-tile__label">
                                <span className="t-body-chip">{s.name}</span>
                                <span className="onb-tile__code t-mono-small">{s.code}</span>
                              </span>
                              {on && <Icon name="check" className="onb-tile__check" />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <p className="onb-showing t-body-meta">
                      <span>
                        Showing {tiles.length.toLocaleString()} of {matches.length.toLocaleString()}
                      </span>
                      {matches.length > TILES_PER_PAGE && (
                        <button
                          type="button"
                          className="onb-link t-body-meta"
                          onClick={() => setShowAll(!showAll)}
                        >
                          {showAll ? 'Show fewer subjects' : 'Show all subjects'}
                        </button>
                      )}
                    </p>
                  </>
                )}
              </>
            )}

            {step === 4 && (
              <>
                <div className="onb-heading">
                  <h1 className="t-display-setup-title">When are you sitting these?</h1>
                  <p className="onb-sub t-body-default">
                    Your target session drives the countdown on your dashboard and how your papers
                    are paced.
                  </p>
                </div>

                <div className="onb-group">
                  {/* Label/Section uppercases in the text style, so the string stays lowercase
                      (TRAP 20) — do not retype the copy in capitals. */}
                  <span className="onb-eyebrow t-label-section">target session</span>
                  {sessions.length === 0 ? (
                    <p className="onb-empty t-body-default">
                      No upcoming sittings to offer yet — you can set your target session from
                      Settings.
                    </p>
                  ) : (
                    <>
                      <div className="onb-chips" role="group" aria-label="Target session">
                        {sessions.map((s) => {
                          const key = seasonKeyOf(s.scode);
                          return (
                            <Chip
                              key={s.scode}
                              /* The label is derived from the code by the app's own formatter, so a
                                 chip cannot say May/June while the stored answer says `w`. */
                              label={sessionLabel(s.scode)}
                              palette={key ? SEASON_PALETTE[key] : 'neutral'}
                              filled={answers.plan.session === s.scode}
                              icon={key ? <SeasonIcon season={key} /> : undefined}
                              onClick={() => setPlan({ session: s.scode })}
                            />
                          );
                        })}
                      </div>
                      {/* Only drawn when a real first-paper date is in hand — §5.4's "263 days"
                          counts to a Cambridge timetable date, which the index does not hold. */}
                      {days != null && chosenSession?.firstPaper && (
                        <p className="onb-countdown">
                          <span className="t-mono-stat">{plural(days, 'day', 'days')}</span>
                          <span className="onb-countdown__to t-body-small">
                            until your first paper —{' '}
                            {DATE.format(new Date(`${chosenSession.firstPaper}T00:00:00`))}
                          </span>
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="onb-group">
                  <span className="onb-eyebrow t-label-section">weekly rhythm</span>
                  <div className="onb-rhythms" role="group" aria-label="Weekly rhythm">
                    {RHYTHMS.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        className="onb-select onb-rhythm"
                        aria-pressed={answers.plan.rhythm === r.key}
                        onClick={() => setPlan({ rhythm: r.key })}
                      >
                        <span className="t-body-strong">{r.name}</span>
                        {/* BASELINE in Figma: the 19px mono figure and the 12px unit share a
                            baseline, which `align-items: baseline` is (§5.4). */}
                        <span className="onb-rhythm__count">
                          <span className="t-mono-stat">{r.count}</span>
                          <span className="onb-rhythm__unit t-body-small">papers a week</span>
                        </span>
                        <span className="onb-rhythm__est t-body-meta">{r.estimate}</span>
                      </button>
                    ))}
                  </div>
                  <p className="onb-note t-body-meta">
                    This is what counts as a day in your streak. Change it any time from Settings.
                  </p>
                </div>
              </>
            )}

            {step === 5 && (
              <>
                <div className="onb-heading">
                  <h1 className="t-display-setup-title">Building your library</h1>
                  {/* The spec's copy reads "Downloading and indexing", which this app does not do:
                      the ingest walks G: in place and writes only the local index. One word changed
                      so the sentence is true — and the count is the real one, not the spec's six. */}
                  <p className="onb-sub t-body-default">
                    Reading and indexing every past paper for{' '}
                    {answers.subjects.length > 0
                      ? `your ${plural(answers.subjects.length, 'subject', 'subjects')}`
                      : 'your library'}
                    . This happens once.
                  </p>
                </div>

                {/* 28 blocks, and only as many lit as the numbers support. With no denominator the
                    strip carries no proportion at all: it sweeps to say work is happening, drops
                    `aria-valuenow` so assistive tech reads it as indeterminate, and the status row
                    below states what is actually known. A bar is information here, never decor. */}
                <div
                  className="onb-blocks"
                  role="progressbar"
                  aria-label="Building your library"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct ?? undefined}
                  data-indeterminate={pct == null && busy ? '' : undefined}
                >
                  {Array.from({ length: PROGRESS_BLOCKS }, (_, i) => (
                    <span
                      key={i}
                      className="onb-block"
                      data-lit={i < lit ? '' : undefined}
                      style={pct == null ? { animationDelay: `${i * 40}ms` } : undefined}
                    />
                  ))}
                </div>

                <p className="onb-status">
                  <span className="onb-status__now t-mono-small">
                    {progress
                      ? `${progress.current} — ${
                          expectedPapers
                            ? `${progress.docs.toLocaleString()} of ${expectedPapers.toLocaleString()} papers`
                            : plural(progress.docs, 'paper', 'papers')
                        }`
                      : /* SetupView's own wording for the same moment — one phrase, not two. */
                        'walking the tree…'}
                  </span>
                  {/* §5.5 runs this row the full 944 while the bar stops at 780, so the right-hand
                      figure lands on the same column as the step label and the button (TRAP 16). */}
                  <span className="onb-status__pct t-mono-small">
                    {pct != null
                      ? `${pct}%`
                      : progress
                        ? plural(progress.subjects, 'subject', 'subjects')
                        : ''}
                  </span>
                </p>

                {error && (
                  <div className="onb-fail">
                    <Notice>{error}</Notice>
                    <Button icon="sync" label="Try again" onClick={onBuild} />
                  </div>
                )}

                <p className="onb-note t-body-meta">
                  Papers are stored locally, so the library works offline once this finishes.
                </p>
              </>
            )}

            {step === 6 && (
              <>
                <div className="onb-heading">
                  {/* Straight apostrophe, U+0027 — §5.6 is explicit that this one is not curled. */}
                  <h1 className="t-display-setup-title">
                    {answers.name.trim() ? `You're set, ${answers.name.trim()}.` : "You're set."}
                  </h1>
                  <p className="onb-sub t-body-default">
                    Here is what I have. Any of it can change later.
                  </p>
                </div>

                {/* A description list, because that is what it is: three label/value pairs. The
                    120px label column is what aligns the values (§5.6), and it is the span rather
                    than the <dt> so the 16px glyph keeps its own 12px gutter outside the column. */}
                <dl className="onb-summary">
                  {summaryRows.map((r) => (
                    <div className="onb-summary__row" key={r.label}>
                      <dt className="onb-summary__label t-body-meta">
                        <Icon name={r.icon} className="onb-summary__glyph" />
                        <span>{r.label}</span>
                      </dt>
                      <dd className="onb-summary__value t-body-strong">{r.value}</dd>
                    </div>
                  ))}
                </dl>

                {/* §5.6 prints "13,447 papers indexed and ready." A count the index has not given
                    us is not a count, so the line is absent rather than approximate. */}
                {indexedPapers != null && (
                  <p className="onb-note t-body-meta">
                    {plural(indexedPapers, 'paper', 'papers')} indexed and ready.
                  </p>
                )}
              </>
            )}
          </div>

          {/* counterAxisAlignItems CENTER is load-bearing, not cosmetic: Primary is 38 tall and
              Secondary 34, so without it Back and Continue sit on different baselines (TRAP 4). */}
          <div className="onb__actions" ref={actionsRef}>
            {/* Back is on 02-04 only (§3.3). 01 has nothing behind it, and 05/06 are terminal —
                there is no way out of onboarding but through it. */}
            {step >= 2 && step <= 4 && <Button label="Back" onClick={() => setStep(step - 1)} />}
            <Button
              variant={step === 5 ? 'secondary' : 'primary'}
              icon={step === 4 ? 'check' : step === 6 ? 'ret' : undefined}
              label={continueLabel}
              disabled={!satisfied}
              onClick={advance}
            />
          </div>
        </div>

        {/* Last in the stage, so he paints over the sheet (§3.5). 160px is the 256 rig at 0.625. */}
        <MrBell size={160} mood={MOODS[step]} className="onb__bell" />
      </div>
    </div>
  );
}

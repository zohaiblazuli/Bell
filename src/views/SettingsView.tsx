/**
 * Settings — seven grouped lists over the 7/5 column split. Geometry is
 * `design/specs/screen-library-settings.md` §6: `content` is 1020 x 746 at (269, 82) — the same
 * 31 / 26 inset inside the page recess that the Library's `lib` sits in — VERTICAL at gap 20, with
 * a 44-tall header over `cols`, which is HORIZONTAL at gap 24 with `left` FIXED 585 and `right`
 * taking the remaining 411. §6 is explicit that those are the authored px and that a true 7/5 would
 * be 581 / 415, so the px win over the ratio.
 *
 * Every card is §6.2's grouped list: `Card rows` holds zero padding and zero gap and each `CardRow`
 * supplies its own 11 / 16, which is the whole reason the `--hair-2` dividers run full bleed and
 * clip against the card's 13px corners. Both primitives already encode that; nothing here restates
 * it, and nothing here reaches into either one's internals.
 *
 * Choice rows are `Chip`, not `SegmentedControl`. §6.2 lists the control types the file actually
 * uses and a `choice` / `tone choice` chip row is one of them — the file works around its own
 * segmented control, whose glyphs are baked into its variants and unreachable through the API.
 *
 * WHAT THE FILE DRAWS THAT THIS DOES NOT, in every case because nothing in the app can honestly
 * fill it:
 *   `Papers folder → Choose…` (`535:405`) — Rust owns one watched root and the read sandbox is
 *     "is this path in the index" (CLAUDE.md), so there is no folder picker to wire.
 *   `Show Mr. Bell`, `Index on launch`, `Include mark schemes`, `Include examiner reports`
 *     (`534:431`, `535:411`, `535:419`, `535:426`) — four switches with nothing behind them.
 *   the UPDATES `notice slot` (`536:436`) and `Storage used` (`537:548`) — an update state and a
 *     byte count are measurements, and nothing in the app measures them.
 *   `Release notes` (`538:459`) — a link out of an app that must run with the network unplugged.
 *
 * The only state here is the clear-data confirm step. Every setting arrives as `settings` and
 * leaves through `onChange`, so this screen cannot drift from what `store.ts` persisted.
 */
import { useEffect, useRef, useState } from 'react';
import './SettingsView.css';
import Button from '@ui/Button';
import Card from '@ui/Card';
import CardRow from '@ui/CardRow';
import Chip, { type ChipPalette } from '@ui/Chip';
import Field from '@ui/Field';
import Notice from '@ui/Notice';
import SectionLabel from '@ui/SectionLabel';
import Switch from '@ui/Switch';
import GitHubMark from '@ui/icons/GitHubMark';
import SeasonIcon from '@ui/icons/SeasonIcon';
import type { BuildProgress, BuildResult } from '@/lib/buildDifficulty';
import type { SeasonChoice, Settings, ToneChoice } from '@/lib/store';
import type { IngestProgress, IngestReport, LibraryStats } from '@/lib/types';

/**
 * The two tone glyphs, verbatim from `design/specs/icons-paths.md` (`163:2` sun, `163:5` moon) and
 * identical to the pair `TonePill` inlines. Both files carry a copy because `sun` and `moon` are not
 * in the sprite's `IconName` union yet; when the re-exported set lands they both collapse to
 * `<Icon name="sun" />`. The sun's rays keep the spec's `butt` caps against index.css's global round.
 */
const SUN_RAYS =
  'M18.2 12H21.4M16.384 16.384L18.647 18.647M12 18.2V21.4M7.616 16.384L5.353 18.647M5.8 12H2.6M7.616 7.616L5.353 5.353M12 5.8V2.6M16.384 7.616L18.647 5.353';
const MOON =
  'M20.983 12.77C20.566 17.516 16.517 21.118 11.755 20.979C6.993 20.84 3.161 17.009 3.021 12.247C2.881 7.485 6.484 3.434 11.23 3.017C9.191 5.797 9.485 9.639 11.923 12.077C14.361 14.515 18.199 14.809 20.981 12.772L20.983 12.77Z';

function ToneGlyph({ night }: { night: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {night ? (
        <path d={MOON} />
      ) : (
        <>
          <circle cx="12" cy="12" r="3.125" />
          <path d={SUN_RAYS} strokeLinecap="butt" />
        </>
      )}
    </svg>
  );
}

/**
 * `tone choice` `534:387` — Day (sun) · Night (moon) · Match system (no glyph).
 *
 * CLAUDE.md is explicit that the tone is a **product-level toggle, not `prefers-color-scheme`**:
 * Day is `:root` and Night overrides on `.app[data-tone='night']`. So "Match system" is an explicit
 * opt-in the user has to reach for, never the default — `SETTINGS_DEFAULTS.tone` is `day`, and the
 * user choosing beats the OS choosing. (Spec TRAP 11: the Day frame still shows Night as the
 * selected chip while its own topbar pill reads "Day"; the selection is bound to the live value
 * here, which is what that trap asks for.)
 */
const TONES: { value: ToneChoice; label: string; glyph: boolean | null }[] = [
  { value: 'day', label: 'Day', glyph: false },
  { value: 'night', label: 'Night', glyph: true },
  { value: 'system', label: 'Match system', glyph: null },
];

/**
 * The three CAIE series, in the order the library filter row lists them (§5.1) rather than the
 * order of the session-code letters. Palettes are the file's own `Season/*` chip washes.
 */
const SERIES: { value: SeasonChoice; label: string; palette: ChipPalette }[] = [
  { value: 's', label: 'May/June', palette: 'may-june' },
  { value: 'w', label: 'Oct/Nov', palette: 'oct-nov' },
  { value: 'm', label: 'Feb/March', palette: 'feb-march' },
];

/**
 * A minutes input, for the two Focus rows the file draws as a `value` + chevron picker (`536:420`).
 *
 * The clamp runs on blur, not on every keystroke: clamping as you type turns "select all, type 45"
 * into 4 → the minimum → 45 and fights the user. While the field has focus it holds its own string;
 * the moment it loses focus it emits one whole number in range and goes back to mirroring the prop.
 * Enter commits without waiting for a blur, because a settings row has nothing to submit to.
 */
function MinutesField({
  value,
  min,
  max,
  label,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  /** Accessible name — `Field` has no visible label of its own, by design. */
  label: string;
  onCommit: (minutes: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    const n = Number.parseInt(draft ?? '', 10);
    setDraft(null);
    if (Number.isFinite(n)) onCommit(Math.min(max, Math.max(min, n)));
  };

  return (
    <Field
      className="set-minutes"
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={5}
      aria-label={label}
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

/**
 * The Library card's two status lines. Both read only what the ingest and the difficulty pass
 * actually report — there is no "last indexed 4 minutes ago" here, because nothing records a
 * timestamp, and the file's own string for that row (`535:432`) is Figma copy, not a measurement.
 * `null` means the row shows no helper at all, which is the honest state before the first run.
 */
function indexLine(
  busy: boolean,
  progress: IngestProgress | null,
  report: IngestReport | null,
): string | null {
  if (busy) {
    const docs = progress?.docs ?? 0;
    // The walk reports the file it is on before it has counted anything.
    if (docs === 0) return progress?.current ?? 'Walking the tree…';
    return `${docs.toLocaleString()} documents · ${progress?.current ?? ''}`;
  }
  if (!report) return null;
  const bits = [
    `${report.docs.toLocaleString()} documents`,
    `${report.subjects.toLocaleString()} subjects`,
    `${(report.elapsedMs / 1000).toFixed(1)}s`,
  ];
  // Unparseable filenames are the one ingest fact a user can act on, so it is not swallowed.
  if (report.skipped > 0) bits.push(`${report.skipped.toLocaleString()} skipped`);
  return bits.join(' · ');
}

function difficultyLine(
  busy: boolean,
  progress: BuildProgress | null,
  result: BuildResult | null,
  thresholds: number | null,
): string | null {
  if (busy) {
    const phase =
      progress?.phase === 'scoring'
        ? 'Scoring'
        : progress?.phase === 'saving'
          ? 'Saving'
          : 'Reading thresholds';
    const done = progress?.done ?? 0;
    const total = progress?.total ?? 0;
    return total > 0 ? `${phase} · ${done.toLocaleString()} of ${total.toLocaleString()}` : `${phase}…`;
  }
  if (result) {
    const bits = [
      `${result.parsedDocs.toLocaleString()} of ${result.docs.toLocaleString()} threshold PDFs read`,
      `${result.scored.toLocaleString()} sittings scored`,
    ];
    if (result.failedDocs > 0) bits.push(`${result.failedDocs.toLocaleString()} failed`);
    return bits.join(' · ');
  }
  if (thresholds != null && thresholds > 0) {
    return `${thresholds.toLocaleString()} grade boundaries stored`;
  }
  return null;
}

export interface Props {
  /** The persisted record, exactly as `loadSettings()` returns it. */
  settings: Settings;
  /** One key at a time: a row emits only what it changed, and App merges and saves. */
  onChange: (patch: Partial<Settings>) => void;

  /* ---- Library. The same props SetupView takes, which this screen retires. ---- */
  /** The watched library root. Read-only: Rust owns it and it is never chosen from here. */
  root: string;
  /** Index counts. `null` before the first index — every count then renders its empty state. */
  stats: LibraryStats | null;
  busy: boolean;
  progress: IngestProgress | null;
  report: IngestReport | null;
  onIngest: () => void;
  diffBusy: boolean;
  diffProgress: BuildProgress | null;
  diffResult: BuildResult | null;
  onBuildDifficulty: () => void;
  /** The last ingest failure, shown under the Library card. */
  error?: string | null;

  /* ---- Updates ---- */
  /** Running version — the same string the sidebar footer prints. Never derived here. */
  version: string;
  /** Build stamp. Absent → no build line, rather than a made-up one. */
  build?: string | null;
  onCheckUpdates: () => void;
  /** True while a check is in flight; the button disables and says so. */
  checkingUpdates?: boolean;

  /* ---- Data ---- */
  /** The app's state directory — where every JSON key in `store.ts` lives. */
  statePath: string;
  onExportData: () => void;
  /** Reveal the state directory in Explorer. */
  onRevealData: () => void;
  /** Fires only after the confirm step this view renders. */
  onClearData: () => void;

  /* ---- About ---- */
  /**
   * The licence line. Absent → the row is not drawn: the repo carries no LICENSE file, and About is
   * the last place to assert a licence nobody has written down.
   */
  licence?: string;
}

export default function SettingsView({
  settings,
  onChange,
  root,
  stats,
  busy,
  progress,
  report,
  onIngest,
  diffBusy,
  diffProgress,
  diffResult,
  onBuildDifficulty,
  error,
  version,
  build,
  onCheckUpdates,
  checkingUpdates = false,
  statePath,
  onExportData,
  onRevealData,
  onClearData,
  licence,
}: Props) {
  /** Transient, and the only state on the screen: a destructive action asks first. */
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Swapping the pressed button for two new ones drops focus to the body, so it is moved
    // deliberately — to Cancel, which is first in DOM order, because the destructive button must
    // never be the thing the keyboard lands on. Queried rather than reffed: `ButtonProps` extends
    // `ComponentPropsWithoutRef`, so a call site cannot hand a Button a ref.
    if (confirmClear) confirmRef.current?.querySelector('button')?.focus();
  }, [confirmClear]);

  const indexed = stats != null && stats.docs > 0;
  const indexStatus = indexLine(busy, progress, report);
  const diffStatus = difficultyLine(diffBusy, diffProgress, diffResult, stats?.thresholds ?? null);
  /** The build line, wherever it appears. One expression, so the two places cannot disagree. */
  const buildLine = build ? `build ${build}` : null;

  /**
   * Keep the file's series order rather than the order the chips were pressed, so the Dashboard
   * reads them the way the library filter row lists them.
   */
  const toggleSeries = (value: SeasonChoice) => {
    const next = settings.seasons.includes(value)
      ? settings.seasons.filter((s) => s !== value)
      : [...settings.seasons, value];
    onChange({ seasons: SERIES.filter((s) => next.includes(s.value)).map((s) => s.value) });
  };

  return (
    <div className="view">
      <div className="settings">
        {/* `header` `533:379` — VERTICAL gap 6: 24 + 6 + 14 = 44. The title is SF Pro Semibold 20,
            a size the published ramp does not carry (TRAP 10); `.t-greeting` is the documented
            off-ramp class for that exact 20, shared with the Dashboard greeting. */}
        <header className="set-head">
          <h1 className="set-title t-greeting">Settings</h1>
          <p className="set-sub t-body-small">
            {`Bell ${version} · one watched folder, `}
            {indexed
              ? `${(stats?.docs ?? 0).toLocaleString()} documents indexed`
              : 'nothing indexed yet'}
          </p>
        </header>

        <div className="set-cols">
          <div className="set-col set-col--left">
            <section className="set-group" aria-label="Appearance">
              <SectionLabel label="Appearance" />
              <Card rows>
                {/* The file says "the macOS appearance setting" (`534:383`). Bell is a Windows
                    desktop app, so the sentence names the OS it actually reads. */}
                <CardRow label="Tone" helper="Match system follows the Windows appearance setting">
                  <span className="set-choice" role="group" aria-label="Tone">
                    {TONES.map((t) => (
                      <Chip
                        key={t.value}
                        label={t.label}
                        filled={settings.tone === t.value}
                        icon={t.glyph == null ? undefined : <ToneGlyph night={t.glyph} />}
                        onClick={() => onChange({ tone: t.value })}
                      />
                    ))}
                  </span>
                </CardRow>

                <CardRow label="Reduce motion" helper="Cut the tone crossfade and page transitions">
                  <Switch
                    checked={settings.reduceMotion}
                    onChange={(reduceMotion) => onChange({ reduceMotion })}
                    label="Reduce motion"
                  />
                </CardRow>
              </Card>
            </section>

            <section className="set-group" aria-label="Library">
              {/* The only sec-label in the file that carries a meta (§6.1). Ours counts documents,
                  not "papers": `stats.docs` is every indexed file — question papers, mark schemes,
                  thresholds and reports — and calling that a paper count would be wrong by ~4x. */}
              <SectionLabel
                label="Library"
                meta={indexed ? `${(stats?.docs ?? 0).toLocaleString()} documents` : undefined}
              />
              <Card rows>
                {/* §6.3 sets this helper in `Mono/Small` rather than the row's Body/Meta — it is a
                    path, not prose — and the inner class wins over the ramp class CardRow applies. */}
                <CardRow
                  label="Papers folder"
                  helper={<span className="set-path t-mono-small">{root}</span>}
                />

                <CardRow
                  label="Documents"
                  helper={
                    indexed
                      ? `${(stats?.subjects ?? 0).toLocaleString()} subjects · ${(
                          stats?.sessions ?? 0
                        ).toLocaleString()} sessions`
                      : 'Nothing indexed yet'
                  }
                >
                  {/* §6.2's last control type: plain `Mono/Meta` on `--ink-2`, no button, no
                      chevron — `Storage used` `537:552` is the file's instance of it. */}
                  {indexed ? (
                    <span className="set-value t-mono-meta">
                      {(stats?.docs ?? 0).toLocaleString()}
                    </span>
                  ) : null}
                </CardRow>

                <CardRow
                  label="Index"
                  helper={
                    indexStatus ? (
                      <span className="set-now">{indexStatus}</span>
                    ) : (
                      'Walks the watched folder in place. Nothing on the drive is written to.'
                    )
                  }
                >
                  <Button
                    icon="sync"
                    className={busy ? 'set-spin' : undefined}
                    /* A scoring pass reads the index this would be rebuilding underneath it. */
                    disabled={busy || diffBusy}
                    onClick={onIngest}
                    label={busy ? 'Indexing…' : 'Rebuild index'}
                  />
                </CardRow>

                <CardRow
                  label="Difficulty"
                  helper={
                    diffStatus ??
                    "Scored locally from the library's own grade-threshold PDFs, per component."
                  }
                >
                  <Button
                    /* `sync` while it runs: `set-spin` rotates whatever glyph is in the slot, and a
                       revolving check-in-circle reads as a rendering fault rather than progress. */
                    icon={diffBusy ? 'sync' : 'checkc'}
                    className={diffBusy ? 'set-spin' : undefined}
                    /* Nothing to score before there is an index, and the two passes share it. */
                    disabled={diffBusy || busy || !indexed}
                    onClick={onBuildDifficulty}
                    label={diffBusy ? 'Scoring…' : 'Rebuild difficulty'}
                  />
                </CardRow>
              </Card>

              {error ? <Notice className="set-notice">{error}</Notice> : null}
              {/* One failure, not the list: `failures` is capped at 8 by buildDifficulty and the
                  first is representative — the same call SetupView made. */}
              {!diffBusy && diffResult && diffResult.failures.length > 0 ? (
                <Notice className="set-notice">{diffResult.failures[0]}</Notice>
              ) : null}
            </section>

            <section className="set-group" aria-label="Exam sessions">
              <SectionLabel label="Exam sessions" />
              <Card rows>
                {/* Multi-select: a candidate can sit more than one series, and the set drives the
                    Dashboard's days-to-exam. Deselecting all is allowed and the helper says what it
                    costs, rather than the row silently pinning a series the user does not sit. */}
                <CardRow
                  label="Series you sit"
                  helper={
                    settings.seasons.length > 0
                      ? "Sets the Dashboard's days-to-exam countdown"
                      : 'No series selected — the Dashboard has no countdown'
                  }
                >
                  <span className="set-choice" role="group" aria-label="Series you sit">
                    {SERIES.map((s) => (
                      <Chip
                        key={s.value}
                        label={s.label}
                        palette={s.palette}
                        filled={settings.seasons.includes(s.value)}
                        icon={<SeasonIcon season={s.value} />}
                        onClick={() => toggleSeries(s.value)}
                      />
                    ))}
                  </span>
                </CardRow>
              </Card>
            </section>
          </div>

          <div className="set-col set-col--right">
            <section className="set-group" aria-label="Focus">
              <SectionLabel label="Focus" />
              <Card rows>
                <CardRow label="Start the timer when a paper opens">
                  <Switch
                    checked={settings.focusAutostart}
                    onChange={(focusAutostart) => onChange({ focusAutostart })}
                    label="Start the timer when a paper opens"
                  />
                </CardRow>

                <CardRow label="Session length" helper="Minutes on the clock when a session starts">
                  <MinutesField
                    value={settings.focusMinutes}
                    min={5}
                    max={300}
                    label="Default session length in minutes"
                    onCommit={(focusMinutes) => onChange({ focusMinutes })}
                  />
                  <span className="set-unit t-body-meta">min</span>
                </CardRow>

                <CardRow
                  label="Streak threshold"
                  helper="Focused minutes in a day for it to count"
                >
                  <MinutesField
                    value={settings.streakMinutes}
                    min={1}
                    max={240}
                    label="Streak threshold in minutes"
                    onCommit={(streakMinutes) => onChange({ streakMinutes })}
                  />
                  <span className="set-unit t-body-meta">min</span>
                </CardRow>
              </Card>
            </section>

            <section className="set-group" aria-label="Updates">
              <SectionLabel label="Updates" />
              <Card rows>
                {/* Off by default, and that default is the point: offline is a hard requirement, so
                    nothing reaches the network unless the user asks here or presses Check now. The
                    file draws this switch On (`536:451`); the requirement outranks the mock. */}
                <CardRow
                  label="Check automatically"
                  helper="Daily, in the background. Off by default — Bell makes no network request otherwise."
                >
                  <Switch
                    checked={settings.updateAuto}
                    onChange={(updateAuto) => onChange({ updateAuto })}
                    label="Check for updates automatically"
                  />
                </CardRow>

                {/* One of the file's three label-less rows (TRAP 13): a Body/Meta string sits in the
                    label slot and the action sits opposite it. */}
                <CardRow helper={buildLine ? `Bell ${version} · ${buildLine}` : `Bell ${version}`}>
                  <Button
                    icon="sync"
                    className={checkingUpdates ? 'set-spin' : undefined}
                    disabled={checkingUpdates}
                    onClick={onCheckUpdates}
                    label={checkingUpdates ? 'Checking…' : 'Check now'}
                  />
                </CardRow>
              </Card>
            </section>

            <section className="set-group" aria-label="Data">
              <SectionLabel label="Data" />
              <Card rows>
                <CardRow
                  label="Study data"
                  helper={<span className="set-path t-mono-small">{statePath}</span>}
                >
                  <Button icon="folder" onClick={onRevealData} label="Reveal" />
                </CardRow>

                <CardRow helper="Bookmarks, marks, focus minutes and annotation ink — one JSON file per key.">
                  <Button icon="doc" onClick={onExportData} label="Export…" />
                </CardRow>

                {/* The one destructive action on the screen, and the one row that changes shape:
                    pressing Clear replaces the button with Cancel + Clear rather than firing. The
                    helper carries the warning, because a confirm the user has to infer is not one. */}
                <CardRow
                  label="Clear study data"
                  helper={
                    confirmClear
                      ? 'Every mark, every focused minute and all annotation ink. This cannot be undone.'
                      : 'The index rebuilds itself from the drive; this is the part that only exists here.'
                  }
                >
                  {confirmClear ? (
                    <span
                      ref={confirmRef}
                      className="set-confirm"
                      role="group"
                      aria-label="Confirm clearing study data"
                      /* Escape backs out, which is what a keyboard expects of a confirm step. The
                         handler sits on the group because neither button owns the interaction. */
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setConfirmClear(false);
                      }}
                    >
                      <Button onClick={() => setConfirmClear(false)} label="Cancel" />
                      <Button
                        className="set-danger"
                        aria-label="Clear all study data"
                        onClick={() => {
                          setConfirmClear(false);
                          onClearData();
                        }}
                        label="Clear"
                      />
                    </span>
                  ) : (
                    <Button
                      className="set-danger"
                      onClick={() => setConfirmClear(true)}
                      label="Clear…"
                    />
                  )}
                </CardRow>
              </Card>
            </section>

            <section className="set-group" aria-label="About">
              <SectionLabel label="About" />
              <Card rows>
                {/* §6.4's About row verbatim: a `Body/Strong` label over a `Mono/Small` helper
                    (`538:455`), which is the pairing CardRow's own header documents — the label
                    slot's ramp class is `Body/Default`, so Semibold is wrapped at the call site.
                    The spec's helper is `build 1284 · September 2026`; the date is a measurement
                    nothing takes, so only the build stamp ships, and only when App passes one. */}
                <CardRow
                  label={<span className="t-body-strong">Bell {version}</span>}
                  helper={buildLine ? <span className="t-mono-small">{buildLine}</span> : undefined}
                />

                {/* §6.4: "a second copy of the sidebar credit row". Literally the same classes, so
                    the heart's documented `--d5` borrow is stated once, in app.css, not twice. */}
                <CardRow
                  label={
                    <span className="credit t-body-meta">
                      Built with <span className="credit-heart">♥</span> by{' '}
                      <GitHubMark size={11} className="credit-mark" />
                      <span className="credit-name">zohaiblazuli</span>
                    </span>
                  }
                />

                {licence ? <CardRow helper={licence} /> : null}
              </Card>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

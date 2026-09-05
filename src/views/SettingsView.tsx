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
import { useEffect, useMemo, useRef, useState } from 'react';
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
import Icon, { type IconName } from '@/components/Icon';
import PetShelf from '@/components/PetShelf';
import type { UpdateState } from '@/components/UpdateFlow';
import { petList, type PetEntry } from '@/lib/pets';
import type { SeasonChoice, Settings, ToneChoice } from '@/lib/store';
import type { LibraryStats, RepairReport, Subject, SyncReport } from '@/lib/types';

/**
 * `tone choice` `534:387` — Day (sun) · Night (moon) · Match system (no glyph). `glyph` is the
 * sprite name to clone, or `null` for the row that carries none — `sun` `163:2` and `moon` `163:5`
 * live in `IconName` now, so this screen no longer inlines their paths.
 *
 * CLAUDE.md is explicit that the tone is a **product-level toggle, not `prefers-color-scheme`**:
 * Day is `:root` and Night overrides on `.app[data-tone='night']`. So "Match system" is an explicit
 * opt-in the user has to reach for, never the default — `SETTINGS_DEFAULTS.tone` is `day`, and the
 * user choosing beats the OS choosing. (Spec TRAP 11: the Day frame still shows Night as the
 * selected chip while its own topbar pill reads "Day"; the selection is bound to the live value
 * here, which is what that trap asks for.)
 */
const TONES: { value: ToneChoice; label: string; glyph: IconName | null }[] = [
  { value: 'day', label: 'Day', glyph: 'sun' },
  { value: 'night', label: 'Night', glyph: 'moon' },
  { value: 'system', label: 'Match system', glyph: null },
];

/**
 * The three CAIE series, in the order the library filter row lists them (§5.1) rather than the
 * order of the session-code letters. Palettes are the file's own `Season/*` chip washes.
 */
/** The three qualifications, in the order every other surface lists them. */
const LEVELS = ['A Level', 'IGCSE', 'O Level'] as const;

/** Matches LibraryView's chips, so a qualification wears one colour across the app. */
const LEVEL_PALETTE: Record<(typeof LEVELS)[number], ChipPalette> = {
  'A Level': 'a-level',
  IGCSE: 'igcse',
  'O Level': 'o-level',
};

const SERIES: { value: SeasonChoice; label: string; palette: ChipPalette }[] = [
  { value: 's', label: 'May/June', palette: 'may-june' },
  { value: 'w', label: 'Oct/Nov', palette: 'oct-nov' },
  { value: 'm', label: 'Feb/Mar', palette: 'feb-march' },
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
 * The Library card's status lines.
 *
 * Unlike the folder-walking version there IS an honest "last synced" figure now —
 * `catalog_meta.synced_at` records one — so the row that used to have no timestamp to
 * show finally has one. `null` still means no helper at all, which is the truthful
 * state before the first sync.
 */
function syncLine(busy: boolean, progress: string | null, report: SyncReport | null): string | null {
  if (busy) return progress ?? 'Checking for a newer catalogue…';
  if (!report) return null;
  const { status } = report;
  if (!report.changed) {
    return `Already current · ${status.papers.toLocaleString()} papers`;
  }
  return [
    `${status.papers.toLocaleString()} papers`,
    `${status.subjects.toLocaleString()} subjects`,
    `${status.sessions.toLocaleString()} sessions`,
  ].join(' · ');
}

/** `132120576` -> `126 MB`. Whole numbers past a megabyte: nobody needs 126.4 here. */
function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return mb < 1024 ? `${Math.round(mb)} MB` : `${(mb / 1024).toFixed(1)} GB`;
}

/** `1738099200000` -> `2 hours ago`. Absent means never synced. */
function syncedAgo(ms: number | null | undefined): string | null {
  if (ms == null) return null;
  const minutes = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function repairLine(report: RepairReport | null): string | null {
  if (!report) return null;
  const bits = [`${report.scanned.toLocaleString()} files scanned`];
  if (report.linked > 0) bits.push(`${report.linked.toLocaleString()} linked`);
  if (report.pruned > 0) bits.push(`${report.pruned.toLocaleString()} missing`);
  if (report.unmatched > 0) bits.push(`${report.unmatched.toLocaleString()} unrecognised`);
  return bits.join(' · ');
}

/**
 * What the last check found, for the row that holds the button that ran it.
 *
 * `null` means nothing has been asked yet, and the row keeps its version line — an app that has not
 * looked must not claim to be current. Every other phase says what is true right now, including the
 * three that belong to a download already in progress: the card is where someone comes back to when
 * the sidebar pill is not in front of them.
 */
function updateLine(state: UpdateState | undefined): string | null {
  if (!state) return null;
  switch (state.phase) {
    case 'idle':
      return null;
    case 'checking':
      return 'Asking the update server…';
    case 'current':
      return `Up to date — v${state.version} is the newest build.`;
    case 'available':
      return `v${state.version} is available. Open it from the sidebar to download.`;
    case 'downloading':
      return `Downloading v${state.version}…`;
    case 'ready':
      return `v${state.version} is downloaded and installs on the next restart.`;
    case 'installing':
      return `Restarting into v${state.version}…`;
    case 'error':
      return state.message;
  }
}

export interface Props {
  /** The persisted record, exactly as `loadSettings()` returns it. */
  settings: Settings;
  /** One key at a time: a row emits only what it changed, and App merges and saves. */
  onChange: (patch: Partial<Settings>) => void;

  /* ---- Library. The same props SetupView takes, which this screen retires. ---- */
  /** Where downloads land. Read-only: Rust owns it and it is never chosen from here. */
  root: string;
  /** Catalogue counts. `null` before the first sync — every count renders its empty state. */
  stats: LibraryStats | null;
  busy: boolean;
  /** Human-readable sync step, straight from Rust. */
  progress: string | null;
  report: SyncReport | null;
  onSync: () => void;
  /** Reconcile the download records with what is actually on disk. */
  onRepair: () => void;
  /** Open the downloads folder in Explorer. */
  onRevealDownloads: () => void;
  repairReport?: RepairReport | null;
  /** The last sync or download failure, shown under the Library card. */
  error?: string | null;

  /* ---- Your subjects. The sidebar's list, and the reason it is short. ---- */
  /** Every subject in the catalogue. Filtered to `board` for the chips below. */
  subjects: Subject[];
  /** Chosen qualification, spelled as the catalogue labels it: `A Level` etc. */
  board: string | null;
  onBoard: (level: string | null) => void;
  /** Syllabus codes, not ids — a code survives a resync and a level change. */
  chosenSubjects: string[];
  onToggleSubject: (code: string) => void;

  /* ---- Updates ---- */
  /** Running version — the same string the sidebar footer prints. Never derived here. */
  version: string;
  /** Build stamp. Absent → no build line, rather than a made-up one. */
  build?: string | null;
  onCheckUpdates: () => void;
  /** True while a check is in flight; the button disables and says so. */
  checkingUpdates?: boolean;
  /**
   * The update flow's phase, so this card can report the outcome of its own button.
   *
   * It is here because the card owns the press: a check that came back "nothing newer" used to set
   * the flow to `idle`, which draws no pill and no dialog — so on the newest build "Check now" looked
   * exactly like a dead button. The dialog answers a press too; this is the line that is still there
   * afterwards.
   */
  updateState?: UpdateState;

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
  onSync,
  onRepair,
  onRevealDownloads,
  repairReport = null,
  error,
  subjects,
  board,
  onBoard,
  chosenSubjects,
  onToggleSubject,
  version,
  build,
  onCheckUpdates,
  checkingUpdates = false,
  updateState,
  statePath,
  onExportData,
  onRevealData,
  onClearData,
  licence,
}: Props) {
  /** Transient, and the only state on the screen: a destructive action asks first. */
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmRef = useRef<HTMLSpanElement>(null);

  /**
   * The pet shelf, and just enough of the installed list to name the current mascot.
   *
   * `PetShelf` keeps its own copy rather than being handed this one: it installs and removes, so it
   * needs to refresh on its own, and one shared mutable list would mean plumbing a callback up here to
   * do what re-reading on close already does. Two cheap reads of the same directory, no shared state.
   */
  const [petShelf, setPetShelf] = useState(false);
  const [pets, setPets] = useState<PetEntry[] | null>(null);

  useEffect(() => {
    // On mount, and again whenever the shelf closes — which is the only thing that can change it.
    if (petShelf) return;
    void petList()
      .then(setPets)
      .catch(() => setPets([]));
  }, [petShelf]);

  /**
   * What the row says, which is what is actually on screen rather than what is stored: a selection
   * whose pet has since been removed falls back to Mr. Bell, so the row has to as well.
   */
  const mascotName =
    pets == null
      ? '…'
      : (settings.pet ? pets.find((p) => p.id === settings.pet)?.displayName : null) ?? 'Mr. Bell';

  useEffect(() => {
    // Swapping the pressed button for two new ones drops focus to the body, so it is moved
    // deliberately — to Cancel, which is first in DOM order, because the destructive button must
    // never be the thing the keyboard lands on. Queried rather than reffed: `ButtonProps` extends
    // `ComponentPropsWithoutRef`, so a call site cannot hand a Button a ref.
    if (confirmClear) confirmRef.current?.querySelector('button')?.focus();
  }, [confirmClear]);

  const synced = stats != null && stats.papers > 0;
  const syncStatus = syncLine(busy, progress, report);
  const repairStatus = repairLine(repairReport);
  const lastSynced = syncedAgo(stats?.syncedAtMs);
  const updateStatus = updateLine(updateState);

  /** The chips to offer. Alphabetical, and narrowed to the chosen qualification. */
  const boardSubjects = useMemo(
    () =>
      subjects
        .filter((s) => !board || s.level === board)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [subjects, board],
  );
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
            {`Bell ${version} · `}
            {synced
              ? `${(stats?.papers ?? 0).toLocaleString()} papers in the catalogue`
              : 'catalogue not synced yet'}
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
                        icon={t.glyph ? <Icon name={t.glyph} /> : undefined}
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

                {/* The file draws a `Show Mr. Bell` switch here (`534:431`) and this screen has always
                    left it out, because a switch that only hides him had nothing behind it. This is
                    what belongs in that slot: which mascot, rather than whether. */}
                <CardRow
                  label="Mascot"
                  helper="Mr. Bell ships with Bell. Pets are imported from codex-pets.net and kept on this machine."
                  onClick={() => setPetShelf(true)}
                >
                  <span className="set-value t-body-small">{mascotName}</span>
                </CardRow>
              </Card>
            </section>

            <section className="set-group" aria-label="Library">
              {/* The only sec-label in the file that carries a meta (§6.1). It counts PAPERS now,
                  which is finally the same unit the rest of the app says: the old figure counted
                  every indexed file — question papers, mark schemes, thresholds and reports — and
                  was wrong by roughly 4x as a paper count. */}
              <SectionLabel
                label="Library"
                meta={synced ? `${(stats?.papers ?? 0).toLocaleString()} papers` : undefined}
              />
              <Card rows>
                {/* §6.3 sets this helper in `Mono/Small` rather than the row's Body/Meta — it is a
                    path, not prose — and the inner class wins over the ramp class CardRow applies. */}
                {/* The path was always printed here; what it lacked was a way to get to it. The
                    Study data row a column over has had a Reveal since the start, and the folder
                    holding the actual papers is the one people want to open. */}
                <CardRow
                  label="Downloads folder"
                  helper={<span className="set-path t-mono-small">{root}</span>}
                >
                  <Button icon="folder" label="Reveal" onClick={onRevealDownloads} />
                </CardRow>

                <CardRow
                  label="Catalogue"
                  helper={
                    synced
                      ? `${(stats?.subjects ?? 0).toLocaleString()} subjects · ${(
                          stats?.sessions ?? 0
                        ).toLocaleString()} sessions`
                      : 'Not synced yet'
                  }
                >
                  {/* §6.2's last control type: plain `Mono/Meta` on `--ink-2`, no button, no
                      chevron — `Storage used` `537:552` is the file's instance of it. */}
                  {synced ? (
                    <span className="set-value t-mono-meta">
                      {(stats?.papers ?? 0).toLocaleString()}
                    </span>
                  ) : null}
                </CardRow>

                <CardRow
                  label="On this machine"
                  helper={
                    (stats?.downloads ?? 0) > 0
                      ? `Question papers and mark schemes · ${formatSize(stats?.downloadBytes ?? 0)}`
                      : 'Nothing downloaded yet — papers arrive when you open them'
                  }
                >
                  <span className="set-value t-mono-meta">
                    {(stats?.downloads ?? 0).toLocaleString()}
                  </span>
                </CardRow>

                <CardRow
                  label="Catalogue"
                  helper={
                    syncStatus ? (
                      <span className="set-now">{syncStatus}</span>
                    ) : lastSynced ? (
                      `Last synced ${lastSynced}. Ratings and grade boundaries come from ShinyPapers.`
                    ) : (
                      'Fetched from ShinyPapers. Browsing works offline once it has synced once.'
                    )
                  }
                >
                  <Button
                    icon="sync"
                    className={busy ? 'set-spin' : undefined}
                    disabled={busy}
                    onClick={onSync}
                    label={busy ? 'Syncing…' : 'Sync catalogue'}
                  />
                </CardRow>

                <CardRow
                  label="Downloaded files"
                  helper={
                    repairStatus ??
                    'Re-links anything moved into the folder by hand, and forgets files that have gone.'
                  }
                >
                  <Button
                    /* `sync` while it runs: `set-spin` rotates whatever glyph is in the slot, and a
                       revolving check-in-circle reads as a rendering fault rather than progress. */
                    icon="checkc"
                    disabled={busy}
                    onClick={onRepair}
                    label="Check downloads"
                  />
                </CardRow>
              </Card>

              {error ? <Notice className="set-notice">{error}</Notice> : null}
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

            <section className="set-group" aria-label="Your subjects">
              {/* The sidebar lists these and nothing else, which is the whole point: the
                  catalogue holds every subject Cambridge publishes and almost none of them
                  are yours. Answered first in onboarding's step 03 and edited here — one
                  stored list, not two that can disagree. */}
              <SectionLabel
                label="Your subjects"
                meta={chosenSubjects.length > 0 ? `${chosenSubjects.length} chosen` : undefined}
              />
              <Card rows>
                <CardRow
                  label="Qualification"
                  helper="Narrows the subjects below. Papers from other qualifications stay searchable."
                >
                  <span className="set-choice" role="group" aria-label="Qualification">
                    {LEVELS.map((level) => (
                      <Chip
                        key={level}
                        label={level}
                        palette={LEVEL_PALETTE[level]}
                        filled={board === level}
                        onClick={() => onBoard(board === level ? null : level)}
                      />
                    ))}
                  </span>
                </CardRow>

                {/* Deliberately NOT a CardRow. That component's control slot is `flex: none`
                    because Figma hugs it — its own note says "a three-chip row in the 585 column
                    should clip against the card, not squash" — and thirteen subject chips are not
                    a three-chip row: they overflow the card sideways instead of wrapping, because
                    an unconstrained slot gives `flex-wrap` nothing to wrap against. So the grid
                    takes the card's full width under a label of its own, and keeps the row model's
                    padding and divider by hand. */}
                <div className="set-subjects">
                  <span className="set-subjects__label t-body-default">Subjects you sit</span>
                  <span className="set-subjects__helper t-body-meta">
                    {boardSubjects.length === 0
                      ? board
                        ? `No ${board} subjects in the catalogue yet`
                        : 'Pick a qualification to see its subjects'
                      : chosenSubjects.length > 0
                        ? 'These are the subjects in the sidebar'
                        : 'Nothing chosen — the sidebar falls back to the whole catalogue'}
                  </span>
                  {boardSubjects.length > 0 && (
                    <span
                      className="set-subjects__grid"
                      role="group"
                      aria-label="Subjects you sit"
                    >
                      {boardSubjects.map((subject) => (
                        <Chip
                          key={subject.id}
                          label={subject.name}
                          code={subject.code}
                          filled={chosenSubjects.includes(subject.code)}
                          onClick={() => onToggleSubject(subject.code)}
                        />
                      ))}
                    </span>
                  )}
                </div>
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
                {/* ON by default since 2026-09-06, at Zohaib's instruction — the Figma file draws it
                    that way too (`536:451`). The reasoning that kept it off still holds everywhere
                    else: the catalogue is fetched because the library depends on it, and nothing else
                    reaches the network unasked. A daily version check is the one exception, and it is
                    one request from Rust that the app carries on working fine without. */}
                <CardRow
                  label="Check automatically"
                  helper="Daily, in the background. Turn it off and a new version only arrives when you press Check now."
                >
                  <Switch
                    checked={settings.updateAuto}
                    onChange={(updateAuto) => onChange({ updateAuto })}
                    label="Check for updates automatically"
                  />
                </CardRow>

                {/* One of the file's three label-less rows (TRAP 13): a Body/Meta string sits in the
                    label slot and the action sits opposite it. The helper is the answer to the button
                    beside it once it has been pressed, and the version line until then — an app that
                    has not looked must not claim to be up to date. */}
                <CardRow
                  helper={
                    updateStatus ? (
                      <span className="set-now">{updateStatus}</span>
                    ) : buildLine ? (
                      `Bell ${version} · ${buildLine}`
                    ) : (
                      `Bell ${version}`
                    )
                  }
                >
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
                      : 'The catalogue and your downloads stay; this is the part that only exists here.'
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

      {/* Last in the view, so it paints over both columns. It renders nothing while closed. */}
      <PetShelf
        open={petShelf}
        onClose={() => setPetShelf(false)}
        selected={settings.pet}
        onSelect={(pet) => onChange({ pet })}
      />
    </div>
  );
}

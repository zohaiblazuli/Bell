/**
 * Update flow — Bell App v2: a framed corner panel (bottom right) that carries an update from
 * available → downloading → ready, a small dialog for the answers a manual check needs (checking,
 * up to date, failed), and a full-screen "reopening" overlay while the install restarts the app.
 *
 * MANUAL BY DEFAULT — DO NOT ADD A POLL. CLAUDE.md makes running with the network unplugged a hard
 * requirement, so nothing here checks, downloads or installs on mount, on render, or on a timer.
 * This file imports nothing from `@tauri-apps`, which means it cannot reach the network even by
 * accident: every act that does is a callback the caller passes in and a person pressed. The
 * "check automatically" opt-in is a switch on the Settings UPDATES card and it belongs there.
 *
 * WHO OWNS WHAT. The state lives in App.tsx; these components take it and emit intent.
 *
 * PROGRESS IS MEASURED, NEVER GUESSED. `UpdateProgress` is bytes over total, straight off the
 * updater's download event. Where the response carried no length there is no fraction and no bar.
 *
 * RELEASE NOTES ARE TEXT, NOT MARKUP. The payload comes off a remote server, so it is rendered as
 * a text child and nothing else: no `dangerouslySetInnerHTML`, no `innerHTML` write, no markdown
 * pass. React escapes it, which is the whole defence; `white-space: pre-wrap` keeps line breaks.
 */
import './UpdateFlow.css';
import type { ReactNode } from 'react';
import Dialog from '@ui/Dialog';
import Button from '@ui/Button';
import OwlMark from '@ui/shapekit/OwlMark';

/* ── the state machine ─────────────────────────────────────────────────────────────────────── */

/**
 * Bytes over total, as the updater reports them: the payload of the `update:progress` event that
 * `src/lib/api.ts` should forward (the wrapper this needs is spelled out in the build report). It
 * is declared here so both components compile against the interface rather than against a command.
 * `total` is null when the download response carried no length — the updater's own start event
 * makes the content length optional, so the honest type does too.
 */
export interface UpdateProgress {
  downloaded: number;
  total: number | null;
}

/** What the flow was doing when it failed, and therefore which handler its retry calls. */
export type UpdateStep = 'check' | 'download' | 'install';

/**
 * idle → checking → available → downloading → ready → installing, with `error` reachable from each
 * of those three network steps. A union rather than a phase name beside loose fields, so a phase
 * can never render data it does not have: there is no version to print while idle, and no progress
 * to print before the first byte lands.
 */
export type UpdateState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  /**
   * The check came back with nothing newer. A phase of its own, not a return to `idle`, and that is
   * the whole point: "nothing happened" and "I asked, and the answer is you are current" are
   * different things to a person who just pressed a button, and `idle` could only say the first.
   */
  | { phase: 'current'; version: string }
  /** Required and nullable on purpose: App has to state whether the build shipped any notes. */
  | { phase: 'available'; version: string; notes: string | null }
  | { phase: 'downloading'; version: string; progress: UpdateProgress | null }
  | { phase: 'ready'; version: string }
  | { phase: 'installing'; version: string }
  | { phase: 'error'; during: UpdateStep; message: string };

/* ── the corner panel ──────────────────────────────────────────────────────────────────── */

export interface UpdateCornerProps {
  state: UpdateState;
  /** Available → fetch the build. */
  onDownload: () => void;
  /** Ready → the confirmed restart. */
  onInstall: () => void;
  /** × and Later: hide the panel until something changes. Cancels nothing. */
  onHide: () => void;
}

/**
 * The persistent update control: one bottom-right panel whose action changes in place — Download
 * becomes a progress bar, then Restart now. It rolls up out of the corner when it first appears.
 */
export function UpdateCorner({ state, onDownload, onInstall, onHide }: UpdateCornerProps) {
  const isUpdateFlow =
    state.phase === 'available' ||
    state.phase === 'downloading' ||
    state.phase === 'ready' ||
    state.phase === 'installing' ||
    (state.phase === 'error' && state.during !== 'check');
  if (!isUpdateFlow) return null;

  const downloading = state.phase === 'downloading';
  const ready = state.phase === 'ready' || state.phase === 'installing' || (state.phase === 'error' && state.during === 'install');
  const retrying = state.phase === 'error';
  const version = 'version' in state ? state.version : 'the latest version';
  const notes = state.phase === 'available' ? state.notes?.trim() : null;
  const busy = state.phase === 'installing';
  const primary = busy
    ? 'Restarting…'
    : ready
      ? retrying
        ? 'Try restart again'
        : 'Restart now'
      : retrying
        ? 'Try download again'
        : 'Download now';

  return (
    <aside className="uflow-corner" aria-live="polite" aria-label="Application update">
      <div className="uflow-corner__head">
        {ready ? <ReadyGlyph /> : <DownloadGlyph falling={downloading} />}
        <div className="uflow-corner__id">
          <span className="uflow-corner__eyebrow">
            {downloading ? 'DOWNLOADING UPDATE' : ready ? 'UPDATE READY' : 'UPDATE AVAILABLE'}
          </span>
          <strong className="uflow-corner__title">
            {ready ? `Restart to install v${version}` : `Bell v${version}`}
          </strong>
        </div>
        {!busy && (
          <button type="button" className="uflow-corner__x" title="Hide until next launch" aria-label="Hide update panel" onClick={onHide}>
            ×
          </button>
        )}
      </div>

      {downloading ? (
        <DownloadProgress progress={state.progress} />
      ) : state.phase === 'error' ? (
        <ErrorNote>{state.message}</ErrorNote>
      ) : ready ? (
        <p className="uflow-corner__copy">{RESTART_BODY}</p>
      ) : (
        <p className="uflow-corner__copy">{notes || 'A new version is ready to download.'}</p>
      )}

      {!downloading && (
        <div className="uflow-corner__actions" data-solo={busy ? 'true' : undefined}>
          {!busy && <Button label="Later" onClick={onHide} />}
          <Button
            variant="primary"
            label={primary}
            onClick={busy ? undefined : ready ? onInstall : onDownload}
            aria-disabled={busy ? 'true' : undefined}
            aria-busy={busy ? true : undefined}
          />
        </div>
      )}
    </aside>
  );
}

/** A cream arrow dropping into an ink tray on a blue tile; it falls on repeat while downloading. */
function DownloadGlyph({ falling }: { falling: boolean }) {
  return (
    <span className="uflow-glyph uflow-glyph--dl" data-falling={falling ? 'true' : undefined} aria-hidden="true">
      <span className="uflow-glyph__arrow">
        <i />
        <b />
      </span>
      <span className="uflow-glyph__tray" />
    </span>
  );
}

/** The bell tile — yellow, a red quarter ringing in its corner and an ink dot — thrown in with a burst. */
function ReadyGlyph() {
  return (
    <span className="uflow-glyph uflow-glyph--ready" aria-hidden="true">
      <span className="uflow-glyph__burst">
        <i style={{ borderRadius: '50%', background: 'var(--sk-blue)', animationName: 'sk-burst-1' }} />
        <i style={{ background: 'var(--sk-red)', animationName: 'sk-burst-2' }} />
        <i style={{ background: 'var(--sk-black)', clipPath: 'polygon(50% 0,100% 100%,0 100%)', animationName: 'sk-burst-3' }} />
        <i style={{ background: 'var(--sk-yellow)', clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)', animationName: 'sk-burst-4' }} />
      </span>
      <span className="uflow-glyph__tile">
        <i className="uflow-glyph__bell" />
        <i className="uflow-glyph__dot" />
      </span>
    </span>
  );
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="uflow-error" role="alert">
      <i />
      <span>{children}</span>
    </div>
  );
}

/* ── the restarting overlay ─────────────────────────────────────────────────────────────────── */

/**
 * While the installer runs, the app irises closed to paper and the owl mark pops in, wiggles its
 * ears and blinks over "REOPENING INTO V…" and a filling rule. The restart itself tears it down.
 */
export function UpdateRestarting({ state }: { state: UpdateState }) {
  if (state.phase !== 'installing') return null;
  return (
    <div className="uflow-restart" role="status" aria-live="assertive">
      <span className="uflow-restart__owl">
        <OwlMark size={84} />
      </span>
      <span className="uflow-restart__line">REOPENING INTO V{state.version}</span>
      <span className="uflow-restart__bar">
        <i />
      </span>
    </div>
  );
}

/* ── the dialog · §A1 ──────────────────────────────────────────────────────────────────────── */

/**
 * §A1's own copy, from `437:106`. The spec prints it truncated at the 372px measure — "…and open
 * papers come back exactly as …" — so the last three words are written here and everything before
 * them is the file's.
 */
const RESTART_BODY =
  'Bell will close and reopen. Your session and open papers come back exactly as they are.';

/** Naming the step that failed beats one "Update failed" standing in for three different things. */
const ERROR_TITLE: Record<UpdateStep, string> = {
  check: 'Could not check for updates',
  download: 'Download failed',
  install: 'Could not restart',
};

/** One face of the dialog: what it says, and what its buttons do. */
interface Face {
  title: string;
  body: ReactNode;
  /** The Secondary label. Every face has a way out; the measured one calls it "Later". */
  dismiss: string;
  /** The Primary action, where the face has one. A `label` with no `onClick` is one in flight. */
  primary?: { label: string; onClick?: () => void };
  /** How the owl mark in the dialog moves: tilting while it asks, a hop for good news, a sigh for bad. */
  mood: 'think' | 'hop' | 'sigh' | 'still';
}

/**
 * Windows Explorer's convention — 1024-based steps under KB / MB / GB labels — because the number
 * a user compares this against is the one their file manager shows them.
 */
function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${Math.round(n)} bytes`;
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return mb < 1024 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(2)} GB`;
}

/**
 * Remote text, rendered as text. It goes in as a child and nothing else, so a `<script>` in the
 * payload is a string a reader can see rather than a node the webview runs. `tabIndex` is not
 * decoration either: the block scrolls when a changelog is long, and a scrollable box Tab cannot
 * reach is unreadable without a mouse.
 */
function ReleaseNotes({ notes }: { notes: string | null }) {
  const text = notes?.trim();
  if (!text) {
    return <span className="uflow-empty">No release notes were published for this build.</span>;
  }
  return (
    // `role="group"` is what makes the label legal: a plain div is `generic`, and a generic element
    // is not allowed to carry an accessible name, so the label would be dropped on the floor.
    <div className="uflow-notes" role="group" aria-label="Release notes" tabIndex={0}>
      {text}
    </div>
  );
}

function DownloadProgress({ progress }: { progress: UpdateProgress | null }) {
  /* Asked for, nothing measured yet: the download has started and the first progress event has not
     arrived. Saying so is honest where a 0 % or an empty bar is not. */
  if (!progress) return <span className="uflow-corner__copy">Starting the download.</span>;

  const total = progress.total !== null && progress.total > 0 ? progress.total : null;
  const pct = total === null ? null : Math.min(100, Math.round((progress.downloaded / total) * 100));
  return (
    <div className="uflow-progress">
      <div className="uflow-bytes">
        <span>
          {total === null
            ? `${formatBytes(progress.downloaded)} downloaded`
            : `${formatBytes(progress.downloaded)} of ${formatBytes(total)}`}
        </span>
        {pct !== null && <span>{pct}%</span>}
      </div>
      {/* No length, no bar — a bar with no total is a shape pretending to be a fraction. */}
      {pct !== null && (
        <div className="uflow-bar" role="progressbar" aria-label="Download progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <i style={{ width: `${pct}%` }} />
        </div>
      )}
      <span className="uflow-progress__note">Keep studying. Nothing closes until you say so.</span>
    </div>
  );
}

/**
 * Which face the panel wears. Only `ready` is drawn in Figma — the file specifies the restart
 * moment because that is the only one it needed to — so the rest reuse the same 420-wide shell with
 * copy written here. The owl mark tilts while a question is out, hops for good news and sighs for
 * a failure.
 */
function faceFor(state: UpdateState, on: Record<UpdateStep, () => void>): Face | null {
  switch (state.phase) {
    /* Nothing was asked, so there is nothing to answer: if App leaves the dialog open as the flow
       returns to idle it simply closes, which is the honest end of "Later". */
    case 'idle':
      return null;

    case 'checking':
      return {
        title: 'Checking for updates',
        body: 'Asking the update server for a newer build.',
        dismiss: 'Close',
        mood: 'think',
      };

    /**
     * The answer to a question somebody asked. This face exists because the flow used to fall silent
     * here — a manual check that found nothing set `idle`, which draws no pill and no dialog, so
     * pressing "Check now" on the latest build looked exactly like pressing a dead button.
     *
     * App raises the dialog for this ONLY on a check the user started; the once-per-launch automatic
     * check must never open a modal to say nothing is wrong.
     */
    case 'current':
      return {
        title: 'Bell is up to date',
        body: `You are running v${state.version}, which is the newest build.`,
        dismiss: 'Close',
        mood: 'hop',
      };

    case 'available':
      return {
        title: `Update to v${state.version}`,
        body: <ReleaseNotes notes={state.notes} />,
        dismiss: 'Later',
        primary: { label: 'Download now', onClick: on.download },
        mood: 'still',
      };

    case 'downloading':
      return {
        title: `Downloading v${state.version}`,
        body: <DownloadProgress progress={state.progress} />,
        /* "Later" would read as "cancel" here. Closing the panel abandons nothing: the download
           carries on and the corner panel keeps counting it. */
        dismiss: 'Close',
        mood: 'think',
      };

    /* The measured face: title `437:105`, body `437:106`, Later + Restart now `437:107`. */
    case 'ready':
      return {
        title: `Restart to install v${state.version}`,
        body: RESTART_BODY,
        dismiss: 'Later',
        primary: { label: 'Restart now', onClick: on.install },
        mood: 'hop',
      };

    /* Every pixel of the ready face, because the question has been answered rather than replaced —
       only the Primary changes, to a label with no handler behind it. */
    case 'installing':
      return {
        title: `Restart to install v${state.version}`,
        body: RESTART_BODY,
        dismiss: 'Close',
        primary: { label: 'Restarting…' },
        mood: 'think',
      };

    case 'error':
      return {
        title: ERROR_TITLE[state.during],
        body: <ErrorNote>{state.message}</ErrorNote>,
        dismiss: 'Close',
        /* The retry is whatever failed, which is the whole reason `during` is in the state. */
        primary: { label: 'Try again', onClick: on[state.during] },
        mood: 'sigh',
      };
  }
}

export interface UpdateDialogProps {
  /**
   * Raised by an act, never by a phase: a manual check, or a failure the corner cannot explain.
   * Nothing in this file opens itself, so a modal never appears over someone's paper unbidden.
   */
  open: boolean;
  state: UpdateState;
  /** Retry a failed check. Nothing else here checks — that button lives in Settings. */
  onCheck: () => void;
  /** Download now, and retry a failed download. */
  onDownload: () => void;
  /** The confirmed restart. Only "Restart now" emits it. */
  onInstall: () => void;
  /** Later / Close / Escape / a press on the scrim. It closes the panel and cancels nothing. */
  onDismiss: () => void;
  className?: string;
}

/**
 * The 420 x 280 panel. `Dialog` owns the measured geometry, the scrim, the focus trap and Escape;
 * everything here is the copy, the owl mark and the
 * two buttons.
 */
export function UpdateDialog({
  open,
  state,
  onCheck,
  onDownload,
  onInstall,
  onDismiss,
  className,
}: UpdateDialogProps) {
  const face = faceFor(state, { check: onCheck, download: onDownload, install: onInstall });
  if (!open || !face) return null;

  /* `uflow-solo` tells the stylesheet the action row holds one button, so it centres instead of
     stretching a lone Close across the whole 372. No other class is added to the panel: Dialog owns
     it, and a hook nothing styles is one more thing to explain later. */
  const panelClass = [face.primary ? null : 'uflow-solo', className].filter(Boolean).join(' ');
  const busy = Boolean(face.primary && !face.primary.onClick);
  /* The 181-wide fill is only right for the measured two-up row; a single button keeps Button's own
     hug and lets the row centre it. */
  const actionClass = face.primary ? 'uflow-action' : undefined;

  return (
    <Dialog
      open
      onClose={onDismiss}
      title={face.title}
      art={
        <span className="uflow-owl" data-mood={face.mood} key={face.mood}>
          <OwlMark size={64} />
        </span>
      }
      className={panelClass}
      actions={
        <>
          <Button className={actionClass} label={face.dismiss} onClick={onDismiss} />
          {face.primary && (
            <Button
              variant="primary"
              className={actionClass}
              label={face.primary.label}
              onClick={face.primary.onClick}
              /* `aria-disabled`, not `disabled`. Button.css dims both, and a real `disabled` drops
                 focus to <body> the moment the phase turns — where Dialog's key handler, bound on
                 the scrim, can no longer see Escape or hold Tab inside the modal. Focusable and
                 inert is the version that keeps the trap, and with no handler attached a second
                 press cannot fire a second install. */
              aria-disabled={busy ? 'true' : undefined}
              aria-busy={busy ? true : undefined}
            />
          )}
        </>
      }
    >
      {face.body}
    </Dialog>
  );
}

/**
 * Update flow — the sidebar notice pill and the restart dialog. Spec:
 * `design/specs/update-and-startup.md` PART A — dialog `437:7` (§A1), notice set `440:115` (§A2),
 * and the page's own notes (§A3). The two motion frames are `motion-mr-bell.md` §4 (notice, 4.6s)
 * and §5 (dialog, 2.2s).
 *
 * MANUAL BY DEFAULT — DO NOT ADD A POLL. CLAUDE.md makes running with the network unplugged a hard
 * requirement, so nothing here checks, downloads or installs on mount, on render, or on a timer.
 * This file imports nothing from `@tauri-apps`, which means it cannot reach the network even by
 * accident: every act that does is a callback the caller passes in and a person pressed. The
 * "check automatically" opt-in is a switch on the Settings UPDATES card
 * (`screen-library-settings.md` `536:435` / `536:447`) and it belongs there, in the one place a
 * user can see it and turn it off. If a background check ever lands it goes behind that switch in
 * App.tsx — not into a `useEffect` here.
 *
 * WHO OWNS WHAT. The state lives in App.tsx; both components take it and emit intent. The pill is
 * the ambient indicator and the dialog is the moment that needs an answer, which is the split the
 * spec makes itself: "The indicator is a 30px glass pill in the sidebar; the dialog owns the
 * restart moment" (§A3). Neither component opens the other — App raises the dialog when the pill
 * asks for it, and should raise it on `error` too, because the pill has no error face.
 *
 * PROGRESS IS MEASURED, NEVER GUESSED. `UpdateProgress` is bytes over total, straight off the
 * updater's download event. Where the response carried no length there is no fraction, and the
 * pill — which can only render a percentage — stays out rather than print a 0% that means nothing.
 *
 * RELEASE NOTES ARE TEXT, NOT MARKUP. The payload comes off a remote server, so it is rendered as
 * a text child and nothing else: no `dangerouslySetInnerHTML`, no `innerHTML` write, no markdown
 * pass. React escapes it, which is the whole defence; `white-space: pre-wrap` in the stylesheet
 * keeps the line breaks its author typed without letting a tag through.
 */
import './UpdateFlow.css';
import type { ReactNode } from 'react';
import UpdateNotice from '@ui/UpdateNotice';
import Dialog from '@ui/Dialog';
import Button from '@ui/Button';
import Notice from '@ui/Notice';
import Meter from '@ui/Meter';
import type { BellMood } from '@ui/brand/MrBell';
import Mascot from './Mascot';

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

/* ── the pill · §A2 ────────────────────────────────────────────────────────────────────────── */

export interface UpdatePillProps {
  state: UpdateState;
  /** Available → fetch the build. The only press in this component that reaches the network. */
  onDownload: () => void;
  /**
   * Ready → raise `UpdateDialog`. It must NOT install: the dialog owns the restart moment, and
   * keeping this handler to "open the dialog" makes it idempotent, so a second press on a pill that
   * is already installing cannot start a second install.
   */
  onRestart: () => void;
  className?: string;
}

/**
 * The sidebar indicator. Three faces and no more — `UpdateNotice` hard-codes one string per face,
 * so there is no way to render a fourth here and no reason to want one: the pill says what is
 * true, and anything that needs a sentence belongs in the dialog.
 */
export function UpdatePill({ state, onDownload, onRestart, className }: UpdatePillProps) {
  const cls = className ? `uflow-pill ${className}` : 'uflow-pill';

  switch (state.phase) {
    /* Nothing is waiting, so nothing is indicated. `checking` and `current` get no face either:
       Figma's axis is Available / Downloading / Ready, and the button that starts a check lives on the
       Settings UPDATES card, which owns the feedback for its own press. An "up to date" pill parked in
       the sidebar for the rest of the session would be an indicator with nothing to indicate. */
    case 'idle':
    case 'checking':
    case 'current':
      return null;

    case 'available':
      return <UpdateNotice state="available" onClick={onDownload} className={cls} />;

    case 'downloading': {
      const p = state.progress;
      const total = p && p.total !== null && p.total > 0 ? p.total : null;
      /* No length means no fraction. The Downloading face always prints
         `Math.round(progress * 100)%`, so rendering it here would put a 0 % on screen that the app
         cannot stand behind; the pill stays out and the dialog reports the bytes it does have. */
      if (!p || total === null) return null;
      return <UpdateNotice state="downloading" progress={p.downloaded / total} className={cls} />;
    }

    case 'ready':
    case 'installing':
      return <UpdateNotice state="ready" onClick={onRestart} className={cls} />;

    /* A failure has no face of its own and must not be styled into one. What the pill shows is
       whatever is still true underneath it: a failed check leaves nothing waiting, a failed
       download leaves the update available, a failed install leaves it downloaded — and in those
       last two a press retries. The message itself reaches the user in the dialog. */
    case 'error':
      if (state.during === 'check') return null;
      return state.during === 'download' ? (
        <UpdateNotice state="available" onClick={onDownload} className={cls} />
      ) : (
        <UpdateNotice state="ready" onClick={onRestart} className={cls} />
      );
  }
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
  mood: BellMood;
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
  if (!progress) return <span>Starting the download.</span>;

  const total = progress.total !== null && progress.total > 0 ? progress.total : null;
  return (
    <div className="uflow-progress">
      <span className="uflow-bytes t-mono-small">
        {total === null
          ? `${formatBytes(progress.downloaded)} downloaded`
          : `${formatBytes(progress.downloaded)} of ${formatBytes(total)}`}
      </span>
      {/* No length, no bar — a bar with no total is a shape pretending to be a fraction. The bar
          carries a name so it becomes a real `progressbar`: the byte line above is static text and
          a screen reader would read it once, at the value it happened to have. */}
      {total !== null && <Meter value={progress.downloaded / total} label="Download progress" />}
    </div>
  );
}

/**
 * Which face the panel wears. Only `ready` is drawn in Figma — the file specifies the restart
 * moment because that is the only one it needed to — so the rest reuse the same 420-wide shell with
 * copy written here. Mr. Bell's mood follows the same rule: `specs-push-up` is the gesture motion
 * §5 measures on this dialog, `slump` is the system's own mood for a bad moment, and the faces the
 * file does not draw get `idle` rather than an invented gesture.
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
        body: 'Bell is asking the update server for a newer build.',
        dismiss: 'Close',
        mood: 'scuttle',
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
        mood: 'specs-push-up',
      };

    case 'available':
      return {
        title: `Update to v${state.version}`,
        body: <ReleaseNotes notes={state.notes} />,
        dismiss: 'Later',
        primary: { label: 'Download now', onClick: on.download },
        mood: 'idle',
      };

    case 'downloading':
      return {
        title: `Downloading v${state.version}`,
        body: <DownloadProgress progress={state.progress} />,
        /* "Later" would read as "cancel" here. Closing the panel abandons nothing: the download
           carries on and the pill keeps counting it. */
        dismiss: 'Close',
        mood: 'scuttle',
      };

    /* The measured face: title `437:105`, body `437:106`, Later + Restart now `437:107`. */
    case 'ready':
      return {
        title: `Restart to install v${state.version}`,
        body: RESTART_BODY,
        dismiss: 'Later',
        primary: { label: 'Restart now', onClick: on.install },
        mood: 'specs-push-up',
      };

    /* Every pixel of the ready face, because the question has been answered rather than replaced —
       only the Primary changes, to a label with no handler behind it. */
    case 'installing':
      return {
        title: `Restart to install v${state.version}`,
        body: RESTART_BODY,
        dismiss: 'Close',
        primary: { label: 'Restarting…' },
        mood: 'scuttle',
      };

    case 'error':
      return {
        title: ERROR_TITLE[state.during],
        body: <Notice className="uflow-error">{state.message}</Notice>,
        dismiss: 'Close',
        /* The retry is whatever failed, which is the whole reason `during` is in the state. */
        primary: { label: 'Try again', onClick: on[state.during] },
        mood: 'slump',
      };
  }
}

export interface UpdateDialogProps {
  /**
   * Raised by an act, never by a phase: the Ready pill asks for it, and App should also raise it
   * when the phase turns to `error`, since the pill has no error face. Nothing in this file opens
   * itself, which is what keeps a modal from appearing over someone's paper unbidden.
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
 * everything here is the copy, the 96px Mr. Bell (0.375 of the 256 rig, still whole pixels) and the
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
      art={<Mascot size={96} mood={face.mood} />}
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

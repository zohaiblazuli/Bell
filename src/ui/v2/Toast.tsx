/**
 * Toast (Design System v2) — §18. A polite notification system. `ToastProvider` wraps the app and
 * renders a fixed bottom-right region through a portal; `useToast()` returns `toast(opts) => id`
 * and `dismiss(id)`. Status is conveyed by a tone icon AND text (never colour alone), and the region
 * sits bottom-right so it never covers a bottom-centre primary CTA.
 *
 * Auto-dismiss defaults by tone: success/info ~4s, warning ~6s, error persists until dismissed. A
 * caller `duration` overrides (pass 0 to make any tone persist). A toast that carries an action
 * pauses its countdown while hovered, so the action stays reachable. The visible stack is capped;
 * extra toasts queue and promote as slots free.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import Icon, { type IconName } from '../../components/Icon';
import Button from '@ui/v2/Button';

export type ToastTone = 'success' | 'info' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  tone: ToastTone;
  title: string;
  message?: string;
  action?: ToastAction;
  /** Overrides the tone default. Non-positive (0) keeps the toast until dismissed. */
  duration?: number;
}

interface ToastEntry extends ToastOptions {
  id: string;
  leaving?: boolean;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const MAX_VISIBLE = 4;
const EXIT_MS = 120; // matches --motion-fast; also the reduced-motion removal fallback.

/** Tone → auto-dismiss ms. 0 means persist (error). */
const TONE_DURATION: Record<ToastTone, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 0,
};

/* Icons drawn from the closed IconName union (no invented names). Each tone gets a distinct glyph
   so status never rides on colour alone: success = check-circle, error = x, warning = warn triangle,
   info = the neutral ellipsis (the sprite has no dedicated "i"). */
const TONE_ICON: Record<ToastTone, IconName> = {
  success: 'checkc',
  info: 'dots',
  warning: 'warn',
  error: 'x',
};

const TONE_LABEL: Record<ToastTone, string> = {
  success: 'Success',
  info: 'Information',
  warning: 'Warning',
  error: 'Error',
};

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;
function nextId() {
  counter += 1;
  return `v2-toast-${counter}`;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
  return ctx;
}

function ToastItem({
  entry,
  onDismiss,
  onRemove,
}: {
  entry: ToastEntry;
  onDismiss: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [paused, setPaused] = useState(false);
  const duration = entry.duration != null ? entry.duration : TONE_DURATION[entry.tone];
  const canPause = Boolean(entry.action);

  // Auto-dismiss countdown. Skipped when persistent, paused (hover w/ action), or already leaving.
  useEffect(() => {
    if (entry.leaving || duration <= 0 || paused) return;
    const t = setTimeout(() => onDismiss(entry.id), duration);
    return () => clearTimeout(t);
  }, [entry.id, entry.leaving, duration, paused, onDismiss]);

  // Once flagged leaving, let the exit animation run then unmount (timeout also covers reduced motion).
  useEffect(() => {
    if (!entry.leaving) return;
    const t = setTimeout(() => onRemove(entry.id), EXIT_MS);
    return () => clearTimeout(t);
  }, [entry.leaving, entry.id, onRemove]);

  return (
    <div
      className="v2-toast"
      data-tone={entry.tone}
      data-leaving={entry.leaving || undefined}
      role={entry.tone === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
      onMouseEnter={canPause ? () => setPaused(true) : undefined}
      onMouseLeave={canPause ? () => setPaused(false) : undefined}
    >
      <Icon name={TONE_ICON[entry.tone]} className="v2-toast__icon" />
      <div className="v2-toast__body">
        <span className="v2-toast__title t-ui">
          <span className="v2-toast__tone-label">{TONE_LABEL[entry.tone]}: </span>
          {entry.title}
        </span>
        {entry.message ? <span className="v2-toast__msg t-caption">{entry.message}</span> : null}
        {entry.action ? (
          <div className="v2-toast__actions">
            <Button
              variant="ghost"
              size="dense"
              label={entry.action.label}
              onClick={() => {
                entry.action?.onClick();
                onDismiss(entry.id);
              }}
            />
          </div>
        ) : null}
      </div>
      <Button
        className="v2-toast__close"
        variant="ghost"
        size="dense"
        icon="x"
        iconOnly
        aria-label="Dismiss notification"
        onClick={() => onDismiss(entry.id)}
      />
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);

  const remove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const dismiss = useCallback((id: string) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, leaving: true } : e)));
  }, []);

  const toast = useCallback((opts: ToastOptions) => {
    const id = nextId();
    setEntries((prev) => [...prev, { ...opts, id }]);
    return id;
  }, []);

  const apiRef = useRef<ToastContextValue>({ toast, dismiss });
  apiRef.current.toast = toast;
  apiRef.current.dismiss = dismiss;

  // Only the first MAX_VISIBLE are mounted; the rest queue (and so their timers do not run) until a
  // slot frees. A leaving toast holds its slot until removed, so the queue never jumps in early.
  const visible = entries.slice(0, MAX_VISIBLE);

  return (
    <ToastContext.Provider value={apiRef.current}>
      {children}
      {typeof document !== 'undefined'
        ? createPortal(
            <div className="v2-toast-region" role="region" aria-label="Notifications">
              {visible.map((entry) => (
                <ToastItem key={entry.id} entry={entry} onDismiss={dismiss} onRemove={remove} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

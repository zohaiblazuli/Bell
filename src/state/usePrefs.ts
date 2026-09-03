/**
 * The two persisted records, and the tone they resolve to.
 *
 * Extracted from `App.tsx` at the end of the Phase 5 port. The views were deliberately NOT converted
 * to context consumers: their authors wrote explicit, documented `Props` interfaces, and turning those
 * into implicit context reads would make the screens harder to test and delete the documentation. What
 * moved is the *logic* — so `App` composes state rather than being a 700-line state machine, and each
 * hook here is small enough to read in one sitting.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  loadOnboarding,
  loadSettings,
  saveOnboarding,
  saveSettings,
  type Onboarding,
  type Settings,
} from '@/lib/store';
import type { Tone } from '@ui/TonePill';

export interface Prefs {
  settings: Settings;
  /** Merge and persist. A row emits only what it changed. */
  patchSettings: (patch: Partial<Settings>) => void;
  onboarding: Onboarding;
  /** One answer at a time, keyed by field name — which is also the `onboarding.<key>` state key. */
  answerOnboarding: <K extends keyof Onboarding>(key: K, value: Onboarding[K]) => void;
  /** The RESOLVED tone, which is what `data-tone` gets. `settings.tone` is only the choice. */
  tone: Tone;
  /** Toggles to an explicit tone, so one press also leaves `system` behind. */
  toggleTone: () => void;
}

export function usePrefs(): Prefs {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [onboarding, setOnboarding] = useState<Onboarding>(() => loadOnboarding());

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  /**
   * `done` is one of the answers, so finishing onboarding and recording an answer are the same call —
   * there is no second path that could set the gate.
   */
  const answerOnboarding = useCallback(
    <K extends keyof Onboarding>(key: K, value: Onboarding[K]) => {
      setOnboarding((prev) => {
        const next = { ...prev, [key]: value };
        saveOnboarding(next);
        return next;
      });
    },
    [],
  );

  /**
   * `system` is an explicit opt-in — `CLAUDE.md` says the toggle is product-level and never
   * `prefers-color-scheme` by default — so the media query is only consulted once the user has asked
   * for it. Subscribed unconditionally all the same: the listener is free, and gating the subscription
   * on the current choice would mean missing a change made while the choice was something else.
   */
  const [systemNight, setSystemNight] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemNight(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const tone: Tone = settings.tone === 'system' ? (systemNight ? 'night' : 'day') : settings.tone;

  const toggleTone = useCallback(
    () => patchSettings({ tone: tone === 'day' ? 'night' : 'day' }),
    [patchSettings, tone],
  );

  return { settings, patchSettings, onboarding, answerOnboarding, tone, toggleTone };
}

/**
 * The update state machine and Settings' three data actions.
 *
 * Both belong together because both are the only things in the app that reach outside it: one to a
 * release feed that does not exist yet (`lib/updates.ts` explains why it answers `not-configured`
 * rather than spinning), the other to the state directory and Explorer.
 *
 * Nothing here fires on mount unless `auto` is true AND updates are configured. That is the whole
 * offline guarantee, and it is a `&&` rather than a comment.
 */
import { useCallback, useEffect, useState } from 'react';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import * as api from '@/lib/api';
import * as updates from '@/lib/updates';
import type { UpdateState } from '@/components/UpdateFlow';

export interface Updates {
  state: UpdateState;
  /** The dialog is raised by an act, never by a phase — nothing here opens itself. */
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  /**
   * Ask the feed. `manual` means a person pressed a button and is waiting for an answer, which is the
   * only case that may raise a modal to report good news — the once-per-launch automatic check must
   * never open a dialog to say nothing is wrong.
   */
  check: (manual?: boolean) => Promise<void>;
  download: () => Promise<void>;
  install: () => Promise<void>;
  /** Where the JSON keys live, for Settings' Data card. Empty until Rust answers. */
  statePath: string;
  exportData: () => Promise<void>;
  revealData: () => Promise<void>;
  clearData: () => Promise<void>;
}

/** `auto` is `settings.updateAuto`; `onError` surfaces a failure where the app already shows them. */
export function useUpdates(auto: boolean, onError: (message: string) => void): Updates {
  const [state, setState] = useState<UpdateState>({ phase: 'idle' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statePath, setStatePath] = useState('');

  useEffect(() => {
    void api.statePath().then(setStatePath).catch(() => {});
  }, []);

  const check = useCallback(async (manual = false) => {
    setState({ phase: 'checking' });
    try {
      const found = await updates.checkForUpdate();
      if (found.status === 'available') {
        setState({ phase: 'available', version: found.version, notes: found.notes });
        // Asked for, so answered in the dialog. An AUTOMATIC check deliberately leaves only the
        // sidebar pill: a modal appearing over someone's paper unbidden is what the flow's whole
        // pill-then-dialog split exists to avoid.
        if (manual) setDialogOpen(true);
      } else if (found.status === 'current') {
        // Say so. This used to set `idle`, which draws no pill and no dialog — so pressing "Check
        // now" on the newest build was indistinguishable from pressing a dead button. The dialog
        // opens only for a check somebody asked for; the launch check just leaves the phase behind
        // for the Settings card to read.
        setState({ phase: 'current', version: __APP_VERSION__ });
        if (manual) setDialogOpen(true);
      } else {
        // The pill has no face for this, so the dialog carries the explanation.
        setState({
          phase: 'error',
          during: 'check',
          message: 'This build has no update channel configured, so there is nothing to check.',
        });
        setDialogOpen(true);
      }
    } catch (e) {
      setState({ phase: 'error', during: 'check', message: String(e) });
      setDialogOpen(true);
    }
  }, []);

  const download = useCallback(async () => {
    const version = 'version' in state ? state.version : '';
    setState({ phase: 'downloading', version, progress: null });
    try {
      await updates.downloadUpdate((p) => setState({ phase: 'downloading', version, progress: p }));
      setState({ phase: 'ready', version });
    } catch (e) {
      setState({ phase: 'error', during: 'download', message: String(e) });
      setDialogOpen(true);
    }
  }, [state]);

  const install = useCallback(async () => {
    const version = 'version' in state ? state.version : '';
    setState({ phase: 'installing', version });
    try {
      await updates.installUpdate();
    } catch (e) {
      setState({ phase: 'error', during: 'install', message: String(e) });
    }
  }, [state]);

  useEffect(() => {
    // Once per launch on the stored preference, never on a timer.
    if (auto && updates.UPDATES_CONFIGURED) void check();
  }, [auto, check]);

  /**
   * Exported beside the state dir rather than to a folder the user picks: the dialog plugin is not
   * installed, and adding one to choose a destination is a bigger change than this needs. Rust decides
   * the location and validates the name; the frontend only words it.
   */
  const exportData = useCallback(async () => {
    try {
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      await revealItemInDir(await api.exportState(`bell-export-${stamp}`));
    } catch (e) {
      onError(String(e));
    }
  }, [onError]);

  const revealData = useCallback(async () => {
    if (!statePath) return;
    try {
      await revealItemInDir(statePath);
    } catch (e) {
      onError(String(e));
    }
  }, [statePath, onError]);

  /**
   * Reloads rather than re-hydrating in place: every accessor in `store.ts` reads a module-level cache
   * filled once before the first render, so clearing the files without restarting would leave the
   * running app showing marks that no longer exist on disk.
   */
  const clearData = useCallback(async () => {
    try {
      await api.clearState();
      window.location.reload();
    } catch (e) {
      onError(String(e));
    }
  }, [onError]);

  return {
    state, dialogOpen, setDialogOpen, check, download, install,
    statePath, exportData, revealData, clearData,
  };
}

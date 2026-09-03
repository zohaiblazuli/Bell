import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Lights from '@ui/WindowLights';

/**
 * The traffic lights, wired to the real window.
 *
 * `@ui/WindowLights` owns the geometry and the three states; this is the thin container that
 * supplies the callbacks and tracks focus, because the presentational component should not know
 * that Tauri exists.
 *
 * The `inactive` state is not decoration: with `decorations: false` the lights are the only thing
 * telling you whether the window has focus, so they go grey when it does not — which is exactly
 * what macOS does and what the Figma set draws as `Window = Inactive`.
 */
export default function WindowLights() {
  const [focused, setFocused] = useState(true);

  useEffect(() => {
    const win = getCurrentWindow();
    let cancelled = false;
    const unlisten = win.onFocusChanged(({ payload }) => {
      if (!cancelled) setFocused(payload);
    });
    return () => {
      cancelled = true;
      void unlisten.then((off) => off());
    };
  }, []);

  const win = getCurrentWindow();
  return (
    <Lights
      inactive={!focused}
      onClose={() => void win.close()}
      onMinimize={() => void win.minimize()}
      onZoom={() => void win.toggleMaximize()}
    />
  );
}

import { getCurrentWindow } from '@tauri-apps/api/window';
import Icon from './Icon';

/** macOS-idiom traffic lights, wired to the real window. Glyphs appear on hover. */
export default function WindowLights() {
  const win = getCurrentWindow();
  return (
    <div className="lights">
      <button type="button" aria-label="Close" onClick={() => void win.close()}>
        <Icon name="x" />
      </button>
      <button type="button" aria-label="Minimise" onClick={() => void win.minimize()}>
        <Icon name="min" />
      </button>
      <button type="button" aria-label="Maximise" onClick={() => void win.toggleMaximize()}>
        <Icon name="max" />
      </button>
    </div>
  );
}

/**
 * Window controls — minimise, maximise, close — drawn the Bell App v2 way: plain ink glyphs in 40px
 * cells at the right of the title strip (a Windows app, so Windows order and placement). The name is
 * kept from the old traffic lights so every placement keeps importing the same seam.
 */
export interface WindowLightsProps {
  onClose: () => void;
  onMinimize: () => void;
  onZoom: () => void;
  inactive?: boolean;
  className?: string;
}

export default function WindowLights({ onClose, onMinimize, onZoom, inactive, className }: WindowLightsProps) {
  return (
    <div className={className ? `wlights ${className}` : 'wlights'} data-inactive={inactive || undefined}>
      <button type="button" className="wl wl-minimize" aria-label="Minimise" onClick={onMinimize}>
        <i className="wl__min" />
      </button>
      <button type="button" className="wl wl-zoom" aria-label="Maximise" onClick={onZoom}>
        <i className="wl__max" />
      </button>
      <button type="button" className="wl wl-close" aria-label="Close" onClick={onClose}>
        <i className="wl__x" />
      </button>
    </div>
  );
}

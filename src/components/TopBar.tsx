import Icon from './Icon';

interface Props {
  title: string;
  tone: 'day' | 'night';
  onTone: () => void;
  aurora: 'soft' | 'off';
  onAurora: () => void;
  busy: boolean;
  onReindex: () => void;
  right?: React.ReactNode;
}

export default function TopBar({
  title,
  tone,
  onTone,
  aurora,
  onAurora,
  busy,
  onReindex,
  right,
}: Props) {
  return (
    <div className="topbar" data-tauri-drag-region>
      <div className="tb">
        <div className="title">{title}</div>

        <button type="button" className="search" disabled>
          <Icon name="search" />
          Search papers, subjects, sessions
          <span className="kbd">Ctrl K</span>
        </button>

        <div className="spacer" />
        {right}

        <div
          className="tone"
          data-on="aurora"
          role="switch"
          tabIndex={0}
          aria-checked={aurora === 'soft'}
          aria-label="Soft aurora behind the library"
          onClick={onAurora}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onAurora();
            }
          }}
        >
          Aurora <span className="sw" />
        </div>

        <div
          className="tone"
          data-on="tone"
          role="switch"
          tabIndex={0}
          aria-checked={tone === 'night'}
          aria-label="Night tone"
          onClick={onTone}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onTone();
            }
          }}
        >
          {tone === 'day' ? 'Day' : 'Night'} <span className="sw" />
        </div>

        <button
          type="button"
          className={`icobtn${busy ? ' spin' : ''}`}
          aria-label="Rebuild the library index"
          title="Rebuild the library index"
          onClick={onReindex}
          disabled={busy}
        >
          <Icon name="sync" />
        </button>
      </div>
    </div>
  );
}

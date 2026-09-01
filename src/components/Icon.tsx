export type IconName =
  | 'lib'
  | 'dash'
  | 'bm'
  | 'clock'
  | 'search'
  | 'sliders'
  | 'grid'
  | 'list'
  | 'left'
  | 'chev'
  | 'pen'
  | 'hl'
  | 'eraser'
  | 'zin'
  | 'zout'
  | 'check'
  | 'checkc'
  | 'x'
  | 'focus'
  | 'book'
  | 'ret'
  | 'doc'
  | 'folder'
  | 'sync'
  | 'warn'
  | 'min'
  | 'max'
  | 'play'
  | 'pause';

export default function Icon({
  name,
  className,
  style,
}: {
  name: IconName;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg className={className} style={style} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}

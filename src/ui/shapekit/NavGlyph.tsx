import type { CSSProperties } from 'react';

/**
 * The Shape Kit nav icons — one ink colour (`currentColor`), built from the kit's squares, circles
 * and triangles on an 18px box, exactly as Bell App v2 draws them. Workspace is new (the prototype
 * has no Workspace route): a folder in the same vocabulary.
 */
export type NavGlyphName =
  | 'home'
  | 'papers'
  | 'notebooks'
  | 'dashboard'
  | 'bookmarks'
  | 'recent'
  | 'settings'
  | 'community'
  | 'workspace';

type Part = CSSProperties & { k?: 'knob' };

const P = (left: number, top: number, width: number, height: number, extra: CSSProperties = {}): Part => ({
  left,
  top,
  width,
  height,
  ...extra,
});
const fill: CSSProperties = { background: 'currentColor' };
const ring: CSSProperties = { boxShadow: 'inset 0 0 0 2px currentColor' };

const PARTS: Record<NavGlyphName, Part[]> = {
  home: [
    P(0, 1, 18, 8, { ...fill, clipPath: 'polygon(50% 0,100% 100%,0 100%)' }),
    P(2, 8, 14, 9, ring),
    P(7, 11, 4, 6, fill),
  ],
  papers: [
    P(1, 3, 3.5, 14, fill),
    P(6, 1, 3.5, 16, fill),
    P(12.5, 3, 3.5, 14.5, { ...fill, transform: 'rotate(14deg)', transformOrigin: '50% 100%' }),
    P(0, 16.5, 18, 1.5, fill),
  ],
  notebooks: [
    P(3, 1, 13, 16, ring),
    P(1, 4, 4, 2, fill),
    P(1, 8, 4, 2, fill),
    P(1, 12, 4, 2, fill),
    P(12, 1, 3, 7, { ...fill, clipPath: 'polygon(0 0,100% 0,100% 100%,50% 75%,0 100%)' }),
  ],
  dashboard: [
    P(1, 1, 7, 7, { ...fill, borderRadius: '50%' }),
    P(10, 1, 7, 7, fill),
    P(1, 10, 7, 7, { ...fill, borderRadius: '7px 0 0 0' }),
    P(10, 12, 7, 3, fill),
  ],
  bookmarks: [
    P(3, 0, 12, 18, { ...fill, clipPath: 'polygon(0 0,100% 0,100% 100%,50% 74%,0 100%)' }),
    P(3, 0, 12, 3, fill),
  ],
  recent: [
    P(1, 1, 16, 16, { ...ring, borderRadius: '50%' }),
    P(8, 4, 2, 5.5, fill),
    P(8.5, 8, 5, 2, fill),
    P(8, 8, 2, 2, fill),
  ],
  settings: [
    P(0, 3, 18, 2, fill),
    P(0, 8, 18, 2, fill),
    P(0, 13, 18, 2, fill),
    { ...P(10, 1, 6, 6), k: 'knob' },
    { ...P(2, 6, 6, 6), k: 'knob' },
    { ...P(8, 11, 6, 6), k: 'knob' },
  ],
  community: [
    P(1, 1, 16, 16, { ...ring, borderRadius: '50%' }),
    P(6, 1, 6, 16, { ...ring, borderRadius: '50%' }),
    P(1, 8, 16, 2, fill),
  ],
  workspace: [
    P(1, 2, 7, 4, { ...fill, clipPath: 'polygon(0 0,70% 0,100% 100%,0 100%)' }),
    P(1, 5, 16, 12, ring),
    P(1, 5, 16, 2, fill),
  ],
};

export default function NavGlyph({ name, className }: { name: NavGlyphName; className?: string }) {
  return (
    <span className={`nav-glyph${className ? ' ' + className : ''}`} aria-hidden="true">
      {PARTS[name].map(({ k, ...style }, i) => (
        <i key={i} className={k === 'knob' ? 'nav-glyph__knob' : undefined} style={style} />
      ))}
    </span>
  );
}

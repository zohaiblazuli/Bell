/**
 * Kbd — `design/specs/components-controls.md` §6, node `13:4`. A key cap set in running text:
 * `Ctrl K` in the search field and the top bar, `↑↓` / `⏎` / `esc` under the command palette,
 * `return` in onboarding.
 *
 * 19 x 18 for a single `K`, 52 x 18 for `Ctrl K`: width is `12 + textWidth` and the height does not
 * move with the key count, so both axes hug and nothing here is pinned. The Figma API is one TEXT
 * property (`Key`), so the API here is children, on a real `<kbd>`.
 */
import type { ReactNode } from 'react';

export interface KbdProps {
  /** The key text — `Ctrl K`, `esc`, `⏎`. Figma's `Key` property. */
  children: ReactNode;
  className?: string;
}

export default function Kbd({ children, className }: KbdProps) {
  return (
    <kbd className={['kbd', 't-mono-small', className].filter(Boolean).join(' ')}>{children}</kbd>
  );
}

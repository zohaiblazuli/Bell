/**
 * The topbar's tone control: sun/moon, the word, and the 44 x 24 Switch.
 *
 * Geometry is `design/specs/screen-library-settings.md` §4, the `tone Day` / `tone Night` row at
 * x 904 (`45:53` D / `46:499` N): 34 tall FIXED, width HUG, radius `--r-pill`, `--glass-strong`
 * with a 1px `--hair` hairline, padding l12 r6, gap 8, clip. The two widths Figma reports are hug
 * results and reproduce exactly, which is the check that the padding and gap above are read right:
 *
 *     12 + 16 icon + 8 + 22 "Day"   + 8 + 44 sw + 6 = 116
 *     12 + 16 icon + 8 + 31 "Night" + 8 + 44 sw + 6 = 125
 *
 * So the width is never set here — it hugs, and a translated label just moves it.
 *
 * The icon reports the *current* tone (sun on Day, moon on Night) rather than the action, per the
 * spec's variant table. `.tone` in app.css has no icon at all, so this pill is 24px wider than the
 * one in the app today.
 *
 * The Switch is the real control — it owns `role="switch"`, `aria-checked`, the keyboard and the
 * focus ring — so the pill itself is a plain box. Switch ON means Night (§4.1). What that
 * supersedes is `.tone` in app.css, a `<div role="switch" tabIndex={0}>` with hand-rolled
 * Enter/Space handling wrapped around a `<span class="sw">`.
 */

import { useRef } from 'react';
import Icon from '../components/Icon';
import Switch from './Switch';

/** The product-level tone. Not `prefers-color-scheme` — the toggle is ours. */
export type Tone = 'day' | 'night';

export interface TonePillProps {
  tone: Tone;
  /** Takes no argument: `tone` is the caller's state and the pill only asks for it to be flipped. */
  onToggle: () => void;
  className?: string;
}

export default function TonePill({ tone, onToggle, className }: TonePillProps) {
  const sw = useRef<HTMLSpanElement>(null);
  const night = tone === 'night';

  return (
    <div
      className={className ? `tonepill ${className}` : 'tonepill'}
      /* The whole pill stays a mouse target, as it was before the port — but the Switch inside is
         the control, so a click that already landed on it must not toggle a second time. Keyboard
         and assistive tech go through the Switch, which is why there is no role or tabindex here. */
      onClick={(e) => {
        if (!sw.current?.contains(e.target as Node)) onToggle();
      }}
    >
      {/* Reports the *current* tone, not the action — `sun` `163:2` / `moon` `163:5`, cloned from
          the sprite now that both are in `IconName`. The rays' `butt` cap lives in the symbol. */}
      <Icon name={night ? 'moon' : 'sun'} className="tp-icon" />
      <span className="tp-label t-body-small">{night ? 'Night' : 'Day'}</span>
      <span className="tp-sw" ref={sw}>
        <Switch checked={night} onChange={() => onToggle()} label="Night tone" />
      </span>
    </div>
  );
}

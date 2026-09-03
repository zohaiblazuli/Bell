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
import Switch from './Switch';

/** The product-level tone. Not `prefers-color-scheme` — the toggle is ours. */
export type Tone = 'day' | 'night';

/**
 * The two 16px glyphs, verbatim from `design/specs/icons-paths.md` (`163:2` sun, `163:5` moon).
 * Inlined rather than cloned from the sprite because `sun` and `moon` are not in the app's
 * `IconName` union yet — they arrive with the re-exported set beside `ui/icons/Sprite.tsx`, at
 * which point these two constants become `<Icon name="sun" />`. The sun's rays carry the spec's
 * `butt` caps against the global rule's round.
 */
const SUN = (
  <>
    <circle cx="12" cy="12" r="3.125" />
    <path
      d="M18.2 12H21.4M16.384 16.384L18.647 18.647M12 18.2V21.4M7.616 16.384L5.353 18.647M5.8 12H2.6M7.616 7.616L5.353 5.353M12 5.8V2.6M16.384 7.616L18.647 5.353"
      strokeLinecap="butt"
    />
  </>
);
const MOON = (
  <path d="M20.983 12.77C20.566 17.516 16.517 21.118 11.755 20.979C6.993 20.84 3.161 17.009 3.021 12.247C2.881 7.485 6.484 3.434 11.23 3.017C9.191 5.797 9.485 9.639 11.923 12.077C14.361 14.515 18.199 14.809 20.981 12.772L20.983 12.77Z" />
);

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
      <svg className="tp-icon" viewBox="0 0 24 24" aria-hidden="true">
        {night ? MOON : SUN}
      </svg>
      <span className="tp-label t-body-small">{night ? 'Night' : 'Day'}</span>
      <span className="tp-sw" ref={sw}>
        <Switch checked={night} onChange={() => onToggle()} label="Night tone" />
      </span>
    </div>
  );
}

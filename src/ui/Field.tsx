/**
 * Field — onboarding's text input. `name field` `495:1514`, screen-onboarding.md §4 + §5.1:
 * 420 x 48 FIXED, `--ground` fill, padding-x 14, radius `--r-btn`, value in Body/Default `--ink`.
 *
 * **The focus ring is a border swap, not a second ring.** Resting is 1px `--hair` (the §4 input
 * recipe, measured on 03's search field); focused is 2px `--accent` *in its place*. Figma cannot
 * layer a second stroke and the file was authored that way, so this control switches off the app's
 * global `:focus-visible` outline rather than drawing it on top — two concentric accent rings is
 * not the design. §4 offers an inset box-shadow as a way to keep both; that is the thing declined.
 *
 * The caret is a real node over there (`495:1516`, a 2x18 rect at radius 1, filled `--accent`),
 * because a static mock has to draw one. A live input draws its own, so that measurement ships as
 * `caret-color`: the same colour, and about the same 2px at 13px text.
 *
 * `hint` is the row under the field — "Press [return] to continue" on 01 — `body`'s own gap 24
 * below it, Body/Meta `--ink-3`, centred on the field. Its content is the call site's, because the
 * `return` key in the design is a `Kbd` instance (`495:1519`) and that is its own component.
 *
 * 03's `search` is the same recipe at 40 tall with a leading icon and no focus state measured; it
 * is `SearchField`, not a variant of this one. §4 measures only resting and focused here, so
 * nothing styles a disabled field: have it measured before adding one.
 */
import { useId } from 'react';
import type { ComponentPropsWithRef, ReactNode } from 'react';

export interface FieldProps extends Omit<ComponentPropsWithRef<'input'>, 'children'> {
  /** The helper row under the field. Anything: strings, a `Kbd`, both. */
  hint?: ReactNode;
}

export default function Field({ hint, className, ...rest }: FieldProps) {
  // The hint is helper text *for* the input, so it is wired up as such rather than left as loose
  // text beside it. `useId` means no call site has to invent an id to do that, and any
  // `aria-describedby` the caller already passes is kept rather than replaced.
  const hintId = useId();
  const describedBy = [rest['aria-describedby'], hint ? hintId : undefined]
    .filter(Boolean)
    .join(' ');

  // `className` lands on the wrapper, which is this component's root; the input carries its own two
  // classes. There is no visible label in the design — the step's headline is it — so a call site
  // must pass `aria-label`, or `aria-labelledby` pointing at that headline.
  return (
    <div className={['bell-field', className].filter(Boolean).join(' ')}>
      {/* `type` before the spread so a call site can still override it; everything else after, so
          value, onChange, placeholder, autoFocus and `ref` pass straight through — React 19 needs
          no forwardRef for the ref. */}
      <input
        type="text"
        {...rest}
        className="bell-field__input t-body-default"
        aria-describedby={describedBy || undefined}
      />
      {hint ? (
        <span id={hintId} className="bell-field__hint t-body-meta">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

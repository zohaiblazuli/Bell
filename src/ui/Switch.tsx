/**
 * The 44 x 24 switch. Geometry is `design/specs/components-controls.md` §4 (set `532:7`):
 * 44 x 24 fixed in both states, radius 12, an 18px `--white` knob travelling x 2 -> 24.
 *
 * Figma has exactly two variants (`State = Off | On`) and **no other properties of any kind**, so
 * everything past `checked` is ours: `disabled` follows the design system's global disabled
 * convention (§0 — node opacity 0.55, not a recolour), and `label` exists because a bare switch
 * carries no text of its own.
 *
 * This is a real `<button role="switch">`. What it supersedes — `.tone .sw` in app.css — is a
 * `<span>` inside a `<div role="switch" tabIndex={0}>` with hand-rolled Enter/Space handling; a
 * button gets activation, focus and disabled semantics from the platform instead.
 */

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /**
   * Accessible name. Required, because the control is unlabelled on its own — a Settings row
   * should pass the same words its visible label carries.
   */
  label: string;
  disabled?: boolean;
  className?: string;
}

export default function Switch({ checked, onChange, label, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`switch${className ? ` ${className}` : ''}`}
    >
      <span className="switch-knob" />
    </button>
  );
}

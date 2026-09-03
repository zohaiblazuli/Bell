/**
 * The screen background — the stack every Figma composition sits on.
 *
 * Six layers, bottom to top: the two ambient blooms, the two exported cloud fields, Day's
 * darkening orb, and Night's veil. The `page recess` scrim is the seventh and lives on `.main`,
 * because it has to track the sidebar and topbar rather than a hard-coded inset.
 *
 * Tone is read off `.app[data-tone]` in CSS, so this component takes no props and never
 * re-renders on a tone change.
 *
 * BOTH cloud fields are always in the DOM, and that is the point: `Motion — Tone` (`171:8`) crosses
 * tones by stacking two whole screens and fading one over the other, and swapping one layer's
 * `background-image` cannot be transitioned — it is an instant cut, and the cut is visible because
 * the field is the largest thing on screen. Two layers whose opacities trade is the CSS equivalent,
 * and the second image is 35 KB.
 */
export default function AppBackground() {
  return (
    <div className="bg" aria-hidden="true">
      <div className="bg-ambient" />
      <div className="bg-clouds bg-clouds-day" />
      <div className="bg-clouds bg-clouds-night" />
      <div className="bg-orb" />
      <div className="bg-veil" />
    </div>
  );
}

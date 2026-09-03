/**
 * The screen background — the stack every Figma composition sits on.
 *
 * Seven layers in the file's own paint order: each tone's two ambient blooms and its one raster
 * field, then Night's veil. Day and Night no longer share a single layer — the geometry, the fills
 * and the blend modes all differ, and Night has a scrim Day does not — so each tone's stack is
 * mounted in full and the two trade opacities. See `background.css` for the numbers, all of which
 * are node properties read off `Library — Day` (`40:1080`) and `Library — Night` (`46:417`).
 *
 * Tone is read off `.app[data-tone]` in CSS, so this component takes no props and never re-renders
 * on a tone change.
 *
 * BOTH raster fields stay mounted, and that is the point: `Motion — Tone` (`171:8`) crosses tones by
 * stacking two whole detached screens and fading one over the other. Neither `background-image` nor
 * `mix-blend-mode` nor a layer's geometry can be transitioned, so swapping one layer's image is an
 * instant cut — and the cut is visible because the field is the largest thing on screen. Two stacks
 * whose opacities trade is the CSS equivalent, and the second raster is 102 KB.
 *
 * `page recess` was deleted from the file in the same pass: Night's `veil` now covers the whole
 * frame on its own, so the scrim that used to live on `.main` — the one layer here that had to track
 * the sidebar and top bar rather than the frame — is gone.
 */
export default function AppBackground() {
  return (
    <div className="bg" aria-hidden="true">
      <div className="bg-bloom bg-bloom-a-day" />
      <div className="bg-bloom bg-bloom-b-day" />
      <div className="bg-art bg-art-day" />
      <div className="bg-bloom bg-bloom-a-night" />
      <div className="bg-bloom bg-bloom-b-night" />
      <div className="bg-art bg-art-night" />
      <div className="bg-veil" />
    </div>
  );
}

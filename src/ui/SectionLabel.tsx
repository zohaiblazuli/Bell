/**
 * Section Label — the eyebrow that heads a content group: the label, an optional mono meta, then
 * a hairline rule out to the right edge. Spec: `screen-dashboard.md` §6 (the four-instance
 * pattern), `screen-library-settings.md` §5.2 + §6.1, `screen-bookmarks-recent.md` §5 + §6.
 *
 * NOT the sidebar's `nav-label` ("STUDY", "SUBJECTS"). That is the same text style painted
 * `--ink-3`, padded 12/0/5/10, with no meta and no rule — a different node in every composition,
 * and app.css `.nav-label` still owns it.
 *
 * The root is a plain `<div>`. The same pattern heads real sections, empty states and a loading
 * line, so a hard-coded heading level would be wrong more often than right; give the section it
 * heads its own heading or `aria-label` where the document outline matters.
 *
 * Figma stores some of these strings lowercase (`due for review`, `session coverage`) and
 * uppercases them in the text style, so `label` can be passed in whatever case reads best.
 */
export interface SectionLabelProps {
  label: string;
  /** The machine count beside it — "6 papers", "10 of 40 sat". Absent on most instances. */
  meta?: string;
  rule?: boolean;
}

export default function SectionLabel({ label, meta, rule = true }: SectionLabelProps) {
  return (
    <div className="section-label">
      <span className="section-label__text t-label-section">{label}</span>
      {meta && <span className="section-label__meta t-mono-small">{meta}</span>}
      {rule && <span className="section-label__rule" />}
    </div>
  );
}

/**
 * CoverageMatrix — the dashboard's `session coverage` module.
 * Spec: `design/specs/screen-dashboard.md` §8b (`187:115`, 411 x 134 @ 0,230).
 *
 * Five subjects x eight sessions, each cell none / partial / done. This is the one view nothing
 * else in the app provides: the library tells you what exists and subject progress tells you how
 * far through a subject you are, but only this says *which sittings you have actually sat*.
 *
 * One column geometry is shared by the header and all five data rows — label 96, eight 20-wide
 * session cells on a 28px pitch, a growing strut, then a 30-wide right-aligned count. That shared
 * track is what keeps the header labels centred over their columns without a grid.
 *
 * The count is **done only**; partials deliberately do not count, which is why the file's own
 * figures read `0/8` for a row that has a partial in it. The sec-label's `10 of 40 sat` is the sum
 * of these counts, so a caller that changes the rule has to change the label too.
 */
import type { ReactNode } from 'react';

/** How much of a sitting has been done. `partial` is any progress short of the whole sitting. */
export type Coverage = 'none' | 'partial' | 'done';

export interface CoverageRow {
  /** CAIE syllabus code — the row's identity, and what the caller keys its icon off. */
  code: string;
  name: string;
  /** The 14px subject glyph. Supplied by the caller so this module needs no code→glyph map. */
  icon?: ReactNode;
  /** One entry per session column, in the same order as `sessions`. */
  cells: Coverage[];
}

export interface CoverageMatrixProps {
  /**
   * Session codes as the index carries them — `m24`, `s24`, `w24`. Eight of them at the measured
   * width; the strut absorbs any other count, so fewer or more still lay out.
   */
  sessions: string[];
  rows: CoverageRow[];
  className?: string;
}

/** Measured (§8b): cell 20 x 16 on a 28px pitch, label 96, count 30. */
export const COVERAGE = {
  label: 96,
  cell: { w: 20, h: 16 },
  pitch: 28,
  count: 30,
} as const;

const doneCount = (cells: Coverage[]) => cells.filter((c) => c === 'done').length;

export default function CoverageMatrix({ sessions, rows, className }: CoverageMatrixProps) {
  return (
    <div className={className ? `cov ${className}` : 'cov'}>
      {/* The header's label slot is an empty 96x1 pad in the file, not a heading — the column is
          identified by the row labels below it, so announcing anything here would be noise. */}
      <div className="cov-row cov-head" role="presentation">
        <span className="cov-pad" />
        {sessions.map((s) => (
          <span key={s} className="cov-sess t-mono-small">
            {s}
          </span>
        ))}
        <span className="cov-strut" />
        <span className="cov-count t-mono-small">sat</span>
      </div>

      {rows.map((row) => {
        const done = doneCount(row.cells);
        return (
          <div key={row.code} className="cov-row">
            <span className="cov-label">
              {row.icon}
              <span className="cov-name t-body-chip">{row.name}</span>
            </span>
            {row.cells.map((state, i) => (
              <span
                key={sessions[i] ?? i}
                className={`cov-cell cov-${state}`}
                title={`${row.name} · ${sessions[i] ?? ''} · ${state}`}
              />
            ))}
            <span className="cov-strut" />
            <span className="cov-count cov-count-value t-mono-small">
              {done}/{row.cells.length}
            </span>
          </div>
        );
      })}
    </div>
  );
}

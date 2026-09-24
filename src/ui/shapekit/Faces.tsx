import { useState } from 'react';

/**
 * The animated reaction faces (Bell App v2), built from the kit's shapes rather than stock emoji:
 *
 *   sun   yellow circle — blinks at rest; hover: jumps with squash and stretch
 *   blob  red circle, O mouth — hover: grows and shakes
 *   box   blue square with owl eyes that look side to side — hover: tilts back and forth
 *   tri   green triangle, zigzag mouth — hover: spins
 *
 * Tapping squishes the face and pops four tiny shapes; the picked face goes bold with an ink bar
 * under it. Literal colours in both tones — faces are characters, not chrome.
 */
export type FaceKind = 'sun' | 'blob' | 'box' | 'tri';

export interface FaceOption {
  id: string;
  label: string;
  kind: FaceKind;
  /** Shown beside the label when given (Community's reaction counts). */
  count?: number;
}

interface Props {
  options: FaceOption[];
  /** Ids currently picked. */
  picked: Set<string>;
  onPick: (id: string) => void;
  label: string;
}

export default function Faces({ options, picked, onPick, label }: Props) {
  const [burst, setBurst] = useState<{ id: string; n: number } | null>(null);
  return (
    <div className="sk-faces" role="group" aria-label={label}>
      {options.map((o) => {
        const on = picked.has(o.id);
        const popping = burst?.id === o.id;
        return (
          <button
            key={o.id}
            type="button"
            className="sk-face"
            aria-pressed={on}
            title={o.label}
            onClick={() => {
              setBurst({ id: o.id, n: (burst?.n ?? 0) + 1 });
              onPick(o.id);
            }}
          >
            <span className="sk-face__art" key={popping ? `p${burst!.n}` : 'rest'} data-joy={popping ? 'true' : undefined}>
              <span className={`sk-face__shape sk-face__shape--${o.kind}`}>
                {o.kind === 'sun' && (
                  <>
                    <i className="sk-fs-body" />
                    <i className="sk-fs-eye" style={{ left: 10 }} />
                    <i className="sk-fs-eye" style={{ left: 19 }} />
                    <i className="sk-fs-smile" />
                  </>
                )}
                {o.kind === 'blob' && (
                  <>
                    <i className="sk-fb-body" />
                    <i className="sk-fb-eye" style={{ left: 9 }} />
                    <i className="sk-fb-eye" style={{ left: 20 }} />
                    <i className="sk-fb-o" />
                  </>
                )}
                {o.kind === 'box' && (
                  <>
                    <i className="sk-fx-body" />
                    <i className="sk-fx-eye" style={{ left: 6 }}>
                      <i />
                    </i>
                    <i className="sk-fx-eye" style={{ left: 18 }}>
                      <i />
                    </i>
                    <i className="sk-fx-mouth" />
                  </>
                )}
                {o.kind === 'tri' && (
                  <>
                    <i className="sk-ft-edge" />
                    <i className="sk-ft-body" />
                    <i className="sk-ft-eye" style={{ left: 11 }} />
                    <i className="sk-ft-eye" style={{ left: 18 }} />
                    <i className="sk-ft-zig" />
                  </>
                )}
              </span>
              {popping && (
                <span className="sk-face__burst">
                  <i style={{ borderRadius: '50%', background: 'var(--sk-yellow)', animationName: 'sk-burst-1' }} />
                  <i style={{ background: 'var(--sk-blue)', animationName: 'sk-burst-2' }} />
                  <i style={{ background: 'var(--sk-red)', clipPath: 'polygon(50% 0,100% 100%,0 100%)', animationName: 'sk-burst-3' }} />
                  <i style={{ background: '#3e8a5a', clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)', animationName: 'sk-burst-4' }} />
                </span>
              )}
            </span>
            <span className="sk-face__label">
              {o.label}
              {o.count != null && <span className="sk-face__count">{o.count}</span>}
            </span>
            <i className="sk-face__bar" />
          </button>
        );
      })}
    </div>
  );
}

import { useRef, useState } from 'react';

/**
 * The streak flame (Bell App v2): a red drop with a yellow core and two blinking eyes that flickers
 * at rest, roars on hover, and on a press squishes and throws four tiny shapes while embers drift
 * off the tip. Built from the kit's shapes; literal colours in both tones, like the faces.
 */
export default function Flame({ title }: { title: string }) {
  const [burst, setBurst] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  const pop = () => {
    window.clearTimeout(timer.current);
    setBurst((n) => n + 1);
    timer.current = window.setTimeout(() => setBurst(0), 800);
  };
  return (
    <button type="button" className="sk-flame" title={title} aria-label={title} onClick={pop}>
      <span className="sk-flame__body" data-joy={burst ? 'true' : undefined} key={burst}>
        <i className="sk-flame__outer" />
        <i className="sk-flame__core" />
        <i className="sk-flame__eye" style={{ left: 9 }} />
        <i className="sk-flame__eye" style={{ left: 15 }} />
      </span>
      <i className="sk-flame__ember" style={{ left: 5, top: 6, width: 4, height: 4, background: 'var(--sk-yellow)', ['--dx' as string]: '-5px' }} />
      <i
        className="sk-flame__ember"
        style={{ left: 17, top: 4, width: 3, height: 3, background: 'var(--sk-red)', animationDelay: '.8s', ['--dx' as string]: '6px' }}
      />
      {burst > 0 && (
        <span className="sk-flame__burst" key={`b${burst}`}>
          <i style={{ borderRadius: '50%', background: 'var(--sk-yellow)', animationName: 'sk-burst-1' }} />
          <i style={{ background: 'var(--sk-red)', animationName: 'sk-burst-2' }} />
          <i style={{ background: 'var(--sk-yellow)', clipPath: 'polygon(50% 0,100% 100%,0 100%)', animationName: 'sk-burst-3' }} />
          <i style={{ background: 'var(--sk-red)', clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)', animationName: 'sk-burst-4' }} />
        </span>
      )}
    </button>
  );
}

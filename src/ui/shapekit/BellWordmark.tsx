/**
 * The "1a Full stop" wordmark: Jost Bold, tight tracking, and a blue square for the full stop.
 * The word follows the ink token (it is type, and flips with the tone); the stop is the accent.
 */
export default function BellWordmark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <span className={`bell-wordmark${className ? ' ' + className : ''}`} style={{ fontSize: size }}>
      <span>Bell</span>
      <i className="bell-wordmark__stop" aria-hidden="true" />
    </span>
  );
}

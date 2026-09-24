/**
 * The Bell symbol — "2a Owl head": Hush's face cut down to squares and circles, full-bleed in its
 * tile (blue head across the whole width, black ears in the top corners). Sized in em so one
 * `size` scales every part. Literal colours: a logo does not change with the tone.
 */
export default function OwlMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <span className={`owl-mark${className ? ' ' + className : ''}`} style={{ fontSize: size }} aria-hidden="true">
      <i className="owl-mark__ear owl-mark__ear--l" />
      <i className="owl-mark__ear owl-mark__ear--r" />
      <i className="owl-mark__head" />
      <i className="owl-mark__eye" style={{ left: '.12em' }} />
      <i className="owl-mark__eye" style={{ left: '.58em' }} />
      <i className="owl-mark__pupil" style={{ left: '.21em' }} />
      <i className="owl-mark__pupil" style={{ left: '.67em' }} />
      <i className="owl-mark__beak" />
    </span>
  );
}

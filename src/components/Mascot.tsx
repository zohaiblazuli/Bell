import Hush, { type HushPose } from '@ui/shapekit/Hush';

/**
 * The app's mascot slot. It used to switch between Mr. Bell's rig and the Ms. Bell pet; Bell App v2
 * settles on Hush, the Shape Kit owl, as the one companion — so this is a thin, stable seam over him
 * that every placement (sidebar, notebook corner, dialogs) keeps calling.
 */
export interface MascotProps {
  /** Rendered edge in px. */
  size?: number;
  mood?: HushPose;
  className?: string;
}

export default function Mascot({ size = 86, mood = 'idle', className }: MascotProps) {
  return <Hush pose={mood} size={size} className={className} />;
}

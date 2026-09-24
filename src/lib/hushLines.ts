import type { View } from '@/components/Sidebar';

/**
 * Hush's line of the day — the sidebar speech bubble. His voice (from the behaviour sheet): dry, never
 * mocking, twelve words at most. One line per route, as Bell App v2 writes them; the numbers are real
 * where the prototype's were sample figures.
 */
export function hushLine(
  view: View,
  facts: { papers: number | null; recentCount: number; bookmarks: number },
): string {
  switch (view) {
    case 'dashboard': {
      const h = new Date().getHours();
      return h < 12 ? 'Mornings are for the hard paper.' : h < 18 ? 'Afternoon. One more section?' : 'Evenings suit a timed paper.';
    }
    case 'reader':
    case 'community-reader':
    case 'workspace':
      return 'Watching the clock. Not you.';
    case 'notebooks':
    case 'notebook':
      return 'Your handwriting. My shelf.';
    case 'settings':
      return 'Change what you like. I adapt.';
    case 'community':
      return 'Online bit. It all comes home.';
    case 'recent':
      return facts.recentCount === 0
        ? 'Nothing opened yet. Very restful.'
        : `${facts.recentCount} ${facts.recentCount === 1 ? 'paper' : 'papers'} lately. I counted.`;
    case 'bookmarks':
      return facts.bookmarks === 0 ? 'Nothing saved. Very restful.' : 'Saved for later. Later is coming.';
    default:
      return facts.papers
        ? `${facts.papers.toLocaleString()} papers. Zero wifi needed.`
        : 'Every paper works offline.';
  }
}

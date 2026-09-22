/**
 * Navigation information architecture as data (Design System v2 §3). No JSX lives here — this is
 * the single source of truth for the sidebar's static structure, so the rendered `NavSidebar` stays
 * a pure view over it. Icons are drawn from the CLOSED `IconName` union in `../../components/Icon`;
 * the sprite is fixed, so no name outside that union may appear here.
 *
 * "Pinned Subjects" is intentionally ABSENT: it is a dynamic, per-student group derived from the
 * chosen syllabus at runtime and is passed to `NavSidebar` as its `pinned` prop, not baked in here.
 */
import type { IconName } from '../../components/Icon';

export type NavItem = {
  id: string;
  label: string;
  icon: IconName;
  /** Optional count chip (e.g. unread / available). Dynamic — left unset in the static config. */
  badge?: number;
};

export type NavGroup = {
  id: string;
  /** Eyebrow caption above the group. Omit for an unlabelled group. */
  label?: string;
  items: NavItem[];
};

/**
 * The primary nav, §3. Two labelled groups; "Pinned Subjects" is injected at runtime between
 * "My Stuff" and the bottom-anchored utility items.
 *
 * Icon notes (see the mapping in the handoff): `dash` stands in for Home (no house glyph in the
 * sprite), `grid` for Analytics, `doc` for Downloads (no download-arrow glyph). All are real
 * `IconName`s — nothing invented.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { id: 'home', label: 'Home', icon: 'dash' },
      { id: 'library', label: 'Library', icon: 'lib' },
      { id: 'practice', label: 'Practice', icon: 'pen' },
      { id: 'notebooks', label: 'Notebooks', icon: 'notebook' },
      { id: 'analytics', label: 'Analytics', icon: 'grid' },
    ],
  },
  {
    id: 'my-stuff',
    label: 'My Stuff',
    items: [
      { id: 'bookmarks', label: 'Bookmarks', icon: 'bm' },
      { id: 'downloads', label: 'Downloads', icon: 'doc' },
      { id: 'history', label: 'History', icon: 'clock' },
      { id: 'collections', label: 'Collections', icon: 'folder' },
    ],
  },
];

/**
 * Utility items, anchored to the sidebar bottom (§3). Help has no dedicated question-mark glyph in
 * the fixed sprite, so `warn` is used as an approximation — swap it the moment a `help`/`question`
 * icon is added to the union.
 */
export const NAV_UTILITY: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: 'sliders' },
  { id: 'help', label: 'Help', icon: 'warn' },
];

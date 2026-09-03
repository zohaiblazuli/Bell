/**
 * Command Palette — the ⌘K / Ctrl-K sheet that jumps to a paper or runs a command.
 *
 * The Figma file has no palette artboard, so the surface is assembled out of measured language
 * rather than copied off one node, and each borrowing is cited where it lands:
 *
 *   panel  chrome glass, because a palette is frame and never content (CLAUDE.md rule 1):
 *          `--glass-strong` behind a `--glass-brd` hairline at `--r-panel`, the window shadow, a
 *          `--glass-hi` specular top, over `--scrim`. Same recipe as the sheets in
 *          `design/specs/screen-library-settings.md` §4 and `components-controls.md`.
 *   head   `SearchField`'s field row (`45:41`) continued past the click that opened it — 16px
 *          `search` glyph, the text at FILL in `Body/Default`, placeholder `--ink-3`. The type does
 *          not change under the user's hands between the top bar's pill and this panel.
 *   rows   the Recent list's measured row, `design/specs/screen-bookmarks-recent.md` §6: 48 tall,
 *          gap 14, a 20px `Subject Icon` stroked `--ink-2` — explicitly *not* the sidebar's iris
 *          tint — then the subject, `9706 /12` in Mono/Meta, the session in Mono/Small.
 *
 * Two deviations from those nodes, both deliberate: the row's primary text is `--ink` where the
 * Recent row uses `--ink-2` (the row is the thing being picked, and this list is the only content
 * on screen while it is up), and the rows are inset pills in an 8px-padded list rather than flush
 * rows in a `--card` with `--hair-2` dividers, because they are selectable and a card would put a
 * content surface inside chrome.
 *
 * The interaction model is the ARIA combobox: the input keeps focus and owns every key, the list is a
 * listbox whose options are grouped by section, and the cursor is published through
 * `aria-activedescendant` instead of by moving focus — which is why the rows sit outside the tab
 * order. The reason that matters here is on the row itself.
 *
 * TWO MECHANISMS BELOW ARE LOAD-BEARING AND UNCHANGED BY THE RESTYLE:
 *
 *   1. Keys are captured at the window while the palette is open, so nothing behind it reacts —
 *      Escape must not also close the mark-scheme sheet and the arrows must not page the paper.
 *   2. The search is debounced 90ms and stamped, so a slow query landing late cannot overwrite a
 *      newer one's results.
 *
 * Both keep their own comments. Neither was touched; do not "simplify" either.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Kbd from '@ui/Kbd';
import SectionLabel from '@ui/SectionLabel';
import SubjectIcon from '@ui/icons/SubjectIcon';
import Icon, { type IconName } from './Icon';
import { searchPapers } from '../lib/api';
import { sessionLabel } from '../lib/difficulty';
import { loadRecent, loadRows } from '../lib/store';
import type { PaperRow } from '../lib/types';
import './CommandPalette.css';

export interface PaletteCommand {
  id: string;
  /** What the row reads. Sentence case, an imperative where it is an action — "Check for updates". */
  label: string;
  /** One line beside the label — "Browse every paper", "13,447 papers". Also matched by the query. */
  hint?: string;
  icon: IconName;
  /**
   * NEW. The eyebrow this command sits under. Consecutive commands sharing one are grouped beneath a
   * single header, in the order `commands` arrives — the caller's order is authoritative, nothing
   * here sorts. Absent falls back to `COMMAND_SECTION`.
   */
  section?: string;
  /**
   * NEW. A key cap on the right of the row — "Ctrl K". DISPLAY ONLY: it binds nothing, so it must
   * name a shortcut something else has actually bound, or be left off.
   */
  shortcut?: string;
  /**
   * NEW. Extra words the query may match, space-separated, so "dark" finds "Switch to Night". Never
   * rendered.
   */
  keywords?: string;
  run: () => void;
}

/** The eyebrow a command falls under when it declares no `section` of its own. */
const COMMAND_SECTION = 'Commands';

/** The two sections `screenCommands` uses: a destination, and something the app itself does. */
const GO_TO = 'Go to';
const APP = 'App';

/** Handlers for what `screenCommands` builds: every screen the sidebar lists, plus one act. */
export interface PaletteScreens {
  onLibrary: () => void;
  onDashboard: () => void;
  onBookmarks: () => void;
  onRecent: () => void;
  onSettings: () => void;
  /**
   * Ask the updater to look now. OMIT IT while the app has no updater: the entry then does not render
   * at all, rather than offering the user a check that cannot happen.
   */
  onCheckUpdates?: () => void;
}

/**
 * Real counts for the hints. Each is optional and a missing or zero one renders the prose hint
 * instead — the palette never prints a number the app has not measured, and never names it as
 * something other than what it counts.
 */
export interface PaletteScreenCounts {
  /**
   * `LibraryStats.docs`, i.e. the number the sidebar's Library row already shows. It counts indexed
   * FILES, not papers: a question paper, its mark scheme, its threshold table and its examiner
   * report are four docs, so reading it out as a paper count is wrong by roughly 4x —
   * `views/SettingsView.tsx` makes the same point about the same number and prints "documents".
   * So does the hint here.
   */
  docs?: number | null;
  bookmarks?: number | null;
  recent?: number | null;
}

/**
 * The five screens the sidebar lists, plus "Check for updates" when a handler exists for it, as
 * commands. The definitions live here because the type does; the actions are the caller's, because
 * routing is `App`'s business and this component has no idea what a view is. Spread them into the
 * `commands` prop:
 *
 *     commands={[...screenCommands(handlers, { docs: stats?.docs }), ...whateverElse]}
 *
 * Order is the sidebar's nav order (`design/specs/screen-library-settings.md` §3 + the fifth row),
 * so the palette and the sidebar agree about what the app is made of.
 */
export function screenCommands(
  go: PaletteScreens,
  counts: PaletteScreenCounts = {},
): PaletteCommand[] {
  const count = (n: number | null | undefined, one: string, many: string) =>
    typeof n === 'number' && n > 0 ? `${n.toLocaleString()} ${n === 1 ? one : many}` : undefined;

  const list: PaletteCommand[] = [
    {
      id: 'go-library',
      section: GO_TO,
      label: 'Library',
      hint: count(counts.docs, 'document indexed', 'documents indexed') ?? 'Browse every paper',
      icon: 'lib',
      keywords: 'papers browse subjects sessions',
      run: go.onLibrary,
    },
    {
      id: 'go-dashboard',
      section: GO_TO,
      label: 'Dashboard',
      hint: 'Focus, streak and up next',
      icon: 'dash',
      keywords: 'stats activity streak minutes coverage',
      run: go.onDashboard,
    },
    {
      id: 'go-bookmarks',
      section: GO_TO,
      label: 'Bookmarks',
      hint: count(counts.bookmarks, 'paper marked', 'papers marked') ?? 'Papers you have marked',
      icon: 'bm',
      keywords: 'marked saved starred',
      run: go.onBookmarks,
    },
    {
      id: 'go-recent',
      section: GO_TO,
      label: 'Recent',
      hint: count(counts.recent, 'paper opened', 'papers opened') ?? 'Papers you opened last',
      icon: 'clock',
      keywords: 'history last opened today yesterday',
      run: go.onRecent,
    },
    {
      id: 'go-settings',
      section: GO_TO,
      label: 'Settings',
      hint: 'Tone, library folder, focus and updates',
      icon: 'sliders',
      keywords: 'preferences options tone night day theme folder reduce motion',
      run: go.onSettings,
    },
  ];

  /* Offered only when something can actually perform it — see `onCheckUpdates`. */
  const check = go.onCheckUpdates;
  if (check) {
    list.push({
      id: 'check-updates',
      section: APP,
      label: 'Check for updates',
      hint: 'Look now instead of waiting for the daily check',
      /* `sync` is the closest glyph the set has: it holds no download and no restart icon, which is
         why `ui/UpdateNotice.tsx` had to author both by hand. */
      icon: 'sync',
      keywords: 'update version upgrade release notes',
      run: check,
    });
  }

  return list;
}

export interface Props {
  open: boolean;
  onClose: () => void;
  /** The app's own open: it notes the paper as recent, switches view and starts the focus timer. */
  onOpenPaper: (paper: PaperRow) => void;
  /** In display order. Consecutive commands sharing a `section` group under one eyebrow. */
  commands: PaletteCommand[];
}

/** One flat row per selectable thing, so `sel` indexes the list the arrows actually walk. */
type Row =
  | { kind: 'paper'; section: string; paper: PaperRow }
  | { kind: 'command'; section: string; command: PaletteCommand };

const PAPER_LIMIT = 7;

/**
 * How many commands the resting palette shows under the recents. The resting state is the user's
 * recents; the commands below them are a short menu of destinations, not the whole command set, which
 * a query opens. Six is the most `screenCommands` returns, so putting those first shows all of them.
 */
const REST_COMMAND_LIMIT = 6;

export default function CommandPalette({ open, onClose, onOpenPaper, commands }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PaperRow[]>([]);
  const [sel, setSel] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  /** Stable prefix for the listbox and its options, so `aria-activedescendant` can point at one. */
  const uid = useId();

  const q = query.trim();

  // Papers you have actually opened, newest first — the resting state, and the reason an empty
  // palette is still useful.
  const recent = useMemo(() => {
    if (!open) return [];
    const rows = loadRows();
    return loadRecent()
      .map((r) => rows[r.key])
      .filter((r): r is PaperRow => Boolean(r))
      .slice(0, PAPER_LIMIT);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSel(0);
    setHits([]);
    /* Whatever opened the palette — the top bar's field, or nothing if it was ⌘K from the reader. */
    const opener = document.activeElement as HTMLElement | null;
    const id = window.setTimeout(() => input.current?.focus(), 20);
    return () => {
      window.clearTimeout(id);
      /* Closing removes the focused input, which drops focus on <body> and leaves the next Tab
         starting from the top of the window. Hand it back — but only if nothing else claimed it,
         so a command that moves focus itself still wins. */
      const active = document.activeElement;
      if (active === null || active === document.body) opener?.focus?.();
    };
  }, [open]);

  // Debounced, and stamped so a slow query can never overwrite a newer one's results.
  const stamp = useRef(0);
  useEffect(() => {
    if (!open || q === '') {
      setHits([]);
      return;
    }
    const mine = ++stamp.current;
    const id = window.setTimeout(() => {
      void searchPapers(q, PAPER_LIMIT)
        .then((rows) => {
          if (mine === stamp.current) setHits(rows);
        })
        .catch(() => {
          if (mine === stamp.current) setHits([]);
        });
    }, 90);
    return () => window.clearTimeout(id);
  }, [q, open]);

  const papers = q === '' ? recent : hits;

  const cmds = useMemo(() => {
    if (q === '') return commands.slice(0, REST_COMMAND_LIMIT);
    /* Every whitespace-separated token has to match, which is exactly what `search_papers` does in
       SQL for the papers above — one query syntax in the palette, not two. */
    const tokens = q.toLowerCase().split(/\s+/);
    return commands.filter((c) => {
      const hay = `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [commands, q]);

  /** The papers group's eyebrow: at rest it names the resting state, under a query it says papers. */
  const paperSection = q === '' ? 'Recently opened' : 'Papers';

  /**
   * The count beside that eyebrow, and only where it says something true. `search_papers` is asked
   * for `PAPER_LIMIT` rows, so a full page means "the first seven of an unknown number" — never
   * "seven matches".
   */
  const paperMeta =
    q === '' || papers.length === 0
      ? undefined
      : papers.length < PAPER_LIMIT
        ? `${papers.length} match${papers.length === 1 ? '' : 'es'}`
        : `first ${PAPER_LIMIT}`;

  const rows = useMemo<Row[]>(
    () => [
      ...papers.map((p) => ({ kind: 'paper' as const, paper: p, section: paperSection })),
      ...cmds.map((c) => ({
        kind: 'command' as const,
        command: c,
        section: c.section ?? COMMAND_SECTION,
      })),
    ],
    [papers, cmds, paperSection],
  );

  /**
   * The same rows chunked into consecutive runs of one section. Each run renders as a real ARIA
   * group, which is what lets the visible eyebrow be decorative: the group carries the section name
   * as its label, so a screen reader hears "Go to" once instead of reading a header between options.
   * Chunking consecutive runs rather than collecting by name keeps the caller's order authoritative.
   */
  const groups = useMemo(() => {
    const out: { section: string; at: number; items: { row: Row; i: number }[] }[] = [];
    rows.forEach((row, i) => {
      const run = out[out.length - 1];
      if (run && run.section === row.section) {
        run.items.push({ row, i });
        return;
      }
      /* `at` is where the run starts in the flat list — a key that stays unique even if a caller
         interleaves two runs of the same section. */
      out.push({ section: row.section, at: i, items: [{ row, i }] });
    });
    return out;
  }, [rows]);

  const choose = useCallback(
    (i: number) => {
      const row = rows[i];
      if (!row) return;
      onClose();
      if (row.kind === 'paper') onOpenPaper(row.paper);
      else row.command.run();
    },
    [rows, onClose, onOpenPaper],
  );

  useEffect(() => {
    if (sel < rows.length) return;
    setSel(rows.length === 0 ? 0 : rows.length - 1);
  }, [rows.length, sel]);

  /**
   * A pointer can already see the row it is over, and scrolling the list under a still mouse fires
   * another mouseenter — which would move the cursor and scroll again, walking the list on its own.
   * So only a keyboard move chases the selection.
   */
  const byPointer = useRef(false);
  useEffect(() => {
    if (byPointer.current) {
      byPointer.current = false;
      return;
    }
    list.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({
      block: 'nearest',
    });
  }, [sel]);

  /**
   * Captured at the window while the palette is open, so the keys belong to the palette and
   * nothing behind it reacts — Escape must not also close the mark-scheme sheet, and the arrows
   * must not page the paper underneath.
   */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (rows.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        setSel((s) => (s + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        choose(sel);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, rows.length, sel, choose, onClose]);

  if (!open) return null;

  const listId = `${uid}list`;
  const rowId = (i: number) => `${uid}row${i}`;
  const rowClass = (i: number) => (sel === i ? 'cmdk-row cmdk-row--on' : 'cmdk-row');
  /* The pointer sets the cursor, so what the mouse is over is always what ⏎ would open. Entering the
     row that is ALREADY the cursor has to be a no-op: `setSel(sel)` re-renders nothing, so the
     effect that clears `byPointer` would never run and the flag would sit there and swallow the
     scroll of the next KEYBOARD move. */
  const point = (i: number) => {
    if (i === sel) return;
    byPointer.current = true;
    setSel(i);
  };

  /* Two row shapes, one geometry — see the CSS. They are render helpers rather than components so
     the cursor state stays in one place; nothing in either of them holds state of its own. */
  const paperRow = (p: PaperRow, i: number) => {
    /* `9706 /12` as one string, the way the Recent row bakes it (§6). The space belongs to the file.
       `variant` is null on a subject-wide row, which prints the code alone. */
    const code = p.variant ? `${p.subjectCode} /${p.variant}` : p.subjectCode;
    return (
      <button
        key={`${p.subjectCode}/${p.scode}/${p.variant ?? '-'}/${p.level}`}
        type="button"
        id={rowId(i)}
        role="option"
        aria-selected={sel === i}
        /* Not a tab stop, and this is a correctness point rather than a preference: Enter is handled
           at the window and always acts on the CURSOR, so a focus ring parked on a different row
           would promise something Enter does not do. Arrows move the cursor, ⏎ opens it, clicks
           work — the rows are reachable, just not through Tab. */
        tabIndex={-1}
        /* Spoken as one line, with the session spelled out and the level the row has no room for. */
        aria-label={`${p.subjectName} ${code}, ${sessionLabel(p.scode)}, ${p.level}`}
        data-i={i}
        className={rowClass(i)}
        onMouseEnter={() => point(i)}
        onClick={() => choose(i)}
      >
        <span className="cmdk-row__glyph">
          <SubjectIcon code={p.subjectCode} size={20} />
        </span>
        <span className="cmdk-row__name t-body-nav">{p.subjectName}</span>
        <span className="cmdk-row__code t-mono-meta">{code}</span>
        <span className="cmdk-row__session t-mono-small">{sessionLabel(p.scode)}</span>
        <span className="cmdk-row__end">
          <span className="cmdk-row__enter">
            <Icon name="ret" />
          </span>
        </span>
      </button>
    );
  };

  const commandRow = (c: PaletteCommand, i: number) => (
    <button
      key={c.id}
      type="button"
      id={rowId(i)}
      role="option"
      aria-selected={sel === i}
      tabIndex={-1}
      data-i={i}
      className={rowClass(i)}
      onMouseEnter={() => point(i)}
      onClick={() => choose(i)}
    >
      <span className="cmdk-row__glyph">
        <Icon name={c.icon} />
      </span>
      <span className="cmdk-row__name t-body-nav">{c.label}</span>
      {c.hint && <span className="cmdk-row__hint t-body-meta">{c.hint}</span>}
      <span className="cmdk-row__end">
        {c.shortcut && <Kbd>{c.shortcut}</Kbd>}
        <span className="cmdk-row__enter">
          <Icon name="ret" />
        </span>
      </span>
    </button>
  );

  return (
    <div
      className="cmdk-scrim"
      /* mousedown, not click: a click fires on the common ancestor of its down and up targets, so a
         drag that starts on a row and ends outside the panel would land here and close it. */
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="cmdk"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        /* `aria-modal` claims the keyboard, so Tab must not walk out into the sidebar behind the
           sheet. The palette has exactly one focusable child — the input; the rows are cursor-driven
           and out of the tab order — so honouring that claim is simply "stay where you are". This
           listener is React's own on the panel, deliberately not the window capture handler below. */
        onKeyDown={(e) => {
          if (e.key === 'Tab') e.preventDefault();
        }}
      >
        <div className="cmdk__head">
          <Icon name="search" className="cmdk__glyph" />
          {/* A combobox over the list below: the input keeps focus and the arrows move a cursor
              inside the listbox, which is what `aria-activedescendant` reports. */}
          <input
            ref={input}
            className="cmdk__input t-body-default"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSel(0);
            }}
            placeholder="Search papers or run a command — try 9709 s24 12"
            aria-label="Search papers and commands"
            role="combobox"
            /* The popup is only expanded when it actually holds options; the list hides itself when
               it is empty, and the two must agree. */
            aria-expanded={rows.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={sel < rows.length ? rowId(sel) : undefined}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Both empty states sit OUTSIDE the listbox: a listbox may only hold options and groups, and
            neither of these lines is one. Honest about which case it is, and never a placeholder row. */}
        {q === '' && papers.length === 0 && (
          <p className="cmdk__empty t-body-default">Nothing opened yet — papers you open land here.</p>
        )}
        {q !== '' && rows.length === 0 && (
          <p className="cmdk__empty t-body-default">
            Nothing matched <span className="t-mono-meta">{q}</span>
          </p>
        )}

        <div
          className="cmdk__list"
          id={listId}
          role="listbox"
          aria-label="Papers and commands"
          ref={list}
        >
          {groups.map((g) => (
            /* The section name is the group's label. `paperMeta` belongs to the papers run only —
               the one section this component names itself. */
            <div role="group" aria-label={g.section} key={g.at}>
              <div className="cmdk__eyebrow" aria-hidden="true">
                <SectionLabel
                  label={g.section}
                  meta={g.section === paperSection ? paperMeta : undefined}
                  rule={false}
                />
              </div>

              {g.items.map(({ row, i }) =>
                row.kind === 'paper' ? paperRow(row.paper, i) : commandRow(row.command, i),
              )}
            </div>
          ))}
        </div>

        <div className="cmdk__foot t-body-meta">
          <span className="cmdk__legend">
            <Kbd>↑↓</Kbd> navigate
          </span>
          <span className="cmdk__legend">
            <Kbd>⏎</Kbd> open
          </span>
          <span className="cmdk__legend">
            <Kbd>esc</Kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

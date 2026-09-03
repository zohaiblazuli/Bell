/**
 * Reports — and with `--prune`, removes — class selectors in a stylesheet that no `.tsx`/`.ts` under
 * `src/` ever names.
 *
 *   node scripts/dead-css.mjs                     (defaults to src/styles/app.css)
 *   node scripts/dead-css.mjs src/styles/app.css --prune
 *
 * Written for the Phase 5 port, where every screen took its own stylesheet and left behind the
 * `app.css` block it superseded. Deleting those by eye is how a rule that IS still load-bearing goes
 * with them, so this asks the source instead.
 *
 * The report is deliberately a **lead, not a verdict**. A class assembled at runtime
 * (`\`chip chip--${size}\``) or named only in another stylesheet reads as dead here and is not.
 *
 * `--prune` is therefore narrower than the report: it removes a rule only when **every** selector in
 * its list is one of those unnamed classes, the whole list is class-only (no element, attribute,
 * pseudo-element or bare-`*` selector), and the rule sits at the top level rather than inside an
 * `@media`/`@supports` block. Anything sharing a rule with a live selector, anything scoped by an
 * attribute like `[data-tone]`, and anything inside an at-rule is left for a human. Read the diff.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const prune = argv.includes('--prune');
const sheets = argv.filter((a) => !a.startsWith('--'));
if (sheets.length === 0) sheets.push('src/styles/app.css');

/** Every .tsx/.ts under src/, concatenated. One haystack is faster than a search per class.
 *
 *  Comments are stripped, and that is not tidiness — it is the difference between a usable report and
 *  a useless one. Every superseded block in `app.css` is described in prose somewhere ("the old
 *  `.card-title`…"), so an unstripped haystack reports those classes as live and the report comes back
 *  claiming nothing is dead. Strings and template literals are kept, because that is where a class
 *  name assembled at runtime lives. */
function sources(dir) {
  let out = '';
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out += sources(full);
    else if (/\.tsx?$/.test(entry.name)) {
      out +=
        readFileSync(full, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, ' ')
          .replace(/(^|[^:\w])\/\/[^\n]*/g, '$1 ') + '\n';
    }
  }
  return out;
}

const src = sources(join(root, 'src'));

for (const sheet of sheets) {
  const css = readFileSync(join(root, sheet), 'utf8');

  // Strip comments first: a class named only inside a comment is not a selector.
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

  const classes = new Set();
  for (const m of rules.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) classes.add(m[1]);

  // A hit needs the class as a whole word — `.bar` must not be satisfied by `sidebar`.
  const dead = [...classes]
    .filter((c) => !new RegExp(`(^|[^\\w-])${c.replace(/[-]/g, '\\-')}([^\\w-]|$)`).test(src))
    .sort();

  const bytes = statSync(join(root, sheet)).size;
  console.log(`\n${sheet} — ${bytes} bytes, ${classes.size} class selectors`);
  console.log(`  never named in src/**/*.tsx|ts: ${dead.length}`);
  if (dead.length) console.log('  ' + dead.join(' '));

  if (!prune || dead.length === 0) continue;

  const deadSet = new Set(dead);
  /** A selector list is prunable only if every part is a bare chain of unnamed classes. */
  const prunable = (selectorList) =>
    selectorList.split(',').every((sel) => {
      const s = sel.trim();
      if (!s.startsWith('.')) return false;
      // Reject anything beyond `.a`, `.a.b`, `.a .b`, `.a > .b` — no [attr], :pseudo, element, *.
      if (/[^.\w\s>+~-]/.test(s)) return false;
      const parts = s.match(/\.[\w-]+/g) ?? [];
      return parts.length > 0 && parts.every((p) => deadSet.has(p.slice(1)));
    });

  // Walk the top level only, tracking brace depth so at-rule bodies are skipped wholesale.
  let out = '';
  let i = 0;
  let removed = 0;
  const text = readFileSync(join(root, sheet), 'utf8');
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open === -1) {
      out += text.slice(i);
      break;
    }
    const head = text.slice(i, open);
    // Find the matching close brace, so a nested at-rule body is consumed as one unit.
    let depth = 0;
    let close = open;
    for (; close < text.length; close++) {
      if (text[close] === '{') depth++;
      else if (text[close] === '}' && --depth === 0) break;
    }
    const block = text.slice(i, close + 1);
    // The selector is whatever follows the last comment or `}` in the head.
    const selector = head.replace(/\/\*[\s\S]*?\*\//g, '§').split('§').pop().trim();
    if (!selector.startsWith('@') && prunable(selector)) {
      removed++;
      /* Everything before the selector is kept — except a comment sitting immediately above it with
         no blank line between, which documents the rule being removed and would otherwise be left
         describing nothing. Cutting at the selector rather than dropping the whole head is the
         difference between a clean removal and leaving an orphaned selector to merge into the next
         rule's list, which is silent and wrong. */
      let before = head.slice(0, head.lastIndexOf(selector));
      before = before.replace(/\/\*[\s\S]*?\*\/[^\S\n]*\n?$/, '');
      out += before.replace(/[^\S\n]*$/, '');
    } else {
      out += block;
    }
    i = close + 1;
  }
  // Collapse the runs of blank lines the deletions leave behind.
  out = out.replace(/\n{3,}/g, '\n\n');
  writeFileSync(join(root, sheet), out, 'utf8');
  console.log(`  pruned ${removed} rule(s) → ${out.length} bytes. READ THE DIFF.`);
}

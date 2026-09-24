// Translate a Postgres websearch_to_tsquery-style query (what community-public
// passed to .textSearch('search_vector', q, { type: 'websearch' })) into an
// FTS5 MATCH expression. Supported, matching websearch semantics:
//   - bare words are AND-ed              (FTS5 needs an explicit AND between tokens)
//   - "quoted phrases" match adjacency
//   - -word / -"phrase" negate           (rendered as a binary NOT after positives)
//   - the bare connector `or` (any case) becomes OR
// Ranking isn't used downstream (the list orders by `sort`, not relevance), so this
// targets the same result *set*, not identical scoring. Returns null for an empty query.

interface Term {
  text: string;
  negated: boolean;
}
type Item = Term | { or: true };

function tokenize(input: string): Item[] {
  const items: Item[] = [];
  const re = /(-?)"([^"]*)"|(-?)(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    const negated = (match[1] || match[3]) === '-';
    const raw = (match[2] ?? match[4] ?? '').trim();
    if (!raw) continue;
    if (!negated && raw.toLowerCase() === 'or') {
      items.push({ or: true });
      continue;
    }
    // Strip characters FTS5 treats syntactically; a quoted token is then literal.
    const clean = raw.replace(/["()*:^]/g, ' ').trim();
    if (clean) items.push({ text: clean, negated });
  }
  return items;
}

export function websearchToFts5(input: string): string | null {
  const items = tokenize(input);
  if (items.length === 0) return null;

  // Split into OR-separated groups; within a group AND positives and NOT negatives.
  const groups: Term[][] = [[]];
  for (const item of items) {
    if ('or' in item) groups.push([]);
    else groups[groups.length - 1].push(item);
  }

  const rendered = groups
    .map((group) => {
      const positives = group.filter((t) => !t.negated).map((t) => `"${t.text}"`);
      const negatives = group.filter((t) => t.negated).map((t) => `"${t.text}"`);
      if (positives.length === 0) return null; // FTS5 has no unary NOT; drop pure-negative groups
      let expr = positives.join(' AND ');
      for (const neg of negatives) expr += ` NOT ${neg}`;
      return `(${expr})`;
    })
    .filter((group): group is string => group !== null);

  if (rendered.length === 0) return null;
  return rendered.join(' OR ');
}

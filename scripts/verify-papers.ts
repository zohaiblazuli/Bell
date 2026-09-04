/**
 * End-to-end check of the ShinyPapers catalogue API and the download redirect.
 *
 *   node scripts/run.mjs verify-papers.ts              # catalogue + 6 sampled papers
 *   node scripts/run.mjs verify-papers.ts 12           # sample more
 *   BELL_API_BASE=http://localhost:3000 node scripts/run.mjs verify-papers.ts
 *
 * This replaces the folder-walking version. The app no longer reads a local library, so
 * the thing worth verifying is the contract it now depends on: that the catalogue
 * parses into the shape Rust expects, that its numbers are numbers rather than the
 * strings Postgres `numeric` yields, that unscored papers are present rather than
 * silently dropped, and that a paper id really resolves to PDF bytes.
 *
 * Canvas rendering needs a browser, so a sampled PDF is checked up to the point one
 * can be: it opens, pages resolve, and the viewport has sane dimensions.
 */

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const BASE = (process.env.BELL_API_BASE ?? 'https://shiny-papers.vercel.app').replace(/\/+$/, '');
const SAMPLE = Number(process.argv[2] ?? 6);

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let failures = 0;
function check(ok: boolean, label: string, detail = '') {
  if (ok) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

interface Paper {
  id: number;
  subject_id: number;
  session_id: number;
  component: string;
  a_pct: number | null;
  curve_mean_pct: number | null;
  span_pct: number | null;
  hardness_score: number | null;
  difficulty: string | null;
  difficulty_note: string | null;
  has_ms: boolean;
}

async function main() {
  console.log(`catalogue: ${BASE}/api/desktop/v1/catalog`);

  const res = await fetch(`${BASE}/api/desktop/v1/catalog`, { headers: { 'User-Agent': UA } });
  check(res.ok, `GET catalog -> ${res.status}`);
  if (!res.ok) process.exit(1);

  const etag = res.headers.get('etag');
  check(!!etag, 'ETag present', 'a missing ETag means every launch re-downloads');
  check(
    (res.headers.get('cache-control') ?? '').includes('s-maxage'),
    'Cache-Control carries s-maxage',
  );

  const body = (await res.json()) as {
    version: number;
    generated_at: string;
    subjects: { id: number; code: string; qualification: string }[];
    sessions: { id: number; code: string; season: string }[];
    papers: Paper[];
  };

  check(body.version === 1, `version is 1 (got ${body.version})`);
  check(body.subjects.length > 0, `${body.subjects.length} subjects`);
  check(body.sessions.length > 0, `${body.sessions.length} sessions`);
  check(body.papers.length > 0, `${body.papers.length} papers`);

  // The conditional request is what keeps a launch cheap; if this is not a 304 the
  // ETag is unstable and the cache is doing nothing.
  if (etag) {
    const again = await fetch(`${BASE}/api/desktop/v1/catalog`, {
      headers: { 'User-Agent': UA, 'If-None-Match': etag },
    });
    check(again.status === 304, `If-None-Match -> 304 (got ${again.status})`);
  }

  // Postgres `numeric` comes back from supabase-js as a string. The server coerces it;
  // this is the assertion that keeps it coerced.
  const stringy = body.papers.filter(
    (p) =>
      typeof p.a_pct === 'string' ||
      typeof p.curve_mean_pct === 'string' ||
      typeof p.span_pct === 'string',
  );
  check(stringy.length === 0, 'percentages are numbers, not strings', `${stringy.length} stringy`);

  // Unscored papers must be listed with a null rating rather than dropped — every
  // query helper on the website filters them out, so this is easy to regress.
  const unscored = body.papers.filter((p) => p.difficulty === null);
  console.log(`  note ${unscored.length} paper(s) have no rating yet (expected: they are listed)`);
  check(
    body.papers.every((p) => (p.difficulty === null) === (p.hardness_score === null)),
    'difficulty and hardness_score agree on being null',
  );
  check(
    body.papers.every((p) => p.difficulty === null || ['easy', 'medium', 'hard'].includes(p.difficulty)),
    'every rating is easy|medium|hard',
  );

  const subjectIds = new Set(body.subjects.map((s) => s.id));
  const sessionIds = new Set(body.sessions.map((s) => s.id));
  check(
    body.papers.every((p) => subjectIds.has(p.subject_id) && sessionIds.has(p.session_id)),
    'every paper references a subject and session in the payload',
  );
  check(
    body.papers.every((p) => /^\d{2}$/.test(p.component)),
    'every component is two digits (the download filename depends on it)',
  );

  await sampleDownloads(body.papers);

  console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

async function sampleDownloads(papers: Paper[]) {
  const step = Math.max(1, Math.floor(papers.length / SAMPLE));
  const picks = Array.from({ length: SAMPLE }, (_, i) => papers[i * step]).filter(Boolean);
  console.log(`\nsampling ${picks.length} download(s):`);

  let opened = false;
  for (const paper of picks) {
    const url = `${BASE}/api/desktop/v1/file/${paper.id}/qp`;
    const head = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'manual' });
    const location = head.headers.get('location') ?? '';
    check(head.status === 302, `paper ${paper.id} -> 302`, `got ${head.status}`);
    check(location.startsWith('https://'), `paper ${paper.id} redirects to an https URL`);

    const full = await fetch(url, { headers: { 'User-Agent': UA } });
    const bytes = new Uint8Array(await full.arrayBuffer());
    const magic = new TextDecoder().decode(bytes.slice(0, 5));
    check(magic === '%PDF-', `paper ${paper.id} is a PDF`, `first bytes were ${JSON.stringify(magic)}`);

    // One document is opened properly; doing all of them would just be slow.
    if (!opened && magic === '%PDF-') {
      opened = true;
      const doc = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
      const page = await doc.getPage(1);
      const view = page.getViewport({ scale: 1 });
      check(doc.numPages > 0, `paper ${paper.id} has ${doc.numPages} page(s)`);
      check(view.width > 100 && view.height > 100, `paper ${paper.id} page 1 has sane dimensions`);
      // The legacy build exposes cleanup as `cleanup()`, not `destroy()`.
      await doc.cleanup();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

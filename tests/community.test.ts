import assert from 'node:assert/strict';
import test from 'node:test';
import {
  emptyCommunityFilters,
  filterCommunityResources,
  formatResourceBytes,
  formatTransferEta,
  formatTransferSpeed,
  getTransferPercent,
  mfaQrImageSource,
  resourceInkKey,
  type CommunityResource,
} from '../src/lib/community';

const resource = (overrides: Partial<CommunityResource> = {}): CommunityResource => ({
  id: 'resource-1',
  title: 'Mechanics revision notes',
  description: 'For forces and moments',
  qualification: 'a_level',
  level: 'A Level',
  subjectCode: '9702',
  subjectName: 'Physics',
  resourceType: 'notes',
  authorName: 'A. Student',
  uploaderName: 'Bell Admin',
  contributorCredit: null,
  sourceUrl: null,
  rightsConfirmed: true,
  pageCount: 18,
  sizeBytes: 2_000_000,
  sha256: 'abcdef0123456789abcdef0123456789',
  version: 1,
  upvotes: 4,
  downloads: 2,
  opens: 8,
  popularityScore: 20,
  publishedAt: '2026-09-07T00:00:00Z',
  createdAt: '2026-09-06T00:00:00Z',
  updatedAt: '2026-09-07T00:00:00Z',
  status: 'published',
  scanStatus: 'passed',
  hasVoted: false,
  localPath: null,
  ...overrides,
});

test('community search requires every term across metadata', () => {
  const filters = { ...emptyCommunityFilters(), query: 'physics moments' };
  assert.equal(filterCommunityResources([resource()], filters).length, 1);
  assert.equal(filterCommunityResources([resource()], { ...filters, query: 'physics organic' }).length, 0);
});

test('community filters never expose unpublished resources', () => {
  const rows = [resource(), resource({ id: 'draft', status: 'ready_for_review' })];
  assert.deepEqual(filterCommunityResources(rows, emptyCommunityFilters()).map((row) => row.id), [
    'resource-1',
  ]);
});

test('community filters combine qualification, subject and type', () => {
  const rows = [
    resource(),
    resource({ id: 'maths', subjectCode: '9709', subjectName: 'Mathematics' }),
    resource({ id: 'igcse', qualification: 'igcse', level: 'IGCSE' }),
  ];
  const filters = {
    ...emptyCommunityFilters(),
    qualification: 'a_level' as const,
    subjectCode: '9702',
    resourceType: 'notes' as const,
  };
  assert.deepEqual(filterCommunityResources(rows, filters).map((row) => row.id), ['resource-1']);
});

test('popularity and upvote sorts are deterministic', () => {
  const rows = [
    resource({ id: 'a', title: 'Alpha', popularityScore: 2, upvotes: 20 }),
    resource({ id: 'b', title: 'Beta', popularityScore: 10, upvotes: 3 }),
  ];
  assert.deepEqual(filterCommunityResources(rows, emptyCommunityFilters()).map((row) => row.id), ['b', 'a']);
  assert.deepEqual(
    filterCommunityResources(rows, { ...emptyCommunityFilters(), sort: 'upvoted' }).map((row) => row.id),
    ['a', 'b'],
  );
});

test('resource formatting and annotation key remain version-safe', () => {
  assert.equal(formatResourceBytes(2_000_000), '1.9 MB');
  assert.equal(resourceInkKey(resource()), 'community/resource-1/abcdef0123456789');
  assert.equal(resourceInkKey(resource({ sha256: null, version: 3 })), 'community/resource-1/v3');
});

test('authenticator QR payloads become safe renderable image sources', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
  const expected = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const xmlSvg = `<?xml version="1.0" encoding="UTF-8"?>${svg}`;
  assert.equal(mfaQrImageSource(svg), expected);
  assert.equal(mfaQrImageSource(`data:image/svg+xml;utf-8,${svg}`), expected);
  assert.equal(mfaQrImageSource(`data:image/svg+xml,${encodeURIComponent(svg)}`), expected);
  assert.equal(
    mfaQrImageSource(xmlSvg),
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xmlSvg)}`,
  );
  assert.equal(mfaQrImageSource('https://example.com/qr.svg'), null);
  assert.equal(mfaQrImageSource(null), null);
});

test('community update input accepts uploaderName for editing', () => {
  const updateInput = {
    title: 'Updated Textbook',
    uploaderName: 'Jane Doe',
    authorName: 'Lawrie Ryan',
  };
  assert.equal(updateInput.uploaderName, 'Jane Doe');
});

test('getTransferPercent safely clamps and avoids billion percent overflow', () => {
  // When total is 0 or missing, returns null so indeterminate progress is rendered
  assert.equal(getTransferPercent(25_000_000, 0), null);
  assert.equal(getTransferPercent(25_000_000, -1), null);
  assert.equal(getTransferPercent(0, 0), null);

  // Normal calculation
  assert.equal(getTransferPercent(10_000, 100_000), 10);
  assert.equal(getTransferPercent(50_000, 100_000), 50);

  // Clamped bounds: never exceeds 100% and never below 0%
  assert.equal(getTransferPercent(150_000, 100_000), 100);
  assert.equal(getTransferPercent(-10, 100_000), 0);
});

test('formatTransferSpeed formats MB/s and KB/s with safe empty fallbacks', () => {
  assert.equal(formatTransferSpeed(2_500_000), '2.4 MB/s');
  assert.equal(formatTransferSpeed(1_048_576), '1.0 MB/s');
  assert.equal(formatTransferSpeed(350_000), '342 KB/s');
  assert.equal(formatTransferSpeed(0), '');
  assert.equal(formatTransferSpeed(-100), '');
  assert.equal(formatTransferSpeed(undefined), '');
});

test('formatTransferEta formats human readable remaining time', () => {
  assert.equal(formatTransferEta(12), '~12s left');
  assert.equal(formatTransferEta(59), '~59s left');
  assert.equal(formatTransferEta(75), '~1m 15s left');
  assert.equal(formatTransferEta(120), '~2m left');
  assert.equal(formatTransferEta(0), '');
  assert.equal(formatTransferEta(-5), '');
  assert.equal(formatTransferEta(null), '');
});



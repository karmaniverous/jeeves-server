/**
 * #269: author-written `/api/raw/` anchors in deep-shared documents get the
 * same deep-share auth as embedded images; plain relative links to
 * non-Markdown files are not turned into raw links.
 *
 * @packageDocumentation
 */

import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';

import { verifyKey } from '../auth/keys.js';
import { INSIDER_SEED, makeRuntimeConfig } from '../testing/authFixture.js';
import {
  authenticateRawUrl,
  encodeStack,
  rewriteLinksForDeepShare,
} from './deepShareLinks.js';

const config = makeRuntimeConfig();
const DOC = '/r/docs/a.md';

/** Rewrite one anchor in a deep-shared page and return its href. */
function rewriteHref(href: string, depth: number, stack: string[]): string {
  const html = rewriteLinksForDeepShare(
    `<p><a href="${href}">x</a></p>`,
    INSIDER_SEED,
    stack[stack.length - 1] ?? DOC,
    depth,
    false,
    encodeStack(stack),
    '4102444800000',
  );
  return cheerio.load(html, null, false)('a').attr('href') ?? '';
}

/** Verify the auth query of a rewritten raw URL for its content path. */
function verifies(rawUrl: string, contentPath: string): boolean {
  const url = new URL(rawUrl, 'http://h');
  const q = url.searchParams;
  return verifyKey(
    config.resolvedKeys,
    contentPath,
    q.get('k') ?? undefined,
    q.get('exp') ?? undefined,
    config.resolvedInsiders,
    { d: q.get('d') ?? '', dirs: q.get('dirs') ?? '0', s: q.get('s') ?? '' },
  ).valid;
}

describe('raw anchors in deep shares (#269)', () => {
  it('authenticates an /api/raw/ anchor with k and the deep params', () => {
    const href = rewriteHref('/api/raw/r/docs/report.pdf', 1, [DOC]);
    const q = new URL(href, 'http://h').searchParams;
    expect(href.startsWith('/api/raw/r/docs/report.pdf?')).toBe(true);
    expect(q.get('k')).toMatch(/^[0-9a-f]{32}$/);
    expect(q.get('d')).toBe('1');
    expect(q.get('dirs')).toBe('0');
    expect(q.get('exp')).toBe('4102444800000');
    expect(verifies(href, '/r/docs/report.pdf')).toBe(true);
  });

  it('signs the decoded path of a percent-encoded raw link', () => {
    const href = rewriteHref('/api/raw/r/docs/my%20file.pdf', 1, [DOC]);
    expect(verifies(href, '/r/docs/my file.pdf')).toBe(true);
  });

  it('keeps a fragment after the auth query', () => {
    const href = rewriteHref('/api/raw/r/docs/a.pdf#page=2', 1, [DOC]);
    expect(href.endsWith('#page=2')).toBe(true);
    expect(verifies(href, '/r/docs/a.pdf')).toBe(true);
  });

  it('strips the raw link once depth is exhausted', () => {
    const html = rewriteLinksForDeepShare(
      '<p><a href="/api/raw/r/docs/report.pdf">report</a></p>',
      INSIDER_SEED,
      DOC,
      0,
      false,
      encodeStack([DOC]),
      undefined,
    );
    expect(html).not.toContain('<a');
    expect(html).toContain('report');
  });

  it('does not turn a plain relative non-Markdown link into a raw link', () => {
    const href = rewriteHref('report.pdf', 1, [DOC]);
    expect(href.startsWith('/browse/r/docs/report.pdf?')).toBe(true);
    expect(href).not.toContain('/api/raw/');
  });

  it('uses a simple path key without deep params', () => {
    const url = authenticateRawUrl('/api/raw/r/i.png', INSIDER_SEED);
    expect(verifies(url.replace(/&d=.*$/, ''), '/r/i.png')).toBe(false);
    const q = new URL(url, 'http://h').searchParams;
    expect([...q.keys()]).toEqual(['k']);
    expect(
      verifyKey(
        config.resolvedKeys,
        '/r/i.png',
        q.get('k') ?? undefined,
        undefined,
        config.resolvedInsiders,
      ).valid,
    ).toBe(true);
  });
});

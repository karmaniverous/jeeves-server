import { describe, expect, it } from 'vitest';

import { parseMarkdown } from './markdown.js';

describe('parseMarkdown', () => {
  it('decodes HTML entities in heading text for TOC', () => {
    const md = '# Hello &amp; "World"';
    const { headings } = parseMarkdown(md);
    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe('Hello & "World"');
  });

  it('strips HTML tags from heading text for TOC', () => {
    const md = '## A <em>bold</em> heading';
    const { headings } = parseMarkdown(md);
    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe('A bold heading');
  });

  it('decodes &#39; and &quot; entities in headings', () => {
    const md = "### It&#39;s a &quot;test&quot;";
    const { headings } = parseMarkdown(md);
    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe('It\'s a "test"');
  });
});

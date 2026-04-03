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
    const md = '### It&#39;s a &quot;test&quot;';
    const { headings } = parseMarkdown(md);
    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe('It\'s a "test"');
  });
});

describe('collapsible frontmatter', () => {
  function makeFrontmatter(lineCount: number): string {
    const lines = Array.from(
      { length: lineCount },
      (_, i) => `key${String(i)}: value${String(i)}`,
    );
    return `---\n${lines.join('\n')}\n---\n# Body`;
  }

  it('collapses frontmatter with >10 lines', () => {
    const md = makeFrontmatter(15);
    const { html } = parseMarkdown(md);
    expect(html).toContain('frontmatter-collapsible');
    expect(html).toContain('frontmatter-toggle');
    expect(html).toContain('Show all (15 lines)');
  });

  it('does not collapse frontmatter with ≤10 lines', () => {
    const md = makeFrontmatter(8);
    const { html } = parseMarkdown(md);
    expect(html).toContain('frontmatter-block');
    expect(html).not.toContain('frontmatter-collapsible');
    expect(html).not.toContain('frontmatter-toggle');
  });

  it('preview section contains only the first 10 lines', () => {
    const md = makeFrontmatter(20);
    const { html } = parseMarkdown(md);
    const previewMatch = html.match(
      /frontmatter-preview.*?<code[^>]*>([\s\S]*?)<\/code>/,
    );
    expect(previewMatch).not.toBeNull();
    const previewContent = previewMatch![1];
    const previewLines = previewContent.split('\n');
    expect(previewLines).toHaveLength(10);
    expect(previewLines[0]).toContain('key0');
    expect(previewLines[9]).toContain('key9');
  });

  it('does NOT collapse frontmatter with exactly 10 lines', () => {
    const md = makeFrontmatter(10);
    const { html } = parseMarkdown(md);
    expect(html).toContain('frontmatter-block');
    expect(html).not.toContain('frontmatter-collapsible');
  });

  it('collapses frontmatter with exactly 11 lines', () => {
    const md = makeFrontmatter(11);
    const { html } = parseMarkdown(md);
    expect(html).toContain('frontmatter-collapsible');
    expect(html).toContain('Show all (11 lines)');
  });
});

/**
 * Tests for front matter in rendered Markdown: the `jeeves` namespace is
 * not shown, non-mapping `jeeves` and invalid YAML are shown raw, an empty
 * remainder shows no block, and block source lines still count the
 * original text.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import { parseMarkdown } from './markdown.js';

/** The YAML shown in the front matter block, or null without one. */
function shownYaml(html: string): string | null {
  const match =
    /frontmatter-block"><pre><code class="language-yaml">([\s\S]*?)<\/code>/.exec(
      html,
    );
  return match ? match[1] : null;
}

const BODY = '# Heading\n\nText\n';

describe('parseMarkdown front matter', () => {
  it('hides a jeeves mapping and keeps the rest', () => {
    const { html } = parseMarkdown(
      `---\ntitle: T # c\njeeves:\n  print: bca-brief\nz: 1\n---\n${BODY}`,
    );
    expect(shownYaml(html)).toBe('title: T # c\nz: 1');
    expect(html).not.toContain('bca-brief');
  });

  it('keeps source lines of the original text when jeeves is hidden', () => {
    const { html } = parseMarkdown(
      `---\ntitle: T\njeeves:\n  print: x\n---\n${BODY}`,
    );
    // 5 front matter lines: the heading is line 6 and the text line 8.
    expect(html).toMatch(/<h1[^>]*data-source-start="6"/);
    expect(html).toMatch(/<p data-source-start="8"/);
  });

  it('renders no block when only jeeves was there', () => {
    const { html } = parseMarkdown(`---\njeeves:\n  print: x\n---\n${BODY}`);
    expect(html).not.toContain('frontmatter-block');
    expect(html).toMatch(/<h1[^>]*data-source-start="5"/);
  });

  it('shows a non-mapping jeeves', () => {
    const { html } = parseMarkdown(`---\njeeves: brief\n---\n${BODY}`);
    expect(shownYaml(html)).toBe('jeeves: brief');
  });

  it('shows invalid YAML raw and escaped', () => {
    const raw = 'a: [<b>\njeeves:\n  print: x';
    const { html } = parseMarkdown(`---\n${raw}\n---\n${BODY}`);
    expect(shownYaml(html)).toBe('a: [&lt;b&gt;\njeeves:\n  print: x');
  });
});

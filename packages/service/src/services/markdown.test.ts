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

  it('generates correct slug for headings', () => {
    const md = '## Hello World!';
    const { headings } = parseMarkdown(md);
    expect(headings[0].slug).toBe('hello-world');
  });

  it('renders heading anchors with # link', () => {
    const md = '## My Heading';
    const { html } = parseMarkdown(md);
    expect(html).toContain('id="my-heading"');
    expect(html).toContain('href="#my-heading"');
    expect(html).toContain('class="anchor"');
    expect(html).toContain('#</a>');
  });

  it('deduplicates heading slugs', () => {
    const md = '## Foo\n\n## Foo\n\n## Foo';
    const { headings } = parseMarkdown(md);
    expect(headings[0].slug).toBe('foo');
    expect(headings[1].slug).toBe('foo-1');
    expect(headings[2].slug).toBe('foo-2');
  });
});

describe('parseMarkdown edge cases', () => {
  it('empty markdown input returns empty html and empty headings array', () => {
    const { html, headings } = parseMarkdown('');
    expect(html).toBe('');
    expect(headings).toEqual([]);
  });

  it('input with no frontmatter: no frontmatter block in output', () => {
    const md = '# Just a heading\n\nSome text.';
    const { html } = parseMarkdown(md);
    expect(html).not.toContain('frontmatter-block');
    expect(html).toContain('Just a heading');
  });

  it('CRLF frontmatter still works correctly', () => {
    const md = '---\r\ntitle: Hello\r\nauthor: Test\r\n---\r\n# Body';
    const { html, headings } = parseMarkdown(md);
    expect(html).toContain('frontmatter-block');
    expect(html).toContain('title: Hello');
    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe('Body');
  });
});

describe('GFM task-list checkbox indexing', () => {
  it('assigns sequential data-checkbox-index to checkboxes', () => {
    const md = '- [ ] first\n- [x] second\n- [ ] third';
    const { html } = parseMarkdown(md);
    expect(html).toContain('data-checkbox-index="0"');
    expect(html).toContain('data-checkbox-index="1"');
    expect(html).toContain('data-checkbox-index="2"');
  });

  it('indexes both checked and unchecked checkboxes', () => {
    const md = '- [x] done\n- [ ] todo';
    const { html } = parseMarkdown(md);
    // Checked checkbox has data-checkbox-index="0"
    expect(html).toMatch(/input[^>]*checked[^>]*data-checkbox-index="0"/);
    // Unchecked checkbox has data-checkbox-index="1"
    expect(html).toMatch(
      /input[^>]*type="checkbox"[^>]*data-checkbox-index="1"/,
    );
  });

  it('does not add index to non-checkbox inputs', () => {
    const md = '# Heading\n\nSome text\n\n- regular list item';
    const { html } = parseMarkdown(md);
    expect(html).not.toContain('data-checkbox-index');
  });

  it('handles empty task list', () => {
    const md = '# No tasks here';
    const { html } = parseMarkdown(md);
    expect(html).not.toContain('data-checkbox-index');
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

describe('source mapping', () => {
  it('adds data-source-start and data-source-end to block elements', () => {
    const md = '# Title\n\nA paragraph.';
    const { html } = parseMarkdown(md);
    // Heading at line 1
    expect(html).toMatch(/h1[^>]*data-source-start="1"/);
    expect(html).toMatch(/h1[^>]*data-source-end="1"/);
    // Paragraph at line 3
    expect(html).toMatch(/p[^>]*data-source-start="3"/);
    expect(html).toMatch(/p[^>]*data-source-end="3"/);
  });

  it('adjusts source mapping for frontmatter offset', () => {
    const md = '---\nkey: val\n---\n# Title\n\nA paragraph.';
    const { html } = parseMarkdown(md);
    // Frontmatter is 3 lines (---, key: val, ---\n).
    // frontmatterLineCount = match[0].split('\n').length - 1 = 3
    // Title: token.map[0]=0, start = 0+1+3 = 4
    expect(html).toMatch(/h1[^>]*data-source-start="4"/);
    expect(html).toMatch(/h1[^>]*data-source-end="4"/);
    // Paragraph: token.map[0]=2, start = 2+1+3 = 6
    expect(html).toMatch(/p[^>]*data-source-start="6"/);
    expect(html).toMatch(/p[^>]*data-source-end="6"/);
  });

  it('maps nested blocks (blockquote > paragraph)', () => {
    const md = '> A quoted\n> paragraph';
    const { html } = parseMarkdown(md);
    // Blockquote wraps lines 1-2
    expect(html).toMatch(/blockquote[^>]*data-source-start="1"/);
    expect(html).toMatch(/blockquote[^>]*data-source-end="2"/);
    // Paragraph inside blockquote also gets source mapping
    expect(html).toMatch(/p[^>]*data-source-start="1"/);
    expect(html).toMatch(/p[^>]*data-source-end="2"/);
  });

  it('maps list items with inner paragraphs', () => {
    const md = '- Item one\n- Item two';
    const { html } = parseMarkdown(md);
    // Whole list spans lines 1-2
    expect(html).toMatch(/ul[^>]*data-source-start="1"/);
    expect(html).toMatch(/ul[^>]*data-source-end="2"/);
    // Individual list items
    expect(html).toMatch(/li[^>]*data-source-start="1"/);
    expect(html).toMatch(/li[^>]*data-source-end="1"/);
  });

  it('maps fenced code blocks', () => {
    const md = '```js\nconsole.log("hi");\n```';
    const { html } = parseMarkdown(md);
    expect(html).toMatch(/pre[^>]*data-source-start="1"/);
    expect(html).toMatch(/pre[^>]*data-source-end="3"/);
  });

  it('maps diagram placeholders with source attributes', () => {
    const md = '```mermaid\ngraph TD;\nA-->B;\n```';
    const { html } = parseMarkdown(md);
    expect(html).toMatch(/div[^>]*data-source-start="1"/);
    expect(html).toMatch(/div[^>]*data-source-end="4"/);
    expect(html).toContain('embedded-diagram-lazy');
  });

  it('maps tables', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const { html } = parseMarkdown(md);
    expect(html).toMatch(/table[^>]*data-source-start="1"/);
    expect(html).toMatch(/table[^>]*data-source-end="3"/);
  });

  it('maps hr elements', () => {
    const md = 'Above\n\n---\n\nBelow';
    const { html } = parseMarkdown(md);
    expect(html).toMatch(/hr[^>]*data-source-start="3"/);
    expect(html).toMatch(/hr[^>]*data-source-end="3"/);
  });
});

describe('code blocks', () => {
  it('renders fenced code with language class', () => {
    const md = '```python\nprint("hello")\n```';
    const { html } = parseMarkdown(md);
    expect(html).toContain('class="language-python"');
    expect(html).toContain('print("hello")');
  });

  it('escapes HTML in code blocks', () => {
    const md = '```\n<script>alert("xss")</script>\n```';
    const { html } = parseMarkdown(md);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('renders mermaid blocks as diagram placeholders', () => {
    const md = '```mermaid\ngraph TD;\n```';
    const { html } = parseMarkdown(md);
    expect(html).toContain('embedded-diagram-lazy');
    expect(html).toContain('data-diagram-type="mermaid"');
  });

  it('renders plantuml blocks as diagram placeholders', () => {
    const md = '```plantuml\n@startuml\nAlice -> Bob\n@enduml\n```';
    const { html } = parseMarkdown(md);
    expect(html).toContain('embedded-diagram-lazy');
    expect(html).toContain('data-diagram-type="plantuml"');
  });

  it('renders puml blocks as diagram placeholders', () => {
    const md = '```puml\n@startuml\nAlice -> Bob\n@enduml\n```';
    const { html } = parseMarkdown(md);
    expect(html).toContain('embedded-diagram-lazy');
    expect(html).toContain('data-diagram-type="plantuml"');
  });
});

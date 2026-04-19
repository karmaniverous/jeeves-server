/** Map block element tag to a file extension for CodeMirror language detection. */
export function blockLanguage(el: Element): string {
  const tag = el.tagName.toLowerCase();

  // Code blocks: <pre><code class="language-X">
  if (tag === 'pre') {
    const code = el.querySelector('code[class*="language-"]');
    if (code) {
      const cls = Array.from(code.classList).find((c) => c.startsWith('language-'));
      if (cls) return cls.replace('language-', '');
    }
    return 'md';
  }

  // Diagrams
  if (el.classList.contains('embedded-diagram-lazy')) {
    return 'txt';
  }

  // Everything else (p, h1-h6, li, blockquote, table, tr, hr, ul, ol) → markdown
  return 'md';
}

/** Block type label for the hover indicator. */
export function blockLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case 'p': return 'paragraph';
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': return 'heading';
    case 'li': return 'list item';
    case 'blockquote': return 'blockquote';
    case 'table': return 'table';
    case 'tr': return 'row';
    case 'td': case 'th': return 'cell';
    case 'pre': {
      const code = el.querySelector('code[class*="language-"]');
      if (code) {
        const cls = Array.from(code.classList).find((c) => c.startsWith('language-'));
        if (cls) return `code block (${cls.replace('language-', '')})`;
      }
      return 'code block';
    }
    case 'hr': return 'hr';
    case 'ul': case 'ol': return 'list';
    default:
      if (el.classList.contains('embedded-diagram-lazy')) return 'diagram';
      if (el.classList.contains('embedded-diagram-panzoom')) return 'diagram';
      return tag;
  }
}

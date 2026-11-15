/**
 * The HTML of a document's displayed front matter: a YAML code block,
 * collapsible when it is long.
 *
 * @packageDocumentation
 */

/** Lines shown before a long block collapses. */
const COLLAPSE_THRESHOLD = 10;

/** Escape text for an HTML code block. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Render displayed front matter as HTML.
 *
 * @param yaml - The YAML to show; `null` or empty renders nothing.
 * @returns The block's HTML (with a trailing newline), or `''`.
 */
export function frontMatterBlock(yaml: string | null): string {
  if (!yaml) return '';
  const escaped = escapeHtml(yaml);
  const lines = yaml.split('\n');

  if (lines.length <= COLLAPSE_THRESHOLD)
    return `<div class="frontmatter-block"><pre><code class="language-yaml">${escaped}</code></pre></div>\n`;

  const preview = escapeHtml(lines.slice(0, COLLAPSE_THRESHOLD).join('\n'));
  const label = `Show all (${String(lines.length)} lines)`;
  return (
    `<div class="frontmatter-block frontmatter-collapsible">` +
    `<div class="frontmatter-preview"><pre><code class="language-yaml">${preview}</code></pre></div>` +
    `<div class="frontmatter-full"><pre><code class="language-yaml">${escaped}</code></pre></div>` +
    `<button class="frontmatter-toggle" onclick="this.parentElement.classList.toggle('frontmatter-expanded'); ` +
    `this.textContent = this.parentElement.classList.contains('frontmatter-expanded') ` +
    `? 'Show less' : '${label}'">${label}</button>` +
    `</div>\n`
  );
}

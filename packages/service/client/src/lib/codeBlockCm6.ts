/**
 * Replaces server-rendered highlight.js code blocks in markdown with
 * CodeMirror 6 read-only instances for syntax highlighting and code folding.
 * Call after rendering markdown HTML.
 */
import { mountCm6 } from '@/lib/codeBlockMount';

/** Map highlight.js language classes to file extensions for CM6 */
function langClassToExt(className: string): string | null {
  const match = /language-(\w+)/.exec(className);
  if (!match) return null;
  const lang = match[1];
  // Map hljs language names to file extensions
  const map: Record<string, string> = {
    javascript: 'js', typescript: 'ts', python: 'py',
    json: 'json', yaml: 'yaml', yml: 'yaml',
    html: 'html', css: 'css', xml: 'xml',
    java: 'java', rust: 'rs', sql: 'sql', php: 'php',
    cpp: 'cpp', c: 'c', markdown: 'md',
    jsx: 'jsx', tsx: 'tsx', scss: 'scss',
    bash: 'sh', shell: 'sh', sh: 'sh',
    plaintext: '', text: '',
  };
  return map[lang] ?? lang;
}

export function initCodeBlockCm6(container: HTMLElement, theme: 'light' | 'dark' = 'dark'): () => void {
  const cleanups: (() => void)[] = [];
  const pres = container.querySelectorAll('pre');
  const mounts: Promise<void>[] = [];

  for (const pre of pres) {
    const code = pre.querySelector('code');
    if (!code) continue;

    // Skip diagram placeholders
    if (pre.closest('.embedded-diagram-lazy')) continue;
    if (pre.closest('.embedded-diagram-rendered')) continue;

    const ext = langClassToExt(code.className) ?? '';

    const text = code.textContent ?? '';
    if (!text.trim()) continue;

    // Create a wrapper div for the CM6 instance
    const wrapper = document.createElement('div');
    wrapper.className = 'cm6-embedded-code';
    pre.replaceWith(wrapper);

    // Mount CM6 and collect cleanup
    mounts.push(
      mountCm6(wrapper, text, ext, { defaultWrap: false, theme }).then((cleanup) => {
        cleanups.push(cleanup);
      }),
    );
  }

  // Signal completion for Puppeteer export
  void Promise.all(mounts).then(() => {
    container.setAttribute('data-cm6-ready', 'true');
  });

  return () => { for (const fn of cleanups) fn(); };
}

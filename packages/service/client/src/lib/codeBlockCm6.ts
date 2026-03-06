/**
 * Replaces server-rendered highlight.js code blocks in markdown with
 * CodeMirror 6 read-only instances for syntax highlighting and code folding.
 * Call after rendering markdown HTML.
 */
import { getLanguageExtension, loadCodeMirror } from '@/lib/codemirror';

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

    // Load CM6 async and mount
    mounts.push(mountCm6(wrapper, text, ext, theme, cleanups));
  }

  // Signal completion for Puppeteer export
  void Promise.all(mounts).then(() => {
    container.setAttribute('data-cm6-ready', 'true');
  });

  return () => { for (const fn of cleanups) fn(); };
}

async function mountCm6(
  wrapper: HTMLDivElement,
  text: string,
  ext: string,
  theme: 'light' | 'dark',
  cleanups: (() => void)[],
): Promise<void> {
  try {
    const { EditorView, EditorState, basicSetup, oneDark } = await loadCodeMirror();
    const langExt = await getLanguageExtension(ext);

    // Check if wrapper is still in the DOM (component may have unmounted)
    if (!wrapper.isConnected) return;

    const extensions = [
      basicSetup,
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      // Theme must come before custom overrides so our styles win
      ...(theme === 'dark' ? [oneDark] : []),
      EditorView.theme({
        '&': {
          fontSize: '14px',
          borderRadius: '0.5rem',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
        },
        '.cm-scroller': { overflow: 'auto' },
        '.cm-content': {
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          padding: '0.75rem 0',
        },
        '.cm-gutters': {
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          backgroundColor: 'var(--color-muted)',
          borderRight: '1px solid var(--color-border)',
          color: 'var(--color-muted-foreground)',
        },
        '&.cm-editor': {
          backgroundColor: 'var(--color-muted)',
        },
        '.cm-cursor': { display: 'none' },
        '.cm-activeLineGutter': {
          backgroundColor: 'transparent',
        },
        '.cm-activeLine': {
          backgroundColor: 'transparent',
        },
      }),
    ];

    if (langExt) {
      extensions.push(langExt);
    }

    const state = EditorState.create({ doc: text, extensions });
    const view = new EditorView({ state, parent: wrapper });

    cleanups.push(() => view.destroy());
  } catch {
    // If CM6 fails to load, restore the original pre/code
    wrapper.innerHTML = `<pre class="hljs rounded-lg overflow-x-auto text-sm border border-border p-4 bg-muted text-foreground"><code>${escapeHtml(text)}</code></pre>`;
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

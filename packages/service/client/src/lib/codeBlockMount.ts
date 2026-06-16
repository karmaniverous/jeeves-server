/**
 * Shared CodeMirror 6 mount function with unified toolbar.
 * Used by both CodeViewer (React) and codeBlockCm6 (vanilla DOM).
 */
import { Check, Copy, createElement } from 'lucide';

import { getLanguageExtension, loadCodeMirror } from '@/lib/codemirror';

/** File extensions that default to word-wrap ON (plain text, not code). */
const WRAP_DEFAULT_EXTENSIONS = new Set(['txt', 'log', 'csv']);

/** Determine whether a file extension should default to word-wrap ON. */
export function shouldDefaultWrap(ext: string): boolean {
  return ext === '' || WRAP_DEFAULT_EXTENSIONS.has(ext.toLowerCase());
}

interface MountOptions {
  defaultWrap?: boolean;
  theme: 'light' | 'dark';
}

function createIcon(
  iconData: Parameters<typeof createElement>[0],
  size = 14,
): SVGSVGElement {
  return createElement(iconData, {
    width: size,
    height: size,
  }) as unknown as SVGSVGElement;
}

/** Inline SVG for the TextWrap icon (lucide d.ts export not resolvable by tsc -b) */
function createWrapIcon(size = 14): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const d of [
    'm16 16-3 3 3 3',
    'M3 12h14.5a1 1 0 0 1 0 7H13',
    'M3 19h6',
    'M3 5h18',
  ]) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Build the toolbar DOM with wrap-toggle and copy buttons. */
function createToolbar(
  initialWrap: boolean,
  text: string,
): { toolbar: HTMLDivElement; wrapBtn: HTMLButtonElement } {
  const toolbar = document.createElement('div');
  toolbar.className = 'cm6-toolbar';

  const wrapBtn = document.createElement('button');
  wrapBtn.className = initialWrap
    ? 'cm6-toolbar-btn cm6-toolbar-btn-active'
    : 'cm6-toolbar-btn';
  wrapBtn.title = 'Toggle word wrap';
  wrapBtn.appendChild(createWrapIcon());
  toolbar.appendChild(wrapBtn);

  const copyBtn = document.createElement('button');
  copyBtn.className = 'cm6-toolbar-btn';
  copyBtn.title = 'Copy to clipboard';
  copyBtn.appendChild(createIcon(Copy));
  toolbar.appendChild(copyBtn);

  copyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(text).then(() => {
      copyBtn.innerHTML = '';
      const checkIcon = createIcon(Check);
      checkIcon.style.color = '#4ade80';
      copyBtn.appendChild(checkIcon);
      setTimeout(() => {
        copyBtn.innerHTML = '';
        copyBtn.appendChild(createIcon(Copy));
      }, 1500);
    });
  });

  return { toolbar, wrapBtn };
}

/**
 * Mount a CodeMirror 6 read-only editor with a unified toolbar into `container`.
 * The container will have the `cm6-code-wrapper` class added so CSS hover rules apply.
 * Returns a Promise that resolves to a cleanup function that destroys the editor.
 */
export async function mountCm6(
  container: HTMLElement,
  text: string,
  ext: string,
  options: MountOptions,
): Promise<() => void> {
  try {
    const { EditorView, EditorState, Compartment, basicSetup, oneDark } =
      await loadCodeMirror();
    const langExt = await getLanguageExtension(ext);

    // Guard: container may have been removed from the DOM while we were loading
    if (!container.isConnected) return () => undefined;

    // Mark the container so CSS hover rules apply
    container.classList.add('cm6-code-wrapper');

    // ── toolbar ─────────────────────────────────────────────────────────────
    const initialWrap = options.defaultWrap ?? false;
    const { toolbar, wrapBtn } = createToolbar(initialWrap, text);
    let isWrapped = initialWrap;
    container.appendChild(toolbar);

    // ── CodeMirror editor ────────────────────────────────────────────────────
    const wrapCompartment = new Compartment();

    const extensions = [
      basicSetup,
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      wrapCompartment.of(isWrapped ? EditorView.lineWrapping : []),
      // Theme must precede custom overrides so our styles win
      ...(options.theme === 'dark' ? [oneDark] : []),
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
        '.cm-activeLineGutter': { backgroundColor: 'transparent' },
        '.cm-activeLine': { backgroundColor: 'transparent' },
      }),
    ];

    if (langExt) extensions.push(langExt);

    const state = EditorState.create({ doc: text, extensions });
    const view = new EditorView({ state, parent: container });

    // ── toolbar event handlers ───────────────────────────────────────────────
    wrapBtn.addEventListener('click', () => {
      isWrapped = !isWrapped;
      view.dispatch({
        effects: wrapCompartment.reconfigure(
          isWrapped ? EditorView.lineWrapping : [],
        ),
      });
      wrapBtn.classList.toggle('cm6-toolbar-btn-active', isWrapped);
    });

    return () => view.destroy();
  } catch {
    // If CM6 fails to load, show plain pre/code fallback
    container.innerHTML = `<pre class="hljs rounded-lg overflow-x-auto text-sm border border-border p-4 bg-muted text-foreground"><code>${escapeHtml(text)}</code></pre>`;
    return () => undefined;
  }
}

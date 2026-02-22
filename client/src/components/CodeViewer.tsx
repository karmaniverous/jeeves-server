/**
 * Read-only CodeMirror 6 viewer with syntax highlighting and code folding.
 * Replaces highlight.js-based CodeBlock for the raw file view.
 */
import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { getLanguageExtension, loadCodeMirror } from '@/lib/codemirror';
import { useTheme } from '@/lib/theme';

interface CodeViewerProps {
  content: string;
  fileName: string;
}

export function CodeViewer({ content, fileName }: CodeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<import('@codemirror/view').EditorView | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [theme] = useTheme();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    (async () => {
      const { EditorView, EditorState, basicSetup, oneDark } = await loadCodeMirror();
      if (destroyed) return;

      const ext = fileName.split('.').pop() ?? '';
      const langExt = await getLanguageExtension(ext);
      if (destroyed) return;

      const extensions = [
        basicSetup,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.theme({
          '&': { fontSize: '14px' },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-content': {
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          },
          '.cm-gutters': {
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          },
          // Style the cursor as invisible in read-only mode
          '.cm-cursor': { display: 'none' },
        }),
      ];

      if (theme === 'dark') {
        extensions.push(oneDark);
      }

      if (langExt) {
        extensions.push(langExt);
      }

      const state = EditorState.create({
        doc: content,
        extensions,
      });

      const view = new EditorView({
        state,
        parent: containerRef.current!,
      });

      viewRef.current = view;
      setLoading(false);
    })();

    return () => {
      destroyed = true;
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, fileName, theme]);

  return (
    <div className="relative group rounded-lg border border-border overflow-hidden">
      {/* Copy button */}
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={() => void handleCopy()}
          className="p-1.5 rounded bg-accent hover:bg-accent/80 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
          title="Copy to clipboard"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* CodeMirror container */}
      <div ref={containerRef}>
        {loading && (
          <pre className="p-4 text-sm text-muted-foreground bg-muted">
            <code>{content.slice(0, 200)}…</code>
          </pre>
        )}
      </div>
    </div>
  );
}

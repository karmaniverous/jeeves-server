import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

interface CodeBlockProps {
  /** Raw text content (for copy button) */
  content: string;
  /** Server-highlighted HTML (optional) */
  html?: string | null;
  /** Detected language (optional) */
  language?: string | null;
}

export function CodeBlock({ content, html, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
        {language && (
          <span className="text-xs text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
            {language}
          </span>
        )}
        <button
          onClick={() => void handleCopy()}
          className="p-1.5 rounded bg-accent hover:bg-accent/80 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
          title="Copy to clipboard"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      {html ? (
        <pre className="hljs rounded-lg overflow-x-auto text-sm border border-border p-4 bg-muted text-foreground">
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      ) : (
        <pre className="rounded-lg overflow-x-auto text-sm border border-border p-4 bg-muted text-foreground">
          <code>{content}</code>
        </pre>
      )}
    </div>
  );
}

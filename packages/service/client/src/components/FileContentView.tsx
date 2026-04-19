/**
 * Dispatches to the correct viewer based on file type.
 */
import { Loader2 } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef } from 'react';

const CodeEditor = lazy(() => import('@/components/CodeEditor').then(m => ({ default: m.CodeEditor })));
const CodeViewer = lazy(() => import('@/components/CodeViewer').then(m => ({ default: m.CodeViewer })));
import { MermaidViewer } from '@/components/MermaidViewer';
import { PlantUmlViewer } from '@/components/PlantUmlViewer';
import { SvgViewer } from '@/components/SvgViewer';
import { MarkdownView } from '@/components/MarkdownView';
import { scrollToIdInContainer } from '@/components/scrollUtils';
import { isRenderable } from '@/components/renderableUtils';
import { useScrollAnchor } from '@/hooks/useScrollAnchor';
import type { FileContent } from '@/lib/api';

interface FileContentViewProps {
  reqPath: string;
  file: FileContent | null;
  fileRaw: FileContent | null;
  fileRendered: FileContent | null;
  viewTab: 'rendered' | 'raw';
  editing: boolean;
  setEditing: (editing: boolean) => void;
  proseWidth: 'narrow' | 'medium' | 'wide';
  topBarHeight: number;
  mainRef: React.RefObject<HTMLElement | null>;
  mobileTocOpen: boolean;
  setMobileTocOpen: (open: boolean) => void;
  onSave: (content: string) => Promise<void>;
  refetch: () => Promise<void>;
  loading: boolean;
}

export function FileContentView({
  reqPath, file, fileRaw, fileRendered, viewTab,
  editing, setEditing,
  proseWidth, topBarHeight, mainRef,
  mobileTocOpen, setMobileTocOpen,
  onSave, refetch,
}: FileContentViewProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  useScrollAnchor(mainRef, contentRef);
  const renderable = file ? isRenderable(file) : false;
  const activeTab = renderable ? viewTab : 'raw';
  const fileLoading = !file;

  // Scroll to hash on file load
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && file) {
      const timer = setTimeout(() => scrollToIdInContainer(mainRef.current, hash), 100);
      return () => clearTimeout(timer);
    }
  }, [file, mainRef]);

  return (
    <div ref={contentRef} className="px-4 md:px-6 pt-4">
      {/* Loading state */}
      {fileLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      )}

      {/* Raw view */}
      {(fileRaw ?? file)?.content && activeTab === 'raw' && !editing && (
        <Suspense fallback={
          <pre className="rounded-lg overflow-x-auto text-sm border border-border p-4 bg-muted text-foreground">
            <code>{(fileRaw ?? file)!.content!.slice(0, 500)}…</code>
          </pre>
        }>
          <CodeViewer
            content={(fileRaw ?? file)!.content!}
            fileName={(fileRaw ?? file)!.fileName}
          />
        </Suspense>
      )}

      {/* Editor */}
      {editing && (fileRaw ?? file)?.content != null && activeTab === 'raw' && (
        <Suspense fallback={
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading editor…
          </div>
        }>
          <div style={{ height: `calc(100vh - ${topBarHeight + 16}px)` }}>
            <CodeEditor
              content={(fileRaw ?? file)!.content!}
              fileName={(fileRaw ?? file)!.fileName}
              onSave={onSave}
              onCancel={() => setEditing(false)}
            />
          </div>
        </Suspense>
      )}

      {/* Rendering spinner */}
      {!fileRendered && renderable && activeTab === 'rendered' && !fileLoading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Rendering...
        </div>
      )}

      {/* Markdown */}
      {fileRendered?.type === 'markdown' && fileRendered.html && activeTab === 'rendered' && (
        <MarkdownView
          fileRendered={fileRendered}
          fileRaw={fileRaw}
          reqPath={reqPath}
          proseWidth={proseWidth}
          topBarHeight={topBarHeight}
          mainRef={mainRef}
          mobileTocOpen={mobileTocOpen}
          setMobileTocOpen={setMobileTocOpen}
          refetch={refetch}
        />
      )}

      {/* CSV */}
      {fileRendered?.type === 'csv' && fileRendered.html && activeTab === 'rendered' && (
        <div className={`prose prose-sm dark:prose-invert max-w-none ${proseWidth === 'narrow' ? 'max-w-prose mx-auto' : proseWidth === 'medium' ? 'max-w-4xl mx-auto' : ''}`}>
          <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: fileRendered.html }} />
        </div>
      )}

      {/* SVG */}
      {fileRendered?.type === 'svg' && fileRendered.content && activeTab === 'rendered' && (
        <SvgViewer content={fileRendered.content} />
      )}

      {/* Mermaid */}
      {fileRendered?.type === 'mermaid' && activeTab === 'rendered' && (
        <MermaidViewer html={fileRendered.html ?? null} content={fileRendered.content ?? ''} />
      )}

      {/* PlantUML */}
      {fileRendered?.type === 'plantuml' && activeTab === 'rendered' && (
        <PlantUmlViewer html={fileRendered.html ?? null} content={fileRendered.content ?? ''} />
      )}

      {/* Image */}
      {file?.type === 'image' && (
        <div className="flex justify-center p-4">
          <img src={`/api/raw/${reqPath}`} alt={file.fileName} className="max-w-full rounded-lg shadow-md" />
        </div>
      )}

      {/* Binary download */}
      {file?.type === 'binary' && (
        <div className="text-center p-8">
          <p className="text-muted-foreground mb-4">{file.fileName}</p>
          <a
            href={`/api/raw/${reqPath}`}
            download={file.fileName}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Download
          </a>
        </div>
      )}
    </div>
  );
}

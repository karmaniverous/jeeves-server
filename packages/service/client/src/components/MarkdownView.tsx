/**
 * Markdown rendered view with collapsible TOC sidebar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Undo2, Redo2 } from 'lucide-react';

import { BlockHoverControls } from '@/components/BlockHoverControls';
import { initEmbeddedDiagramPanzoom } from '@/components/EmbeddedDiagramPanzoom';
import { initLazyDiagrams } from '@/components/LazyDiagram';
import { initInlineSvgPanzoom } from '@/components/InlineSvgPanzoom';
import { TocSection } from '@/components/TocSection';
import { buildTocTree, findAncestorSlugs } from '@/components/tocUtils';
import type { FileContent } from '@/lib/api';
import { fileMutate, saveFile } from '@/lib/api';
import { useUndo } from '@/lib/useUndo';
import { initCodeBlockCm6 } from '@/lib/codeBlockCm6';
import { injectCopyButtons } from '@/lib/codeBlockCopy';
import { useTheme } from '@/lib/theme';
import { scrollToIdInContainer } from './scrollUtils';

interface MarkdownViewProps {
  fileRendered: FileContent;
  fileRaw: FileContent | null;
  reqPath: string;
  proseWidth: 'narrow' | 'medium' | 'wide';
  topBarHeight: number;
  mainRef: React.RefObject<HTMLElement | null>;
  mobileTocOpen: boolean;
  setMobileTocOpen: (open: boolean) => void;
  refetch: () => Promise<void>;
}

export function MarkdownView({
  fileRendered, fileRaw, reqPath, proseWidth, topBarHeight, mainRef,
  mobileTocOpen, setMobileTocOpen, refetch,
}: MarkdownViewProps) {
  const [theme] = useTheme();
  const plainCode = new URLSearchParams(window.location.search).has('plain_code');
  const hasHeadings = fileRendered.headings && fileRendered.headings.length > 2;
  const articleRef = useRef<HTMLElement | null>(null);

  const isInsider = fileRendered.isInsider;
  const { undo, redo, canUndo, canRedo } = useUndo();
  const [undoSaving, setUndoSaving] = useState(false);
  const [, forceRender] = useState(0);

  const currentContent = (fileRaw ?? fileRendered).content ?? '';

  const handleUndo = useCallback(async () => {
    const restored = undo(reqPath, currentContent);
    if (!restored) return;
    setUndoSaving(true);
    try {
      await saveFile(reqPath, restored);
      await refetch();
    } finally {
      setUndoSaving(false);
      forceRender((n) => n + 1);
    }
  }, [reqPath, currentContent, undo, refetch]);

  const handleRedo = useCallback(async () => {
    const restored = redo(reqPath, currentContent);
    if (!restored) return;
    setUndoSaving(true);
    try {
      await saveFile(reqPath, restored);
      await refetch();
    } finally {
      setUndoSaving(false);
      forceRender((n) => n + 1);
    }
  }, [reqPath, currentContent, redo, refetch]);

  // Build TOC tree and collapse state
  const tocTree = useMemo(
    () => (hasHeadings ? buildTocTree(fileRendered.headings!) : []),
    [fileRendered.headings, hasHeadings],
  );

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const toggleCollapse = useCallback((slug: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const scrollToHeading = useCallback(
    (slug: string) => {
      // Auto-expand ancestors if collapsed
      const ancestors = findAncestorSlugs(tocTree, slug);
      if (ancestors.some((a) => collapsed.has(a))) {
        setCollapsed((prev) => {
          const next = new Set(prev);
          for (const a of ancestors) next.delete(a);
          return next;
        });
      }
      scrollToIdInContainer(mainRef.current, slug);
    },
    [tocTree, collapsed, mainRef],
  );

  const mobileScrollTo = useCallback(
    (slug: string) => {
      scrollToHeading(slug);
      setMobileTocOpen(false);
    },
    [scrollToHeading, setMobileTocOpen],
  );

  // Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts for undo/redo
  useEffect(() => {
    if (!isInsider) return;
    function handleKeyDown(e: KeyboardEvent) {
      // Suppress when a modal popup is open
      if (document.querySelector('.fixed.z-\\[100\\]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isInsider, handleUndo, handleRedo]);

  // Enable/disable checkboxes when insider status or HTML changes
  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;
    const checkboxes = el.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-checkbox-index]');
    checkboxes.forEach((cb) => {
      cb.disabled = !isInsider;
      cb.style.cursor = isInsider ? 'pointer' : '';
    });
  }, [fileRendered.html, isInsider]);

  // Fire-and-forget checkbox toggle via 'change' event
  useEffect(() => {
    const el = articleRef.current;
    if (!el || !isInsider) return;

    const checkboxes = el.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-checkbox-index]');

    function handleChange(this: HTMLInputElement) {
      const indexAttr = this.getAttribute('data-checkbox-index');
      if (indexAttr === null) return;
      const index = parseInt(indexAttr, 10);
      const checked = this.checked;
      fileMutate(reqPath, { action: 'toggle-checkbox', index, checked }).catch(() =>
        console.warn('Checkbox toggle failed for index', index),
      );
    }

    checkboxes.forEach((cb) => cb.addEventListener('change', handleChange));
    return () => {
      checkboxes.forEach((cb) => cb.removeEventListener('change', handleChange));
    };
  }, [fileRendered.html, isInsider, reqPath]);

  return (
    <>
      {/* Mobile TOC overlay */}
      {mobileTocOpen && hasHeadings && (
        <>
          <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMobileTocOpen(false)} />
          <div
            className="lg:hidden fixed left-2 right-2 z-50 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg max-h-[60vh] overflow-y-auto px-4 py-3"
            style={{ top: `${topBarHeight + 4}px` }}
          >
            <nav>
              {tocTree.map((node) => (
                <TocSection
                  key={node.heading.slug}
                  node={node}
                  collapsed={collapsed}
                  toggleCollapse={toggleCollapse}
                  scrollTo={mobileScrollTo}
                />
              ))}
            </nav>
          </div>
        </>
      )}

      <div className="flex gap-6">
        {/* Desktop TOC sidebar */}
        {hasHeadings && (
          <aside
            className="toc-sidebar hidden lg:block w-56 shrink-0"
            style={{ maxHeight: `calc(100vh - ${topBarHeight + 32}px)` }}
          >
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contents</div>
            <nav className="border-l border-border pl-3">
              {tocTree.map((node) => (
                <TocSection
                  key={node.heading.slug}
                  node={node}
                  collapsed={collapsed}
                  toggleCollapse={toggleCollapse}
                  scrollTo={scrollToHeading}
                />
              ))}
            </nav>
          </aside>
        )}

        {/* Markdown article with hover controls wrapper */}
        <div className="min-w-0 flex-1 relative">
          <article
            ref={(el) => {
              articleRef.current = el;
              if (el) {
                if (!plainCode) initCodeBlockCm6(el, theme);
                injectCopyButtons(el);
                initInlineSvgPanzoom(el);
                initEmbeddedDiagramPanzoom(el);
                initLazyDiagrams(el);
              }
            }}
            className={`prose bg-background p-6 rounded-lg border border-border ${
              proseWidth === 'narrow' ? 'max-w-prose' : proseWidth === 'medium' ? 'max-w-5xl' : 'max-w-none'
            }`}
            style={{
              '--tw-prose-body': 'var(--foreground)',
              '--tw-prose-headings': 'var(--foreground)',
              '--tw-prose-bold': 'var(--foreground)',
              '--tw-prose-links': '#3b82f6',
              '--tw-prose-code': 'var(--foreground)',
              '--tw-prose-pre-bg': 'var(--muted)',
              '--tw-prose-pre-code': 'var(--foreground)',
              '--tw-prose-hr': 'var(--border)',
              '--tw-prose-quotes': 'var(--muted-foreground)',
              '--tw-prose-quote-borders': 'var(--border)',
              '--tw-prose-th-borders': 'var(--border)',
              '--tw-prose-td-borders': 'var(--border)',
            } as React.CSSProperties}
            dangerouslySetInnerHTML={{ __html: fileRendered.html! }}
            onClick={(e) => {
              const target = e.target as HTMLElement;

              // Handle anchor clicks
              const anchor = target.closest('a');
              const href = anchor?.getAttribute('href');
              if (href?.startsWith('#')) {
                e.preventDefault();
                scrollToIdInContainer(mainRef.current, href.slice(1));
              }
            }}
          />
          {isInsider && (canUndo(reqPath) || canRedo(reqPath)) && (
            <div className="absolute top-2 right-2 flex gap-1 z-10">
              {canUndo(reqPath) && (
                <button
                  onClick={handleUndo}
                  disabled={undoSaving}
                  title="Undo (Ctrl+Z)"
                  className="p-1.5 bg-popover border border-border rounded hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {undoSaving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Undo2 className="h-4 w-4 text-muted-foreground" />}
                </button>
              )}
              {canRedo(reqPath) && (
                <button
                  onClick={handleRedo}
                  disabled={undoSaving}
                  title="Redo (Ctrl+Shift+Z)"
                  className="p-1.5 bg-popover border border-border rounded hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {undoSaving ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Redo2 className="h-4 w-4 text-muted-foreground" />}
                </button>
              )}
            </div>
          )}
          <BlockHoverControls
            containerRef={articleRef}
            fileRendered={fileRendered}
            fileRaw={fileRaw}
            reqPath={reqPath}
            refetch={refetch}
          />
        </div>
      </div>
    </>
  );
}

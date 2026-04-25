/**
 * Markdown rendered view with collapsible TOC sidebar.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

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
  const popupOpenRef = useRef(false);

  // Preserve scroll position when content re-renders after a save.
  // The cleanup function captures scroll position before React commits
  // the new HTML; the setup function restores it after.
  const savedScrollRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    const mainEl = mainRef.current;
    // Restore: runs after DOM update with new HTML
    if (savedScrollRef.current !== null && mainEl) {
      mainEl.scrollTop = savedScrollRef.current;
      savedScrollRef.current = null;
    }
    // Capture: runs before the next DOM update
    return () => {
      if (mainEl) {
        savedScrollRef.current = mainEl.scrollTop;
      }
    };
  }, [fileRendered.html, mainRef]);

  const isInsider = fileRendered.isInsider;
  const { peekUndo, peekRedo, confirmUndo, confirmRedo } = useUndo();

  const currentContent = (fileRaw ?? fileRendered).content ?? '';

  const handleUndo = useCallback(async () => {
    const restored = peekUndo(reqPath);
    if (!restored) return;
    await saveFile(reqPath, restored);
    confirmUndo(reqPath, currentContent);
    await refetch();
  }, [reqPath, currentContent, peekUndo, confirmUndo, refetch]);

  const handleRedo = useCallback(async () => {
    const restored = peekRedo(reqPath);
    if (!restored) return;
    await saveFile(reqPath, restored);
    confirmRedo(reqPath, currentContent);
    await refetch();
  }, [reqPath, currentContent, peekRedo, confirmRedo, refetch]);

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
      // Suppress when an edit popup or confirm dialog is open
      if (popupOpenRef.current) return;
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

  // Enable/disable checkboxes — runs via useLayoutEffect (synchronous, before
  // paint) so checkboxes are interactive as soon as the DOM is visible.
  // Uses removeAttribute to strip the HTML content attribute, not just the IDL
  // property — mobile WebViews (e.g. Slack) may not reflect .disabled=false
  // to the content attribute, leaving the checkbox visually enabled but
  // unresponsive to taps.
  const enableCheckboxes = useCallback((el: HTMLElement) => {
    const checkboxes = el.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-checkbox-index]');
    checkboxes.forEach((cb) => {
      if (isInsider) {
        cb.removeAttribute('disabled');
        cb.disabled = false;
        cb.style.cursor = 'pointer';
      } else {
        cb.setAttribute('disabled', '');
        cb.disabled = true;
        cb.style.cursor = '';
      }
    });
  }, [isInsider]);

  useLayoutEffect(() => {
    const el = articleRef.current;
    if (el) enableCheckboxes(el);
  }, [fileRendered.html, enableCheckboxes]);

  // Delegated change handler on the article element — survives innerHTML
  // replacement because it's bound to the stable parent, not individual
  // checkbox nodes. Uses native addEventListener rather than React's onChange
  // because the checkboxes are injected via dangerouslySetInnerHTML and we
  // need guaranteed compatibility with mobile WebViews.
  useEffect(() => {
    const el = articleRef.current;
    if (!el || !isInsider) return;

    function handleChange(e: Event) {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.type !== 'checkbox') return;
      const indexAttr = target.getAttribute('data-checkbox-index');
      if (indexAttr === null) return;
      const index = parseInt(indexAttr, 10);
      const checked = target.checked;
      fileMutate(reqPath, { action: 'toggle-checkbox', index, checked }).catch(() =>
        console.warn('Checkbox toggle failed for index', index),
      );
    }

    el.addEventListener('change', handleChange);
    return () => {
      el.removeEventListener('change', handleChange);
    };
  }, [isInsider, reqPath]);

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
          <BlockHoverControls
            containerRef={articleRef}
            fileRendered={fileRendered}
            fileRaw={fileRaw}
            reqPath={reqPath}
            refetch={refetch}
            popupOpenRef={popupOpenRef}
          />
        </div>
      </div>
    </>
  );
}

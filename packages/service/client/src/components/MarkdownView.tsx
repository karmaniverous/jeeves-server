/**
 * Markdown rendered view with collapsible TOC sidebar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { initEmbeddedDiagramPanzoom } from '@/components/EmbeddedDiagramPanzoom';
import { initLazyDiagrams } from '@/components/LazyDiagram';
import { initInlineSvgPanzoom } from '@/components/InlineSvgPanzoom';
import { TocSection } from '@/components/TocSection';
import { buildTocTree, findAncestorSlugs } from '@/components/tocUtils';
import type { FileContent } from '@/lib/api';
import { toggleCheckbox } from '@/lib/api';
import { initCodeBlockCm6 } from '@/lib/codeBlockCm6';
import { injectCopyButtons } from '@/lib/codeBlockCopy';
import { useTheme } from '@/lib/theme';
import { scrollToIdInContainer } from './scrollUtils';

interface MarkdownViewProps {
  fileRendered: FileContent;
  reqPath: string;
  onRefetch: () => void;
  proseWidth: 'narrow' | 'medium' | 'wide';
  topBarHeight: number;
  mainRef: React.RefObject<HTMLElement | null>;
  mobileTocOpen: boolean;
  setMobileTocOpen: (open: boolean) => void;
}

export function MarkdownView({
  fileRendered, reqPath, onRefetch, proseWidth, topBarHeight, mainRef,
  mobileTocOpen, setMobileTocOpen,
}: MarkdownViewProps) {
  const [theme] = useTheme();
  const plainCode = new URLSearchParams(window.location.search).has('plain_code');
  const hasHeadings = fileRendered.headings && fileRendered.headings.length > 2;
  const articleRef = useRef<HTMLElement | null>(null);
  const [toggling, setToggling] = useState(false);
  const mtimeRef = useRef<number>(fileRendered.mtime ?? 0);

  // Update mtime when fileRendered changes (e.g. after refetch)
  useEffect(() => {
    if (fileRendered.mtime !== undefined) {
      mtimeRef.current = fileRendered.mtime;
    }
  }, [fileRendered.mtime]);

  const isInsider = fileRendered.isInsider;

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

  // Setup checkbox interactivity after render
  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;

    const checkboxes = el.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-checkbox-index]');
    checkboxes.forEach((cb) => {
      if (isInsider && !toggling) {
        cb.disabled = false;
        cb.style.cursor = 'pointer';
      } else {
        cb.disabled = true;
        cb.style.cursor = '';
      }
    });
  }, [fileRendered.html, isInsider, toggling]);

  const handleCheckboxClick = useCallback(async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT' || (target as HTMLInputElement).type !== 'checkbox') return;

    const input = target as HTMLInputElement;
    const indexAttr = input.getAttribute('data-checkbox-index');
    if (indexAttr === null) return;
    if (!isInsider) return;

    // Don't call e.preventDefault() — with dangerouslySetInnerHTML the browser
    // has already toggled the native checkbox before this handler fires.
    // Stop propagation to prevent any parent anchor/form from navigating.
    e.stopPropagation();

    const index = parseInt(indexAttr, 10);
    // The browser already toggled input.checked to the desired new state.
    const checked = input.checked;

    setToggling(true);
    input.disabled = true;

    try {
      const result = await toggleCheckbox(reqPath, index, checked, mtimeRef.current);

      if (result.conflict) {
        // Stale write - refetch
        onRefetch();
      } else if (result.ok) {
        mtimeRef.current = result.mtime;
      }
    } catch {
      // Revert the visual toggle on error
      input.checked = !checked;
    } finally {
      setToggling(false);
    }
  }, [isInsider, reqPath, onRefetch]);

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

        {/* Markdown article */}
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
          className={`prose bg-background p-6 rounded-lg border border-border min-w-0 flex-1 ${
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

            // Handle checkbox clicks
            if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
              void handleCheckboxClick(e);
              return;
            }

            // Handle anchor clicks
            const anchor = target.closest('a');
            const href = anchor?.getAttribute('href');
            if (href?.startsWith('#')) {
              e.preventDefault();
              scrollToIdInContainer(mainRef.current, href.slice(1));
            }
          }}
        />
      </div>
    </>
  );
}

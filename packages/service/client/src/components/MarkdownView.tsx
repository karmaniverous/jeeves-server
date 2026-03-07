/**
 * Markdown rendered view with TOC sidebar.
 */
import type { FileContent } from '@/lib/api';
import { initEmbeddedDiagramPanzoom } from '@/components/EmbeddedDiagramPanzoom';
import { initLazyDiagrams } from '@/components/LazyDiagram';
import { initInlineSvgPanzoom } from '@/components/InlineSvgPanzoom';
import { initCodeBlockCm6 } from '@/lib/codeBlockCm6';
import { injectCopyButtons } from '@/lib/codeBlockCopy';
import { useTheme } from '@/lib/theme';

const SCROLL_DURATION = 600;

function smoothScrollTo(container: HTMLElement | Window, targetY: number) {
  const isWindow = container === window;
  const startY = isWindow ? window.scrollY : (container as HTMLElement).scrollTop;
  const diff = targetY - startY;
  if (Math.abs(diff) < 2) return;
  const startTime = performance.now();

  function step(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / SCROLL_DURATION, 1);
    const ease = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    if (isWindow) {
      window.scrollTo(0, startY + diff * ease);
    } else {
      (container as HTMLElement).scrollTop = startY + diff * ease;
    }
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

export function scrollToIdInContainer(container: HTMLElement | null, id: string) {
  const el = document.getElementById(id);
  if (el && container) {
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const top = container.scrollTop + (elRect.top - containerRect.top) - 16;
    smoothScrollTo(container, top);
    window.history.replaceState(null, '', `#${id}`);
  }
}

interface MarkdownViewProps {
  fileRendered: FileContent;
  proseWidth: 'narrow' | 'medium' | 'wide';
  topBarHeight: number;
  mainRef: React.RefObject<HTMLElement | null>;
  mobileTocOpen: boolean;
  setMobileTocOpen: (open: boolean) => void;
}

export function MarkdownView({
  fileRendered, proseWidth, topBarHeight, mainRef,
  mobileTocOpen, setMobileTocOpen,
}: MarkdownViewProps) {
  const [theme] = useTheme();
  const plainCode = new URLSearchParams(window.location.search).has('plain_code');
  const hasHeadings = fileRendered.headings && fileRendered.headings.length > 2;

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
              {fileRendered.headings!.map((h) => (
                <button
                  key={h.slug}
                  type="button"
                  onClick={() => { scrollToIdInContainer(mainRef.current, h.slug); setMobileTocOpen(false); }}
                  className="block text-left text-sm text-muted-foreground hover:text-foreground cursor-pointer py-1 transition-colors w-full"
                  style={{ paddingLeft: `${(h.level - 1) * 0.75}rem` }}
                >
                  {h.text}
                </button>
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
              {fileRendered.headings!.map((h) => (
                <button
                  key={h.slug}
                  type="button"
                  onClick={() => scrollToIdInContainer(mainRef.current, h.slug)}
                  className="block text-left text-sm text-muted-foreground hover:text-foreground cursor-pointer py-0.5 transition-colors"
                  style={{ paddingLeft: `${(h.level - 1) * 0.75}rem` }}
                >
                  {h.text}
                </button>
              ))}
            </nav>
          </aside>
        )}

        {/* Markdown article */}
        <article
          ref={(el) => { if (el) { if (!plainCode) initCodeBlockCm6(el, theme); injectCopyButtons(el); initInlineSvgPanzoom(el); initEmbeddedDiagramPanzoom(el); initLazyDiagrams(el); } }}
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

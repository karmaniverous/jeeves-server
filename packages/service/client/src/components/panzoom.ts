/**
 * Shared Panzoom wrapper for SVG diagrams.
 *
 * Provides fullscreen toggle, zoom-to-fit, and drag/pan for any SVG element.
 */
import Panzoom from '@panzoom/panzoom';
import { createElement, Maximize, Minimize } from 'lucide';

// ── CSS class constants ──────────────────────────────────────────────

const WRAPPER_CLASS = 'relative bg-white rounded-lg border border-border overflow-hidden my-4';
const WRAPPER_FULLSCREEN_CLASS = 'fixed inset-0 z-[100] bg-white flex flex-col';
const VIEWPORT_CLASS = 'overflow-hidden w-full';
const VIEWPORT_FULLSCREEN_CLASS = 'overflow-hidden w-full h-full flex-1';
const INNER_CLASS = 'flex items-center justify-center p-4 [&>svg]:max-w-full [&>svg]:h-auto';
const INNER_FULLSCREEN_CLASS = 'p-4';
const FS_BTN_CLASS = 'absolute top-2 right-2 z-10 p-1.5 bg-zinc-800/70 hover:bg-zinc-700 text-white rounded transition-colors';
const HINT_CLASS = 'text-xs text-muted-foreground text-center py-1 opacity-60';
const HINT_FULLSCREEN_CLASS = 'text-muted-foreground text-xs text-center py-2 pointer-events-none';

const HINT_TEXT = 'Scroll to zoom · Drag to pan';
const HINT_FULLSCREEN_TEXT = 'Scroll to zoom · Drag to pan · Esc to close';

// ── Icon helpers ─────────────────────────────────────────────────────

function createIcon(iconData: typeof Maximize): SVGSVGElement {
  return createElement(iconData, { size: 16 }) as unknown as SVGSVGElement;
}

function setButtonIcon(btn: HTMLButtonElement, iconData: typeof Maximize): void {
  btn.innerHTML = '';
  btn.appendChild(createIcon(iconData));
}

// ── Zoom-to-fit helpers ──────────────────────────────────────────────

function parseSvgDimensions(svg: SVGElement): { w: number; h: number } {
  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number);
    if (parts[2] && parts[3]) return { w: parts[2], h: parts[3] };
  }
  return { w: (svg as SVGSVGElement).clientWidth || 1000, h: (svg as SVGSVGElement).clientHeight || 800 };
}

function computeZoomToFit(
  svgW: number, svgH: number, viewportW: number, viewportH: number,
): { fitScale: number; fittedW: number; fittedH: number; startX: number; startY: number } {
  const fitScale = Math.min(viewportW / svgW, viewportH / svgH, 1);
  const fittedW = svgW * fitScale;
  const fittedH = svgH * fitScale;
  return { fitScale, fittedW, fittedH, startX: (viewportW - fittedW) / 2, startY: (viewportH - fittedH) / 2 };
}

// ── Core factory ─────────────────────────────────────────────────────

export interface PanzoomWrapperOptions {
  /** Extra CSS class for the wrapper (e.g., 'inline-svg-panzoom') */
  wrapperExtraClass?: string;
  /** Minimum height for the viewport (e.g., '200px') */
  viewportMinHeight?: string;
}

export interface PanzoomWrapperResult {
  wrapper: HTMLDivElement;
  /** Call after attaching wrapper to the DOM to initialize Panzoom. */
  initPanzoom: () => void;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  cleanup: () => void;
}

/**
 * Create a panzoom wrapper around an SVG element.
 *
 * The SVG is moved into the wrapper. Returns the wrapper element plus
 * fullscreen controls and a cleanup function.
 */
export function createPanzoomWrapper(
  svg: SVGElement,
  _viewport: HTMLElement,
  options?: PanzoomWrapperOptions,
): PanzoomWrapperResult {
  const wrapperClass = options?.wrapperExtraClass
    ? `${options.wrapperExtraClass} ${WRAPPER_CLASS}`
    : WRAPPER_CLASS;

  const wrapper = document.createElement('div');
  wrapper.className = wrapperClass;
  wrapper.style.cursor = 'grab';

  const viewport = document.createElement('div');
  viewport.className = VIEWPORT_CLASS;
  if (options?.viewportMinHeight) viewport.style.minHeight = options.viewportMinHeight;

  const inner = document.createElement('div');
  inner.className = INNER_CLASS;

  inner.appendChild(svg);
  viewport.appendChild(inner);

  // Fullscreen button
  const fsBtn = document.createElement('button');
  fsBtn.className = FS_BTN_CLASS;
  fsBtn.title = 'Fullscreen';
  setButtonIcon(fsBtn, Maximize);

  // Hint
  const hint = document.createElement('div');
  hint.className = HINT_CLASS;
  hint.textContent = HINT_TEXT;

  wrapper.appendChild(viewport);
  wrapper.appendChild(fsBtn);
  wrapper.appendChild(hint);

  // Panzoom init is deferred until the wrapper is in the DOM.
  // Callers must invoke initPanzoom() after attaching the wrapper.
  let pz: ReturnType<typeof Panzoom> | null = null;

  const wheelHandler = (e: WheelEvent) => { pz?.zoomWithWheel(e); };
  viewport.addEventListener('wheel', wheelHandler, { passive: false });

  const initPanzoom = () => {
    if (pz) return; // already initialized
    pz = Panzoom(inner, { maxScale: 20, contain: 'outside' });
  };

  let isFullscreen = false;

  const enterFullscreen = () => {
    isFullscreen = true;
    wrapper.dataset.origClass = wrapper.className;
    wrapper.className = WRAPPER_FULLSCREEN_CLASS;
    wrapper.style.cursor = 'grab';
    viewport.className = VIEWPORT_FULLSCREEN_CLASS;
    if (options?.viewportMinHeight) viewport.style.minHeight = '';
    inner.className = INNER_FULLSCREEN_CLASS;
    hint.textContent = HINT_FULLSCREEN_TEXT;
    hint.className = HINT_FULLSCREEN_CLASS;
    fsBtn.title = 'Exit fullscreen';
    setButtonIcon(fsBtn, Minimize);
    pz?.destroy();
    pz = null;

    requestAnimationFrame(() => { requestAnimationFrame(() => { setTimeout(() => {
      const s = inner.querySelector('svg');
      if (s && viewport.clientWidth && viewport.clientHeight) {
        const { w: svgW, h: svgH } = parseSvgDimensions(s);
        const { fitScale, fittedW, fittedH, startX, startY } =
          computeZoomToFit(svgW, svgH, viewport.clientWidth, viewport.clientHeight);

        s.setAttribute('width', String(Math.round(fittedW)));
        s.setAttribute('height', String(Math.round(fittedH)));
        s.style.width = `${String(Math.round(fittedW))}px`;
        s.style.height = `${String(Math.round(fittedH))}px`;

        pz = Panzoom(inner, { maxScale: 20 / fitScale, minScale: 0.5, startScale: 1, startX, startY });
      } else {
        pz = Panzoom(inner, { maxScale: 20, minScale: 0.1 });
      }
    }, 50); }); });
  };

  const exitFullscreen = () => {
    isFullscreen = false;
    const s = inner.querySelector('svg');
    if (s) {
      s.setAttribute('width', '100%');
      s.removeAttribute('height');
      s.style.width = '';
      s.style.height = '';
    }
    wrapper.className = wrapper.dataset.origClass ?? wrapperClass;
    wrapper.style.cursor = 'grab';
    viewport.className = VIEWPORT_CLASS;
    if (options?.viewportMinHeight) viewport.style.minHeight = options.viewportMinHeight;
    inner.className = INNER_CLASS;
    hint.textContent = HINT_TEXT;
    hint.className = HINT_CLASS;
    fsBtn.title = 'Fullscreen';
    setButtonIcon(fsBtn, Maximize);
    pz?.destroy();
    pz = Panzoom(inner, { maxScale: 20, contain: 'outside', startScale: 1 });
  };

  fsBtn.addEventListener('click', () => {
    if (isFullscreen) exitFullscreen(); else enterFullscreen();
  });

  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isFullscreen) exitFullscreen();
  };
  document.addEventListener('keydown', escHandler);

  const cleanup = () => {
    viewport.removeEventListener('wheel', wheelHandler);
    document.removeEventListener('keydown', escHandler);
    pz?.destroy();
  };

  return { wrapper, initPanzoom, enterFullscreen, exitFullscreen, cleanup };
}

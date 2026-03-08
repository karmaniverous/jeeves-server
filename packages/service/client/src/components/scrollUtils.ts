/**
 * Smooth scroll utilities for in-page navigation.
 */
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

/**
 * Injects copy buttons into all <pre> blocks within a container element.
 * Call after rendering markdown HTML.
 */
import { createElement, Copy, Check } from 'lucide';

function createIcon(iconData: typeof Copy, size = 14): SVGSVGElement {
  return createElement(iconData, { size }) as unknown as SVGSVGElement;
}

export function injectCopyButtons(container: HTMLElement) {
  const pres = container.querySelectorAll('pre');
  pres.forEach((pre) => {
    if (pre.querySelector('.code-copy-btn')) return; // already injected

    // Make pre relative for absolute positioning of button
    pre.style.position = 'relative';

    const btn = document.createElement('button');
    btn.className = 'code-copy-btn';
    btn.title = 'Copy to clipboard';
    btn.innerHTML = '';
    btn.appendChild(createIcon(Copy));

    btn.addEventListener('click', () => {
      const code = pre.querySelector('code');
      const text = code?.textContent ?? pre.textContent ?? '';
      void navigator.clipboard.writeText(text).then(() => {
        btn.innerHTML = '';
        const checkIcon = createIcon(Check);
        btn.appendChild(checkIcon);
        btn.style.color = '#4ade80';
        setTimeout(() => {
          btn.innerHTML = '';
          btn.appendChild(createIcon(Copy));
          btn.style.color = '';
        }, 1500);
      });
    });

    pre.appendChild(btn);
  });
}

/**
 * SVG normalization utilities shared between components.
 */

/**
 * Normalize an SVG string for responsive display:
 * - Fix preserveAspectRatio="none" (PlantUML quirk)
 * - Remove inline width/height styles
 * - Set width="100%" and let viewBox handle sizing
 * - Ensure viewBox exists if dimensions are available
 */
export function normalizeSvg(svgText: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return svgText;

  // Extract intrinsic dimensions for viewBox if missing
  let w = 0, h = 0;
  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length === 4) { w = parts[2]; h = parts[3]; }
  }
  if (w <= 0 || h <= 0) {
    w = parseFloat(svg.getAttribute('width') ?? '0');
    h = parseFloat(svg.getAttribute('height') ?? '0');
  }

  // Ensure viewBox exists
  if (!svg.getAttribute('viewBox') && w > 0 && h > 0) {
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  // Fix PlantUML preserveAspectRatio="none"
  if (svg.getAttribute('preserveAspectRatio') === 'none') {
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }

  // Strip fixed sizing
  svg.removeAttribute('height');
  svg.style.removeProperty('width');
  svg.style.removeProperty('height');
  svg.style.removeProperty('background');

  // Set responsive sizing
  svg.setAttribute('width', '100%');

  return new XMLSerializer().serializeToString(doc);
}

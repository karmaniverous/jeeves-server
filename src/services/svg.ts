/**
 * SVG rendering and inlining for panzoom support
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Inline SVG images in HTML content for vector zoom support
 */
export function inlineSVGs(htmlContent: string, fileDir: string): string {
  return htmlContent.replace(
    /<img[^>]*?src="([^"]+\.svg)(\?[^"]*)?"[^>]*>/gi,
    (match, svgUrl: string) => {
      try {
        // Extract the file path from the URL
        let svgPath: string;
        if (svgUrl.startsWith('/path/')) {
          // Convert /path/d/foo/bar.svg to D:\foo\bar.svg
          const urlPath = svgUrl.replace('/path/', '');
          svgPath = urlPath
            .replace(
              /^([a-z])\//,
              (m: string, d: string) => `${d.toUpperCase()}:\\`,
            )
            .replace(/\//g, '\\');
        } else {
          svgPath = path.resolve(fileDir, svgUrl);
        }

        if (!fs.existsSync(svgPath)) {
          return match; // Keep original if file not found
        }

        let svgContent = fs.readFileSync(svgPath, 'utf8');

        // Remove XML declaration if present
        svgContent = svgContent.replace(/<\?xml[^?]*\?>\s*/gi, '');

        // Add class for styling
        svgContent = svgContent.replace(/<svg/, '<svg class="inline-svg"');

        // Wrap in zoomable container
        return `<div class="svg-container zoomable-svg" data-src="${svgUrl}">${svgContent}</div>`;
      } catch {
        return match; // Keep original on error
      }
    },
  );
}

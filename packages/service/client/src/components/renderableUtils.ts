/**
 * Utility functions for determining if a file is renderable.
 */
import type { FileContent } from '@/lib/api';

const RENDERABLE_EXTENSIONS = new Set(['.md', '.svg', '.mmd', '.puml', '.plantuml', '.pu']);

export function isRenderable(file: FileContent): boolean {
  return file.type === 'markdown' || file.type === 'svg' || file.type === 'mermaid' || file.type === 'plantuml' || !!file.html;
}

export function isRenderableExt(reqPath: string): boolean {
  const ext = reqPath ? `.${reqPath.split('.').pop()?.toLowerCase()}` : '';
  return RENDERABLE_EXTENSIONS.has(ext);
}

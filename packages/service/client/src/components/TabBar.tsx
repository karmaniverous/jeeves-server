/**
 * Tab bar for file views — Rendered/Raw tabs, prose width toggle, and edit button.
 */
import { Menu, Minus, Minimize2, Maximize2, Pencil, X } from 'lucide-react';

import type { FileContent } from '@/lib/api';
import { isRenderable, isRenderableExt } from './renderableUtils';

interface TabBarProps {
  reqPath: string;
  file: FileContent | null;
  fileRendered: FileContent | null;
  viewTab: 'rendered' | 'raw';
  setViewTab: (tab: 'rendered' | 'raw') => void;
  proseWidth: 'narrow' | 'medium' | 'wide';
  toggleProseWidth: (w: 'narrow' | 'medium' | 'wide') => void;
  isInsider: boolean;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  mobileTocOpen: boolean;
  setMobileTocOpen: (open: boolean) => void;
  loading: boolean;
}

export function TabBar({
  reqPath, file, fileRendered, viewTab, setViewTab,
  proseWidth, toggleProseWidth,
  isInsider, editing, setEditing,
  mobileTocOpen, setMobileTocOpen, loading,
}: TabBarProps) {
  if (!file && !loading) return null;

  const renderable = file ? isRenderable(file) : isRenderableExt(reqPath);
  const activeTab = renderable ? viewTab : 'raw';

  return (
    <div className="flex items-center gap-1 border-b border-border bg-background px-4 md:px-6">
      {fileRendered?.headings && fileRendered.headings.length > 2 && (
        <button
          onClick={() => setMobileTocOpen(!mobileTocOpen)}
          className="lg:hidden p-1.5 mr-1 text-muted-foreground hover:text-foreground transition-colors"
          title="Table of contents"
        >
          {mobileTocOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      )}
      {renderable && (
        <button
          onClick={() => setViewTab('rendered')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'rendered'
              ? 'border-blue-500 text-blue-500'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Rendered
        </button>
      )}
      <button
        onClick={() => setViewTab('raw')}
        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
          activeTab === 'raw'
            ? 'border-blue-500 text-blue-500'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        Raw
      </button>
      {file?.type === 'markdown' && activeTab === 'rendered' && (
        <div className="hidden md:flex items-center ml-2 border border-border rounded-md overflow-hidden">
          {(['narrow', 'medium', 'wide'] as const).map((w) => (
            <button
              key={w}
              onClick={() => toggleProseWidth(w)}
              className={`p-1.5 transition-colors ${
                proseWidth === w ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
              title={`${w.charAt(0).toUpperCase() + w.slice(1)} width`}
            >
              {w === 'narrow' ? <Minimize2 className="h-3.5 w-3.5" /> : w === 'medium' ? <Minus className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
      {isInsider && activeTab === 'raw' && file?.content != null && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="ml-2 flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground border border-border rounded transition-colors"
          title="Edit file"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
      )}
    </div>
  );
}

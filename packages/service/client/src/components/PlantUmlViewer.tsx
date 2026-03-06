import { SvgViewer } from './SvgViewer';

interface PlantUmlViewerProps {
  /** Server-rendered SVG string */
  html: string | null;
  /** Raw PlantUML source (fallback) */
  content: string;
}

export function PlantUmlViewer({ html, content }: PlantUmlViewerProps) {
  if (!html) {
    return (
      <div className="p-4 bg-red-950/20 border border-red-800 rounded-lg">
        <div className="text-red-400 text-sm font-medium mb-2">PlantUML render failed</div>
        <pre className="text-red-300 text-xs overflow-x-auto">{content}</pre>
      </div>
    );
  }

  return <SvgViewer content={html} />;
}

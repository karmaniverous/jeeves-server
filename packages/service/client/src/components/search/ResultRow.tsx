import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';

import type { SearchFacet, SearchResult } from '@/lib/apiTypes';
import { buildChips, type ResultChip } from '@/lib/resultChips';

/** Max chips shown in collapsed view */
const COLLAPSED_CHIP_COUNT = 4;

/** A metadata chip: click it to filter by its value. */
function MetaChip({
  chip,
  onClick,
}: {
  chip: ResultChip;
  onClick: (field: string, value: string) => void;
}) {
  const display =
    chip.value.length > 30 ? chip.value.slice(0, 28) + '…' : chip.value;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(chip.field, chip.value);
      }}
      className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground border border-border hover:bg-primary/10 hover:border-primary/30 transition-colors cursor-pointer truncate max-w-[200px]"
      title={`${chip.label}: ${chip.value} — click to filter`}
    >
      <span className="text-muted-foreground">{chip.label}:</span> {display}
    </button>
  );
}

/** One search result: name, score, path, metadata chips and expandable chunks. */
export function ResultRow({
  result,
  facets,
  onNavigate,
  onChipClick,
}: {
  result: SearchResult;
  facets: SearchFacet[];
  onNavigate: (path: string) => void;
  onChipClick: (field: string, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const preview = result.chunks[0]?.text ?? '';
  const truncatedPreview =
    preview.length > 150 ? preview.slice(0, 150) + '…' : preview;

  const allChips = buildChips(result, facets);
  const collapsedChips = allChips.slice(0, COLLAPSED_CHIP_COUNT);
  const hasMore = allChips.length > COLLAPSED_CHIP_COUNT;

  const renderChip = (chip: ResultChip, i: number) => (
    <MetaChip key={`${chip.field}-${i}`} chip={chip} onClick={onChipClick} />
  );

  return (
    <div className="border-b border-border last:border-0 px-4 py-2">
      <div className="flex items-start gap-2">
        <FileText className="h-4 w-4 text-zinc-400 shrink-0 mt-1" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate(`/browse/${result.browsePath}`)}
              className="text-blue-500 hover:underline text-sm font-medium truncate"
            >
              {result.fileName}
            </button>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {(result.bestScore * 100).toFixed(0)}%
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {result.chunks.length} chunk
              {result.chunks.length !== 1 ? 's' : ''}
            </span>
            {result.mtime && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(result.mtime).toLocaleDateString()}
              </span>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
              title={expanded ? 'Collapse chunks' : 'Expand chunks'}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 break-words leading-relaxed">
            {result.browsePath}
          </div>
          {/* Collapsed chips */}
          {!expanded && collapsedChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {collapsedChips.map(renderChip)}
              {hasMore && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-[10px] text-blue-500 hover:underline cursor-pointer"
                >
                  +{allChips.length - COLLAPSED_CHIP_COUNT} more
                </button>
              )}
            </div>
          )}
          {!expanded && collapsedChips.length === 0 && (
            <div className="text-sm text-foreground/70 mt-1 truncate">
              {truncatedPreview}
            </div>
          )}
          {/* Expanded: all chips + chunks */}
          {expanded && (
            <>
              {allChips.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 mt-1.5 mb-2">
                  {allChips.map(renderChip)}
                </div>
              )}
              <div className="max-h-48 overflow-y-auto border border-border rounded bg-muted/30 divide-y divide-border">
                {result.chunks.map((chunk, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 text-sm text-foreground/80 leading-relaxed"
                  >
                    <span className="text-[10px] text-muted-foreground mr-2">
                      #{chunk.index}
                    </span>
                    {chunk.text}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

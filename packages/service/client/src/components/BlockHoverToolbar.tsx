/**
 * The hover overlay on a rendered Markdown block: its border, label and the Edit, Copy, Insert above/below and Delete buttons (Insert and Delete hidden for cells, Insert below and Delete for a header row).
 */
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Pencil,
  Trash2,
} from 'lucide-react';

import {
  BORDER_PADDING,
  CONTROLS_HEIGHT,
  isCell,
  isHeaderRow,
  type OverlayRect,
} from '@/components/blockHoverDom';
import { blockLabel } from '@/components/blockUtils';

interface BlockHoverToolbarProps {
  hoveredEl: Element;
  hoverRect: OverlayRect;
  controlsRef: React.RefObject<HTMLDivElement | null>;
  onEdit: () => void;
  onCopy: () => void;
  onInsert: (position: 'before' | 'after') => void;
  onDelete: () => void;
}

const BUTTON =
  'p-0.5 bg-popover border border-border rounded hover:bg-accent transition-colors';

export function BlockHoverToolbar({
  hoveredEl,
  hoverRect,
  controlsRef,
  onEdit,
  onCopy,
  onInsert,
  onDelete,
}: BlockHoverToolbarProps) {
  const isHeaderTr =
    hoveredEl.tagName.toLowerCase() === 'tr' && isHeaderRow(hoveredEl);

  return (
    <div
      ref={controlsRef}
      className="absolute pointer-events-none"
      style={{
        top: hoverRect.top - CONTROLS_HEIGHT,
        left: hoverRect.left,
        width: hoverRect.width,
        height: hoverRect.height + CONTROLS_HEIGHT,
      }}
    >
      {/* Border highlight (offset down by CONTROLS_HEIGHT to leave room for buttons) */}
      <div
        className="absolute inset-x-0 bottom-0 border-2 border-blue-400/50 rounded pointer-events-none"
        style={{ height: hoverRect.height }}
      />

      {/* Label */}
      <span
        className="absolute left-1 text-[10px] px-1 py-0.5 bg-blue-500 text-white rounded-t leading-none pointer-events-auto"
        style={{ top: CONTROLS_HEIGHT - BORDER_PADDING - 2 }}
      >
        {blockLabel(hoveredEl)}
      </span>

      {/* Control buttons */}
      <div
        className="absolute right-1 flex gap-0.5 pointer-events-auto"
        style={{ top: CONTROLS_HEIGHT - BORDER_PADDING - 2 }}
      >
        {/* EDIT (always shown) */}
        <button onClick={onEdit} className={BUTTON} title="Edit">
          <Pencil className="h-3 w-3 text-foreground" />
        </button>

        {/* COPY (shown for all elements including cells) */}
        <button onClick={onCopy} className={BUTTON} title="Copy">
          <Copy className="h-3 w-3 text-foreground" />
        </button>

        {!isCell(hoveredEl) && (
          <>
            {/* INSERT ABOVE */}
            <button
              onClick={() => onInsert('before')}
              className={BUTTON}
              title="Insert above"
            >
              <ArrowUpToLine className="h-3 w-3 text-foreground" />
              <span className="sr-only">Insert above</span>
            </button>

            {/* INSERT BELOW and DELETE (suppressed for header tr) */}
            {!isHeaderTr && (
              <>
                <button
                  onClick={() => onInsert('after')}
                  className={BUTTON}
                  title="Insert below"
                >
                  <ArrowDownToLine className="h-3 w-3 text-foreground" />
                  <span className="sr-only">Insert below</span>
                </button>
                <button
                  onClick={onDelete}
                  className="p-0.5 bg-popover border border-border rounded hover:bg-destructive/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

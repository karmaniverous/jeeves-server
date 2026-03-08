/**
 * Generic action dropdown with state machine (idle/loading/done/error),
 * icon swapping, and variant rendering (header/default/menuItem).
 *
 * Used by LinkDropdown and DownloadDropdown to eliminate structural duplication.
 */
import { Check, Loader2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type ActionState = 'idle' | 'loading' | 'done' | 'error';

export interface ActionDropdownProps {
  /** Icon shown in idle state */
  icon: LucideIcon;
  /** Label for the trigger (menuItem variant) */
  label: string;
  /** Tooltip for the trigger button */
  title: string;
  /** Render variant */
  variant?: 'header' | 'default' | 'menuItem';
  /** Small variant for directory rows */
  compact?: boolean;
  /** Error callback */
  onError?: (error: string) => void;
  /** State change callback */
  onStateChange?: (state: ActionState) => void;
  /** Children rendered inside the dropdown content */
  children: React.ReactNode;
  /** Extra content before children (e.g., error display) — rendered by parent */
  errorSlot?: React.ReactNode;
  /** Dropdown content alignment */
  align?: 'start' | 'center' | 'end';
  /** Dropdown content width class */
  contentClass?: string;
  /** Disabled state */
  disabled?: boolean;
  /** External state override (parent controls state) */
  state?: ActionState;
  /** Called when dropdown opens/closes */
  onOpenChange?: (open: boolean) => void;
}

export function ActionDropdown({
  icon: IdleIcon,
  label,
  title,
  variant = 'default',
  compact,
  state: externalState,
  disabled,
  children,
  errorSlot,
  align = 'end',
  contentClass,
  onOpenChange,
}: ActionDropdownProps) {
  const state = externalState ?? 'idle';
  const isMenuItem = variant === 'menuItem';
  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnSize = compact ? 'h-7 w-7' : 'h-8 w-8';

  const Icon = state === 'done' ? Check : state === 'error' ? X : state === 'loading' ? Loader2 : IdleIcon;
  const iconColor = state === 'done' ? 'text-green-500' : state === 'error' ? 'text-red-500' : '';

  const trigger = isMenuItem ? (
    <button
      className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors w-full text-left"
      disabled={disabled || state === 'loading'}
    >
      <Icon className={`h-4 w-4 shrink-0 ${iconColor} ${state === 'loading' ? 'animate-spin' : ''}`} />
      {label}
    </button>
  ) : (
    <Button
      variant="ghost"
      size="icon"
      className={`${btnSize} ${iconColor || (variant === 'header' ? 'text-zinc-300 hover:text-white hover:bg-white/10' : 'text-muted-foreground hover:text-foreground')}`}
      disabled={disabled || state === 'loading'}
      title={title}
    >
      <Icon className={`${iconSize} ${state === 'loading' ? 'animate-spin' : ''}`} />
    </Button>
  );

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={contentClass}>
        {errorSlot && (
          <>
            {errorSlot}
            <DropdownMenuSeparator />
          </>
        )}
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Reusable error message banner for dropdowns. */
export function DropdownErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="px-2 py-1.5 text-xs text-red-500 bg-red-500/10 rounded mx-1 mb-1">
      {message}
    </div>
  );
}


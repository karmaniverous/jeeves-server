import { LogOut, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth';

export interface CollapsedItem {
  node: React.ReactNode;
  /** Breakpoint at which this item is hidden from the header bar (and thus shown in the menu) */
  breakpoint: 'sm' | 'md' | 'lg' | 'xl';
}

interface AccountMenuProps {
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  /** Items that collapse into this menu at various breakpoints, in display order */
  collapsedItems?: CollapsedItem[];
}

/**
 * Maps breakpoint to Tailwind class that shows the item only BELOW that breakpoint.
 * e.g. breakpoint 'sm' → item is in menu when < sm → "sm:hidden" (visible below sm, hidden at sm+)
 */
const BREAKPOINT_CLASS: Record<string, string> = {
  sm: 'sm:hidden',
  md: 'md:hidden',
  lg: 'lg:hidden',
  xl: 'xl:hidden',
};

export function AccountMenu({ collapsedItems = [] }: AccountMenuProps) {
  const { authenticated, email, picture } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      // Don't close if click is inside the account menu
      if (menuRef.current?.contains(target)) return;
      // Don't close if click is inside a Radix portal (nested dropdown)
      if (target.closest?.('[data-radix-popper-content-wrapper]')) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!authenticated) return null;

  const initial = email ? email[0].toUpperCase() : '?';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-zinc-700 transition-colors"
        title={email ?? 'Account'}
      >
        {picture ? (
          <img src={picture} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
            {initial}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
          {/* User info — links to Google account */}
          <a
            href="https://myaccount.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 border-b border-border hover:bg-accent transition-colors"
          >
            <User className="h-4 w-4 text-foreground" />
            <span className="text-sm text-foreground truncate">{email}</span>
          </a>

          {/* Collapsed items — each visible in menu only below its breakpoint */}
          {collapsedItems.map((item, i) => (
            <div key={i} className={BREAKPOINT_CLASS[item.breakpoint]}>
              {item.node}
            </div>
          ))}

          {/* Separator before sign out if there are collapsed items */}
          {collapsedItems.length > 0 && (
            <div className="border-b border-border" />
          )}

          <a
            href="/auth/logout"
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </a>
        </div>
      )}
    </div>
  );
}

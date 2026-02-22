import { ExternalLink, LogOut, User } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth';

export interface CollapsedItem {
  node: React.ReactNode | ((onDismiss: () => void) => React.ReactNode);
  /** Breakpoint at which this item is hidden from the header bar (and thus shown in the menu) */
  breakpoint: 'bp-400' | 'bp-480' | 'sm' | 'md' | 'lg';
  /** If true, this item contains a nested dropdown that should prevent account menu auto-close */
  hasNestedDropdown?: boolean;
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
/**
 * Maps breakpoint key to Tailwind class that hides the item AT OR ABOVE that width.
 * Items appear in the menu only below their breakpoint.
 * Using arbitrary min-width values for tighter control over when items fold.
 */
const BREAKPOINT_CLASS: Record<string, string> = {
  'bp-400': 'min-[400px]:hidden',
  'bp-480': 'min-[480px]:hidden',
  sm: 'sm:hidden',       // 640px
  md: 'md:hidden',       // 768px
  lg: 'lg:hidden',       // 1024px
};

export function AccountMenu({ collapsedItems = [] }: AccountMenuProps) {
  const { authenticated, email, picture } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [privacyUrl, setPrivacyUrl] = useState<string | null>(null);
  const [termsUrl, setTermsUrl] = useState<string | null>(null);

  // Fetch content share links on mount
  useEffect(() => {
    fetch('/api/content-link/privacy')
      .then((r) => r.json())
      .then((data: { url?: string }) => { if (data.url) setPrivacyUrl(data.url); })
      .catch(() => {});
    fetch('/api/content-link/terms')
      .then((r) => r.json())
      .then((data: { url?: string }) => { if (data.url) setTermsUrl(data.url); })
      .catch(() => {});
  }, []);

  // Track whether a nested Radix dropdown is currently open
  const nestedDropdownOpen = useCallback(() => {
    return !!document.querySelector('[data-radix-popper-content-wrapper]');
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: Event) {
      const target = e.target as HTMLElement;
      // Don't close if click is inside the account menu
      if (menuRef.current?.contains(target)) return;
      // Don't close if a nested Radix dropdown is open anywhere
      if (nestedDropdownOpen()) return;
      // Don't close if click is inside any Radix portal
      if (target.closest?.('[data-radix-popper-content-wrapper]')) return;
      if (target.closest?.('[role="menu"]')) return;
      setOpen(false);
    }
    document.addEventListener('pointerdown', handleClickOutside, true);
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside, true);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [open, nestedDropdownOpen]);

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
              {typeof item.node === 'function' ? item.node(() => setOpen(false)) : item.node}
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

          {/* Legal links — share links to content/*.md */}
          {(privacyUrl ?? termsUrl) && (
            <div className="border-t border-border mt-1 pt-1">
              {privacyUrl && (
                <a
                  href={privacyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Privacy
                </a>
              )}
              {termsUrl && (
                <a
                  href={termsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Terms
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { Moon, Sun, Info, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';

import { AccountMenu, type CollapsedItem } from '@/components/AccountMenu';
import { Button } from '@/components/ui/button';
import type { BreadcrumbItem } from '@/lib/api';

interface HeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  isInsider: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  keyAge?: string | null;
  onRotateKey?: () => void;
  /** Download dropdown for header bar (icon button variant) */
  downloadDropdown?: React.ReactNode;
  /** Link dropdown for header bar (icon button variant) */
  linkControls?: React.ReactNode;
  /** Download dropdown factory for account menu (receives dismiss callback) */
  downloadMenuItem?: (onDismiss: () => void) => React.ReactNode;
  /** Link dropdown factory for account menu (receives dismiss callback) */
  linkMenuItem?: (onDismiss: () => void) => React.ReactNode;
}

export function Header({
  breadcrumbs = [],
  isInsider,
  theme,
  onToggleTheme,
  keyAge,
  onRotateKey,
  downloadDropdown,
  linkControls,
  downloadMenuItem,
  linkMenuItem,
}: HeaderProps) {
  const hasKeyMgmt = isInsider && onRotateKey;

  // Build account menu collapsed items in left-to-right header order
  const collapsedItems: CollapsedItem[] = [];

  const menuItemClass = 'flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors w-full text-left cursor-pointer';

  // Link controls — hidden below 400px
  if (linkMenuItem) {
    collapsedItems.push({
      breakpoint: 'xs',
      node: linkMenuItem,
      hasNestedDropdown: true,
    });
  }

  // Download dropdown — hidden below sm (640px)
  if (downloadMenuItem) {
    collapsedItems.push({
      breakpoint: 'sm',
      node: downloadMenuItem,
      hasNestedDropdown: true,
    });
  }

  // Key management — hidden below md (768px)
  if (hasKeyMgmt) {
    collapsedItems.push({
      breakpoint: 'md',
      node: (
        <button onClick={onRotateKey} className={menuItemClass}>
          <KeyRound className="h-4 w-4 shrink-0" />
          Rotate key{keyAge ? ` (${keyAge})` : ''}
        </button>
      ),
    });
  }

  // About — hidden below lg (1024px)
  collapsedItems.push({
    breakpoint: 'lg',
    node: (
      <Link to="/about" className={menuItemClass}>
        <Info className="h-4 w-4 shrink-0" />
        About Jeeves Server
      </Link>
    ),
  });

  // Theme — hidden below lg (1024px)
  collapsedItems.push({
    breakpoint: 'lg',
    node: (
      <button onClick={onToggleTheme} className={menuItemClass}>
        {theme === 'dark' ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
      </button>
    ),
  });

  return (
    <header className="bg-zinc-800 text-white px-4 py-2">
      <div className="flex items-center gap-1">
        {/* Breadcrumbs — takes remaining space, truncates */}
        <div className="flex items-center min-w-0 flex-1">
          <Link to="/browse" className="text-3xl no-underline shrink-0 mr-1" title="Jeeves Server">
            🎩
          </Link>
          <nav className="flex items-center gap-1 min-w-0 overflow-x-auto overflow-y-hidden scrollbar-thin">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-1 shrink-0">
                <span className="text-zinc-500 mx-0.5">/</span>
                {i === breadcrumbs.length - 1 ? (
                  <span className="text-zinc-300 truncate max-w-48">{crumb.label}</span>
                ) : (
                  <Link
                    to={`/browse/${crumb.path}`}
                    className="text-blue-400 hover:underline truncate max-w-48"
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        </div>

        {/* Controls — progressively hidden via responsive classes */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Link controls: visible 400px+ */}
          {linkControls && (
            <div className="hidden min-[400px]:flex items-center">{linkControls}</div>
          )}

          {/* Download: visible sm+ (640px) */}
          {downloadDropdown && (
            <div className="hidden sm:flex items-center">{downloadDropdown}</div>
          )}

          {/* Key management: visible md+ (768px) */}
          {hasKeyMgmt && (
            <div className="hidden md:flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-zinc-400 hover:text-white h-8 w-8"
                title="Rotate key (invalidates all your shares)"
                onClick={onRotateKey}
              >
                <KeyRound className="h-4 w-4" />
              </Button>
              {keyAge && <span className="text-xs text-zinc-500">{keyAge}</span>}
            </div>
          )}

          {/* About: visible lg+ (1024px) */}
          <Link to="/about" title="About Jeeves Server" className="hidden lg:inline-flex">
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white h-8 w-8">
              <Info className="h-4 w-4" />
            </Button>
          </Link>

          {/* Theme: visible lg+ (1024px) */}
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-white h-8 w-8 hidden lg:inline-flex"
            title="Toggle theme"
            onClick={onToggleTheme}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* Account menu — always visible */}
          <AccountMenu
            theme={theme}
            onToggleTheme={onToggleTheme}
            collapsedItems={collapsedItems}
          />
        </div>
      </div>
    </header>
  );
}

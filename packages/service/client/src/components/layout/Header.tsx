import { Moon, Sun, BookOpen, KeyRound, Search, Activity } from 'lucide-react';

/** GitHub mark (octicon) as an inline SVG component. */
function GitHubLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { AccountMenu, type CollapsedItem } from '@/components/AccountMenu';
import { SearchModal } from '@/components/SearchModal';
import { useBranding } from '@/lib/BrandingContext';
import { Button } from '@/components/ui/button';
import type { BreadcrumbItem } from '@/lib/api';

const GITHUB_URL = 'https://github.com/karmaniverous/jeeves-server';

interface HeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  isInsider: boolean;
  searchEnabled?: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  keyAge?: string | null;
  onRotateKey?: () => void;
  /** When true, render the brand emoji as inert text instead of a home link. */
  disableHomeLink?: boolean;
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
  searchEnabled,
  theme,
  onToggleTheme,
  keyAge,
  onRotateKey,
  disableHomeLink,
  downloadDropdown,
  linkControls,
  downloadMenuItem,
  linkMenuItem,
}: HeaderProps) {
  const branding = useBranding();
  const hasKeyMgmt = isInsider && onRotateKey;

  const [searchOpen, setSearchOpen] = useState(false);

  // Ctrl/Cmd+K keyboard shortcut
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }
  }, []);

  useEffect(() => {
    if (searchEnabled && isInsider) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [searchEnabled, isInsider, handleKeyDown]);



  // Build account menu collapsed items in left-to-right header order
  const collapsedItems: CollapsedItem[] = [];

  const menuItemClass = 'flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors w-full text-left cursor-pointer';

  // Link controls — hidden below 400px
  if (linkMenuItem) {
    collapsedItems.push({
      breakpoint: 'bp-400',
      node: linkMenuItem,
      hasNestedDropdown: true,
    });
  }

  // Download dropdown — hidden below 480px
  if (downloadMenuItem) {
    collapsedItems.push({
      breakpoint: 'bp-480',
      node: downloadMenuItem,
      hasNestedDropdown: true,
    });
  }

  // Key management — hidden below sm (640px)
  if (hasKeyMgmt) {
    collapsedItems.push({
      breakpoint: 'sm',
      node: (
        <button onClick={onRotateKey} className={menuItemClass}>
          <KeyRound className="h-4 w-4 shrink-0" />
          Rotate key{keyAge ? ` (${keyAge})` : ''}
        </button>
      ),
    });
  }

  // Runner — hidden below md (768px)
  if (isInsider) {
    collapsedItems.push({
      breakpoint: 'md',
      node: (
        <Link to="/runner" className={menuItemClass}>
          <Activity className="h-4 w-4 shrink-0" />
          Runner
        </Link>
      ),
    });
  }

  // README — hidden below md (768px)
  collapsedItems.push({
    breakpoint: 'md',
    node: (
      <Link to="/readme" className={menuItemClass}>
        <BookOpen className="h-4 w-4 shrink-0" />
        README
      </Link>
    ),
  });

  // GitHub — hidden below md (768px)
  collapsedItems.push({
    breakpoint: 'md',
    node: (
      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={menuItemClass}>
        <GitHubLogo className="h-4 w-4 shrink-0" />
        GitHub
      </a>
    ),
  });

  // Theme — hidden below md (768px)
  collapsedItems.push({
    breakpoint: 'md',
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
          {disableHomeLink ? (
            <span className="text-3xl shrink-0 mr-1" title={branding.name}>{branding.emoji}</span>
          ) : (
            <Link to="/browse" className="text-3xl no-underline shrink-0 mr-1" title={branding.name}>
              {branding.emoji}
            </Link>
          )}
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
          {/* Search: visible when configured, always shown */}
          {searchEnabled && isInsider && (
            <Button
              variant="ghost"
              size="icon"
              className="text-zinc-300 hover:text-white hover:bg-white/10 h-8 w-8"
              title="Search (Ctrl+K)"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>
          )}

          {/* Link controls: visible 400px+ */}
          {linkControls && (
            <div className="hidden min-[400px]:flex items-center">{linkControls}</div>
          )}

          {/* Download: visible 480px+ */}
          {downloadDropdown && (
            <div className="hidden min-[480px]:flex items-center">{downloadDropdown}</div>
          )}

          {/* Key management: visible sm+ (640px) */}
          {hasKeyMgmt && (
            <div className="hidden sm:flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-zinc-300 hover:text-white hover:bg-white/10 h-8 w-8"
                title="Rotate key (invalidates all your shares)"
                onClick={onRotateKey}
              >
                <KeyRound className="h-4 w-4" />
              </Button>
              {keyAge && <span className="text-xs text-zinc-500">{keyAge}</span>}
            </div>
          )}

          {/* Runner: visible md+ (768px) */}
          {isInsider && (
            <Link to="/runner" title="Runner Dashboard" className="hidden md:inline-flex">
              <Button variant="ghost" size="icon" className="text-zinc-300 hover:text-white hover:bg-white/10 h-8 w-8">
                <Activity className="h-4 w-4" />
              </Button>
            </Link>
          )}

          {/* README: visible md+ (768px) */}
          <Link to="/readme" title="README" className="hidden md:inline-flex">
            <Button variant="ghost" size="icon" className="text-zinc-300 hover:text-white hover:bg-white/10 h-8 w-8">
              <BookOpen className="h-4 w-4" />
            </Button>
          </Link>

          {/* GitHub: visible md+ (768px) */}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" title="GitHub" className="hidden md:inline-flex">
            <Button variant="ghost" size="icon" className="text-zinc-300 hover:text-white hover:bg-white/10 h-8 w-8">
              <GitHubLogo className="h-4 w-4" />
            </Button>
          </a>

          {/* Theme: visible lg+ (1024px) */}
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-300 hover:text-white hover:bg-white/10 h-8 w-8 hidden md:inline-flex"
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
      {searchEnabled && isInsider && (
        <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      )}
    </header>
  );
}

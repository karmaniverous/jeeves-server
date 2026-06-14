import { Moon, Sun, BookOpen, KeyRound, GitBranch, Search, Activity } from 'lucide-react';
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
  downloadDropdown,
  linkControls,
  downloadMenuItem,
  linkMenuItem,
}: HeaderProps) {
  const branding = useBranding();
  const hasKeyMgmt = isInsider && onRotateKey;
  const [readmeUrl, setReadmeUrl] = useState<string | null>(null);
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

  useEffect(() => {
    fetch('/api/readme-link')
      .then(r => r.ok ? r.json() as Promise<{ url: string }> : null)
      .then(data => { if (data?.url) setReadmeUrl(data.url); })
      .catch(() => {});
  }, []);

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
  if (readmeUrl) {
    collapsedItems.push({
      breakpoint: 'md',
      node: (
        <a href={readmeUrl} className={menuItemClass}>
          <BookOpen className="h-4 w-4 shrink-0" />
          README
        </a>
      ),
    });
  }

  // GitHub — hidden below md (768px)
  collapsedItems.push({
    breakpoint: 'md',
    node: (
      <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={menuItemClass}>
        <GitBranch className="h-4 w-4 shrink-0" />
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
          <Link to="/browse" className="text-3xl no-underline shrink-0 mr-1" title={branding.name}>
            {branding.emoji}
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
          {readmeUrl && (
            <a href={readmeUrl} title="README" className="hidden md:inline-flex">
              <Button variant="ghost" size="icon" className="text-zinc-300 hover:text-white hover:bg-white/10 h-8 w-8">
                <BookOpen className="h-4 w-4" />
              </Button>
            </a>
          )}

          {/* GitHub: visible md+ (768px) */}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" title="GitHub" className="hidden md:inline-flex">
            <Button variant="ghost" size="icon" className="text-zinc-300 hover:text-white hover:bg-white/10 h-8 w-8">
              <GitBranch className="h-4 w-4" />
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

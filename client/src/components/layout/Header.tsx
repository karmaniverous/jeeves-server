import { Moon, Sun, Info, KeyRound, Link as LinkIcon, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

import { AccountMenu } from '@/components/AccountMenu';
import { Button } from '@/components/ui/button';
import type { BreadcrumbItem } from '@/lib/api';

interface HeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  isInsider: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  keyAge?: string | null;
  onRotateKey?: () => void;
  downloadDropdown?: React.ReactNode;
  linkControls?: React.ReactNode;
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
}: HeaderProps) {
  const hasKeyMgmt = isInsider && onRotateKey;

  // Build account menu collapsed items in left-to-right header order
  const collapsedItems: { node: React.ReactNode; breakpoint: 'sm' | 'md' | 'lg' }[] = [];

  // Link controls — hidden below sm
  if (linkControls) {
    collapsedItems.push({
      breakpoint: 'sm',
      node: (
        <div className="flex items-center gap-2 px-1 py-0.5 text-sm text-foreground">
          {linkControls}
          <span>Share</span>
        </div>
      ),
    });
  }

  // Download dropdown — hidden below md
  if (downloadDropdown) {
    collapsedItems.push({
      breakpoint: 'md',
      node: (
        <div className="flex items-center gap-2 px-1 py-0.5 text-sm text-foreground">
          {downloadDropdown}
          <span>Download</span>
        </div>
      ),
    });
  }

  // Key management — hidden below lg
  if (hasKeyMgmt) {
    collapsedItems.push({
      breakpoint: 'lg',
      node: (
        <button
          onClick={onRotateKey}
          className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors w-full text-left"
        >
          <KeyRound className="h-4 w-4" />
          Rotate key{keyAge ? ` (${keyAge})` : ''}
        </button>
      ),
    });
  }

  // About — hidden below xl
  collapsedItems.push({
    breakpoint: 'xl',
    node: (
      <Link
        to="/about"
        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
      >
        <Info className="h-4 w-4" />
        About Jeeves Server
      </Link>
    ),
  });

  // Theme — hidden below xl
  collapsedItems.push({
    breakpoint: 'xl',
    node: (
      <button
        onClick={onToggleTheme}
        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors w-full text-left"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
          {/* Link controls: visible sm+ */}
          {linkControls && (
            <div className="hidden sm:flex items-center">{linkControls}</div>
          )}

          {/* Download: visible md+ */}
          {downloadDropdown && (
            <div className="hidden md:flex items-center">{downloadDropdown}</div>
          )}

          {/* Key management: visible lg+ */}
          {hasKeyMgmt && (
            <div className="hidden lg:flex items-center gap-1">
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

          {/* About: visible xl+ */}
          <Link to="/about" title="About Jeeves Server" className="hidden xl:inline-flex">
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white h-8 w-8">
              <Info className="h-4 w-4" />
            </Button>
          </Link>

          {/* Theme: visible xl+ */}
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-white h-8 w-8 hidden xl:inline-flex"
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

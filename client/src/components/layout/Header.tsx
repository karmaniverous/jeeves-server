import { Moon, Sun, Info, KeyRound } from 'lucide-react';
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
  /** Download dropdown (context-dependent) */
  downloadDropdown?: React.ReactNode;
  /** Link dropdown + expiry selector */
  linkControls?: React.ReactNode;
}

function Divider() {
  return <div className="w-px h-6 bg-zinc-600 mx-1 shrink-0" />;
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
  const hasDownloads = !!downloadDropdown;
  const hasShare = !!linkControls;
  const hasKeyMgmt = isInsider && onRotateKey;
  const hasActionBar = hasDownloads || hasShare || hasKeyMgmt;

  return (
    <header className="bg-zinc-800 text-white px-4 py-2">
      <div className="flex flex-wrap items-center gap-y-1">
        {/* Group 1: Breadcrumbs (🎩 pinned, rest scrollable) */}
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

        {/* Group 2: Action bar (download, link, key) — wraps to row 2 on medium screens */}
        {hasActionBar && (
          <div className="flex items-center gap-1 shrink-0 order-3 lg:order-2 w-full lg:w-auto mt-1 lg:mt-0">
            {hasDownloads && (
              <>
                <div className="flex items-center gap-1">{downloadDropdown}</div>
                {(hasShare || hasKeyMgmt) && <Divider />}
              </>
            )}
            {hasShare && (
              <>
                <div className="flex items-center gap-2">{linkControls}</div>
                {hasKeyMgmt && <Divider />}
              </>
            )}
            {hasKeyMgmt && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-zinc-400 hover:text-white h-8 w-8"
                  title="Rotate key (invalidates all your shares)"
                  onClick={onRotateKey}
                >
                  <KeyRound className="h-4 w-4" />
                </Button>
                {keyAge && (
                  <span className="text-xs text-zinc-500">{keyAge}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Group 3: Utility bar (info, theme, account) */}
        <div className="flex items-center gap-1 shrink-0 order-2 lg:order-3">
          {/* Info & theme — visible at lg+, hidden below (folded into account menu) */}
          <Link to="/about" title="About Jeeves Server" className="hidden lg:inline-flex">
            <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white h-8 w-8">
              <Info className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="text-zinc-400 hover:text-white h-8 w-8 hidden lg:inline-flex"
            title="Toggle theme"
            onClick={onToggleTheme}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <AccountMenu
            theme={theme}
            onToggleTheme={onToggleTheme}
            collapsed={true}
          />
        </div>
      </div>
    </header>
  );
}

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
  return <div className="w-px h-6 bg-zinc-600 mx-1" />;
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

  return (
    <header className="sticky top-0 z-50 bg-zinc-800 text-white px-4 py-2 flex flex-wrap items-center gap-2 shadow-sm">
      <nav className="flex items-center gap-1 min-w-0 flex-1">
        <Link to="/browse" className="text-3xl no-underline" title="Jeeves Server">
          🎩
        </Link>
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.path} className="flex items-center gap-1">
            {i > 0 || breadcrumbs.length > 0 ? (
              <span className="text-zinc-500 mx-1">/</span>
            ) : null}
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

      <div className="flex items-center gap-1 flex-wrap">
        {/* Download options */}
        {hasDownloads && (
          <>
            <div className="flex items-center gap-1">{downloadDropdown}</div>
            {(hasShare || hasKeyMgmt) && <Divider />}
          </>
        )}

        {/* Link copiers & expiry */}
        {hasShare && (
          <>
            <div className="flex items-center gap-2">{linkControls}</div>
            {hasKeyMgmt && <Divider />}
          </>
        )}

        {/* Key management */}
        {hasKeyMgmt && (
          <>
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
            <Divider />
          </>
        )}

        {/* Info */}
        <Link to="/about" title="About Jeeves Server">
          <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white h-8 w-8">
            <Info className="h-4 w-4" />
          </Button>
        </Link>

        {/* Day/night */}
        <Button
          variant="ghost"
          size="icon"
          className="text-zinc-400 hover:text-white h-8 w-8"
          title="Toggle theme"
          onClick={onToggleTheme}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* Account */}
        <AccountMenu />
      </div>
    </header>
  );
}

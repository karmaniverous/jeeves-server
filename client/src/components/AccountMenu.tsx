import { Info, LogOut, Moon, Sun, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/lib/auth';

interface AccountMenuProps {
  /** Extra items to show in the menu (e.g. info/theme at narrow widths) */
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  /** Show info/theme inside menu (collapsed mode) */
  collapsed?: boolean;
}

export function AccountMenu({ theme, onToggleTheme, collapsed }: AccountMenuProps) {
  const { authenticated, email, picture } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
          <div className="px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground truncate">{email}</span>
            </div>
          </div>
          {collapsed && (
            <>
              <Link
                to="/about"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
              >
                <Info className="h-4 w-4" />
                About Jeeves Server
              </Link>
              {onToggleTheme && (
                <button
                  onClick={() => { onToggleTheme(); setOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors w-full text-left"
                >
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>
              )}
              <div className="border-b border-border" />
            </>
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

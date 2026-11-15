/**
 * The header controls the account menu shows once the header is too narrow for them, in left-to-right header order, each with the breakpoint below which it moves into the menu.
 */
import { Activity, BookOpen, KeyRound, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { CollapsedItem } from '@/components/AccountMenu';
import { GITHUB_URL, GitHubLogo } from '@/components/layout/GitHubLogo';

const menuItemClass =
  'flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors w-full text-left cursor-pointer';

/** What the menu items depend on (the header's props). */
interface HeaderMenuOptions {
  isInsider: boolean;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  keyAge?: string | null;
  /** Set when key management is shown (an insider with a rotate handler). */
  onRotateKey?: () => void;
  downloadMenuItem?: (onDismiss: () => void) => React.ReactNode;
  linkMenuItem?: (onDismiss: () => void) => React.ReactNode;
}

/**
 * The account menu's collapsed header items.
 *
 * @param options - The header's state.
 * @returns The items, in header order.
 */
export function headerMenuItems({
  isInsider,
  theme,
  onToggleTheme,
  keyAge,
  onRotateKey,
  downloadMenuItem,
  linkMenuItem,
}: HeaderMenuOptions): CollapsedItem[] {
  const collapsedItems: CollapsedItem[] = [];

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
  if (onRotateKey) {
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
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={menuItemClass}
      >
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
        {theme === 'dark' ? (
          <Sun className="h-4 w-4 shrink-0" />
        ) : (
          <Moon className="h-4 w-4 shrink-0" />
        )}
        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
      </button>
    ),
  });

  return collapsedItems;
}

/**
 * Recursive collapsible TOC section component.
 *
 * @packageDocumentation
 */
import { ChevronRight } from 'lucide-react';

import type { TocNode } from './tocUtils.js';

interface TocSectionProps {
  node: TocNode;
  collapsed: Set<string>;
  toggleCollapse: (slug: string) => void;
  activeSlug?: string;
  scrollTo: (slug: string) => void;
}

export function TocSection({
  node,
  collapsed,
  toggleCollapse,
  activeSlug,
  scrollTo,
}: TocSectionProps) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.heading.slug);
  const isActive = activeSlug === node.heading.slug;

  return (
    <div>
      <div className="flex items-center">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggleCollapse(node.heading.slug)}
            className="w-4 h-4 flex items-center justify-center text-muted-foreground shrink-0"
          >
            <ChevronRight
              className={`h-3 w-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
            />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => scrollTo(node.heading.slug)}
          className={`text-left text-sm py-0.5 transition-colors truncate ${
            isActive
              ? 'text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          style={{ paddingLeft: `${(node.heading.level - 1) * 0.75}rem` }}
        >
          {node.heading.text}
        </button>
      </div>
      {hasChildren && !isCollapsed && (
        <div>
          {node.children.map((child) => (
            <TocSection
              key={child.heading.slug}
              node={child}
              collapsed={collapsed}
              toggleCollapse={toggleCollapse}
              activeSlug={activeSlug}
              scrollTo={scrollTo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

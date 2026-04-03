/**
 * Recursive collapsible TOC section component.
 */
import { ChevronRight } from 'lucide-react';

export interface TocNode {
  heading: { level: number; text: string; slug: string };
  children: TocNode[];
}

/**
 * Build a tree of TocNodes from a flat heading list.
 */
export function buildTocTree(
  headings: { level: number; text: string; slug: string }[],
): TocNode[] {
  const root: TocNode[] = [];
  const stack: TocNode[] = [];

  for (const heading of headings) {
    const node: TocNode = { heading, children: [] };

    // Pop stack until we find a parent with a lower level
    while (
      stack.length > 0 &&
      stack[stack.length - 1]!.heading.level >= heading.level
    ) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1]!.children.push(node);
    }

    stack.push(node);
  }

  return root;
}

/**
 * Find all ancestor slugs for a given slug in the tree.
 */
export function findAncestorSlugs(
  nodes: TocNode[],
  targetSlug: string,
): string[] {
  const path: string[] = [];

  function walk(list: TocNode[]): boolean {
    for (const node of list) {
      if (node.heading.slug === targetSlug) return true;
      path.push(node.heading.slug);
      if (walk(node.children)) return true;
      path.pop();
    }
    return false;
  }

  walk(nodes);
  return path;
}

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

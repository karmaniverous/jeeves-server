/**
 * TOC tree utilities for building and navigating heading hierarchies.
 *
 * @packageDocumentation
 */

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

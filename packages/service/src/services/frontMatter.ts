/**
 * Front matter of a Markdown document: the leading `---` YAML block, parsed
 * with the `yaml` package's Document API (YAML 1.2 core schema). The
 * top-level `jeeves` key is the platform's reserved namespace when its value
 * is a mapping (Decision 2): it is returned as directives and removed from
 * the YAML that is displayed, keeping the author's comments and key order.
 *
 * @packageDocumentation
 */

import { isMap, parseDocument } from 'yaml';

/** The front matter block: `---`, the YAML, `---`, each on its own line. */
const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

/** The reserved platform namespace (Decision 2). */
const JEEVES_KEY = 'jeeves';

/** A document's front matter. */
export interface FrontMatter {
  /** The YAML between the delimiters as written; `null` without a block. */
  raw: string | null;
  /** Lines the block (delimiters included) takes in the source. */
  lineCount: number;
  /** The parsed values; `null` without a block, or when the YAML is invalid or not a mapping. */
  data: Record<string, unknown> | null;
  /** The value of a `jeeves` mapping; `null` otherwise. */
  directives: Record<string, unknown> | null;
  /** The YAML to show; `null` (or empty) shows no block. */
  display: string | null;
  /** `jeeves` is present but not a mapping: shown, not interpreted. */
  jeevesIgnored: boolean;
}

/** No front matter at all. */
const NONE: FrontMatter = {
  raw: null,
  lineCount: 0,
  data: null,
  directives: null,
  display: null,
  jeevesIgnored: false,
};

/**
 * Split a Markdown source into its front matter and body. Invalid YAML is
 * shown raw, with no data and no directives.
 *
 * @param source - The full Markdown text.
 * @returns The front matter and the body after it.
 */
export function parseFrontMatter(source: string): {
  frontMatter: FrontMatter;
  body: string;
} {
  const match = FRONT_MATTER_RE.exec(source);
  if (!match) return { frontMatter: NONE, body: source };

  const raw = match[1];
  const shown: FrontMatter = {
    ...NONE,
    raw,
    lineCount: match[0].split('\n').length - 1,
    display: raw,
  };
  const body = source.slice(match[0].length);

  const doc = parseDocument(raw);
  if (doc.errors.length > 0 || !isMap(doc.contents))
    return { frontMatter: shown, body };

  const data = doc.toJS() as Record<string, unknown>;
  const jeeves = doc.get(JEEVES_KEY, true);
  if (jeeves === undefined) return { frontMatter: { ...shown, data }, body };
  if (!isMap(jeeves))
    return { frontMatter: { ...shown, data, jeevesIgnored: true }, body };

  doc.delete(JEEVES_KEY);
  const display =
    doc.contents.items.length === 0
      ? null
      : doc.toString({ lineWidth: 0 }).replace(/\r?\n$/, '');
  return {
    frontMatter: {
      ...shown,
      data,
      directives: data[JEEVES_KEY] as Record<string, unknown>,
      display,
    },
    body,
  };
}

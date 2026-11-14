/**
 * Normalises recorded reply text so it is the same on every run, host and platform: temp and package paths, the content root's URL, keys and deep-share stacks, OTP blobs, timestamps, uptime, versions and UUIDs; on Windows it also maps drive listings and breadcrumbs onto the Linux view of the content root. Pure.
 *
 * @packageDocumentation
 */

import { WIRE_ROOT_ID } from './wireFixture.js';

/** The paths a reply may contain. */
export interface NormaliseContext {
  /** Temp directory. */
  dir: string;
  /** Content root's URL path (leading slash). */
  rootUrl: string;
  /** Service package directory. */
  serviceDir: string;
  /** Service package directory as the server writes it in URLs. */
  serviceUrl: string;
  /** Platform the reply came from. */
  platform: NodeJS.Platform;
}

/**
 * Replace every occurrence of each form with the placeholder.
 *
 * @param text - Text.
 * @param forms - Literal forms (empty ones skipped).
 * @param placeholder - Replacement.
 * @returns The text.
 */
function replaceAll(text: string, forms: string[], placeholder: string) {
  let out = text;
  for (const form of forms) if (form) out = out.split(form).join(placeholder);
  return out;
}

/**
 * The forms a filesystem path takes in a reply: raw, JSON-escaped,
 * forward-slashed and URI-encoded.
 *
 * @param p - Path.
 * @returns Forms, longest (JSON-escaped) first.
 */
const pathForms = (p: string): string[] => [
  JSON.stringify(p).slice(1, -1),
  p,
  p.replace(/\\/g, '/'),
  encodeURIComponent(p),
];

/** The rest of a path following a path placeholder (any separators). */
const TAIL = /\{(dir|pkg)\}((?:(?:\\\\|\\|\/)[^\\/"'<>&?#]*)+)/g;

/** Value patterns that change between runs. */
const VOLATILE: readonly [RegExp, string][] = [
  [/(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])/g, '{key}'],
  [/((?:[?&]|&amp;)s=)[^&"'\s<>#]+/g, '$1{stack}'],
  [/(%26s%3D)(?:[\w$-]|%2B|%24)+/g, '$1{stack}'],
  [/((?:[?&]|&amp;)enc=)[^&"'\s<>#]+/g, '$1{enc}'],
  [/(state=|"state":")[0-9a-f]{64}/g, '$1{state}'],
  [/(code_challenge=)[\w-]+/g, '$1{challenge}'],
  [/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, '{ts}'],
  [/"uptime":\d+(?:\.\d+)?/g, '"uptime":0'],
  [/("version":)"[^"]*"/g, '$1"{version}"'],
  [
    /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
    '{uuid}',
  ],
];

/**
 * Normalise reply text.
 *
 * @param text - Body or header text.
 * @param ctx - Paths.
 * @returns The normalised text.
 */
export function normaliseText(text: string, ctx: NormaliseContext): string {
  const rootRel = ctx.rootUrl.replace(/^\//, '');
  const serviceRel = ctx.serviceUrl.replace(/^\//, '');
  let out = replaceAll(text, [rootRel, encodeURIComponent(rootRel)], '{root}');
  out = replaceAll(out, [WIRE_ROOT_ID], '{root}');
  out = replaceAll(out, [serviceRel, encodeURIComponent(serviceRel)], '{pkg}');
  out = replaceAll(out, pathForms(ctx.dir), '{dir}');
  out = replaceAll(out, pathForms(ctx.serviceDir), '{pkg}');
  out = out.replace(
    TAIL,
    (_m, name: string, tail: string) =>
      `{${name}}${tail.replace(/\\\\|\\/g, '/')}`,
  );
  for (const [pattern, replacement] of VOLATILE)
    out = out.replace(pattern, replacement);
  return out;
}

/** A drive listing entry (`GET /api/drives`). */
interface Drive {
  letter: string;
  label: string;
}

/**
 * True for a drive listing.
 *
 * @param value - Parsed body.
 * @returns Whether every element is exactly `{ letter, label }`.
 */
const isDriveList = (value: unknown): value is Drive[] =>
  Array.isArray(value) &&
  value.every(
    (d: unknown) =>
      typeof d === 'object' &&
      d !== null &&
      Object.keys(d).join() === 'letter,label',
  );

/**
 * Map platform-specific structure onto the Linux view: on Windows a drive
 * listing names every readable drive and breadcrumbs start at the drive,
 * where Linux lists the configured root and starts crumbs there.
 *
 * @param value - Parsed, text-normalised body.
 * @param ctx - Paths.
 * @returns The mapped value.
 */
function mapPlatform(value: unknown, ctx: NormaliseContext): unknown {
  if (isDriveList(value)) {
    if (ctx.platform !== 'win32') return value;
    const drive = ctx.rootUrl.split('/')[1];
    return value
      .filter((d) => d.letter === drive)
      .map(() => ({ letter: '{root}', label: '{dir}/content' }));
  }
  if (Array.isArray(value)) return value.map((v) => mapPlatform(v, ctx));
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      k === 'breadcrumbs' && Array.isArray(v)
        ? collapseCrumbs(v as { label: string; path: string }[])
        : mapPlatform(v, ctx),
    ]),
  );
}

/**
 * Start breadcrumbs at the content root, labelled `{root}`.
 *
 * @param crumbs - Breadcrumbs.
 * @returns Crumbs at or below the root.
 */
function collapseCrumbs(crumbs: { label: string; path: string }[]) {
  return crumbs
    .filter((c) => c.path === '{root}' || c.path.startsWith('{root}/'))
    .map((c) => (c.path === '{root}' ? { ...c, label: '{root}' } : c));
}

/**
 * Normalise a reply body: text first, then (for JSON) platform structure
 * and redacted fields. JSON that needs neither keeps its exact bytes.
 *
 * @param text - Body text.
 * @param ctx - Paths.
 * @param redact - Top-level fields to replace with `"{redacted}"`.
 * @returns The normalised body.
 */
export function normaliseBody(
  text: string,
  ctx: NormaliseContext,
  redact: string[] = [],
): string {
  const out = normaliseText(text, ctx);
  let parsed: unknown;
  try {
    parsed = JSON.parse(out);
  } catch {
    return out;
  }
  let mapped = mapPlatform(parsed, ctx);
  if (redact.length > 0 && typeof mapped === 'object' && mapped !== null) {
    mapped = Object.fromEntries(
      Object.entries(mapped).map(([k, v]) => [
        k,
        redact.includes(k) ? '{redacted}' : v,
      ]),
    );
  }
  const again = JSON.stringify(mapped);
  return again === JSON.stringify(parsed) ? out : again;
}

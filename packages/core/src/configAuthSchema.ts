/**
 * Config schemas for access: auth modes, Google and email login, event
 * webhooks, access scopes, insiders and keys.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

/** Supported authentication methods */
export const authModeSchema = z.enum(['google', 'keys', 'email']);

/** Google OAuth configuration */
export const googleAuthSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

/** Email (magic link) authentication configuration */
export const emailAuthSchema = z.object({
  /** SMTP connection string (e.g. smtps://user:pass\@smtp.example.com:465) */
  smtpUrl: z.string().min(1),
  /** Sender email address for magic link emails */
  fromAddress: z.email(),
});

/** Auth configuration */
export const authSchema = z.object({
  /** Active authentication methods. Order determines priority. */
  modes: z
    .array(authModeSchema)
    .min(1, { message: 'At least one auth mode is required' }),
  /** Google OAuth config. Required if modes includes "google". */
  google: googleAuthSchema.optional(),
  /** Session cookie signing secret. Required if modes includes "google". */
  sessionSecret: z.string().min(1).optional(),
  /** Email (magic link) auth config. Required if modes includes "email". */
  email: emailAuthSchema.optional(),
});

/** Event webhook configuration */
export const eventConfigSchema = z.object({
  schema: z.record(z.string(), z.unknown()),
  cmd: z.string(),
  map: z.record(z.string(), z.unknown()).optional(),
  timeoutMs: z.number().positive().optional(),
});

/**
 * Scopes configuration — controls which paths a user/key can access.
 *
 * Three forms:
 * - `string` — single allow pattern (e.g. '/d/*')
 * - `string[]` — array of allow patterns (shorthand for \{ allow: [...] \})
 * - `\{ allow?: string[], deny?: string[] \}` — explicit allow/deny rules
 *
 * Semantics:
 * - Path must match at least one allow rule AND NOT match any deny rule
 * - Omitting `allow` = implicit ['/*'] (allow everything)
 * - Omitting `deny` = no exclusions
 * - Omitting scopes entirely = unrestricted access
 */
export const scopesObjectSchema = z.object({
  allow: z.array(z.string()).optional(),
  deny: z.array(z.string()).optional(),
});

export const scopesSchema = z.union([
  z.string(),
  z.array(z.string()),
  scopesObjectSchema,
]);

/** Insider entry (identity + scopes + optional persisted seed) */
export const insiderEntrySchema = z.object({
  scopes: scopesSchema.optional(),
  /** Extra allow patterns merged on top of named scope references */
  allow: z.array(z.string()).optional(),
  /** Extra deny patterns merged on top of named scope references */
  deny: z.array(z.string()).optional(),
  /** Auto-generated insider seed, persisted in config.json */
  seed: z.string().min(1).optional(),
  /** ISO timestamp of when the seed was created */
  keyCreatedAt: z.string().optional(),
});

/** Key entry — plain string (seed, no scopes) or object with key + optional scopes */
export const keyEntrySchema = z.union([
  z.string().min(1),
  z.object({
    key: z.string().min(1),
    scopes: scopesSchema.optional(),
    /** Extra allow patterns merged on top of named scope references */
    allow: z.array(z.string()).optional(),
    /** Extra deny patterns merged on top of named scope references */
    deny: z.array(z.string()).optional(),
  }),
]);

/** Check if a string is a named scope identifier (not a path glob). */
export function isScopeName(v: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(v);
}

/** Helper: collect named scope references from a scopes field value.
 *
 * Backward-compat note: `scopes` has historically accepted path globs like "/**" or ["/a","/b"].
 * We only treat values as *named scope references* if they look like identifiers
 * (e.g. "restricted", "no-vc") rather than path globs.
 */
export function getScopeRefs(scopes: unknown): string[] {
  if (typeof scopes === 'string') return isScopeName(scopes) ? [scopes] : [];

  if (Array.isArray(scopes) && scopes.length > 0) {
    const strs = scopes.filter((v) => typeof v === 'string');
    if (strs.length !== scopes.length) return [];
    return strs.filter((v) => isScopeName(v));
  }

  return [];
}

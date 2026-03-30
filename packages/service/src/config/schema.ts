import { SERVER_PORT } from '@karmaniverous/jeeves';
import { z } from 'zod';

import { getBindAddress } from '../util/bindAddress.js';

/** Supported authentication methods */
export const authModeSchema = z.enum(['google', 'keys']);

/** Google OAuth configuration */
export const googleAuthSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
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
});

/** Event webhook configuration */
export const eventConfigSchema = z.object({
  schema: z.record(z.string(), z.unknown()),
  cmd: z.string(),
  map: z.record(z.string(), z.unknown()).optional(),
  timeoutMs: z.number().positive().optional(),
});

/**
 * Scopes configuration â€" controls which paths a user/key can access.
 *
 * Three forms:
 * - `string` â€" single allow pattern (e.g. '/d/*')
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

/** Insider entry (identity + scopes only; keys are in state.json) */
export const insiderEntrySchema = z.object({
  scopes: scopesSchema.optional(),
  /** Extra allow patterns merged on top of named scope references */
  allow: z.array(z.string()).optional(),
  /** Extra deny patterns merged on top of named scope references */
  deny: z.array(z.string()).optional(),
});

/** Key entry â€" plain string (seed, no scopes) or object with key + optional scopes */
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

/** Helper: collect named scope references from a scopes field value.
 *
 * Backward-compat note: `scopes` has historically accepted path globs like "/**" or ["/a","/b"].
 * We only treat values as *named scope references* if they look like identifiers
 * (e.g. "restricted", "no-vc") rather than path globs.
 */
function getScopeRefs(scopes: unknown): string[] {
  const isName = (v: string): boolean => /^[A-Za-z0-9_-]+$/.test(v);

  if (typeof scopes === 'string') return isName(scopes) ? [scopes] : [];

  if (Array.isArray(scopes) && scopes.length > 0) {
    const strs = scopes.filter((v) => typeof v === 'string');
    if (strs.length !== scopes.length) return [];
    return strs.filter((v) => isName(v));
  }

  return [];
}

/** Top-level Jeeves Server configuration */
export const jeevesConfigSchema = z
  .object({
    port: z.number().int().positive().default(SERVER_PORT),
    /**
     * Network interface to bind the server to.
     * Default: '0.0.0.0' (all interfaces — required for external access by insiders, share links, etc.)
     * Set to '127.0.0.1' to restrict to loopback only.
     */
    host: z.string().min(1).default(getBindAddress()),
    chromePath: z.string().min(1),
    auth: authSchema,
    /** Named scope definitions, referenced by insiders/keys/outsiderPolicy */
    scopes: z.record(z.string(), scopesObjectSchema).default({}),
    insiders: z.record(z.email(), insiderEntrySchema).default({}),
    keys: z.record(z.string(), keyEntrySchema).default({}),
    events: z.record(z.string(), eventConfigSchema).default({}),
    eventTimeoutMs: z.number().positive().default(30_000),
    eventLogPurgeMs: z.number().positive().default(2_592_000_000),
    /** Maximum directory size in MB for ZIP export. Directories exceeding this are refused. */
    maxZipSizeMb: z.number().positive().default(100),
    /**
     * Filesystem roots for the file browser (Linux only).
     * Map of id â†' filesystem path. On Windows this is ignored (drives are auto-discovered).
     * Example: \{ home: '/home/user', projects: '/opt/projects' \}
     * Default: \{ root: '/' \}
     */
    roots: z.record(z.string(), z.string()).optional(),
    /**
     * URL of the jeeves-runner API for process dashboard proxy.
     * Default: 'http://127.0.0.1:1937'
     */
    runnerUrl: z.url().optional(),
    /** @deprecated Mermaid is now bundled. This field is ignored but kept for backward compatibility. */
    mermaidCliPath: z.string().optional(),
    /**
     * PlantUML rendering configuration.
     * - jarPath: local PlantUML jar (requires Java). Tried first â€" supports !include.
     * - servers: fallback PlantUML server URLs, tried in order.
     *   The public community server (https://www.plantuml.com/plantuml) is always
     *   appended as the last resort unless explicitly listed.
     * If omitted entirely, only the community server is used.
     */
    plantuml: z
      .object({
        jarPath: z.string().optional(),
        javaPath: z.string().optional(),
        servers: z.array(z.url()).optional(),
      })
      .optional(),
    /**
     * Directory for cached rendered diagrams (content-addressed by source hash).
     * Defaults to `.diagram-cache` in the server working directory.
     */
    diagramCachePath: z.string().optional(),
    /**
     * URL of the jeeves-watcher API for semantic search.
     * When set, the search UI appears in the header. Example: 'http://127.0.0.1:1936'
     */
    watcherUrl: z.url().optional(),
    /**
     * URL of the jeeves-meta API for synthesis engine health checks.
     * Default: 'http://127.0.0.1:1938'
     */
    metaUrl: z.url().default('http://127.0.0.1:1938'),
    /**
     * Global outsider policy â€" constrains which paths are eligible for outsider sharing.
     * Uses the same allow/deny model as insider scopes.
     * If omitted, all paths are shareable with outsiders.
     */
    outsiderPolicy: scopesSchema.optional(),
  })
  .superRefine((config, ctx) => {
    // Google auth mode requires google config + sessionSecret
    if (config.auth.modes.includes('google')) {
      if (!config.auth.google) {
        ctx.addIssue({
          code: 'custom',
          message: 'auth.google is required when auth.modes includes "google"',
          path: ['auth', 'google'],
        });
      }
      if (!config.auth.sessionSecret) {
        ctx.addIssue({
          code: 'custom',
          message:
            'auth.sessionSecret is required when auth.modes includes "google"',
          path: ['auth', 'sessionSecret'],
        });
      }
    }

    // Keys auth mode requires at least one key
    if (
      config.auth.modes.includes('keys') &&
      Object.keys(config.keys).length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one key is required when auth.modes includes "keys"',
        path: ['keys'],
      });
    }

    // _internal and _plugin keys must not have scopes
    for (const reserved of ['_internal', '_plugin'] as const) {
      const key = config.keys[reserved];
      if (key && typeof key === 'object' && 'scopes' in key && key.scopes) {
        ctx.addIssue({
          code: 'custom',
          message: `${reserved} key must not have scopes (it is always unscoped)`,
          path: ['keys', reserved],
        });
      }
    }

    // Validate all scope name references resolve to the top-level scopes map
    const scopeNames = new Set(Object.keys(config.scopes));
    const validateRefs = (
      refs: string[],
      refPath: (string | number)[],
    ): void => {
      for (const ref of refs) {
        if (!scopeNames.has(ref)) {
          ctx.addIssue({
            code: 'custom',
            message: `Scope "${ref}" is not defined in the top-level scopes map`,
            path: refPath,
          });
        }
      }
    };

    for (const [email, entry] of Object.entries(config.insiders)) {
      const refs = getScopeRefs(entry.scopes);
      if (refs.length > 0) validateRefs(refs, ['insiders', email, 'scopes']);
    }

    for (const [name, entry] of Object.entries(config.keys)) {
      if (typeof entry === 'object') {
        const refs = getScopeRefs(entry.scopes);
        if (refs.length > 0) validateRefs(refs, ['keys', name, 'scopes']);
      }
    }

    const outsiderRefs = getScopeRefs(config.outsiderPolicy);
    if (outsiderRefs.length > 0) validateRefs(outsiderRefs, ['outsiderPolicy']);
  });

/** Inferred config type */
export type JeevesConfig = z.infer<typeof jeevesConfigSchema>;

/** Auth mode type */
export type AuthMode = z.infer<typeof authModeSchema>;

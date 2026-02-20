import { z } from 'zod';

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
  modes: z.array(authModeSchema).min(1, { message: 'At least one auth mode is required' }),
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
 * Scopes configuration — controls which paths a user/key can access.
 *
 * Three forms:
 * - `string` — single allow pattern (e.g. '/d/*')
 * - `string[]` — array of allow patterns (shorthand for { allow: [...] })
 * - `{ allow?: string[], deny?: string[] }` — explicit allow/deny rules
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
});

/** Key entry — plain string (seed, no scopes) or object with key + optional scopes */
export const keyEntrySchema = z.union([
  z.string().min(1),
  z.object({
    key: z.string().min(1),
    scopes: scopesSchema.optional(),
  }),
]);

/** Top-level Jeeves Server configuration */
export const jeevesConfigSchema = z
  .object({
    port: z.number().int().positive(),
    chromePath: z.string().min(1),
    auth: authSchema,
    insiders: z.record(z.string().email(), insiderEntrySchema).default({}),
    keys: z.record(z.string(), keyEntrySchema).default({}),
    events: z.record(z.string(), eventConfigSchema).default({}),
    eventTimeoutMs: z.number().positive().default(30_000),
    eventLogPurgeMs: z.number().positive().default(2_592_000_000),
    /** Maximum directory size in MB for ZIP export. Directories exceeding this are refused. */
    maxZipSizeMb: z.number().positive().default(100),
    /**
     * Filesystem roots for the file browser (Linux only).
     * Map of id → filesystem path. On Windows this is ignored (drives are auto-discovered).
     * Example: { home: '/home/user', projects: '/opt/projects' }
     * Default: { root: '/' }
     */
    roots: z.record(z.string(), z.string()).optional(),
    /** Path to mermaid-cli (npx prefix directory). If not set, mermaid rendering is disabled. */
    mermaidCliPath: z.string().optional(),
    /**
     * PlantUML rendering configuration.
     * - jarPath: local PlantUML jar (requires Java). Tried first — supports !include.
     * - servers: fallback PlantUML server URLs, tried in order.
     *   The public community server (https://www.plantuml.com/plantuml) is always
     *   appended as the last resort unless explicitly listed.
     * If omitted entirely, only the community server is used.
     */
    plantuml: z.object({
      jarPath: z.string().optional(),
      servers: z.array(z.string().url()).optional(),
    }).optional(),
    /**
     * Global outsider policy — constrains which paths are eligible for outsider sharing.
     * Uses the same allow/deny model as insider scopes.
     * If omitted, all paths are shareable with outsiders.
     */
    outsiderPolicy: scopesObjectSchema.optional(),
  })
  .superRefine((config, ctx) => {
    // Google auth mode requires google config + sessionSecret
    if (config.auth.modes.includes('google')) {
      if (!config.auth.google) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'auth.google is required when auth.modes includes "google"',
          path: ['auth', 'google'],
        });
      }
      if (!config.auth.sessionSecret) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'auth.sessionSecret is required when auth.modes includes "google"',
          path: ['auth', 'sessionSecret'],
        });
      }
    }

    // Keys auth mode requires at least one key
    if (config.auth.modes.includes('keys') && Object.keys(config.keys).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one key is required when auth.modes includes "keys"',
        path: ['keys'],
      });
    }

    // _internal key must not have scopes
    const internal = config.keys['_internal'];
    if (internal && typeof internal === 'object' && 'scopes' in internal && internal.scopes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '_internal key must not have scopes (it is always unscoped)',
        path: ['keys', '_internal'],
      });
    }
  });

/** Inferred config type */
export type JeevesConfig = z.infer<typeof jeevesConfigSchema>;

/** Auth mode type */
export type AuthMode = z.infer<typeof authModeSchema>;

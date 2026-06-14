import { SERVER_PORT } from '@karmaniverous/jeeves';
import { z } from 'zod';

/** Config properties deprecated in v3.6.0 (now resolved via core services). */
export const DEPRECATED_CONFIG_PROPS = [
  'host',
  'runnerUrl',
  'watcherUrl',
  'metaUrl',
] as const;

/** Supported authentication methods */
export const authModeSchema = z.enum(['google', 'keys', 'email']);

/** Google OAuth configuration */
export const googleAuthSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

/** Email (magic link) authentication configuration */
export const emailAuthSchema = z.object({
  /** SMTP connection string (e.g. smtps://user:pass@smtp.example.com:465) */
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
function getScopeRefs(scopes: unknown): string[] {
  if (typeof scopes === 'string') return isScopeName(scopes) ? [scopes] : [];

  if (Array.isArray(scopes) && scopes.length > 0) {
    const strs = scopes.filter((v) => typeof v === 'string');
    if (strs.length !== scopes.length) return [];
    return strs.filter((v) => isScopeName(v));
  }

  return [];
}

/** Logging configuration. Not hot-reloadable — changes require service restart. */
export const loggingConfigSchema = z.object({
  /** Log level. */
  level: z
    .string()
    .optional()
    .describe('Logging level (trace, debug, info, warn, error, fatal).'),
  /** Log file path. */
  file: z
    .string()
    .optional()
    .describe('Path to log file (logs to stdout if omitted).'),
});

/** Inferred logging config type. */
export type LoggingConfig = z.infer<typeof loggingConfigSchema>;

/** OAuth provider configuration */
export const oauthProviderSchema = z.object({
  authUrl: z.string().pipe(z.url()),
  tokenUrl: z.string().pipe(z.url()),
  pkce: z.boolean().default(false),
  defaultScopes: z.array(z.string()).default([]),
});

/** OAuth configuration */
export const oauthSchema = z.object({
  credentialDir: z.string(),
  providers: z.record(z.string(), oauthProviderSchema).default({}),
});

/** Theme overrides for light and dark modes */
export const themeOverridesSchema = z.record(z.string(), z.string());

/** Instance branding configuration */
export const brandingSchema = z.object({
  /** Instance display name (used in page title, navbar, emails) */
  name: z.string().default('Jeeves Server'),
  /** Instance emoji (used as home icon in navbar) */
  emoji: z.string().default('🎩'),
  /** CSS variable overrides grouped by theme mode */
  theme: z
    .object({
      light: themeOverridesSchema.optional(),
      dark: themeOverridesSchema.optional(),
    })
    .optional(),
  /** Handlebars template for magic link emails. Supports {{magicLink}}, {{branding.name}}, {{branding.emoji}} */
  emailTemplate: z.string().optional(),
});

/** Top-level Jeeves Server configuration */
export const jeevesConfigSchema = z
  .object({
    port: z.number().int().positive().default(SERVER_PORT),
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
     * Map of id → filesystem path. On Windows this is ignored (drives are auto-discovered).
     * Example: \{ home: '/home/user', projects: '/opt/projects' \}
     * Default: \{ root: '/' \}
     */
    roots: z.record(z.string(), z.string()).optional(),
    /** @deprecated Mermaid is now bundled. This field is ignored but kept for backward compatibility. */
    mermaidCliPath: z.string().optional(),
    /**
     * PlantUML rendering configuration.
     * - jarPath: local PlantUML jar (requires Java). Tried first — supports !include.
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
     * Global outsider policy — constrains which paths are eligible for outsider sharing.
     * Uses the same allow/deny model as insider scopes.
     * If omitted, all paths are shareable with outsiders.
     */
    outsiderPolicy: scopesSchema.optional(),
    /**
     * Logging configuration.
     * Not hot-reloadable — changes require a service restart.
     */
    logging: loggingConfigSchema.optional(),
    /** OAuth2 credential management configuration */
    oauth: oauthSchema.optional(),
    /**
     * Shortlink redirects. Keys are slug identifiers (`[a-zA-Z0-9_-]+`),
     * values are redirect targets — either relative paths (e.g. `/browse/...`)
     * or absolute URLs (e.g. `https://example.com`).
     *
     * Accessible at `GET /go/:slug` without authentication.
     */
    go: z
      .record(
        z.string().regex(/^[a-zA-Z0-9_-]+$/),
        z
          .string()
          .min(1)
          .refine((v) => v.startsWith('/') || /^[a-z]+:\/\//i.test(v), {
            message:
              'Target must be a relative path starting with / or an absolute URL',
          }),
      )
      .default({}),
    /** Instance branding (name, emoji, theme overrides, email template) */
    branding: brandingSchema.optional(),
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

    // Email auth mode requires email config
    if (config.auth.modes.includes('email')) {
      if (!config.auth.email) {
        ctx.addIssue({
          code: 'custom',
          message: 'auth.email is required when auth.modes includes "email"',
          path: ['auth', 'email'],
        });
      }
      if (!config.auth.sessionSecret) {
        ctx.addIssue({
          code: 'custom',
          message:
            'auth.sessionSecret is required when auth.modes includes "email"',
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

/** Inferred branding type */
export type Branding = z.infer<typeof brandingSchema>;

/** Default branding values. Single source of truth for all fallbacks. */
export const DEFAULT_BRANDING = {
  name: 'Jeeves Server',
  emoji: '🎩',
} as const;

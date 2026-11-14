import { SERVER_PORT } from '@karmaniverous/jeeves';
import { z } from 'zod';

import type { authModeSchema } from './configAuthSchema.js';
import {
  authSchema,
  eventConfigSchema,
  getScopeRefs,
  insiderEntrySchema,
  keyEntrySchema,
  scopesObjectSchema,
  scopesSchema,
} from './configAuthSchema.js';
import {
  brandingSchema,
  loggingConfigSchema,
  oauthSchema,
} from './configFeatureSchemas.js';
import { absolutePathSchema, printStylesSchema } from './configPrintStyles.js';

export {
  authModeSchema,
  authSchema,
  emailAuthSchema,
  eventConfigSchema,
  googleAuthSchema,
  insiderEntrySchema,
  isScopeName,
  keyEntrySchema,
  scopesObjectSchema,
  scopesSchema,
} from './configAuthSchema.js';
export type { LoggingConfig } from './configFeatureSchemas.js';
export {
  brandingSchema,
  loggingConfigSchema,
  oauthProviderSchema,
  oauthSchema,
  themeOverridesSchema,
} from './configFeatureSchemas.js';

/** Config properties deprecated in v3.6.0 (now resolved via core services). */
export const DEPRECATED_CONFIG_PROPS = [
  'host',
  'runnerUrl',
  'watcherUrl',
  'metaUrl',
] as const;

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
     * Directory for cached PDF/DOCX exports. Defaults to `.export-cache` in
     * the server working directory. Read at startup.
     */
    exportCachePath: z.string().optional(),
    /**
     * Named PDF print styles (#316): absolute paths to a stylesheet and
     * optional header/footer templates and assets directory, read on use.
     */
    printStyles: printStylesSchema.optional(),
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
    /** Absolute path to the durable event queue JSONL file. Cursor file is derived as eventQueue + '.cursor'. */
    eventQueue: absolutePathSchema('eventQueue').optional(),
    /** Maximum number of event queue entries processed concurrently. Defaults to 3. */
    eventQueueConcurrency: z.number().int().positive().default(3),
    /** Public base URL (e.g. https://jeeves.johngalt.id). When set, API responses include full public URLs. */
    publicUrl: z.url().optional(),
    /**
     * Trust `X-Forwarded-Proto` / `X-Forwarded-Host` / `Host` to build the
     * public origin when `publicUrl` is unset. Enable only behind a proxy
     * that sets or strips these headers itself. Default: false.
     */
    trustProxyHeaders: z.boolean().default(false),
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

    // Login links and OAuth redirects are absolute URLs on a trusted public
    // origin: publicUrl, or forwarding headers only when explicitly trusted.
    const loginFlows = [
      config.auth.modes.includes('email') ? 'email login' : null,
      config.auth.modes.includes('google') ? 'Google login' : null,
      config.oauth ? 'OAuth (oauth)' : null,
    ].filter((flow): flow is string => flow !== null);
    if (
      loginFlows.length > 0 &&
      !config.publicUrl &&
      !config.trustProxyHeaders
    ) {
      ctx.addIssue({
        code: 'custom',
        message: `publicUrl is required when ${loginFlows.join(', ')} is configured (or set trustProxyHeaders: true behind a proxy that sets X-Forwarded-* headers)`,
        path: ['publicUrl'],
      });
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

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

/** Insider entry (identity + scopes only; keys are in state.json) */
export const insiderEntrySchema = z.object({
  scopes: z.union([z.string(), z.array(z.string())]).optional(),
});

/** Key entry — plain string (seed, no scopes) or object with key + optional scopes */
export const keyEntrySchema = z.union([
  z.string().min(1),
  z.object({
    key: z.string().min(1),
    scopes: z.union([z.string(), z.array(z.string())]).optional(),
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

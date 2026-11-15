/**
 * Config schemas for optional features: logging, OAuth credential
 * management and branding.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

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
  /** Handlebars template for magic link emails. Supports \{\{magicLink\}\}, \{\{branding.name\}\}, \{\{branding.emoji\}\} */
  emailTemplate: z.string().optional(),
});

/**
 * The server's `health` block in `GET /status` (`serverHealthSchema`): today's block plus the 3.16.0 additions (sign-in redirect URIs, `eventQueue`), with the event commands and the Chrome path optional because callers that aren't admin don't get them (Decision 22). Pure.
 *
 * @packageDocumentation
 */

import { z } from 'zod';

/** CSS variable overrides of one theme mode. */
const cssOverridesSchema = z.record(z.string(), z.string());

/** A downstream service as `/status` last saw it. */
export const serviceProbeSchema = z.object({
  /** Service URL. */
  url: z.string(),
  /** Whether its `/status` or `/health` answered. */
  reachable: z.boolean(),
  /** Version it reported. */
  version: z.string().optional(),
});

/** Event queue progress (counts since start; timestamps ISO). */
export const eventQueueHealthSchema = z.object({
  /** Byte offset the processor has reached. */
  offset: z.number(),
  /** Queue file size in bytes. */
  size: z.number(),
  /** Bytes not yet processed. */
  pendingBytes: z.number(),
  /** Queue lines that could not be parsed. */
  parseErrors: z.number(),
  /** Last time the cursor was reset. */
  lastCursorReset: z.string().optional(),
  /** Last time the processor rewound. */
  lastRewind: z.string().optional(),
});

/** The server's `health` details. */
export const serverHealthSchema = z.object({
  /** Listening port. */
  port: z.number(),
  /** Chrome (PDF and diagram rendering). */
  chrome: z.object({
    /** Whether a Chrome path is configured. */
    configured: z.boolean(),
    /** Configured Chrome path (admin callers only). */
    path: z.string().optional(),
  }),
  /** Sign-in configuration. */
  auth: z.object({
    /** Enabled sign-in modes. */
    modes: z.array(z.string()),
    /** Configured insiders. */
    insiderCount: z.number(),
    /** Configured machine keys. */
    keyCount: z.number(),
    /** Google sign-in redirect URI (google mode with a public origin). */
    googleRedirectUri: z.string().optional(),
    /** OAuth provider redirect URI (when providers are configured). */
    oauthRedirectUri: z.string().optional(),
  }),
  /** Configured webhook events. */
  events: z.array(
    z.object({
      /** Event name. */
      name: z.string(),
      /** Command it runs (admin callers only). */
      cmd: z.string().optional(),
    }),
  ),
  /** Event queue progress. */
  eventQueue: eventQueueHealthSchema,
  /** Export capabilities. */
  exports: z.object({
    /** Document formats. */
    documents: z.array(z.string()),
    /** Directory archive formats. */
    directories: z.array(z.string()),
    /** Diagram formats. */
    diagrams: z.array(z.string()),
    /** Whether Chrome is configured. */
    chromeAvailable: z.boolean(),
  }),
  /** Diagram rendering. */
  diagrams: z.object({
    /** Mermaid is available. */
    mermaid: z.boolean(),
    /** PlantUML renderers. */
    plantuml: z.object({
      /** A local PlantUML jar is configured. */
      localJar: z.boolean(),
      /** PlantUML servers. */
      servers: z.array(z.string()),
    }),
  }),
  /** Downstream Jeeves services (probed in the background). */
  services: z.object({
    /** jeeves-watcher. */
    watcher: serviceProbeSchema,
    /** jeeves-runner. */
    runner: serviceProbeSchema,
    /** jeeves-meta. */
    meta: serviceProbeSchema,
    /** Last probe (ISO), or null before the first. */
    lastChecked: z.string().nullable(),
  }),
  /** Branding. */
  branding: z.object({
    /** Product name. */
    name: z.string(),
    /** Emoji. */
    emoji: z.string().optional(),
    /** CSS variable overrides per theme mode. */
    theme: z
      .object({
        /** Light mode overrides. */
        light: cssOverridesSchema.optional(),
        /** Dark mode overrides. */
        dark: cssOverridesSchema.optional(),
      })
      .optional(),
  }),
});

/**
 * Jeeves Server Configuration
 *
 * Copy this file to `jeeves.config.ts` and fill in your values.
 * The real config is gitignored (it contains secrets).
 *
 * @see src/config/schema.ts for the Zod schema (source of truth)
 */
import type { JeevesConfig } from './src/config/schema.js';

export default {
  /** Server port */
  port: 3456,

  /** Path to Chrome/Chromium for Puppeteer PDF/DOCX export */
  chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',

  /**
   * Authentication configuration.
   */
  auth: {
    /**
     * Active authentication methods (order = priority):
     * - 'google': Google OAuth (insiders authenticate via Google login)
     * - 'keys': URL key auth (insiders authenticate via derived URL keys)
     *
     * Examples:
     *   ['google']         — Google OAuth only (production)
     *   ['keys']           — URL keys only (simple/bot access)
     *   ['keys', 'google'] — Both active, keys checked first
     */
    modes: ['google', 'keys'],

    /**
     * Google OAuth credentials.
     * Required if modes includes 'google'.
     * Get these from Google Cloud Console \> APIs & Services \> Credentials.
     */
    google: {
      clientId: 'your-google-client-id.apps.googleusercontent.com',
      clientSecret: 'GOCSPX-your-client-secret',
    },

    /**
     * Secret for signing session cookies.
     * Required if modes includes 'google'.
     * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     */
    sessionSecret: 'generate-a-random-64-char-hex-string',
  },

  /**
   * Insider users — humans with full browsing access.
   *
   * With 'google' mode: authenticated via Google OAuth, key auto-generated on first login.
   * With 'keys' mode: authenticated via HMAC-derived insider URL key.
   *
   * Scopes restrict which paths the insider can access.
   * Uses standard glob syntax (picomatch): /** for recursive, /* for single-level.
   * ['/**'] = full access. ['/d/docs/**'] = only files under D:/docs/.
   */
  insiders: {
    'user@example.com': {
      scopes: ['/**'],
    },
  },

  /**
   * Named API keys for machine access and outsider share links.
   *
   * Plain string = seed value, no scope restrictions.
   * Object = \{ key: '...', scopes: [...] \} for restricted access.
   *
   * Reserved names:
   * - '_internal': Server-side operations (Puppeteer export). Must NOT have scopes.
   *
   * Generate seeds with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   */
  keys: {
    primary: 'generate-a-random-64-char-hex-string',
    _internal: 'generate-a-different-random-64-char-hex-string',
    // Example scoped key for webhooks only:
    // webhook: { key: 'another-random-hex', scopes: ['/event'] },
  },

  /**
   * Event webhook processing rules.
   * Maps incoming POST /event payloads to commands via JSON Schema matching.
   */
  events: {},

  /** Default timeout for event command execution (ms) */
  eventTimeoutMs: 30_000,

  /** How long to keep event log entries before purging (ms). Default: 30 days */
  eventLogPurgeMs: 2_592_000_000,

  /**
   * Filesystem roots for the file browser (Linux only — ignored on Windows).
   * Maps a URL-safe id to a filesystem path.
   * Default (if omitted): \{ root: '/' \}
   *
   * Examples:
   *   \{ home: '/home/user', projects: '/opt/projects' \}
   *   \{ workspace: '/workspace' \}
   */
  // roots: { home: '/home/user' },

  /**
   * Path to mermaid-cli installation (npx --prefix directory).
   * If omitted, uses system npx (mermaid-cli must be globally installed).
   * Windows example: 'E:\\tools\\mermaid-cli'
   * Linux example: '/opt/mermaid-cli'
   */
  // mermaidCliPath: '/opt/mermaid-cli',

  /**
   * PlantUML rendering configuration.
   * - jarPath: local PlantUML jar (requires Java). Tried first — supports !include.
   * - servers: fallback PlantUML server URLs, tried in order.
   *   The public community server is always appended as last resort.
   * If omitted, only the community server is used (no !include support).
   */
  // plantuml: {
  //   jarPath: '/opt/plantuml/plantuml.jar',
  //   javaPath: '/usr/bin/java',  // optional — defaults to 'java' on PATH
  //   servers: ['https://internal.plantuml.example.com/plantuml'],
  // },

  /**
   * Directory for cached rendered diagrams (content-addressed by source hash).
   * Both standalone .mmd/.puml files and embedded diagram code blocks are cached.
   * Defaults to `.diagram-cache` in the server working directory.
   */
  // diagramCachePath: '/var/cache/jeeves/diagrams',
} satisfies JeevesConfig;

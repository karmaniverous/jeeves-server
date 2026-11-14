/**
 * The wire app's fixture: the content corpus (Markdown with front matter, `.markdown`, JSON, CSV, an image, a PDF, Mermaid and PlantUML sources, nested directories, names with spaces and `%`), the seeds and the server config. Writes the corpus to disk with fixed modification times.
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Linux root id of the content root (Windows uses the drive letter). */
export const WIRE_ROOT_ID = 'wireroot';

/** Modification time of every corpus file and directory. */
export const WIRE_MTIME = new Date('2026-01-02T03:04:05.000Z');

/** Far-future expiry (ms) for expiring share keys: 2100-01-01. */
export const WIRE_FUTURE_EXP = '4102444800000';

/** Past expiry (ms) for expired share keys. */
export const WIRE_PAST_EXP = '1000';

/** Seeds of the configured insiders and machine keys. */
export const WIRE_SEEDS = {
  admin: 'wire-seed-admin-insider',
  scoped: 'wire-seed-scoped-insider',
  primary: 'wire-seed-primary-machine-key',
  scopedKey: 'wire-seed-scoped-machine-key',
  internal: 'wire-seed-internal-machine-key',
} as const;

/** Insider emails by role. */
export const WIRE_EMAILS = {
  admin: 'admin@wire.test',
  scoped: 'scoped@wire.test',
  noSeed: 'noseed@wire.test',
} as const;

/** Session cookie signing secret. */
export const WIRE_SESSION_SECRET = 'wire-session-secret';

/** Mermaid source of the diagram embedded in `embedded.md`. */
export const EMBEDDED_MERMAID = 'graph LR\n  X-->Y\n';

/** Hash under which a render of `embedded.md` registers its diagram. */
export const EMBEDDED_HASH = crypto
  .createHash('sha256')
  .update(`mermaid\0${EMBEDDED_MERMAID}`)
  .digest('hex');

/** A 1x1 transparent PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

/** A minimal PDF. */
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n',
);

/** Corpus files by `/`-separated path relative to the content root. */
export const WIRE_CORPUS: Readonly<Record<string, string | Buffer>> = {
  'doc.md': [
    '---',
    'title: Wire Document',
    'tags:',
    '  - alpha',
    '  - beta',
    '---',
    '',
    '# Wire document',
    '',
    'See [inner](sub%20dir/inner.md) and [the image](image.png).',
    '',
    '- [ ] first',
    '- [x] second',
    '',
    '| A | B |',
    '| --- | --- |',
    '| 1 | 2 |',
    '',
  ].join('\n'),
  'embedded.md': `# Embedded\n\n\`\`\`mermaid\n${EMBEDDED_MERMAID}\`\`\`\n`,
  'notes.markdown': '# Notes\n\nA `.markdown` file.\n',
  'data.json': '{\n  "a": 1\n}\n',
  'data.csv': 'a,b\n1,2\n',
  'image.png': PNG,
  'report.pdf': PDF,
  'flow.mmd': 'graph TD\n  A-->B\n',
  'seq.puml': '@startuml\nA -> B\n@enduml\n',
  'sub dir/inner.md': '# Inner\n',
  'sub dir/100% done.md': '# Done\n',
  'public/shared.md': '# Shared\n',
  'public/deeper/leaf.md': '# Leaf\n',
  'private/secret.md': '# Secret\n',
};

/** Bytes the export cache holds for `doc.md` (PDF and DOCX). */
export const CACHED_EXPORT = Buffer.from('cached export bytes');

/** SVG the diagram cache holds for `flow.mmd` and the embedded diagram. */
export const CACHED_SVG = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

/**
 * Write the corpus under `contentDir` (replacing what is there) and give
 * every file and directory {@link WIRE_MTIME}.
 *
 * @param contentDir - Content root.
 */
export function writeCorpus(contentDir: string): void {
  fs.rmSync(contentDir, { recursive: true, force: true, maxRetries: 3 });
  const dirs = new Set<string>([contentDir]);
  for (const [rel, data] of Object.entries(WIRE_CORPUS)) {
    const file = path.join(contentDir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    fs.utimesSync(file, WIRE_MTIME, WIRE_MTIME);
    for (let d = path.dirname(file); d.startsWith(contentDir);) {
      dirs.add(d);
      if (d === contentDir) break;
      d = path.dirname(d);
    }
  }
  for (const dir of [...dirs].sort((a, b) => b.length - a.length))
    fs.utimesSync(dir, WIRE_MTIME, WIRE_MTIME);
}

/** Paths the wire config is built from. */
export interface WireDirs {
  /** Temp directory holding everything. */
  dir: string;
  /** Content root. */
  contentDir: string;
  /** Content root's URL path (`/wireroot` or `/c/.../content`). */
  rootUrl: string;
}

/**
 * The server config file: Google, key and email sign-in, sessions, an
 * unscoped and a scoped insider, an insider without a seed, unscoped,
 * scoped and `_internal` machine keys, outsider sharing with a policy, an
 * event schema with a harmless command, OAuth, shortlinks and a closed
 * SMTP port.
 *
 * @param dirs - Wire paths.
 * @returns The config object (written as JSON).
 */
export function wireConfig(dirs: WireDirs): Record<string, unknown> {
  const { dir, contentDir, rootUrl } = dirs;
  return {
    port: 1934,
    chromePath: path.join(dir, 'no-chrome', 'chrome'),
    auth: {
      modes: ['google', 'keys', 'email'],
      google: { clientId: 'wire-client-id', clientSecret: 'wire-secret' },
      sessionSecret: WIRE_SESSION_SECRET,
      email: { smtpUrl: 'smtp://127.0.0.1:9', fromAddress: 'jeeves@wire.test' },
    },
    scopes: { public: { allow: [`${rootUrl}/public/**`] } },
    insiders: {
      [WIRE_EMAILS.admin]: {
        seed: WIRE_SEEDS.admin,
        keyCreatedAt: '2026-01-01T00:00:00.000Z',
      },
      [WIRE_EMAILS.scoped]: { scopes: 'public', seed: WIRE_SEEDS.scoped },
      [WIRE_EMAILS.noSeed]: {},
    },
    keys: {
      _internal: WIRE_SEEDS.internal,
      primary: WIRE_SEEDS.primary,
      scoped: { key: WIRE_SEEDS.scopedKey, scopes: 'public' },
    },
    events: {
      ping: {
        schema: {
          type: 'object',
          properties: { kind: { const: 'ping' } },
          required: ['kind'],
        },
        cmd: 'node -e "process.exit(0)"',
      },
    },
    roots: { [WIRE_ROOT_ID]: contentDir },
    diagramCachePath: path.join(dir, 'diagram-cache'),
    outsiderPolicy: { deny: [`${rootUrl}/private/**`] },
    oauth: {
      credentialDir: path.join(dir, 'oauth'),
      providers: {
        wire: {
          authUrl: 'https://auth.wire.test/authorize',
          tokenUrl: 'http://127.0.0.1:9/token',
          pkce: true,
          defaultScopes: ['read'],
        },
      },
    },
    go: { docs: '/browse/docs', ext: 'https://example.com/target' },
    branding: { name: 'Wire', emoji: 'W' },
    eventQueue: path.join(dir, 'events', 'event-queue.jsonl'),
    publicUrl: 'https://wire.test',
  };
}

/** A stored OAuth credential that never expires. */
export const WIRE_CREDENTIAL = {
  provider: 'wire',
  account: 'me',
  access_token: 'wire-access-token',
  refresh_token: 'wire-refresh-token',
  token_type: 'Bearer',
  scope: 'read',
  obtained_at: '2026-01-01T00:00:00.000Z',
  tokenUrl: 'http://127.0.0.1:9/token',
  clientId: 'wire-oauth-client',
  clientSecret: 'wire-oauth-secret',
};

/** A stored OAuth credential that expired, with a refresh token. */
export const WIRE_EXPIRED_CREDENTIAL = {
  ...WIRE_CREDENTIAL,
  account: 'old',
  expires_in: 60,
};

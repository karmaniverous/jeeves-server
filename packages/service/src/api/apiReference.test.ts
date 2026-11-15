// @vitest-environment node
/**
 * The API docs stay in step with the catalog (#259): the generated `guides/api-reference.md` matches `SERVER_CATALOG` and `ROUTE_ACCESS` (run `npm run api-reference` after changing either), lists every entry, and the hand-written error table in `guides/api-integration.md` lists every `SERVER_*` code with its status.
 */

import { readFileSync } from 'node:fs';

import {
  SERVER_CATALOG,
  SERVER_ERROR_CODES,
  SERVER_ERROR_STATUS,
} from '@karmaniverous/jeeves-server-core';
import { describe, expect, it } from 'vitest';

import {
  API_REFERENCE_FILE,
  renderApiReference,
} from '../../scripts/apiReference.js';

const reference = renderApiReference();

describe('guides/api-reference.md', () => {
  it('matches the catalog (run `npm run api-reference` after changing it)', () => {
    expect(readFileSync(API_REFERENCE_FILE, 'utf8')).toBe(reference);
  });

  it('has a section per catalog entry with its method, path and access class', () => {
    for (const entry of SERVER_CATALOG.entries) {
      expect(reference).toContain(
        `### ${entry.name}\n\n\`${entry.method} ${entry.path}\``,
      );
    }
    expect(reference).toContain(
      '| [`config`](#config) | `GET` | `/config` | admin |',
    );
    expect(reference).toContain(
      '**Access:** `insider`: an identity (session or insider/machine key); every path the request addresses must be in its scopes; also the insider-seed insider key.',
    );
  });

  it('lists request fields, leaves share-link parameters to one note, and names binary responses', () => {
    const share = reference.slice(reference.indexOf('### share\n'));
    expect(share).toContain(
      '| `path` | body | `string` | Path to share (/<root>/<path>). |',
    );
    expect(share).toContain('| `dirs` | body | `boolean` (optional) |');
    const raw = reference.slice(
      reference.indexOf('### raw\n'),
      reference.indexOf('### export\n'),
    );
    expect(raw).not.toContain('| `exp` |');
    expect(raw).toContain('[Share credentials](#share-credentials)');
    expect(raw).toContain('**Response:** `application/octet-stream` bytes.');
  });
});

describe('guides/api-integration.md errors table', () => {
  it('lists every SERVER_* code with its status', () => {
    const guide = readFileSync(
      new URL('../../guides/api-integration.md', import.meta.url),
      'utf8',
    );
    for (const code of SERVER_ERROR_CODES) {
      expect(guide).toMatch(
        new RegExp(
          `^\\| \`${String(SERVER_ERROR_STATUS[code])}\` \\|[^\\n]*\`${code}\``,
          'm',
        ),
      );
    }
  });
});

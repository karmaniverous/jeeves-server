// @vitest-environment node
/**
 * The web client's raw-content URL against the real app: in a share-link view the page's image `src` and download `href` (`pageRawUrl` with the credential the page was opened with) open for an outsider; without the credential they don't.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  pageRawUrl,
  pageShareCredential,
} from '../../../client/src/lib/pageAuth.js';
import { startWireApp, type WireApp } from '../wire/wireApp.js';
import { WIRE_CORPUS } from '../wire/wireFixture.js';
import { SDK_BASE_URL, SDK_KEYS, sdkClient } from './sdkHarness.js';

let wire: WireApp;
let root: string;

beforeAll(async () => {
  wire = await startWireApp();
  root = wire.rootUrl.slice(1);
});

afterAll(async () => {
  await wire.close();
});

describe('pageRawUrl on the real app', () => {
  it('opens a shared image for an outsider only with the page credential', async () => {
    const admin = sdkClient(wire.app, { key: SDK_KEYS.admin });
    const reqPath = `${root}/image.png`;
    const { url } = await admin.share({
      path: `/${reqPath}`,
      expiry: String(Date.now() + 60_000),
    });
    // The page the outsider opens is the share's page URL.
    const credential = pageShareCredential(new URL(url, SDK_BASE_URL).search);
    expect(credential?.exp).toBeDefined();

    const shared = await wire.app.inject({
      url: pageRawUrl(reqPath, credential),
    });
    expect(shared.statusCode).toBe(200);
    expect(shared.rawPayload.equals(WIRE_CORPUS['image.png'] as Buffer)).toBe(
      true,
    );

    const bare = await wire.app.inject({ url: pageRawUrl(reqPath, undefined) });
    expect(bare.statusCode).toBe(401);
  });
});

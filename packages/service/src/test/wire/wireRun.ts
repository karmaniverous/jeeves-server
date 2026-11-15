/**
 * Runs a wire scenario against a {@link WireApp} from a reset state and records what a client sees: status, selected headers and the body (text normalised, binary as length and hash). No assertions.
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';

import type { LightMyRequestResponse } from 'fastify';

import type { WireApp } from './wireApp.js';
import { credentialFor } from './wireCredentials.js';
import {
  normaliseBody,
  type NormaliseContext,
  normaliseText,
} from './wireNormalise.js';
import type { WireRecord, WireScenario } from './wireTypes.js';

/** Headers recorded when present. */
const RECORDED_HEADERS = [
  'content-type',
  'content-disposition',
  'location',
  'retry-after',
  'cache-control',
] as const;

/** Content types recorded as text. */
const TEXT_TYPE =
  /^(?:text\/|application\/(?:json|javascript)|image\/svg\+xml)/;

/** Archive content types, recorded by length only (entry metadata varies). */
const ARCHIVE_TYPE = /^application\/(?:zip|x-tar|gzip|x-gzip)/;

/**
 * Expand the URL placeholders.
 *
 * @param url - Scenario URL.
 * @param wire - The wire app.
 * @returns The request URL.
 */
export function expandUrl(
  url: string,
  wire: Pick<WireApp, 'rootUrl' | 'contentDir'>,
): string {
  return url
    .split('{root}')
    .join(wire.rootUrl.replace(/^\//, ''))
    .split('{fsroot}')
    .join(encodeURIComponent(wire.contentDir));
}

/**
 * The normalisation context of a wire app.
 *
 * @param wire - The wire app.
 * @returns Paths and platform.
 */
export const normaliseContext = (wire: WireApp): NormaliseContext => ({
  dir: wire.dir,
  rootUrl: wire.rootUrl,
  serviceDir: wire.serviceDir,
  serviceUrl: wire.serviceUrl,
  platform: process.platform,
});

/**
 * Send one request of a scenario.
 *
 * @param wire - The wire app.
 * @param s - The request.
 * @returns The Fastify inject response.
 */
function send(
  wire: WireApp,
  s: Omit<WireScenario, 'name' | 'before'>,
): Promise<LightMyRequestResponse> {
  const cred = credentialFor(s.cred, wire);
  let url = expandUrl(s.url, wire);
  if (cred.query) {
    const query = s.legacyKeyParam
      ? cred.query.replace(/(^|&)k=/, '$1key=')
      : cred.query;
    url += (url.includes('?') ? '&' : '?') + query;
  }
  const headers: Record<string, string> = { ...cred.headers };
  let payload: string | object | undefined;
  if (s.rawBody) {
    headers['content-type'] = s.rawBody.contentType;
    payload = s.rawBody.body;
  } else if (s.payload !== undefined) {
    if (typeof s.payload === 'object' && s.payload !== null)
      payload = JSON.parse(
        expandUrl(JSON.stringify(s.payload), wire),
      ) as object;
    else {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(s.payload);
    }
  }
  return wire.app.inject({
    method: s.method,
    url,
    headers,
    ...(payload === undefined ? {} : { payload }),
  });
}

/**
 * Run one scenario from a reset state and record the reply.
 *
 * @param wire - The wire app.
 * @param scenario - The scenario.
 * @returns The record.
 */
export async function runScenario(
  wire: WireApp,
  scenario: WireScenario,
): Promise<WireRecord> {
  wire.reset();
  for (const step of scenario.before ?? []) await send(wire, step);
  const res = await send(wire, scenario);
  const ctx = normaliseContext(wire);

  const headers: Record<string, string> = {};
  for (const name of RECORDED_HEADERS) {
    const value = res.headers[name];
    if (value !== undefined) headers[name] = normaliseText(value, ctx);
  }
  const record: WireRecord = { status: res.statusCode, headers };
  if (scenario.omitBody) return record;

  const type = headers['content-type'] ?? '';
  if (res.rawPayload.length === 0 || TEXT_TYPE.test(type)) {
    record.body = normaliseBody(res.body, ctx, scenario.redact);
  } else {
    record.bytes = res.rawPayload.length;
    if (!ARCHIVE_TYPE.test(type))
      record.sha256 = crypto
        .createHash('sha256')
        .update(res.rawPayload)
        .digest('hex');
  }
  return record;
}

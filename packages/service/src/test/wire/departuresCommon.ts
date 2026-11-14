/**
 * Shared parts of the wire departure lists: the departure shape and the `allowedBy` texts the lists cite. Pure data.
 *
 * @packageDocumentation
 */

/** One approved departure. */
export interface WireDeparture {
  /** What the branch base sent, and why it changes. */
  before: string;
  /** The spec decision or design section that allows it. */
  allowedBy: string;
  /** HTTP status of the new reply. */
  status: number;
  /** The `code` of the new standard error body (error replies only). */
  code?: string;
}

/** Decision 4 (#315): the service's own errors move to Fastify's standard error body. */
export const D4 =
  "Decision 4 / #315: Fastify's standard error body (api/errors.ts, registerErrorHandlers)";

/**
 * As {@link D4}, with the status the spec's code list gives the code.
 *
 * @param why - The code and the status change.
 * @returns The `allowedBy` text.
 */
export const d4Status = (why: string) =>
  `${D4}; status per the spec's code list: ${why}`;

export const D4_CHROME = d4Status('SERVER_CHROME_UNAVAILABLE is 503 (was 500)');
export const D4_EXPORT_FAILED = d4Status(
  'SERVER_EXPORT_FAILED is 502 (a failed render was 500)',
);
/** Decision 8: access by credential kind and access class (the access hook). */
export const D8 =
  'Decision 8 (#289, #301): identities are verified as identities and their scopes apply to the path (ROUTE_ACCESS, api/accessHook.ts)';

/** As {@link D8}, for an identity navigating an ancestor of its scopes. */
export const D8_NAVIGATION = `${D8}; navigation entries admit an identity on a non-denied ancestor of its scopes (canNavigatePath), as for sessions`;

/** As {@link D8}, for a scoped machine key on an insider route (#289, #301). */
export const D8_SCOPED_KEY = `${D8}; a scoped machine key calls share, resolvePath and search within its scopes`;

/** As {@link D8}, for any identity on an `insider` entry. */
export const D8_INSIDER = `${D8}; insider entries admit every identity, scoped or not`;

/** As {@link D8}, for the scope check on the path an insider route addresses. */
export const D8_SCOPE = `${D8}; resolvePath checks the resolved browse path against the caller's scopes (#301)`;

/** As {@link D8}, for the insider-seed insider key on `rotateKey`. */
export const D8_LOGIN_SEED = `${D8}; the insider-seed insider key authenticates shareFor and rotateKey (loginSeedKey)`;

/** Decision 11 (GHSA-pfhj). */
export const D11 =
  'Decision 11 (GHSA-pfhj): /config and /config/apply are admin routes';

/** The catalog validates requests (T9): Fastify's validation error. */
export const D_VALIDATION =
  "routes from the catalog: the request is validated against the entry's schemas before its handler, so a malformed request is Fastify's FST_ERR_VALIDATION (400)";

/** Decision 14: the webhook body is a JSON object. */
export const D14 =
  'Decision 14: receiveEvent takes a JSON object (looseObject); an array, scalar or text body is a 400';

/** Decision 17 (#270): /status adds the sign-in redirect URIs. */
export const D17 =
  'Decision 17 (#270): /status adds health.auth.googleRedirectUri and oauthRedirectUri (the wire config has the google mode, OAuth providers and publicUrl)';

/** Decision 20 (#292): one rotation route; the legacy routes are removed. */
export const D20 =
  'Decision 20 (#292): POST /api/rotate-key is the one rotation route; POST /rotate-key and GET /share are removed';

/** Decision 12. */
export const D12 =
  'Decision 12: admin entries need an identity with no scopes configured';

/** Decision 22. */
export const D22 =
  'Decision 22: /status omits health.events[].cmd and health.chrome.path for callers that are not admin';

export const D4_RUNNER = d4Status(
  'SERVER_RUNNER_UNAVAILABLE is 503 (an unreachable runner was 502)',
);

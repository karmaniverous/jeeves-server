/**
 * OAuth2 API handlers (insider auth required): `oauthStart` (POST /api/oauth/start, oauthStart.ts), `oauthStatus` and `oauthToken` (GET /api/oauth/status, /api/oauth/token, oauthCredentialRoutes.ts). Credential persistence and refresh are `services/oauthCredentialStore.ts`.
 *
 * @packageDocumentation
 */

import type { HandlersFor } from '../../api/handlerTypes.js';
import { oauthCredentialHandlers } from './oauthCredentialRoutes.js';
import { oauthStartHandlers } from './oauthStart.js';

/** The OAuth API handlers. */
export const oauthApiHandlers: HandlersFor<
  'oauthStart' | 'oauthStatus' | 'oauthToken'
> = { ...oauthStartHandlers, ...oauthCredentialHandlers };

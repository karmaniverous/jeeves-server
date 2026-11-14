/**
 * Magic link authentication API route.
 *
 * POST /api/auth/magic — accepts an email, sends a magic link + OTP if the
 * email matches a configured insider. Always returns 200 with verifyUrl to
 * prevent email enumeration.
 *
 * Flow:
 * 1. Generate signed token (HMAC-SHA256, stateless).
 * 2. Generate 8-char OTP from 32-char alphabet.
 * 3. Encrypt signed token with AES-256-GCM using SHA-256(otp) as the key.
 * 4. Return verifyUrl pointing to "/auth/magic/verify?enc=blob".
 * 5. For valid insiders: send email with both OTP and clickable magic link.
 * 6. For invalid/non-insider emails: return fake random blob (no email sent).
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';

import { type HandlersFor, ok } from '../../api/handlerTypes.js';
import { sanitizeReturnTo } from '../../auth/resolve.js';
import { getConfig } from '../../config/index.js';
import { DEFAULT_BRANDING } from '../../config/schema.js';
import { sendMagicLinkEmail } from '../../services/email.js';
import {
  encryptToken,
  formatOtp,
  generateOtp,
  signToken,
} from '../../util/magicToken.js';
import {
  getPublicOrigin,
  publicOriginConfigError,
} from '../../util/publicOrigin.js';

/** `sendMagicLink`: send a magic link + OTP to a configured insider. */
export const magicLinkHandlers: HandlersFor<'sendMagicLink'> = {
  sendMagicLink: ({ body }, request) => {
    const config = getConfig();

    // Never build login links from request headers unless trusted. With
    // email login configured, refuse for every request (not only
    // insiders) so the response doesn't reveal which emails are insiders.
    const emailLoginConfigured =
      config.authModes.includes('email') && !!config.emailAuth;
    const origin = getPublicOrigin(config, request);
    if (emailLoginConfigured && !origin) throw publicOriginConfigError();

    const email = body.email?.toLowerCase().trim();
    const returnTo = body.returnTo
      ? sanitizeReturnTo(body.returnTo)
      : undefined;

    // Check if email matches a configured insider
    const insider = config.resolvedInsiders.find(
      (i) => i.email.toLowerCase() === (email ?? ''),
    );

    const sessionSecret = config.sessionSecret;

    if (
      origin &&
      email &&
      insider &&
      sessionSecret &&
      config.authModes.includes('email') &&
      config.emailAuth
    ) {
      // Generate self-validating signed token
      const token = signToken({ email, returnTo }, sessionSecret);

      // Generate OTP and encrypt the token
      const otp = generateOtp();
      const enc = encryptToken(token, otp);
      const verifyUrl = `/auth/magic/verify?enc=${enc}`;

      // Build clickable magic link on the configured public origin
      const magicLink = `${origin}/auth/magic/callback?token=${token}`;

      // Send email (fire-and-forget — don't block the response)
      const branding = config.branding ?? DEFAULT_BRANDING;

      sendMagicLinkEmail(
        email,
        magicLink,
        formatOtp(otp),
        config.emailAuth.fromAddress,
        { name: branding.name, emoji: branding.emoji },
        config.branding?.emailTemplate,
      ).catch((err: unknown) => {
        request.log.error({ err, email }, 'Failed to send magic link email');
      });

      return Promise.resolve(ok({ verifyUrl }));
    }

    // Anti-enumeration: always return a verifyUrl with a fake random blob
    const fakeEnc = crypto.randomBytes(64).toString('base64url');
    return Promise.resolve(
      ok({ verifyUrl: `/auth/magic/verify?enc=${fakeEnc}` }),
    );
  },
};

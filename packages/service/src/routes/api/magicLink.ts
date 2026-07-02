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

import type { FastifyPluginCallback } from 'fastify';

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

export const magicLinkApiRoute: FastifyPluginCallback = (
  fastify,
  _opts,
  done,
) => {
  fastify.post<{ Body: { email?: string; returnTo?: string } }>(
    '/api/auth/magic',
    async (request, reply) => {
      const config = getConfig();

      const email = request.body.email?.toLowerCase().trim();
      const returnTo = request.body.returnTo
        ? sanitizeReturnTo(request.body.returnTo)
        : undefined;

      // Check if email matches a configured insider
      const insider = config.resolvedInsiders.find(
        (i) => i.email.toLowerCase() === (email ?? ''),
      );

      const sessionSecret = config.sessionSecret;

      if (
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

        // Build clickable magic link
        const proto =
          (request.headers['x-forwarded-proto'] as string | undefined) ??
          'http';
        const host =
          (request.headers['x-forwarded-host'] as string | undefined) ??
          request.headers['host'] ??
          request.hostname;
        const magicLink = `${proto}://${host}/auth/magic/callback?token=${token}`;

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
          fastify.log.error({ err, email }, 'Failed to send magic link email');
        });

        return reply.code(200).send({ verifyUrl });
      }

      // Anti-enumeration: always return a verifyUrl with a fake random blob
      const fakeEnc = crypto.randomBytes(64).toString('base64url');
      return reply
        .code(200)
        .send({ verifyUrl: `/auth/magic/verify?enc=${fakeEnc}` });
    },
  );
  done();
};

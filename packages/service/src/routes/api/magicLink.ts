/**
 * Magic link authentication API route.
 *
 * POST /api/auth/magic — accepts an email, sends a magic link if the email
 * matches a configured insider. Always returns 200 OK to prevent email
 * enumeration.
 *
 * @packageDocumentation
 */

import crypto from 'node:crypto';

import type { FastifyPluginAsync } from 'fastify';

import { getConfig } from '../../config/index.js';
import { sendMagicLinkEmail } from '../../services/email.js';
import { storeMagicToken } from '../../services/magicLinkState.js';

// eslint-disable-next-line @typescript-eslint/require-await
export const magicLinkApiRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { email?: string } }>(
    '/auth/magic',
    async (request, reply) => {
      const config = getConfig();

      // Always return 200 to prevent email enumeration
      const email = request.body?.email?.toLowerCase()?.trim();
      if (!email) {
        return reply.code(200).send({ ok: true });
      }

      // Check if email matches a configured insider
      const insider = config.resolvedInsiders.find(
        (i) => i.email.toLowerCase() === email,
      );

      if (insider && config.authModes.includes('email') && config.emailAuth) {
        // Generate a secure token
        const token = crypto.randomBytes(32).toString('hex');
        storeMagicToken(token, { email });

        // Build the magic link URL
        const proto =
          (request.headers['x-forwarded-proto'] as string | undefined) ??
          'http';
        const host =
          (request.headers['x-forwarded-host'] as string | undefined) ??
          (request.headers['host'] as string | undefined) ??
          request.hostname;
        const magicLink = `${proto}://${host}/auth/magic/callback?token=${token}`;

        // Send the email (fire-and-forget — don't block the response)
        const branding = config.branding ?? {
          name: 'Jeeves Server',
          emoji: '🎩',
        };

        sendMagicLinkEmail(
          email,
          magicLink,
          config.emailAuth.fromAddress,
          { name: branding.name, emoji: branding.emoji },
          branding.emailTemplate,
        ).catch((err: unknown) => {
          fastify.log.error(
            { err, email },
            'Failed to send magic link email',
          );
        });
      }

      return reply.code(200).send({ ok: true });
    },
  );
};

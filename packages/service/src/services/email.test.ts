import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearTransport,
  getTransport,
  initTransport,
  sendMagicLinkEmail,
} from './email.js';

describe('email service', () => {
  beforeEach(() => {
    clearTransport();
  });

  describe('initTransport', () => {
    it('creates a transport from an SMTP URL', () => {
      initTransport('smtp://localhost:2525');
      expect(getTransport()).not.toBeNull();
    });
  });

  describe('sendMagicLinkEmail', () => {
    it('throws if transport is not initialized', async () => {
      await expect(
        sendMagicLinkEmail(
          'test@example.com',
          'https://example.com/login',
          'a3k7 m9p2',
          'noreply@example.com',
          { name: 'Test', emoji: '🧪' },
        ),
      ).rejects.toThrow('Email transport not initialized');
    });

    it('sends email with default template when no custom template is provided', async () => {
      initTransport('smtp://localhost:2525');
      const t = getTransport()!;

      let sentOpts: Record<string, unknown> = {};
      (
        t as unknown as {
          sendMail: (
            opts: Record<string, unknown>,
          ) => Promise<{ messageId: string }>;
        }
      ).sendMail = (opts: Record<string, unknown>) => {
        sentOpts = opts;
        return Promise.resolve({ messageId: 'test' });
      };

      await sendMagicLinkEmail(
        'user@example.com',
        'https://example.com/auth/magic/callback?token=xyz',
        'b5r2 t8qn',
        'login@jeeves.id',
        { name: 'My Server', emoji: '🏠' },
      );

      expect(sentOpts.from).toBe('login@jeeves.id');
      expect(sentOpts.to).toBe('user@example.com');
      expect(sentOpts.subject).toBe('🏠 Sign in to My Server');
      const html = sentOpts.html as string;
      expect(html).toContain('🏠 My Server');
      expect(html).toContain(
        'https://example.com/auth/magic/callback?token=xyz',
      );
      expect(html).toContain('b5r2 t8qn');
      expect(html).toContain('expire');
    });
  });

  describe('sendMagicLinkEmail with custom template', () => {
    it('uses the custom template when provided', async () => {
      initTransport('smtp://localhost:2525');
      const t = getTransport()!;

      // Capture the sendMail call
      let sentHtml = '';
      (
        t as unknown as {
          sendMail: (opts: { html?: string }) => Promise<{ messageId: string }>;
        }
      ).sendMail = (opts: { html?: string }) => {
        sentHtml = opts.html ?? '';
        return Promise.resolve({ messageId: 'test' });
      };

      const customTemplate =
        '<p>Hello from {{branding.name}}! Code: {{otpCode}} <a href="{{{magicLink}}}">Login</a></p>';
      await sendMagicLinkEmail(
        'test@example.com',
        'https://example.com/login?token=abc',
        'x9f4 k2jm',
        'noreply@example.com',
        { name: 'Custom App', emoji: '🚀' },
        customTemplate,
      );

      expect(sentHtml).toContain('Hello from Custom App!');
      expect(sentHtml).toContain('Code: x9f4 k2jm');
      expect(sentHtml).toContain('href="https://example.com/login?token=abc"');
    });
  });
});

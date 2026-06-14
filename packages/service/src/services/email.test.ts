import { describe, it, expect, beforeEach } from 'vitest';
import Handlebars from 'handlebars';

import {
  clearTransport,
  getTransport,
  initTransport,
  sendMagicLinkEmail,
} from './email.js';

/** Default template duplicated here for rendering tests. */
const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
  <h2 style="font-size: 1.25rem;">{{branding.emoji}} {{branding.name}}</h2>
  <p>Click the link below to sign in:</p>
  <p><a href="{{{magicLink}}}" style="display:inline-block;padding:10px 24px;background:#4285f4;color:#fff;text-decoration:none;border-radius:4px;font-size:14px;font-weight:500;">Sign in</a></p>
  <p style="color:#888;font-size:0.85rem;">This link expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
</body>
</html>`;

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

  describe('default template rendering', () => {
    it('renders the default template with branding and magic link', () => {
      const template = Handlebars.compile(DEFAULT_TEMPLATE);
      const html = template({
        magicLink: 'https://example.com/auth/magic/callback?token=abc123',
        branding: { name: 'Test Server', emoji: '🧪' },
      });

      expect(html).toContain('🧪 Test Server');
      expect(html).toContain(
        'href="https://example.com/auth/magic/callback?token=abc123"',
      );
      expect(html).toContain('expires in 10 minutes');
    });
  });

  describe('custom template rendering', () => {
    it('renders a custom template with branding variables', () => {
      const customTemplate =
        '<p>Hello from {{branding.name}}! <a href="{{magicLink}}">Login</a></p>';
      const template = Handlebars.compile(customTemplate);
      const html = template({
        magicLink: 'https://example.com/login',
        branding: { name: 'Custom App', emoji: '🚀' },
      });

      expect(html).toContain('Hello from Custom App!');
      expect(html).toContain('href="https://example.com/login"');
    });
  });

  describe('sendMagicLinkEmail', () => {
    it('throws if transport is not initialized', async () => {
      await expect(
        sendMagicLinkEmail(
          'test@example.com',
          'https://example.com/login',
          'noreply@example.com',
          { name: 'Test', emoji: '🧪' },
        ),
      ).rejects.toThrow('Email transport not initialized');
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import Handlebars from 'handlebars';

import {
  clearTransport,
  DEFAULT_TEMPLATE,
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

/**
 * Mailer service for magic link authentication.
 *
 * Wraps nodemailer to send branded login emails using the configured
 * SMTP connection string. Renders email body from a Handlebars template
 * (custom or default).
 *
 * @packageDocumentation
 */

import Handlebars from 'handlebars';
import { createTransport, type Transporter } from 'nodemailer';

/** Branding data passed to the email template. */
export interface EmailBranding {
  name: string;
  emoji: string;
}

/** Default magic link email template (plain HTML). */
export const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
  <h2 style="font-size: 1.25rem;">{{branding.emoji}} {{branding.name}}</h2>
  <p>Click the link below to sign in:</p>
  <p><a href="{{{magicLink}}}" style="display:inline-block;padding:10px 24px;background:#4285f4;color:#fff;text-decoration:none;border-radius:4px;font-size:14px;font-weight:500;">Sign in</a></p>
  <p style="color:#888;font-size:0.85rem;">This link expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
</body>
</html>`;

let transport: Transporter | null = null;

/**
 * Initialize (or reinitialize) the nodemailer transport.
 *
 * @param smtpUrl - SMTP connection string (e.g. smtps://user:pass\@smtp.example.com:465)
 */
export function initTransport(smtpUrl: string): void {
  transport = createTransport(smtpUrl);
}

/**
 * Send a magic link email to a recipient.
 *
 * @param to - Recipient email address.
 * @param magicLink - The full magic link URL.
 * @param fromAddress - Sender email address.
 * @param branding - Instance branding (name, emoji).
 * @param customTemplate - Optional Handlebars template string (overrides default).
 */
export async function sendMagicLinkEmail(
  to: string,
  magicLink: string,
  fromAddress: string,
  branding: EmailBranding,
  customTemplate?: string,
): Promise<void> {
  if (!transport) {
    throw new Error(
      'Email transport not initialized. Call initTransport() first.',
    );
  }

  const templateSource = customTemplate ?? DEFAULT_TEMPLATE;
  const template = Handlebars.compile(templateSource);
  const html = template({ magicLink, branding });

  await transport.sendMail({
    from: fromAddress,
    to,
    subject: `${branding.emoji} Sign in to ${branding.name}`,
    html,
  });
}

/**
 * Get the current transport (for testing/verification).
 */
export function getTransport(): Transporter | null {
  return transport;
}

/**
 * Clear the transport (for testing).
 */
export function clearTransport(): void {
  transport = null;
}

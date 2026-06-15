/**
 * SPA sign-in page — shown when the user is not authenticated.
 *
 * Uses the real Header component (theme toggle only) and fetches
 * auth modes from /status to decide which sign-in options to show.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Header } from '@/components/layout/Header';
import { useBranding } from '@/lib/BrandingContext';
import { useTheme } from '@/lib/theme';

type AuthMode = 'google' | 'email' | 'keys';

/** Google "G" logo SVG — official 4-color version. */
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function SignIn() {
  const [theme, toggleTheme] = useTheme();
  const branding = useBranding();
  const [authModes, setAuthModes] = useState<AuthMode[]>([]);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch auth modes from /status
  useEffect(() => {
    fetch('/status')
      .then((r) => (r.ok ? (r.json() as Promise<{ health?: { auth?: { modes?: AuthMode[] } } }>) : null))
      .then((data) => {
        const modes = data?.health?.auth?.modes;
        if (modes) setAuthModes(modes);
      })
      .catch(() => {});
  }, []);

  const hasGoogle = authModes.includes('google');
  const hasEmail = authModes.includes('email');
  const returnTo = window.location.pathname + window.location.search;
  const loginHref = `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

  const handleMagicLink = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const email = (form.elements.namedItem('email') as HTMLInputElement).value;
      setEmailError('');
      setSubmitting(true);
      try {
        const res = await fetch('/api/auth/magic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, returnTo }),
        });
        if (res.ok) {
          setEmailSent(true);
        } else {
          setEmailError('Something went wrong. Please try again.');
        }
      } catch {
        setEmailError('Network error. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [returnTo],
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        isInsider={false}
        theme={theme}
        onToggleTheme={toggleTheme}
        disableHomeLink
      />

      <div className="flex-1 flex items-center justify-center px-5">
        <div className="w-full max-w-sm text-center space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-1">
              {branding.emoji} {branding.name}
            </h1>
            <h2 className="text-sm font-normal text-muted-foreground">
              Sign in to continue
            </h2>
          </div>

          <div className="text-sm text-muted-foreground">
            Trying to access:
            <br />
            <code className="inline-block mt-1 px-1.5 py-0.5 bg-muted rounded text-xs break-all max-w-full">
              {returnTo}
            </code>
          </div>

          {/* Magic link email form */}
          {hasEmail && !emailSent && (
            <form onSubmit={handleMagicLink} className="space-y-3">
              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                required
                className="w-full px-3 py-2.5 text-sm border border-border rounded-md bg-background text-foreground outline-none focus:border-primary transition-colors"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Send Login Link'}
              </button>
              {emailError && (
                <p className="text-sm text-destructive">{emailError}</p>
              )}
            </form>
          )}

          {hasEmail && emailSent && (
            <p className="text-sm text-muted-foreground">
              Check your email for a login link — if you&apos;re registered, one is on its way.
            </p>
          )}

          {/* Divider */}
          {hasEmail && hasGoogle && !emailSent && (
            <div className="text-xs text-muted-foreground">— or —</div>
          )}

          {/* Google sign-in button — follows Google branding guidelines */}
          {hasGoogle && (
            <a
              href={loginHref}
              className="inline-flex items-center justify-center gap-3 w-full px-6 py-2.5 bg-white text-[#3c4043] rounded-md shadow-sm border border-[#dadce0] text-sm font-medium hover:shadow-md transition-shadow dark:bg-[#131314] dark:text-[#e3e3e3] dark:border-[#8e918f]"
            >
              <GoogleLogo className="w-[18px] h-[18px] shrink-0" />
              Sign in with Google
            </a>
          )}

          {!hasGoogle && !hasEmail && (
            <p className="text-sm text-muted-foreground">
              This server requires an API key for access.
            </p>
          )}
        </div>
      </div>

      <footer className="py-4 text-center">
        <p className="text-xs text-muted-foreground space-x-3">
          <Link to="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:underline">
            Terms of Service
          </Link>
        </p>
      </footer>
    </div>
  );
}

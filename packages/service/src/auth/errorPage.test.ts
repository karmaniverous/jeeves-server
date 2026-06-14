import { describe, expect, it } from 'vitest';

import { renderErrorPage } from './errorPage.js';

describe('renderErrorPage', () => {
  it('renders valid HTML with the given title and message', () => {
    const html = renderErrorPage('Test Error', 'Something went wrong.');
    expect(html).toContain('<title>Test Error</title>');
    expect(html).toContain('<h1>Test Error</h1>');
    expect(html).toContain('Something went wrong.');
    expect(html).toContain('Return to sign in');
  });

  it('includes dark mode styles', () => {
    const html = renderErrorPage('Error', 'Oops.');
    expect(html).toContain('prefers-color-scheme: dark');
  });

  it('includes a return link to the root', () => {
    const html = renderErrorPage('Error', 'Oops.');
    expect(html).toContain('href="/"');
  });
});

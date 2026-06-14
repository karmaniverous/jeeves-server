/**
 * Server-rendered error page for authentication failures.
 * @packageDocumentation
 */

/**
 * Render an inline HTML error page.
 */
export function renderErrorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body {
    font-family: system-ui, -apple-system, sans-serif;
    max-width: 480px;
    margin: 80px auto;
    padding: 0 20px;
    text-align: center;
    color: #1a1a1a;
    background: #fff;
  }
  @media (prefers-color-scheme: dark) {
    body { color: #e0e0e0; background: #1a1a1a; }
  }
  h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; }
  p { font-size: 0.95rem; line-height: 1.5; color: #666; }
  @media (prefers-color-scheme: dark) { p { color: #999; } }
  a { color: #4285f4; text-decoration: none; }
  a:hover { text-decoration: underline; }
</style>
</head>
<body>
<h1>${title}</h1>
<p>${message}</p>
<p><a href="/">Return to sign in</a></p>
</body>
</html>`;
}

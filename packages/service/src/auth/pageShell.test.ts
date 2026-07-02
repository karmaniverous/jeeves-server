import { describe, expect, it } from 'vitest';

import { escapeHtml, renderPageShell } from './pageShell.js';

describe('escapeHtml', () => {
  it('escapes all five HTML-sensitive characters', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('passes through safe strings unchanged', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapes a realistic XSS payload', () => {
    const result = escapeHtml('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });
});

describe('renderPageShell', () => {
  it('renders a complete HTML document with doctype', () => {
    const html = renderPageShell({
      titleSuffix: 'Test',
      bodyContent: '<p>Hello</p>',
    });
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('</html>');
  });

  it('includes default branding when none is provided', () => {
    const html = renderPageShell({
      titleSuffix: 'Test',
      bodyContent: '',
    });
    expect(html).toContain('Jeeves Server');
    expect(html).toContain('🎩');
  });

  it('uses custom branding when provided', () => {
    const html = renderPageShell({
      titleSuffix: 'Test',
      brandName: 'My App',
      brandEmoji: '🚀',
      bodyContent: '',
    });
    expect(html).toContain('My App');
    expect(html).toContain('🚀');
    expect(html).not.toContain('Jeeves Server');
  });

  it('escapes branding values in the output', () => {
    const html = renderPageShell({
      titleSuffix: 'Test',
      brandName: '<script>alert(1)</script>',
      bodyContent: '',
    });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('includes title suffix in the page title', () => {
    const html = renderPageShell({
      titleSuffix: 'Sign In',
      bodyContent: '',
    });
    expect(html).toContain('<title>🎩 Jeeves Server — Sign In</title>');
  });

  it('injects extra CSS when provided', () => {
    const html = renderPageShell({
      titleSuffix: 'Test',
      bodyContent: '',
      extraCss: '  .custom { color: red; }',
    });
    expect(html).toContain('.custom { color: red; }');
  });

  it('renders body content inside the box container', () => {
    const html = renderPageShell({
      titleSuffix: 'Test',
      bodyContent: '<form id="testForm">content</form>',
    });
    expect(html).toContain('<form id="testForm">content</form>');
  });

  it('includes footer script when provided', () => {
    const html = renderPageShell({
      titleSuffix: 'Test',
      bodyContent: '',
      footerScript: 'console.log("loaded");',
    });
    expect(html).toContain('console.log("loaded");');
  });

  it('omits footer script block when not provided', () => {
    const html = renderPageShell({
      titleSuffix: 'Test',
      bodyContent: '',
    });
    // Should have exactly two script blocks: theme init + theme toggle
    const scriptMatches = html.match(/<script>/g);
    expect(scriptMatches).toHaveLength(2);
  });

  it('includes theme initialization script', () => {
    const html = renderPageShell({
      titleSuffix: 'Test',
      bodyContent: '',
    });
    expect(html).toContain("localStorage.getItem('jeeves-theme')");
  });

  it('includes theme toggle button with sun and moon icons', () => {
    const html = renderPageShell({
      titleSuffix: 'Test',
      bodyContent: '',
    });
    expect(html).toContain('id="themeToggle"');
    expect(html).toContain('class="icon-sun"');
    expect(html).toContain('class="icon-moon"');
  });

  it('includes shared dark mode CSS overrides', () => {
    const html = renderPageShell({
      titleSuffix: 'Test',
      bodyContent: '',
    });
    expect(html).toContain('.dark body');
    expect(html).toContain('.dark h2');
  });
});

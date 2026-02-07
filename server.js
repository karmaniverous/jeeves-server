/**
 * @module jeeves-server
 * 
 * Express server for Jeeves:
 * - Webhook receiver (derives source from request headers/body)
 * - File server with markdown rendering
 * - Path-specific key authentication
 * 
 * Setup:
 *   1. Copy .env.local.template to .env.local
 *   2. Set API_KEY to a random secret
 *   3. npm install
 *   4. npm start
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { marked } = require('marked');
const hljs = require('highlight.js');

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

// Load .env.local if it exists
function loadEnvLocal() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  }
  return env;
}

const localEnv = loadEnvLocal();
const API_KEY = localEnv.API_KEY || process.env.API_KEY;
const PORT = parseInt(localEnv.PORT || process.env.PORT || '3456', 10);
const EVENTS_LOG = path.join(__dirname, 'logs', 'webhook-events.jsonl');

if (!API_KEY) {
  console.error('ERROR: API_KEY not set. Copy .env.local.template to .env.local and set API_KEY.');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function appendJsonl(p, obj) { 
  ensureDir(path.dirname(p)); 
  fs.appendFileSync(p, JSON.stringify(obj) + '\n', 'utf8'); 
}
function nowIso() { return new Date().toISOString(); }

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

// Compute path-specific key: HMAC-SHA256(apiKey, normalizedPath)
// Each path gets a unique key while only storing one secret
function computePathKey(apiKey, urlPath) {
  const normalized = urlPath.toLowerCase().replace(/^\/+|\/+$/g, '');
  const hash = crypto.createHmac('sha256', apiKey).update(normalized).digest('hex');
  return hash.substring(0, 32);
}

// Verify a path-specific key
function verifyPathKey(apiKey, urlPath, providedKey) {
  if (!providedKey) return false;
  const expected = computePathKey(apiKey, urlPath);
  try {
    return crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Source Detection (for webhooks)
// ─────────────────────────────────────────────────────────────

function detectSource(req) {
  const headers = req.headers;
  const body = req.body || {};

  if (headers['x-notion-signature']) {
    return { source: 'notion', event: headers['x-notion-event'] || 'unknown' };
  }
  if (headers['x-github-event']) {
    return { source: 'github', event: headers['x-github-event'] };
  }
  if (body.type && (body.team_id || body.api_app_id)) {
    return { source: 'slack', event: body.type };
  }
  if (body.type && body.data?.object && body.api_version) {
    return { source: 'stripe', event: body.type };
  }
  if (headers['x-webhook-source']) {
    return { source: headers['x-webhook-source'], event: headers['x-webhook-event'] || 'unknown' };
  }
  if (body._source) {
    return { source: body._source, event: body._event || 'unknown' };
  }
  return { source: 'unknown', event: 'unknown' };
}

// ─────────────────────────────────────────────────────────────
// Webhook Handlers
// ─────────────────────────────────────────────────────────────

const handlers = {
  notion: async (req, ctx) => {
    appendJsonl(EVENTS_LOG, { at: nowIso(), ...ctx, action: 'logged' });
    return { ok: true, message: 'Notion webhook received' };
  },
  github: async (req, ctx) => {
    appendJsonl(EVENTS_LOG, { at: nowIso(), ...ctx, action: 'logged' });
    return { ok: true, message: 'GitHub webhook received' };
  },
  slack: async (req, ctx) => {
    if (req.body.type === 'url_verification') {
      return { challenge: req.body.challenge };
    }
    appendJsonl(EVENTS_LOG, { at: nowIso(), ...ctx, action: 'logged' });
    return { ok: true, message: 'Slack webhook received' };
  },
  stripe: async (req, ctx) => {
    appendJsonl(EVENTS_LOG, { at: nowIso(), ...ctx, action: 'logged' });
    return { ok: true, message: 'Stripe webhook received' };
  },
  unknown: async (req, ctx) => {
    appendJsonl(EVENTS_LOG, { at: nowIso(), ...ctx, action: 'logged_unknown' });
    return { ok: true, message: 'Webhook received (unknown source)' };
  }
};

// ─────────────────────────────────────────────────────────────
// Express App
// ─────────────────────────────────────────────────────────────

const app = express();

app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

// Health check (no auth)
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Key generator: compute key for a given path (requires raw API key)
app.get('/key', (req, res) => {
  const provided = req.headers['x-api-key'];
  if (!provided) {
    return res.status(401).json({ error: 'X-API-Key header required' });
  }
  try {
    if (!crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(API_KEY))) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
  } catch {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const targetPath = req.query.path;
  if (!targetPath) {
    return res.status(400).json({ error: 'path query param required' });
  }

  const key = computePathKey(API_KEY, targetPath);
  res.json({ path: targetPath, key });
});

// Webhook endpoint (path-specific key auth)
app.use('/webhook', (req, res, next) => {
  const provided = req.headers['x-api-key'] || req.query.key;
  if (!verifyPathKey(API_KEY, '/webhook', provided)) {
    appendJsonl(EVENTS_LOG, { at: nowIso(), kind: 'auth_failed', ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.post('/webhook', async (req, res) => {
  const ctx = detectSource(req);
  try {
    const handler = handlers[ctx.source] || handlers.unknown;
    const result = await handler(req, ctx);
    res.json(result);
  } catch (err) {
    appendJsonl(EVENTS_LOG, { at: nowIso(), ...ctx, error: String(err) });
    res.status(500).json({ error: 'Handler failed' });
  }
});

// Path endpoint (path-specific key auth, serves files with markdown rendering)
app.use('/path', (req, res, next) => {
  const urlPath = req.path;
  const provided = req.query.key;
  
  if (!verifyPathKey(API_KEY, urlPath, provided)) {
    appendJsonl(EVENTS_LOG, { at: nowIso(), kind: 'auth_failed_path', ip: req.ip, path: urlPath });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Root path: list all drives
app.get('/path', (req, res) => {
  const { execSync } = require('child_process');
  let drives = [];
  try {
    // Get drives on Windows
    const output = execSync('wmic logicaldisk get name', { encoding: 'utf8' });
    drives = output.split('\n')
      .map(line => line.trim())
      .filter(line => /^[A-Z]:$/.test(line))
      .map(d => d.replace(':', ''));
  } catch {
    drives = ['C', 'D', 'E']; // Fallback
  }
  
  let rows = '';
  for (const drive of drives) {
    const drivePath = drive + ':\\';
    const urlPath = '/' + drive.toLowerCase();
    const key = computePathKey(API_KEY, urlPath);
    let freeSpace = '-', totalSpace = '-';
    try {
      // This is a simple approach; we could use wmic for more detail
    } catch {}
    rows += '<tr><td>💾 <a href="/path' + urlPath + '?key=' + key + '">' + drivePath + '</a></td><td>Drive</td></tr>';
  }
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Drives</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #fafafa; color: #333; }
    .header { background: #24292e; color: #fff; padding: 1rem 2rem; }
    .header a { color: #79b8ff; text-decoration: none; }
    .container { padding: 1.5rem 2rem; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #e1e4e8; }
    th { background: #f6f8fa; font-weight: 600; font-size: 13px; color: #586069; }
    td { font-size: 14px; }
    tr:hover { background: #f6f8fa; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="header">
    <div class="breadcrumb">drives</div>
  </div>
  <div class="container">
    <table>
      <thead><tr><th>Drive</th><th>Type</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

app.get('/path/*', (req, res) => {
  const reqPath = req.params[0];
  if (!reqPath) {
    return res.redirect('/path');
  }

  // Convert URL path to Windows path: d/foo/bar.md -> D:\foo\bar.md
  let filePath = reqPath;
  if (/^[a-zA-Z]\//.test(filePath)) {
    filePath = filePath[0].toUpperCase() + ':' + filePath.slice(1);
  }
  filePath = filePath.replace(/\//g, '\\');
  
  const resolved = path.resolve(filePath);
  appendJsonl(EVENTS_LOG, { at: nowIso(), kind: 'path_access', ip: req.ip, requested: reqPath, resolved });

  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'File not found', path: resolved });
  }

  const stats = fs.statSync(resolved);
  if (stats.isDirectory()) {
    // ─────────────────────────────────────────────────────────
    // Directory listing with breadcrumb navigation
    // ─────────────────────────────────────────────────────────
    const binaryExts = ['.exe', '.dll', '.bin', '.so', '.dylib', '.obj', '.o', '.a', '.lib', '.msi', '.iso', '.img', '.dmg', '.deb', '.rpm', '.zip', '.tar', '.gz', '.7z', '.rar', '.cab'];
    
    // Build breadcrumb trail
    const pathParts = resolved.split('\\').filter(p => p);
    let breadcrumbs = '<a href="/path?key=' + computePathKey(API_KEY, '/') + '">drives</a>';
    let accumPath = '';
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      if (i === 0) {
        // Drive letter
        accumPath = part;
      } else {
        accumPath += '\\' + part;
      }
      const urlPath = '/' + accumPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (m, d) => d.toLowerCase());
      const key = computePathKey(API_KEY, urlPath);
      breadcrumbs += ' / <a href="/path' + urlPath + '?key=' + key + '">' + part + '</a>';
    }
    
    // Read directory contents
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    let rows = '';
    
    // Sort: directories first, then files, alphabetically
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });
    
    for (const entry of sorted) {
      const entryPath = path.join(resolved, entry.name);
      const entryUrlPath = '/' + entryPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (m, d) => d.toLowerCase());
      const entryKey = computePathKey(API_KEY, entryUrlPath);
      
      let type, size, mtime;
      try {
        const entryStats = fs.statSync(entryPath);
        mtime = entryStats.mtime.toISOString().split('T')[0];
        if (entry.isDirectory()) {
          type = 'Directory';
          size = '-';
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          type = ext ? ext.slice(1).toUpperCase() : 'File';
          size = formatSize(entryStats.size);
        }
      } catch {
        type = '?';
        size = '-';
        mtime = '-';
      }
      
      // Check if we should link this entry
      const ext = path.extname(entry.name).toLowerCase();
      const isBinary = binaryExts.includes(ext);
      const nameCell = (isBinary && !entry.isDirectory())
        ? entry.name
        : '<a href="/path' + entryUrlPath + '?key=' + entryKey + '">' + entry.name + '</a>';
      
      const icon = entry.isDirectory() ? '📁' : '📄';
      rows += '<tr><td>' + icon + ' ' + nameCell + '</td><td>' + type + '</td><td>' + size + '</td><td>' + mtime + '</td></tr>';
    }
    
    const dirName = path.basename(resolved) || resolved;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${dirName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #fafafa; color: #333; }
    .header { background: #24292e; color: #fff; padding: 1rem 2rem; }
    .header a { color: #79b8ff; text-decoration: none; }
    .header a:hover { text-decoration: underline; }
    .breadcrumb { font-size: 14px; }
    .container { padding: 1.5rem 2rem; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #e1e4e8; }
    th { background: #f6f8fa; font-weight: 600; font-size: 13px; color: #586069; }
    td { font-size: 14px; }
    tr:hover { background: #f6f8fa; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .count { color: #586069; font-size: 13px; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="header">
    <div class="breadcrumb">${breadcrumbs}</div>
  </div>
  <div class="container">
    <div class="count">${entries.length} items</div>
    <table>
      <thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Modified</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentTypes = {
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.yaml': 'text/yaml; charset=utf-8',
    '.yml': 'text/yaml; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.ts': 'application/typescript; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.jsonl': 'text/plain; charset=utf-8',
    '.log': 'text/plain; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
  };
  
  try {
    if (ext === '.md') {
      let markdown = fs.readFileSync(resolved, 'utf8');
      const fileName = path.basename(resolved);
      const fileDir = path.dirname(resolved);
      
      // ─────────────────────────────────────────────────────────
      // PRE-PROCESS: Convert Windows paths to markdown links
      // (only outside of code blocks and inline code)
      // ─────────────────────────────────────────────────────────
      const winPathRegex = /([A-Z]):\\(?:[^\s"'`<>\\]+\\)*[^\s"'`<>\\]+/g;
      
      // Binary extensions that shouldn't be linked (can't render in browser)
      const binaryExts = ['.exe', '.dll', '.bin', '.so', '.dylib', '.obj', '.o', '.a', '.lib', '.msi', '.iso', '.img', '.dmg', '.deb', '.rpm', '.zip', '.tar', '.gz', '.7z', '.rar', '.cab'];
      
      // Resolve a Windows path: check existence, skip binaries
      const resolvePathForLink = (winPath) => {
        // Skip templated paths
        if (winPath.includes('{') || winPath.includes('}')) return null;
        
        if (!fs.existsSync(winPath)) return null;
        
        const stats = fs.statSync(winPath);
        if (stats.isFile()) {
          // Skip binary files
          const ext = path.extname(winPath).toLowerCase();
          if (binaryExts.includes(ext)) return null;
        }
        // Directories and viewable files are linkable
        return winPath;
      };
      
      const linkifyPathMd = (winPath) => {
        const resolved = resolvePathForLink(winPath);
        if (!resolved) return winPath; // Return original text, no link
        
        const urlPath = '/' + resolved.replace(/\\/g, '/').replace(/^([A-Z]):/, (m, d) => d.toLowerCase());
        const key = computePathKey(API_KEY, urlPath);
        return `[${winPath}](/path${urlPath}?key=${key})`;
      };
      
      // Split by fenced code blocks AND inline code to avoid linkifying inside them
      const codeBlockRegex = /(```[\s\S]*?```|`[^`\n]+`)/g;
      const parts = markdown.split(codeBlockRegex);
      markdown = parts.map((part) => {
        // Code blocks and inline code - leave alone (will be post-processed in HTML)
        if (part.startsWith('```') || part.startsWith('`')) {
          return part;
        }
        return part.replace(winPathRegex, linkifyPathMd);
      }).join('');
      
      // ─────────────────────────────────────────────────────────
      // PARSE: Convert markdown to HTML with heading anchors
      // ─────────────────────────────────────────────────────────
      const headings = [];
      
      const renderer = new marked.Renderer();
      renderer.heading = function(text, level, raw) {
        const headingText = typeof text === 'object' ? text.text : text;
        const headingRaw = typeof text === 'object' ? text.raw : raw;
        const headingLevel = typeof text === 'object' ? text.depth : level;
        
        const slug = (headingRaw || headingText)
          .toLowerCase()
          .replace(/<[^>]+>/g, '')
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        
        headings.push({ level: headingLevel, text: headingText.replace(/<[^>]+>/g, ''), slug });
        return `<h${headingLevel} id="${slug}"><a href="#${slug}" class="anchor">#</a> ${headingText}</h${headingLevel}>\n`;
      };
      
      marked.setOptions({ renderer });
      let htmlContent = marked(markdown);
      
      // Generate TOC (on by default, disable with ?toc=0)
      let tocHtml = '';
      const showToc = req.query.toc !== '0' && headings.length > 0;
      if (showToc) {
        tocHtml = '<nav class="toc"><div class="toc-title">Contents</div><ul>';
        for (const h of headings) {
          const indent = (h.level - 1) * 0.8;
          tocHtml += `<li style="margin-left:${indent}em"><a href="#${h.slug}">${h.text}</a></li>`;
        }
        tocHtml += '</ul></nav>';
      }
      
      // ─────────────────────────────────────────────────────────
      // POST-PROCESS: Fix relative links (images, hrefs)
      // ─────────────────────────────────────────────────────────
      htmlContent = htmlContent.replace(
        /(href|src)="([^"]+)"/g,
        (match, attr, url) => {
          if (url.startsWith('http://') || url.startsWith('https://') || 
              url.startsWith('#') || url.startsWith('//') || url.startsWith('/path/')) {
            return match;
          }
          
          let targetPath;
          if (url.startsWith('/')) {
            targetPath = 'D:' + url;
          } else {
            targetPath = path.resolve(fileDir, url);
          }
          
          const urlPath = '/path/' + targetPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (m, d) => d.toLowerCase());
          const key = computePathKey(API_KEY, urlPath.replace('/path', ''));
          
          return `${attr}="${urlPath}?key=${key}"`;
        }
      );
      
      // ─────────────────────────────────────────────────────────
      // POST-PROCESS: Linkify Windows paths inside <code> tags
      // (but not inside <pre> blocks)
      // ─────────────────────────────────────────────────────────
      const linkifyPathHtml = (winPath) => {
        const resolved = resolvePathForLink(winPath);
        if (!resolved) return winPath; // Return original text, no link
        
        const urlPath = '/' + resolved.replace(/\\/g, '/').replace(/^([A-Z]):/, (m, d) => d.toLowerCase());
        const key = computePathKey(API_KEY, urlPath);
        return `<a href="/path${urlPath}?key=${key}">${winPath}</a>`;
      };
      
      // Split by <pre> blocks to preserve them
      const preParts = htmlContent.split(/(<pre[\s\S]*?<\/pre>)/g);
      htmlContent = preParts.map((part) => {
        if (part.startsWith('<pre')) return part;
        // Linkify paths inside <code> tags
        return part.replace(/<code>([^<]*)<\/code>/g, (match, inner) => {
          const linked = inner.replace(winPathRegex, linkifyPathHtml);
          return `<code>${linked}</code>`;
        });
      }).join('');
      
      const hasToc = showToc && headings.length > 0;
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${fileName}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      color: #333;
      background: #fafafa;
    }
    .layout { display: flex; min-height: 100vh; }
    .toc {
      width: 260px;
      flex-shrink: 0;
      background: #f6f8fa;
      border-right: 1px solid #e1e4e8;
      padding: 1.5rem 1rem;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
    }
    .toc-title { font-weight: 600; margin-bottom: 0.8em; color: #1a1a1a; }
    .toc ul { margin: 0; padding-left: 0; list-style: none; }
    .toc li { margin: 0.4em 0; font-size: 0.9em; }
    .toc a { color: #555; }
    .toc a:hover { color: #0366d6; }
    .content {
      flex: 1;
      max-width: 900px;
      padding: 2rem 3rem;
    }
    .no-toc .content { margin: 0 auto; }
    h1, h2, h3, h4, h5, h6 { color: #1a1a1a; margin-top: 1.5em; }
    h1 { border-bottom: 2px solid #e1e4e8; padding-bottom: 0.3em; }
    h2 { border-bottom: 1px solid #e1e4e8; padding-bottom: 0.3em; }
    code { background: #f0f0f0; padding: 0.2em 0.4em; border-radius: 3px; font-family: 'SF Mono', Consolas, monospace; font-size: 0.9em; }
    pre { background: #282c34; color: #abb2bf; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; color: inherit; padding: 0; }
    blockquote { border-left: 4px solid #dfe2e5; margin: 1em 0; padding: 0.5em 1em; color: #6a737d; background: #fff; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #dfe2e5; padding: 0.6em 1em; text-align: left; }
    th { background: #f6f8fa; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    a.anchor { color: #ccc; margin-right: 0.3em; font-weight: normal; }
    a.anchor:hover { color: #0366d6; }
    code a { color: inherit; text-decoration: underline; text-decoration-style: dotted; }
    code a:hover { text-decoration-style: solid; }
    hr { border: none; border-top: 1px solid #e1e4e8; margin: 2em 0; }
    img { max-width: 100%; height: auto; }
    ul, ol { padding-left: 2em; }
    li { margin: 0.25em 0; }
    @media (max-width: 900px) {
      .toc { display: none; }
      .content { padding: 1.5rem; }
    }
  </style>
</head>
<body>
  <div class="layout${hasToc ? '' : ' no-toc'}">
    ${tocHtml}
    <main class="content">
${htmlContent}
    </main>
  </div>
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
      return;
    }
    
    // For text-based files, wrap in HTML viewer by default (disable with ?raw=1)
    const textExtensions = ['.txt', '.json', '.jsonl', '.yaml', '.yml', '.log', '.csv', '.xml', '.js', '.ts', '.css', '.html', '.md', '.ps1', '.sh', '.bat', '.cmd', '.ini', '.conf', '.cfg'];
    const isTextFile = textExtensions.includes(ext) || (contentTypes[ext] || '').startsWith('text/');
    
    if (req.query.raw === '1' || !isTextFile) {
      // Raw mode or binary file
      const contentType = contentTypes[ext] || 'application/octet-stream';
      const content = fs.readFileSync(resolved);
      res.setHeader('Content-Type', contentType);
      res.send(content);
    } else {
      // HTML viewer for text files with syntax highlighting
      const content = fs.readFileSync(resolved, 'utf8');
      const fileName = path.basename(resolved);
      
      // Map extensions to highlight.js languages
      const langMap = {
        '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
        '.ts': 'typescript', '.tsx': 'typescript',
        '.json': 'json', '.jsonl': 'json',
        '.yaml': 'yaml', '.yml': 'yaml',
        '.xml': 'xml', '.html': 'xml', '.htm': 'xml',
        '.css': 'css', '.scss': 'scss', '.less': 'less',
        '.md': 'markdown',
        '.py': 'python',
        '.rb': 'ruby',
        '.go': 'go',
        '.rs': 'rust',
        '.java': 'java',
        '.c': 'c', '.h': 'c',
        '.cpp': 'cpp', '.hpp': 'cpp', '.cc': 'cpp',
        '.cs': 'csharp',
        '.php': 'php',
        '.sh': 'bash', '.bash': 'bash', '.zsh': 'bash',
        '.ps1': 'powershell', '.psm1': 'powershell',
        '.bat': 'dos', '.cmd': 'dos',
        '.sql': 'sql',
        '.ini': 'ini', '.conf': 'ini', '.cfg': 'ini',
        '.dockerfile': 'dockerfile',
        '.makefile': 'makefile',
      };
      
      const lang = langMap[ext] || null;
      let highlighted;
      try {
        if (lang) {
          highlighted = hljs.highlight(content, { language: lang }).value;
        } else {
          highlighted = hljs.highlightAuto(content).value;
        }
      } catch {
        highlighted = content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }
      
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${fileName}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <style>
    body {
      font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 13px;
      line-height: 1.5;
      margin: 0;
      padding: 0;
      background: #0d1117;
      color: #c9d1d9;
    }
    pre { margin: 0; padding: 1rem; overflow-x: auto; }
    code { font-family: inherit; }
    .header {
      background: #161b22;
      padding: 0.5rem 1rem;
      border-bottom: 1px solid #30363d;
      color: #8b949e;
      font-size: 12px;
      position: sticky;
      top: 0;
    }
    .header a { color: #58a6ff; }
  </style>
</head>
<body>
  <div class="header">${resolved} &nbsp;|&nbsp; <a href="?raw=1">View Raw</a></div>
  <pre><code class="hljs${lang ? ' language-' + lang : ''}">${highlighted}</code></pre>
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    }
  } catch (err) {
    appendJsonl(EVENTS_LOG, { at: nowIso(), kind: 'path_error', path: resolved, error: String(err) });
    res.status(500).json({ error: 'Failed to read file', details: String(err) });
  }
});

// ─────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Jeeves server listening on port ${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  POST /webhook  - Receive webhooks (path-key auth)`);
  console.log(`  GET  /path/*   - Serve files (path-key auth)`);
  console.log(`  GET  /key      - Compute path key (X-API-Key auth)`);
  console.log(`  GET  /health   - Health check (no auth)`);
});

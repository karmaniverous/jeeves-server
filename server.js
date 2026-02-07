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

app.get('/path/*', (req, res) => {
  const reqPath = req.params[0];
  if (!reqPath) {
    return res.status(400).json({ error: 'No path provided' });
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
    return res.status(400).json({ error: 'Path is a directory', path: resolved });
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
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
  };
  
  try {
    if (ext === '.md') {
      const markdown = fs.readFileSync(resolved, 'utf8');
      let htmlContent = marked(markdown);
      const fileName = path.basename(resolved);
      const fileDir = path.dirname(resolved);
      
      // Rewrite local links to use /path/ with computed keys
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
      
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
      color: #333;
      background: #fafafa;
    }
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
    hr { border: none; border-top: 1px solid #e1e4e8; margin: 2em 0; }
    img { max-width: 100%; height: auto; }
    ul, ol { padding-left: 2em; }
    li { margin: 0.25em 0; }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
      return;
    }
    
    const contentType = contentTypes[ext] || 'application/octet-stream';
    const content = fs.readFileSync(resolved);
    res.setHeader('Content-Type', contentType);
    res.send(content);
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

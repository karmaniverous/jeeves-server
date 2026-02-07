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

// Export libraries (lazy-loaded)
let puppeteer = null;
let docx = null;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

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
let API_KEY = localEnv.API_KEY || process.env.API_KEY;
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

// State file for tracking metadata like key rotation
const STATE_FILE = path.join(__dirname, 'state.json');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function getKeyRotationTimestamp() {
  const state = loadState();
  return state.keyRotatedAt || null;
}

function setKeyRotationTimestamp(timestamp) {
  const state = loadState();
  state.keyRotatedAt = timestamp;
  saveState(state);
}

function formatRelativeTime(isoTimestamp) {
  if (!isoTimestamp) return null;
  const then = new Date(isoTimestamp).getTime();
  const now = Date.now();
  const diffMs = now - then;
  
  if (diffMs < 0) return null;
  
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function buildBreadcrumbs(resolvedPath, apiKey, mode) {
  const pathParts = resolvedPath.split('\\').filter(p => p);
  
  // Outsiders see only the filename (tail)
  if (mode === 'outsider') {
    const fileName = pathParts[pathParts.length - 1] || '';
    return `<span class="breadcrumb-tail">${fileName}</span>`;
  }
  
  // Insiders see full navigable breadcrumbs
  const insiderKey = computeInsiderKey(apiKey);
  let breadcrumbs = '<a href="/path?key=' + insiderKey + '" class="home-icon">🎩</a>';
  let accumPath = '';
  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    if (i === 0) {
      accumPath = part;
    } else {
      accumPath += '\\' + part;
    }
    const separator = i === 0 ? '' : ' &nbsp;/&nbsp; ';
    const isLast = i === pathParts.length - 1;
    if (isLast) {
      // Last element: no link, just text
      breadcrumbs += separator + '<span class="breadcrumb-current">' + part + '</span>';
    } else {
      const urlPath = '/' + accumPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (m, d) => d.toLowerCase());
      breadcrumbs += separator + '<a href="/path' + urlPath + '?key=' + insiderKey + '">' + part + '</a>';
    }
  }
  return breadcrumbs;
}

// Compute path-specific key: HMAC-SHA256(apiKey, normalizedPath)
// Each path gets a unique key while only storing one secret
function computePathKey(apiKey, urlPath) {
  const normalized = urlPath.toLowerCase().replace(/^\/+|\/+$/g, '');
  const hash = crypto.createHmac('sha256', apiKey).update(normalized).digest('hex');
  return hash.substring(0, 32);
}

// ─────────────────────────────────────────────────────────────
// Shared UI Components
// ─────────────────────────────────────────────────────────────

function renderThemeStyles() {
  return `
    :root {
      --bg-primary: #ffffff;
      --bg-secondary: #f6f8fa;
      --bg-tertiary: #fafafa;
      --text-primary: #24292e;
      --text-secondary: #586069;
      --text-muted: #6a737d;
      --border-color: #e1e4e8;
      --link-color: #0366d6;
      --code-bg: #f6f8fa;
      --table-header-bg: #f6f8fa;
      --table-row-hover: #f6f8fa;
    }
    [data-theme="dark"] {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #0d1117;
      --text-primary: #c9d1d9;
      --text-secondary: #8b949e;
      --text-muted: #6e7681;
      --border-color: #30363d;
      --link-color: #58a6ff;
      --code-bg: #161b22;
      --table-header-bg: #161b22;
      --table-row-hover: #161b22;
    }
  `;
}

function renderHeaderStyles() {
  return `
    .header { background: #24292e; color: #fff; padding: 0.75rem 2rem; font-size: 14px; line-height: 1.4; position: sticky; top: 0; z-index: 100; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 0 rgba(255,255,255,0.2); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    [data-theme="dark"] .header { box-shadow: none; }
    .header a { color: #79b8ff; text-decoration: none; }
    .header a:hover { text-decoration: underline; }
    .breadcrumb { display: flex; align-items: center; overflow: hidden; flex: 1; min-width: 0; }
    .breadcrumb a, .breadcrumb span:not(.home-icon) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; display: inline-block; vertical-align: middle; }
    .header-actions { display: flex; gap: 1rem; font-size: 13px; align-items: center; flex-shrink: 0; white-space: nowrap; }
    .header-actions a { color: #8b949e; }
    .header-actions a:hover { color: #79b8ff; }
    .breadcrumb-tail { color: #e1e4e8; }
    .breadcrumb-current { color: #e1e4e8; }
    .home-icon { font-size: 2rem; text-shadow: 0 0 8px rgba(255,255,255,0.8), 0 0 16px rgba(255,255,255,0.5); text-decoration: none !important; padding-right: 1rem; }
    .share-ui { display: flex; align-items: center; gap: 0.5rem; }
    .share-ui input { width: 50px; padding: 2px 6px; border: 1px solid #444; border-radius: 3px; background: #333; color: #fff; font-size: 12px; }
    .share-ui button { padding: 2px 8px; border: 1px solid #444; border-radius: 3px; background: #333; color: #8b949e; cursor: pointer; font-size: 12px; }
    .share-ui button:hover { background: #444; color: #fff; }
    .share-btn-inside, .share-btn-outside { min-width: 55px; }
    .expiry-countdown { color: #8b949e; font-size: 12px; margin-left: 0.5rem; }
    .expiry-countdown.expired { color: #f85149; }
    .theme-toggle { background: none; border: 1px solid #444; border-radius: 3px; padding: 2px 8px; cursor: pointer; font-size: 14px; color: #8b949e; }
    .theme-toggle:hover { background: #444; color: #fff; }
    .key-rotation-group { display: flex; align-items: center; gap: 0.4rem; margin-right: 1rem; }
    .key-rotation-age { color: #6e7681; font-size: 12px; }
    .info-btn-group { margin-right: 1rem; }
  `;
}

function renderThemeScript() {
  return `
    (function() {
      const saved = localStorage.getItem('jeeves-theme') || 'light';
      document.documentElement.setAttribute('data-theme', saved);
      window.toggleTheme = function() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('jeeves-theme', next);
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
      };
      document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
      });
    })();
  `;
}

function renderHeader(options) {
  const { isInsider, breadcrumbs, fileName, queryKey, currentPath, insiderKey, actions = [], expiry = null, showRaw = true } = options;
  
  const defaultActions = showRaw && fileName ? [
    `<a href="?key=${queryKey}&amp;raw=1" download="${fileName}" title="Download raw file">⬇ Raw</a>`
  ] : [];
  const allActions = [...defaultActions, ...actions];
  
  let shareUi;
  if (isInsider) {
    // Insider: Inside | Outside buttons + expiry input
    shareUi = `
      <div class="share-ui">
        <span style="color:#8b949e">Share:</span>
        <button id="share-inside-btn" class="share-btn-inside" data-key="${queryKey}" title="Copy insider link to clipboard">Inside</button>
        <span style="color:#444">|</span>
        <button id="share-outside-btn" class="share-btn-outside" data-path="${currentPath}" data-insider-key="${insiderKey}" title="Generate outsider link with optional expiry">Outside</button>
        <input type="text" id="share-expiry" placeholder="1h" title="Expiry: 15m, 1h, 7d, or blank for never">
      </div>
    `;
  } else {
    // Outsider: simple Share button + expiry countdown
    const expiryHtml = expiry ? `<span class="expiry-countdown" data-expiry="${expiry}"></span>` : '';
    shareUi = `
      <div class="share-ui">
        <button id="share-btn" data-key="${queryKey}" title="Copy link to clipboard">📋 Share</button>
        ${expiryHtml}
      </div>
    `;
  }
  
  // Info button (always shown)
  const infoBtnGroup = `
    <div class="info-btn-group">
      <a href="/about${isInsider ? '?key=' + insiderKey : ''}" class="theme-toggle" title="About Jeeves Server" style="text-decoration:none;font-weight:bold;">?</a>
    </div>
  `;
  
  // Key rotation button with timestamp (insider only)
  let keyRotateGroup = '';
  if (isInsider) {
    const rotationTs = getKeyRotationTimestamp();
    const rotationAge = formatRelativeTime(rotationTs);
    const ageHtml = rotationAge ? `<span class="key-rotation-age">${rotationAge}</span>` : '';
    keyRotateGroup = `
      <div class="key-rotation-group">
        <button id="rotate-key-btn" class="theme-toggle" title="Rotate API Key" data-insider-key="${insiderKey}">🔑</button>
        ${ageHtml}
      </div>
    `;
  }
  
  return `
    <div class="header">
      <div class="breadcrumb">${breadcrumbs}</div>
      <div class="header-actions">
        ${infoBtnGroup}
        ${keyRotateGroup}
        ${allActions.join('\n        ')}
        ${shareUi}
        <button id="theme-toggle" class="theme-toggle" onclick="toggleTheme()" title="Toggle dark/light theme">🌙</button>
      </div>
    </div>
  `;
}

function renderShareScript(isInsider) {
  if (isInsider) {
    return `
    const shareInsideBtn = document.getElementById('share-inside-btn');
    const shareOutsideBtn = document.getElementById('share-outside-btn');
    const shareExpiry = document.getElementById('share-expiry');
    
    // Load saved expiry
    const savedExpiry = localStorage.getItem('jeeves-share-expiry') || '';
    if (shareExpiry) shareExpiry.value = savedExpiry;
    
    // Inside button: copy current page URL
    if (shareInsideBtn) {
      shareInsideBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(window.location.href);
        shareInsideBtn.textContent = '✓';
        setTimeout(() => { shareInsideBtn.textContent = 'Inside'; }, 1500);
      });
    }
    
    // Outside button: generate outsider link with expiry
    if (shareOutsideBtn) {
      shareOutsideBtn.addEventListener('click', async () => {
        const expiryInput = shareExpiry ? shareExpiry.value.trim() : '';
        const path = shareOutsideBtn.dataset.path;
        const insiderKey = shareOutsideBtn.dataset.insiderKey;
        
        // Validate expiry format
        let expParam = '';
        if (expiryInput) {
          const match = expiryInput.match(/^(\\d+)([mhd])$/i);
          if (!match) {
            shareExpiry.style.borderColor = '#f85149';
            shareExpiry.title = 'Invalid format. Use: 15m, 1h, 7d';
            setTimeout(() => { shareExpiry.style.borderColor = '#444'; }, 2000);
            return;
          }
          const val = parseInt(match[1], 10);
          const unit = match[2].toLowerCase();
          if (val <= 0 || val > 365) {
            shareExpiry.style.borderColor = '#f85149';
            shareExpiry.title = 'Value must be 1-365';
            setTimeout(() => { shareExpiry.style.borderColor = '#444'; }, 2000);
            return;
          }
          const multiplier = { m: 60*1000, h: 60*60*1000, d: 24*60*60*1000 }[unit];
          const expiry = Date.now() + val * multiplier;
          expParam = '&exp=' + expiry;
        }
        
        localStorage.setItem('jeeves-share-expiry', expiryInput);
        
        try {
          const resp = await fetch('/share?path=' + encodeURIComponent(path) + '&key=' + insiderKey + expParam);
          const data = await resp.json();
          if (data.url) {
            const fullUrl = window.location.origin + data.url;
            await navigator.clipboard.writeText(fullUrl);
            shareOutsideBtn.textContent = '✓';
            setTimeout(() => { shareOutsideBtn.textContent = 'Outside'; }, 1500);
          }
        } catch (err) { console.error('Share failed:', err); }
      });
    }
    
    // Key rotation button
    const rotateKeyBtn = document.getElementById('rotate-key-btn');
    if (rotateKeyBtn) {
      rotateKeyBtn.addEventListener('click', async () => {
        const confirmed = confirm('⚠️ Rotate API Key?\\n\\nThis will INVALIDATE all existing links and shares.\\n\\nYou will be redirected to the new insider link for this page.');
        if (!confirmed) return;
        
        const insiderKey = rotateKeyBtn.dataset.insiderKey;
        try {
          const resp = await fetch('/rotate-key?key=' + insiderKey, { method: 'POST' });
          const data = await resp.json();
          if (data.ok && data.insiderKey) {
            // Navigate to same path with new insider key
            const url = new URL(window.location.href);
            url.searchParams.set('key', data.insiderKey);
            window.location.href = url.toString();
          } else {
            alert('Key rotation failed: ' + (data.error || 'Unknown error'));
          }
        } catch (err) {
          alert('Key rotation failed: ' + err.message);
        }
      });
    }
    `;
  } else {
    return `
    const shareBtn = document.getElementById('share-btn');
    const countdownEl = document.querySelector('.expiry-countdown');
    
    // Share button: copy current page URL
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(window.location.href);
        shareBtn.textContent = '✓ Copied';
        setTimeout(() => { shareBtn.textContent = '📋 Share'; }, 1500);
      });
    }
    
    // Expiry countdown
    if (countdownEl) {
      const expiry = parseInt(countdownEl.dataset.expiry, 10);
      const update = () => {
        const remaining = expiry - Date.now();
        if (remaining <= 0) {
          countdownEl.textContent = '(expired)';
          countdownEl.classList.add('expired');
          return;
        }
        const mins = Math.floor(remaining / 60000);
        const hours = Math.floor(mins / 60);
        const days = Math.floor(hours / 24);
        let text;
        if (days > 0) text = days + 'd ' + (hours % 24) + 'h';
        else if (hours > 0) text = hours + 'h ' + (mins % 60) + 'm';
        else text = mins + 'm';
        countdownEl.textContent = '(expires in ' + text + ')';
      };
      update();
      setInterval(update, 60000);
    }
    `;
  }
}

// Compute insider key: HMAC-SHA256(apiKey, "insider")
// Works for any path, grants full navigation
function computeInsiderKey(apiKey) {
  const hash = crypto.createHmac('sha256', apiKey).update('insider').digest('hex');
  return hash.substring(0, 32);
}

// Compute outsider key with expiry: HMAC-SHA256(apiKey, path + "|" + expiry)
function computeOutsiderKeyWithExpiry(apiKey, urlPath, expiry) {
  const normalized = urlPath.toLowerCase().replace(/^\/+|\/+$/g, '');
  const data = normalized + '|' + expiry;
  const hash = crypto.createHmac('sha256', apiKey).update(data).digest('hex');
  return hash.substring(0, 32);
}

// Verify key and determine access mode
// Returns: { valid: boolean, mode: 'insider' | 'outsider' | null }
function verifyKey(apiKey, urlPath, providedKey, expParam) {
  if (!providedKey) return { valid: false, mode: null };
  
  // Check insider key first
  const insiderKey = computeInsiderKey(apiKey);
  try {
    if (crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(insiderKey))) {
      return { valid: true, mode: 'insider' };
    }
  } catch {}
  
  // Check outsider key with expiry
  if (expParam) {
    const expiry = parseInt(expParam, 10);
    if (isNaN(expiry) || expiry < Date.now()) {
      return { valid: false, mode: null }; // Expired or invalid
    }
    const expectedKey = computeOutsiderKeyWithExpiry(apiKey, urlPath, expParam);
    try {
      if (crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(expectedKey))) {
        return { valid: true, mode: 'outsider' };
      }
    } catch {}
  }
  
  // Check outsider key without expiry
  const expectedKey = computePathKey(apiKey, urlPath);
  try {
    if (crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(expectedKey))) {
      return { valid: true, mode: 'outsider' };
    }
  } catch {}
  
  return { valid: false, mode: null };
}

// Legacy verify function for backward compatibility
function verifyPathKey(apiKey, urlPath, providedKey) {
  const result = verifyKey(apiKey, urlPath, providedKey, null);
  return result.valid;
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
// Export Handler (PDF/DOCX)
// ─────────────────────────────────────────────────────────────

async function handleExport(req, res, filePath, markdown, fileName, fileDir, format) {
  const baseName = fileName.replace(/\.md$/i, '');
  
  if (format === 'pdf') {
    try {
      // Lazy-load puppeteer
      if (!puppeteer) {
        puppeteer = require('puppeteer-core');
      }
      
      // Build the HTML URL for this page (without export param)
      const pageUrl = `http://localhost:${PORT}${req.path}?key=${req.query.key}&toc=1`;
      
      const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.goto(pageUrl, { waitUntil: 'networkidle0' });
      
      // Hide the header, panzoom overlay, and anchor links for PDF
      // Constrain images to fit within A4 page (210x297mm minus 1cm margins = 190x277mm)
      await page.addStyleTag({ content: `
        .header, .header-actions, .panzoom-container, .panzoom-hint { display: none !important; }
        .toc { position: static !important; height: auto !important; page-break-after: always; }
        .toc-spacer { display: none !important; }
        .layout { display: block !important; }
        body { background: #fff !important; }
        a.anchor { display: none !important; }
        img, svg, .svg-container, .zoomable-svg { 
          max-width: 190mm !important; 
          max-height: 250mm !important; 
          width: auto !important; 
          height: auto !important;
          display: block !important;
          page-break-inside: avoid !important; 
        }
        img { object-fit: contain !important; }
      `});
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
        printBackground: true
      });
      
      await browser.close();
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
      return;
    } catch (err) {
      appendJsonl(EVENTS_LOG, { at: nowIso(), kind: 'pdf_export_error', error: String(err) });
      res.status(500).json({ error: 'PDF export failed', details: String(err) });
      return;
    }
  }
  
  if (format === 'docx') {
    try {
      // Lazy-load puppeteer and html-to-docx
      if (!puppeteer) {
        puppeteer = require('puppeteer-core');
      }
      const HtmlToDocx = require('@turbodocx/html-to-docx');
      
      // Build the HTML URL for this page (without export param, no TOC)
      const pageUrl = `http://localhost:${PORT}${req.path}?key=${req.query.key}&toc=0`;
      
      const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 800 });
      await page.goto(pageUrl, { waitUntil: 'networkidle0' });
      
      // Get SVG bounding boxes for screenshots
      const svgInfos = await page.evaluate(() => {
        const svgContainers = document.querySelectorAll('.svg-container, .zoomable-svg');
        return Array.from(svgContainers).map((container, i) => {
          const svg = container.querySelector('svg');
          if (!svg) return null;
          const rect = svg.getBoundingClientRect();
          return {
            index: i,
            x: Math.floor(rect.x),
            y: Math.floor(rect.y),
            width: Math.ceil(rect.width),
            height: Math.ceil(rect.height)
          };
        }).filter(Boolean);
      });
      
      // Screenshot each SVG as PNG (include dimensions for aspect-ratio-aware sizing)
      const svgPngDataUrls = [];
      for (const info of svgInfos) {
        if (info.width > 0 && info.height > 0) {
          const pngBuffer = await page.screenshot({
            clip: { x: info.x, y: info.y, width: info.width, height: info.height },
            type: 'png'
          });
          svgPngDataUrls.push({
            index: info.index,
            dataUrl: 'data:image/png;base64,' + pngBuffer.toString('base64'),
            width: info.width,
            height: info.height
          });
        }
      }
      
      // Helper function to calculate aspect-ratio-aware dimensions
      // Max bounds: 6 inches wide × 8 inches tall (576px × 768px at 96dpi)
      const MAX_WIDTH_PX = 576;
      const MAX_HEIGHT_PX = 768;
      
      function calcScaledDimensions(origWidth, origHeight) {
        let w = origWidth;
        let h = origHeight;
        
        // Scale down if wider than max
        if (w > MAX_WIDTH_PX) {
          const scale = MAX_WIDTH_PX / w;
          w = MAX_WIDTH_PX;
          h = Math.round(h * scale);
        }
        
        // Scale down if still taller than max
        if (h > MAX_HEIGHT_PX) {
          const scale = MAX_HEIGHT_PX / h;
          h = MAX_HEIGHT_PX;
          w = Math.round(w * scale);
        }
        
        return { width: w, height: h };
      }
      
      // Get the HTML content and replace SVGs with PNG data URLs
      const processedHtml = await page.evaluate((pngUrls, maxW, maxH) => {
        // Helper to calculate scaled dimensions (duplicated for browser context)
        function calcScaled(origW, origH) {
          let w = origW;
          let h = origH;
          if (w > maxW) {
            const scale = maxW / w;
            w = maxW;
            h = Math.round(h * scale);
          }
          if (h > maxH) {
            const scale = maxH / h;
            h = maxH;
            w = Math.round(w * scale);
          }
          return { width: w, height: h };
        }
        
        const content = document.querySelector('.content');
        if (!content) return '<p>No content</p>';
        
        // Clone content to avoid modifying the page
        const contentClone = content.cloneNode(true);
        
        // Remove anchor links (the "#" symbols)
        contentClone.querySelectorAll('a.anchor').forEach(el => el.remove());
        
        // Replace SVG containers with PNG images (with proper dimensions)
        const svgContainers = contentClone.querySelectorAll('.svg-container, .zoomable-svg');
        svgContainers.forEach((container, i) => {
          const pngInfo = pngUrls.find(p => p.index === i);
          if (pngInfo) {
            const img = document.createElement('img');
            img.src = pngInfo.dataUrl;
            img.alt = 'Diagram';
            // Calculate scaled dimensions preserving aspect ratio
            const dims = calcScaled(pngInfo.width, pngInfo.height);
            img.setAttribute('width', dims.width);
            img.setAttribute('height', dims.height);
            container.replaceWith(img);
          } else {
            const placeholder = document.createElement('p');
            placeholder.textContent = '[Diagram]';
            placeholder.style.fontStyle = 'italic';
            container.replaceWith(placeholder);
          }
        });
        
        // Fix image URLs and set explicit dimensions for proper DOCX sizing
        contentClone.querySelectorAll('img').forEach(img => {
          if (img.src && !img.src.startsWith('data:')) {
            img.src = new URL(img.src, window.location.origin).href;
          }
          // Get natural dimensions if available, otherwise use rendered size
          const origW = img.naturalWidth || img.width || 400;
          const origH = img.naturalHeight || img.height || 300;
          const dims = calcScaled(origW, origH);
          img.setAttribute('width', dims.width);
          img.setAttribute('height', dims.height);
          // Remove CSS sizing - use explicit attributes for DOCX
          img.style.maxWidth = '';
          img.style.maxHeight = '';
        });
        
        // Apply inline styles for tables (CSS classes may not work)
        contentClone.querySelectorAll('table').forEach(table => {
          table.setAttribute('border', '1');
          table.style.borderCollapse = 'collapse';
          table.style.width = '100%';
        });
        contentClone.querySelectorAll('th').forEach(th => {
          th.style.backgroundColor = '#f0f0f0';
          th.style.fontWeight = 'bold';
          th.style.padding = '8px';
          th.style.border = '1px solid #999';
        });
        contentClone.querySelectorAll('td').forEach(td => {
          td.style.padding = '8px';
          td.style.border = '1px solid #999';
        });
        
        // Apply inline styles for code blocks and preserve newlines
        contentClone.querySelectorAll('pre').forEach(pre => {
          pre.style.fontFamily = 'Consolas, monospace';
          pre.style.fontSize = '9pt';
          pre.style.backgroundColor = '#f5f5f5';
          pre.style.padding = '12px';
          pre.style.border = '1px solid #ddd';
          // Convert newlines to <br> for DOCX compatibility
          pre.innerHTML = pre.innerHTML.replace(/\n/g, '<br>');
        });
        contentClone.querySelectorAll('code').forEach(code => {
          code.style.fontFamily = 'Consolas, monospace';
        });
        
        return contentClone.innerHTML;
      }, svgPngDataUrls, MAX_WIDTH_PX, MAX_HEIGHT_PX);
      
      await browser.close();
      
      // Build clean HTML document with better styling
      const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.6; }
    h1 { font-size: 20pt; font-weight: bold; color: #1a1a1a; margin-top: 24pt; margin-bottom: 12pt; }
    h2 { font-size: 16pt; font-weight: bold; color: #2a2a2a; margin-top: 18pt; margin-bottom: 10pt; }
    h3 { font-size: 13pt; font-weight: bold; color: #3a3a3a; margin-top: 14pt; margin-bottom: 8pt; }
    h4 { font-size: 11pt; font-weight: bold; color: #4a4a4a; margin-top: 12pt; margin-bottom: 6pt; }
    p { margin: 6pt 0; }
    code { font-family: Consolas, 'Courier New', monospace; font-size: 10pt; background-color: #f4f4f4; padding: 2pt 4pt; }
    pre { font-family: Consolas, 'Courier New', monospace; font-size: 9pt; background-color: #f8f8f8; border: 1pt solid #ddd; padding: 12pt; margin: 12pt 0; white-space: pre-wrap; word-wrap: break-word; }
    pre code { background-color: transparent; padding: 0; }
    table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
    th { background-color: #f0f0f0; font-weight: bold; border: 1pt solid #999; padding: 8pt; text-align: left; }
    td { border: 1pt solid #999; padding: 8pt; text-align: left; }
    tr:nth-child(even) td { background-color: #fafafa; }
    blockquote { border-left: 4pt solid #ddd; margin: 12pt 0; padding: 6pt 12pt; color: #666; }
    ul, ol { margin: 6pt 0; padding-left: 24pt; }
    li { margin: 4pt 0; }
    a { color: #0066cc; }
    img, svg { margin: 12pt 0; display: block; }
  </style>
</head>
<body>
${processedHtml}
</body>
</html>`;
      
      // Convert HTML to DOCX using TurboDocx
      console.log(`[DOCX] Converting ${fileName}, SVGs converted via Puppeteer: ${svgPngDataUrls.length}`);
      const docxBuffer = await HtmlToDocx(fullHtml, null, {
        title: fileName.replace(/\.md$/i, ''),
        creator: 'Jeeves Server',
        table: {
          row: {
            cantSplit: true
          }
        },
        imageProcessing: {
          svgHandling: 'native',  // We've already converted SVGs to PNG
          maxRetries: 2,
          downloadTimeout: 15000
        }
      });
      
      // Handle ArrayBuffer or Buffer response
      const buffer = Buffer.isBuffer(docxBuffer) ? docxBuffer : Buffer.from(docxBuffer);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}.docx"`);
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);
      return;
    } catch (err) {
      appendJsonl(EVENTS_LOG, { at: nowIso(), kind: 'docx_export_error', error: String(err) });
      res.status(500).json({ error: 'DOCX export failed', details: String(err) });
      return;
    }
  }
  
  res.status(400).json({ error: 'Invalid export format' });
}

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

// Favicon (no auth)
app.get('/favicon.svg', (req, res) => {
  res.sendFile(path.join(__dirname, 'favicon.svg'));
});
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'favicon.svg'));
});

// About page (no auth, but insider features if key provided) - renders about.md
app.get('/about', async (req, res) => {
  const aboutPath = path.join(__dirname, 'about.md');
  if (!fs.existsSync(aboutPath)) {
    return res.status(404).send('About page not found');
  }
  
  // Check for insider key
  const queryKey = req.query.key || '';
  const insiderKey = computeInsiderKey(API_KEY);
  const isInsider = queryKey === insiderKey;
  
  const markdown = fs.readFileSync(aboutPath, 'utf8');
  
  // Raw download
  if (req.query.raw === '1') {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="about.md"');
    return res.send(markdown);
  }
  
  // PDF/DOCX export
  if (req.query.export === 'pdf' || req.query.export === 'docx') {
    const format = req.query.export;
    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
      const page = await browser.newPage();
      
      // Render the about page HTML first
      await page.goto(`http://localhost:${PORT}/about`, { waitUntil: 'networkidle0' });
      
      // Remove header for export
      await page.addStyleTag({ content: `
        .header, .header-actions { display: none !important; }
        .toc { position: static !important; height: auto !important; page-break-after: always; }
        .toc-spacer { display: none !important; }
        .layout { display: block !important; }
        body { background: #fff !important; }
        a.anchor { display: none !important; }
      `});
      
      if (format === 'pdf') {
        const pdfBuffer = await page.pdf({
          format: 'A4',
          margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
          printBackground: true
        });
        await browser.close();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="about.pdf"');
        return res.send(pdfBuffer);
      } else {
        const htmlContent = await page.content();
        await browser.close();
        const HTMLtoDOCX = require('html-to-docx');
        const docxBuffer = await HTMLtoDOCX(htmlContent, null, {
          table: { row: { cantSplit: true } },
          footer: true,
          pageNumber: true
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', 'attachment; filename="about.docx"');
        return res.send(Buffer.from(docxBuffer));
      }
    } catch (err) {
      console.error('Export error:', err);
      return res.status(500).send('Export failed: ' + err.message);
    }
  }
  
  // Parse markdown with heading anchors
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
  const htmlContent = marked(markdown);
  
  // Generate TOC
  let tocHtml = '<nav class="toc"><div class="toc-title">Contents</div><ul>';
  for (const h of headings) {
    const indent = (h.level - 1) * 0.8;
    tocHtml += `<li style="margin-left:${indent}em"><a href="#${h.slug}">${h.text}</a></li>`;
  }
  tocHtml += '</ul></nav>';
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>About — Jeeves Server</title>
  <script>${renderThemeScript()}</script>
  <style>
    ${renderThemeStyles()}
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      color: var(--text-primary);
      background: var(--bg-tertiary);
    }
    ${renderHeaderStyles()}
    .layout { display: flex; min-height: calc(100vh - 42px); }
    .toc {
      width: 260px;
      flex-shrink: 0;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      padding: 1.5rem 1rem;
      position: fixed;
      top: 42px;
      left: 0;
      height: calc(100vh - 42px);
      overflow-y: auto;
    }
    .toc-title { font-weight: 600; margin-bottom: 0.8em; padding-top: 1rem; color: var(--text-primary); }
    .toc ul { margin: 0; padding-left: 0; list-style: none; }
    .toc li { margin: 0.4em 0; font-size: 0.9em; }
    .toc a { color: var(--text-secondary); }
    .toc a:hover { color: var(--link-color); }
    .toc-spacer { width: 260px; flex-shrink: 0; }
    .content {
      flex: 1;
      max-width: 900px;
      padding: 2rem 3rem;
    }
    h1, h2, h3, h4, h5, h6 { color: var(--text-primary); margin-top: 1.5em; scroll-margin-top: 80px; }
    h1 { border-bottom: 2px solid var(--border-color); padding-bottom: 0.3em; }
    h2 { border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
    code { background: var(--code-bg); padding: 0.2em 0.4em; border-radius: 3px; font-family: 'SF Mono', Consolas, monospace; font-size: 0.9em; color: var(--text-primary); }
    pre { background: #282c34; color: #abb2bf; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; color: inherit; padding: 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid var(--border-color); padding: 0.6em 1em; text-align: left; }
    th { background: var(--table-header-bg); }
    a { color: var(--link-color); text-decoration: none; }
    a:hover { text-decoration: underline; }
    a.anchor { color: var(--text-muted); margin-right: 0.3em; font-weight: normal; }
    a.anchor:hover { color: var(--link-color); }
    hr { border: none; border-top: 1px solid var(--border-color); margin: 2em 0; }
    @media (max-width: 900px) {
      .toc { display: none; }
      .content { padding: 1.5rem; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="breadcrumb">${isInsider ? '<a href="/path?key=' + insiderKey + '" class="home-icon">🎩</a>' : '<span class="home-icon">🎩</span>'} About</div>
    <div class="header-actions">
      ${isInsider ? `
        <div class="info-btn-group">
          <a href="/about?key=${insiderKey}" class="theme-toggle" title="About Jeeves Server" style="text-decoration:none;font-weight:bold;">?</a>
        </div>
        <div class="key-rotation-group">
          <button id="rotate-key-btn" class="theme-toggle" title="Rotate API Key" data-insider-key="${insiderKey}">🔑</button>
          ${(() => { const ts = getKeyRotationTimestamp(); const age = formatRelativeTime(ts); return age ? '<span class="key-rotation-age">' + age + '</span>' : ''; })()}
        </div>
      ` : ''}
      <a href="/about${isInsider ? '?key=' + insiderKey + '&' : '?'}raw=1" download="about.md" title="Download raw file">⬇ Raw</a>
      <a href="/about${isInsider ? '?key=' + insiderKey + '&' : '?'}export=pdf" title="Export as PDF">📄 PDF</a>
      <a href="/about${isInsider ? '?key=' + insiderKey + '&' : '?'}export=docx" title="Export as Word document">📝 DOCX</a>
      <button id="theme-toggle" class="theme-toggle" onclick="toggleTheme()" title="Toggle dark/light theme">🌙</button>
    </div>
  </div>
  <div class="layout">
    ${tocHtml}
    <div class="toc-spacer"></div>
    <main class="content">
${htmlContent}
    </main>
  </div>
  ${isInsider ? `<script>
    document.getElementById('rotate-key-btn')?.addEventListener('click', async function() {
      if (!confirm('Rotate API key? All existing links will be invalidated.')) return;
      const insiderKey = this.getAttribute('data-insider-key');
      try {
        const res = await fetch('/rotate-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ insiderKey })
        });
        const data = await res.json();
        if (data.ok) {
          window.location.href = '/about?key=' + data.insiderKey;
        } else {
          alert('Rotation failed: ' + (data.error || 'Unknown error'));
        }
      } catch (e) {
        alert('Rotation failed: ' + e.message);
      }
    });
  </script>` : ''}
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
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

// Generate insider key (requires raw API key)
app.get('/insider-key', (req, res) => {
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

  const key = computeInsiderKey(API_KEY);
  res.json({ key });
});

// Rotate API key (requires insider key)
app.post('/rotate-key', (req, res) => {
  const provided = req.query.key;
  const insiderKey = computeInsiderKey(API_KEY);
  
  // Verify insider access
  try {
    if (!provided || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(insiderKey))) {
      return res.status(401).json({ error: 'Insider key required' });
    }
  } catch {
    return res.status(401).json({ error: 'Insider key required' });
  }
  
  // Generate new API key
  const newApiKey = crypto.randomBytes(32).toString('hex');
  
  // Write to .env.local
  const envPath = path.join(__dirname, '.env.local');
  let envContent = '';
  try {
    envContent = fs.readFileSync(envPath, 'utf8');
  } catch {}
  
  // Replace or add API_KEY line
  const lines = envContent.split('\n');
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('API_KEY=')) {
      lines[i] = 'API_KEY=' + newApiKey;
      found = true;
      break;
    }
  }
  if (!found) {
    lines.push('API_KEY=' + newApiKey);
  }
  
  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
  
  // Update in-memory API_KEY so the server uses the new key immediately
  API_KEY = newApiKey;
  
  // Track rotation timestamp
  const rotatedAt = nowIso();
  setKeyRotationTimestamp(rotatedAt);
  appendJsonl(EVENTS_LOG, { at: rotatedAt, kind: 'api_key_rotated' });
  
  // Compute new insider key
  const newInsiderKey = computeInsiderKey(newApiKey);
  
  res.json({ ok: true, insiderKey: newInsiderKey });
});

// Share endpoint: generate outsider link (requires insider key)
app.get('/share', (req, res) => {
  const provided = req.query.key;
  const insiderKey = computeInsiderKey(API_KEY);
  
  // Verify insider access
  try {
    if (!provided || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(insiderKey))) {
      return res.status(401).json({ error: 'Insider key required' });
    }
  } catch {
    return res.status(401).json({ error: 'Insider key required' });
  }
  
  const targetPath = req.query.path;
  if (!targetPath) {
    return res.status(400).json({ error: 'path query param required' });
  }
  
  const expiry = req.query.exp; // Optional expiry timestamp
  let outsiderKey, shareUrl;
  
  if (expiry) {
    outsiderKey = computeOutsiderKeyWithExpiry(API_KEY, targetPath, expiry);
    shareUrl = `/path${targetPath}?key=${outsiderKey}&exp=${expiry}`;
  } else {
    outsiderKey = computePathKey(API_KEY, targetPath);
    shareUrl = `/path${targetPath}?key=${outsiderKey}`;
  }
  
  res.json({ path: targetPath, key: outsiderKey, exp: expiry || null, url: shareUrl });
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
  const expParam = req.query.exp;
  
  const authResult = verifyKey(API_KEY, urlPath, provided, expParam);
  
  if (!authResult.valid) {
    appendJsonl(EVENTS_LOG, { at: nowIso(), kind: 'auth_failed_path', ip: req.ip, path: urlPath });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Store access mode on request for use in rendering
  req.accessMode = authResult.mode; // 'insider' or 'outsider'
  next();
});

// Root path: list all drives
app.get('/path', (req, res) => {
  const { execSync } = require('child_process');
  let drives = [];
  try {
    // Get drives with volume names on Windows
    const output = execSync('wmic logicaldisk get name,volumename', { encoding: 'utf8' });
    const lines = output.split('\n').map(line => line.trim()).filter(line => line);
    // Skip header line, parse "C:  VolumeName" format
    for (const line of lines.slice(1)) {
      const match = line.match(/^([A-Z]:)\s*(.*)?$/);
      if (match) {
        drives.push({ letter: match[1].replace(':', ''), label: (match[2] || '').trim() });
      }
    }
  } catch {
    drives = [{ letter: 'C', label: '' }, { letter: 'D', label: '' }, { letter: 'E', label: '' }]; // Fallback
  }
  
  const isInsider = req.accessMode === 'insider';
  const insiderKey = computeInsiderKey(API_KEY);
  const linkKey = isInsider ? insiderKey : null;
  
  let rows = '';
  for (const drive of drives) {
    const drivePath = drive.letter + ':\\';
    const urlPath = '/' + drive.letter.toLowerCase();
    const key = linkKey || computePathKey(API_KEY, urlPath);
    const labelText = drive.label ? ' (' + drive.label + ')' : '';
    rows += '<tr><td>💾 <a href="/path' + urlPath + '?key=' + key + '">' + drivePath + '</a>' + labelText + '</td><td>Drive</td></tr>';
  }
  
  const headerHtml = renderHeader({
    isInsider: true,
    breadcrumbs: '<span class="home-icon">🎩</span>',
    fileName: null,
    queryKey: req.query.key,
    currentPath: '/',
    insiderKey,
    showRaw: false,
    actions: []
  });
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>Drives</title>
  <script>${renderThemeScript()}</script>
  <style>
    ${renderThemeStyles()}
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: var(--bg-tertiary); color: var(--text-primary); }
    ${renderHeaderStyles()}
    .container { padding: 1.5rem 2rem; }
    table { width: 100%; border-collapse: collapse; background: var(--bg-primary); border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color); }
    th { background: var(--table-header-bg); font-weight: 600; font-size: 13px; color: var(--text-secondary); }
    td { font-size: 14px; }
    tr:hover { background: var(--table-row-hover); }
    a { color: var(--link-color); text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  ${headerHtml}
  <div class="container">
    <table>
      <thead><tr><th>Drive</th><th>Type</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <script>
    ${renderShareScript(true)}
  </script>
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
  // Also handle bare drive letter: c -> C:\
  let filePath = reqPath;
  if (/^[a-zA-Z]$/.test(filePath)) {
    // Bare drive letter
    filePath = filePath.toUpperCase() + ':\\';
  } else if (/^[a-zA-Z]\//.test(filePath)) {
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
    // Dangerous executables - browsers might try to run these, so don't link them
    const dangerousExts = ['.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.vbe', '.jse', '.ws', '.wsf', '.wsc', '.wsh', '.ps1', '.reg', '.inf', '.hta', '.dll', '.so', '.dylib'];
    // All other files (images, documents, archives, etc.) are linked - browser will download or display as appropriate
    
    // Build breadcrumb trail (hidden for outsiders)
    const breadcrumbs = buildBreadcrumbs(resolved, API_KEY, req.accessMode);
    const isInsider = req.accessMode === 'insider';
    const insiderKey = computeInsiderKey(API_KEY);
    
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
      // Insiders get insider key for all links, outsiders get path-specific keys
      const entryKey = isInsider ? insiderKey : computePathKey(API_KEY, entryUrlPath);
      
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
      // Only dangerous executables aren't linked; all other files are clickable (browser downloads or displays)
      const ext = path.extname(entry.name).toLowerCase();
      const isDangerous = dangerousExts.includes(ext);
      const nameCell = (isDangerous && !entry.isDirectory())
        ? entry.name + ' <span title="Executable file - not linked for security">⚠️</span>'
        : '<a href="/path' + entryUrlPath + '?key=' + entryKey + '">' + entry.name + '</a>';
      
      const icon = entry.isDirectory() ? '📁' : '📄';
      rows += '<tr><td>' + icon + ' ' + nameCell + '</td><td>' + type + '</td><td>' + size + '</td><td>' + mtime + '</td></tr>';
    }
    
    const dirName = path.basename(resolved) || resolved;
    const currentPath = '/' + reqPath;
    const expiry = req.query.exp ? parseInt(req.query.exp, 10) : null;
    
    const headerHtml = renderHeader({
      isInsider,
      breadcrumbs,
      fileName: null,
      queryKey: req.query.key,
      currentPath,
      insiderKey,
      expiry,
      showRaw: false,
      actions: []
    });
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>${dirName}</title>
  <script>${renderThemeScript()}</script>
  <style>
    ${renderThemeStyles()}
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: var(--bg-tertiary); color: var(--text-primary); }
    ${renderHeaderStyles()}
    .container { padding: 1.5rem 2rem; }
    table { width: 100%; border-collapse: collapse; background: var(--bg-primary); border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color); }
    th { background: var(--table-header-bg); font-weight: 600; font-size: 13px; color: var(--text-secondary); }
    td { font-size: 14px; }
    tr:hover { background: var(--table-row-hover); }
    a { color: var(--link-color); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .count { color: var(--text-secondary); font-size: 13px; margin-bottom: 1rem; }
  </style>
</head>
<body>
  ${headerHtml}
  <div class="container">
    <div class="count">${entries.length} items</div>
    <table>
      <thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Modified</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <script>
    ${renderShareScript(isInsider)}
  </script>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentTypes = {
    // Text files
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.yaml': 'text/yaml; charset=utf-8',
    '.yml': 'text/yaml; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',  // text/javascript for display, not execution
    '.ts': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.jsonl': 'text/plain; charset=utf-8',
    '.log': 'text/plain; charset=utf-8',
    '.mmd': 'text/plain; charset=utf-8',
    // Images - browser displays inline
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
    // Documents - browser may display or download
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Archives - browser downloads
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.7z': 'application/x-7z-compressed',
    '.rar': 'application/vnd.rar',
    // Audio/Video - browser may play inline
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    // Fonts
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
  };
  
  try {
    if (ext === '.md') {
      let markdown = fs.readFileSync(resolved, 'utf8');
      const fileName = path.basename(resolved);
      const fileDir = path.dirname(resolved);
      
      // ─────────────────────────────────────────────────────────
      // EXPORT: Handle PDF/DOCX export requests
      // ─────────────────────────────────────────────────────────
      if (req.query.export === 'pdf' || req.query.export === 'docx') {
        return handleExport(req, res, resolved, markdown, fileName, fileDir, req.query.export);
      }
      
      // ─────────────────────────────────────────────────────────
      // PRE-PROCESS: Convert Windows paths to markdown links
      // (only outside of code blocks and inline code)
      // ─────────────────────────────────────────────────────────
      const winPathRegex = /([A-Z]):\\(?:[^\s"'`<>\\]+\\)*[^\s"'`<>\\]+/g;
      
      // Dangerous executables that shouldn't be linked (security risk)
      const dangerousExts = ['.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.vbe', '.jse', '.ws', '.wsf', '.wsc', '.wsh', '.ps1', '.reg', '.inf', '.hta', '.dll', '.so', '.dylib'];
      
      // Resolve a Windows path: check existence, skip dangerous executables
      const resolvePathForLink = (winPath) => {
        // Skip templated paths
        if (winPath.includes('{') || winPath.includes('}')) return null;
        
        if (!fs.existsSync(winPath)) return null;
        
        const stats = fs.statSync(winPath);
        if (stats.isFile()) {
          // Skip dangerous executables
          const ext = path.extname(winPath).toLowerCase();
          if (dangerousExts.includes(ext)) return null;
        }
        // Directories and all other files are linkable
        return winPath;
      };
      
      const linkifyPathMd = (winPath) => {
        const resolved = resolvePathForLink(winPath);
        if (!resolved) return winPath; // Return original text, no link
        
        const urlPath = '/' + resolved.replace(/\\/g, '/').replace(/^([A-Z]):/, (m, d) => d.toLowerCase());
        // Don't add key here - post-processing will add appropriate key based on access mode
        return `[${winPath}](/path${urlPath})`;
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
      // For insiders: all links use insider key
      // For outsiders: src (images) get path-specific keys, href (navigation) get no key
      // ─────────────────────────────────────────────────────────
      const isInsiderMode = req.accessMode === 'insider';
      const linkInsiderKey = computeInsiderKey(API_KEY);
      
      htmlContent = htmlContent.replace(
        /(href|src)="([^"]+)"/g,
        (match, attr, url) => {
          // Skip external URLs and anchors
          if (url.startsWith('http://') || url.startsWith('https://') || 
              url.startsWith('#') || url.startsWith('//')) {
            return match;
          }
          
          let urlPath;
          
          // Handle URLs that already start with /path/ (from linkifyPathMd)
          if (url.startsWith('/path/')) {
            // Strip any existing query params and use the path as-is
            urlPath = url.split('?')[0];
          } else {
            // Convert relative/absolute paths to /path/ URLs
            let targetPath;
            if (url.startsWith('/')) {
              targetPath = 'D:' + url;
            } else {
              targetPath = path.resolve(fileDir, url);
            }
            urlPath = '/path/' + targetPath.replace(/\\/g, '/').replace(/^([A-Z]):/, (m, d) => d.toLowerCase());
          }
          
          if (isInsiderMode) {
            // Insiders get insider key for all links
            return `${attr}="${urlPath}?key=${linkInsiderKey}"`;
          } else {
            // Outsiders: embedded resources (src) get path-specific keys
            if (attr === 'src') {
              const key = computePathKey(API_KEY, urlPath.replace('/path', ''));
              return `${attr}="${urlPath}?key=${key}"`;
            } else {
              // href for outsiders: strip the link entirely (handled in second pass)
              return `${attr}="__STRIP_LINK__"`;
            }
          }
        }
      );
      
      // Second pass: strip internal links marked for removal (outsider mode)
      if (!isInsiderMode) {
        htmlContent = htmlContent.replace(
          /<a\s+href="__STRIP_LINK__"[^>]*>([^<]*)<\/a>/g,
          '$1'  // Just the link text, no anchor tag
        );
      }
      
      // ─────────────────────────────────────────────────────────
      // POST-PROCESS: Inline SVG images for vector zoom
      // ─────────────────────────────────────────────────────────
      htmlContent = htmlContent.replace(
        /<img[^>]*?src="([^"]+\.svg)(\?[^"]*)?"[^>]*>/gi,
        (match, svgUrl, query) => {
          try {
            // Extract the file path from the URL
            let svgPath;
            if (svgUrl.startsWith('/path/')) {
              // Convert /path/d/foo/bar.svg to D:\foo\bar.svg
              const urlPath = svgUrl.replace('/path/', '');
              svgPath = urlPath.replace(/^([a-z])\//, (m, d) => d.toUpperCase() + ':\\').replace(/\//g, '\\');
            } else {
              svgPath = path.resolve(fileDir, svgUrl);
            }
            
            if (!fs.existsSync(svgPath)) {
              return match; // Keep original if file not found
            }
            
            let svgContent = fs.readFileSync(svgPath, 'utf8');
            
            // Remove XML declaration if present
            svgContent = svgContent.replace(/<\?xml[^?]*\?>\s*/gi, '');
            
            // Add class for styling and ensure viewBox exists for proper scaling
            svgContent = svgContent.replace(/<svg/, '<svg class="inline-svg"');
            
            // Wrap in a zoomable container
            return `<div class="svg-container zoomable-svg" data-src="${svgUrl}">${svgContent}</div>`;
          } catch (err) {
            return match; // Keep original on error
          }
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
        
        if (isInsiderMode) {
          // Insiders get insider key
          return `<a href="/path${urlPath}?key=${linkInsiderKey}">${winPath}</a>`;
        } else {
          // Outsiders: no link, just plain text
          return winPath;
        }
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
      const isInsider = req.accessMode === 'insider';
      const breadcrumbs = buildBreadcrumbs(resolved, API_KEY, req.accessMode);
      const insiderKey = computeInsiderKey(API_KEY);
      const currentPath = '/' + reqPath; // Use reqPath (params[0]) not req.path to avoid /path prefix duplication
      const expiry = req.query.exp ? parseInt(req.query.exp, 10) : null;
      const headerHtml = renderHeader({
        isInsider,
        breadcrumbs,
        fileName,
        queryKey: req.query.key,
        currentPath,
        insiderKey,
        expiry,
        actions: [
          `<a href="?key=${req.query.key}&amp;export=pdf" title="Export as PDF">📄 PDF</a>`,
          `<a href="?key=${req.query.key}&amp;export=docx" title="Export as Word document">📝 DOCX</a>`
        ]
      });
      
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>${fileName}</title>
  <script>${renderThemeScript()}</script>
  <style>
    ${renderThemeStyles()}
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      color: var(--text-primary);
      background: var(--bg-tertiary);
    }
    ${renderHeaderStyles()}
    .layout { display: flex; min-height: calc(100vh - 42px); }
    .toc {
      width: 260px;
      flex-shrink: 0;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      padding: 1.5rem 1rem;
      position: fixed;
      top: 42px;
      left: 0;
      height: calc(100vh - 42px);
      overflow-y: auto;
    }
    .toc-title { font-weight: 600; margin-bottom: 0.8em; padding-top: 1rem; color: var(--text-primary); }
    .toc ul { margin: 0; padding-left: 0; list-style: none; }
    .toc li { margin: 0.4em 0; font-size: 0.9em; }
    .toc a { color: var(--text-secondary); }
    .toc a:hover { color: var(--link-color); }
    .toc-spacer { width: 260px; flex-shrink: 0; }
    .content {
      flex: 1;
      max-width: 900px;
      padding: 2rem 3rem;
    }
    .no-toc .content { margin: 0 auto; }
    h1, h2, h3, h4, h5, h6 { color: var(--text-primary); margin-top: 1.5em; scroll-margin-top: 80px; }
    h1 { border-bottom: 2px solid var(--border-color); padding-bottom: 0.3em; }
    h2 { border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
    code { background: var(--code-bg); padding: 0.2em 0.4em; border-radius: 3px; font-family: 'SF Mono', Consolas, monospace; font-size: 0.9em; color: var(--text-primary); }
    pre { background: #282c34; color: #abb2bf; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    pre code { background: none; color: inherit; padding: 0; }
    blockquote { border-left: 4px solid var(--border-color); margin: 1em 0; padding: 0.5em 1em; color: var(--text-muted); background: var(--bg-secondary); }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid var(--border-color); padding: 0.6em 1em; text-align: left; }
    th { background: var(--table-header-bg); }
    a { color: var(--link-color); text-decoration: none; }
    a:hover { text-decoration: underline; }
    a.anchor { color: var(--text-muted); margin-right: 0.3em; font-weight: normal; }
    a.anchor:hover { color: var(--link-color); }
    code a { color: inherit; text-decoration: underline; text-decoration-style: dotted; }
    code a:hover { text-decoration-style: solid; }
    hr { border: none; border-top: 1px solid var(--border-color); margin: 2em 0; }
    img { max-width: 100%; height: auto; }
    img.zoomable { cursor: zoom-in; }
    .svg-container { max-width: 100%; overflow: hidden; }
    .svg-container svg.inline-svg { max-width: 100%; height: auto; display: block; }
    .zoomable-svg { cursor: zoom-in; }
    .panzoom-container { 
      position: fixed; 
      top: 0; left: 0; right: 0; bottom: 0; 
      background: rgba(0,0,0,0.9); 
      z-index: 1000; 
      display: none;
      cursor: grab;
    }
    .panzoom-container.active { display: flex; align-items: center; justify-content: center; }
    .panzoom-container:active { cursor: grabbing; }
    .panzoom-container img { max-width: none; max-height: none; }
    .panzoom-svg-holder { display: none; align-items: center; justify-content: center; width: 100%; height: 100%; overflow: hidden; }
    .panzoom-svg-holder .pz-svg-inner { display: block; background: #fff; }
    .panzoom-svg-holder svg { display: block; background: #fff; }
    .panzoom-close { 
      position: fixed; 
      top: 20px; right: 20px; 
      color: #fff; 
      font-size: 32px; 
      cursor: pointer; 
      z-index: 1001;
      background: rgba(0,0,0,0.5);
      width: 44px; height: 44px;
      border-radius: 22px;
      display: flex; align-items: center; justify-content: center;
    }
    .panzoom-close:hover { background: rgba(255,255,255,0.2); }
    .panzoom-hint {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      color: #aaa;
      font-size: 13px;
      z-index: 1001;
    }
    ul, ol { padding-left: 2em; }
    li { margin: 0.25em 0; }
    @media (max-width: 900px) {
      .toc { display: none; }
      .content { padding: 1.5rem; }
    }
  </style>
</head>
<body>
  ${headerHtml}
  <div class="layout${hasToc ? '' : ' no-toc'}">
    ${tocHtml}
    ${hasToc ? '<div class="toc-spacer"></div>' : ''}
    <main class="content">
${htmlContent}
    </main>
  </div>
  <div class="panzoom-container" id="panzoom-overlay">
    <span class="panzoom-close" id="panzoom-close">×</span>
    <img id="panzoom-img" src="" alt="">
    <div id="panzoom-svg" class="panzoom-svg-holder"></div>
    <div class="panzoom-hint">Scroll to zoom • Drag to pan • Click or Esc to close</div>
  </div>
  <script src="https://unpkg.com/@panzoom/panzoom@4.5.1/dist/panzoom.min.js"></script>
  <script>
    // Mark raster images as zoomable if rendered smaller than actual size
    document.querySelectorAll('.content img').forEach(img => {
      const check = () => {
        if (img.naturalWidth > img.clientWidth || img.naturalHeight > img.clientHeight) {
          img.classList.add('zoomable');
          img.title = 'Click to zoom';
        }
      };
      if (img.complete) check();
      else img.onload = check;
    });

    // Mark inline SVGs as zoomable (they're always vector, so always benefit from zoom)
    document.querySelectorAll('.zoomable-svg').forEach(container => {
      container.title = 'Click to zoom (vector)';
    });

    // Panzoom overlay
    const overlay = document.getElementById('panzoom-overlay');
    const pzImg = document.getElementById('panzoom-img');
    const pzSvgContainer = document.getElementById('panzoom-svg');
    const closeBtn = document.getElementById('panzoom-close');
    let pz = null;

    document.addEventListener('click', e => {
      // Handle raster images
      if (e.target.classList.contains('zoomable')) {
        pzImg.src = e.target.src;
        pzImg.style.display = 'block';
        pzSvgContainer.style.display = 'none';
        overlay.classList.add('active');
        pz = Panzoom(pzImg, { maxScale: 10, contain: 'outside' });
        pzImg.parentElement.addEventListener('wheel', pz.zoomWithWheel);
        return;
      }
      
      // Handle inline SVGs (click on container or any child)
      const svgContainer = e.target.closest('.zoomable-svg');
      if (svgContainer) {
        const svg = svgContainer.querySelector('svg');
        if (svg) {
          // Wrap SVG so Panzoom transforms a div (avoids SVG sizing quirks + stray centering)
          pzSvgContainer.innerHTML = '<div class="pz-svg-inner">' + svg.outerHTML + '</div>';
          pzSvgContainer.style.display = 'flex';
          pzImg.style.display = 'none';
          overlay.classList.add('active');
          const inner = pzSvgContainer.querySelector('.pz-svg-inner');
          const clonedSvg = inner.querySelector('svg');
          // Strip all inline styles and size attributes
          clonedSvg.removeAttribute('style');
          clonedSvg.removeAttribute('width');
          clonedSvg.removeAttribute('height');
          // Calculate size to fit viewport while maintaining aspect ratio
          const vb = clonedSvg.getAttribute('viewBox');
          const maxW = window.innerWidth * 0.9;
          const maxH = window.innerHeight * 0.85;
          if (vb) {
            const parts = vb.split(/[\\s,]+/).map(Number);
            const svgW = parts[2], svgH = parts[3];
            const scale = Math.min(maxW / svgW, maxH / svgH);
            inner.style.width = (svgW * scale) + 'px';
            inner.style.height = (svgH * scale) + 'px';
            clonedSvg.style.width = '100%';
            clonedSvg.style.height = '100%';
          } else {
            inner.style.maxWidth = maxW + 'px';
            inner.style.maxHeight = maxH + 'px';
          }
          pz = Panzoom(inner, { maxScale: 20, overflow: 'visible' });
          pz.reset({ animate: false });
          // Attach wheel to inner element so focal point calculation matches panzoom target
          inner.addEventListener('wheel', pz.zoomWithWheel);
        }
      }
    });

    function closePanzoom() {
      overlay.classList.remove('active');
      if (pz) { pz.destroy(); pz = null; }
      pzImg.src = '';
      pzImg.style.display = 'block';
      pzSvgContainer.innerHTML = '';
      pzSvgContainer.style.display = 'none';
    }

    closeBtn.addEventListener('click', closePanzoom);
    overlay.addEventListener('click', e => { if (e.target === overlay || e.target === pzSvgContainer) closePanzoom(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('active')) closePanzoom(); });

    // Share functionality
    ${renderShareScript(isInsider)}
  </script>
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
      return;
    }
    
    // Detect if file is text by checking for binary content (null bytes)
    // This is more flexible than whitelisting extensions
    function looksLikeText(buffer) {
      // Check first 8KB for null bytes - a simple but effective binary detection
      const checkSize = Math.min(buffer.length, 8192);
      for (let i = 0; i < checkSize; i++) {
        if (buffer[i] === 0) return false;
      }
      return true;
    }
    
    const content = fs.readFileSync(resolved);
    
    // Special case: SVG files get their own HTML wrapper viewer
    if (ext === '.svg' && req.query.raw !== '1') {
      // Remove width="100%" from SVG to prevent aspect ratio issues with tall diagrams
      let svgContent = content.toString('utf8')
        .replace(/<svg([^>]*)\s+width="100%"/, '<svg$1')
        .replace(/<svg([^>]*)\s+style="[^"]*max-width:\s*[\d.]+px;?[^"]*"/, '<svg$1');
      const fileName = path.basename(resolved);
      const breadcrumbs = buildBreadcrumbs(resolved, API_KEY);
      
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>${fileName}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #1e1e1e; color: #ccc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .header {
      background: #161b22;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #30363d;
      font-size: 13px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .header a { color: #58a6ff; text-decoration: none; }
    .header a:hover { text-decoration: underline; }
    .header .actions { font-size: 12px; color: #8b949e; }
    .svg-wrapper {
      padding: 1rem;
      overflow: auto;
      text-align: center;
    }
    .svg-wrapper svg {
      max-width: 100% !important;
      max-height: calc(100vh - 80px);
      width: auto !important;
      height: auto !important;
      background: #fff;
      border-radius: 4px;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="breadcrumb">${breadcrumbs}</div>
    <div class="actions"><a href="?key=${req.query.key}&amp;raw=1">View Raw</a></div>
  </div>
  <div class="svg-wrapper">
    ${svgContent}
  </div>
</body>
</html>`;
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }
    
    const isTextFile = looksLikeText(content);
    
    if (req.query.raw === '1' || !isTextFile) {
      // Raw mode or binary file - serve with appropriate content-type
      const contentType = contentTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      
      // For types browsers don't display inline, suggest download
      const inlineTypes = ['image/', 'video/', 'audio/', 'text/', 'application/pdf', 'application/json', 'application/xml'];
      const isInlineType = inlineTypes.some(t => contentType.startsWith(t));
      if (!isInlineType) {
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(resolved)}"`);
      }
      
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
      
      const breadcrumbs = buildBreadcrumbs(resolved, API_KEY, req.accessMode);
      const isInsider = req.accessMode === 'insider';
      const insiderKey = computeInsiderKey(API_KEY);
      const currentPath = '/' + reqPath;
      const expiry = req.query.exp ? parseInt(req.query.exp, 10) : null;
      
      const headerHtml = renderHeader({
        isInsider,
        breadcrumbs,
        fileName,
        queryKey: req.query.key,
        currentPath,
        insiderKey,
        expiry,
        actions: []  // Just the default Raw download
      });
      
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>${fileName}</title>
  <script>${renderThemeScript()}</script>
  <link id="hljs-theme" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <style>
    ${renderThemeStyles()}
    body {
      font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 13px;
      line-height: 1.5;
      margin: 0;
      padding: 0;
      background: var(--bg-primary);
      color: var(--text-primary);
    }
    pre { margin: 0; padding: 1rem; overflow-x: auto; background: var(--code-bg); }
    code { font-family: inherit; }
    ${renderHeaderStyles()}
  </style>
</head>
<body>
  ${headerHtml}
  <pre><code class="hljs${lang ? ' language-' + lang : ''}">${highlighted}</code></pre>
  <script>
    ${renderShareScript(isInsider)}
    // Swap highlight.js theme based on current theme
    function updateHljsTheme() {
      const theme = document.documentElement.getAttribute('data-theme');
      const link = document.getElementById('hljs-theme');
      link.href = theme === 'dark' 
        ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
        : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
    }
    updateHljsTheme();
    const origToggle = window.toggleTheme;
    window.toggleTheme = function() { origToggle(); updateHljsTheme(); };
  </script>
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

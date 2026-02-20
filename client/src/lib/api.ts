/**
 * API client for Jeeves Server backend
 *
 * Auth: session cookies (Google OAuth) or key-based (?key= URL param).
 * When a key is present in the URL, it's stored and passed to all API calls.
 */

const API_BASE = '/api';

/** Extract and cache auth params from URL (once) */
const _urlParams = new URLSearchParams(window.location.search);
const _urlKey = _urlParams.get('key');

/** Auth-related params to forward on every API call (key + deep share params) */
const _authSuffix = (() => {
  if (!_urlKey) return '';
  const params = new URLSearchParams();
  params.set('key', _urlKey);
  // Forward deep share params so the server can verify the key
  for (const p of ['d', 'dirs', 's', 'exp'] as const) {
    const v = _urlParams.get(p);
    if (v !== null) params.set(p, v);
  }
  return params.toString();
})();

/** Append auth params to a URL if a key was provided */
export function withKey(url: string): string {
  if (!_authSuffix) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${_authSuffix}`;
}

export interface DirectoryEntry {
  name: string;
  type: 'directory' | 'file';
  ext: string;
  size: number | null;
  mtime: string | null;
}

export interface DirectoryListing {
  path: string;
  entries: DirectoryEntry[];
  breadcrumbs: BreadcrumbItem[];
  isInsider: boolean;
}

export interface BreadcrumbItem {
  label: string;
  path: string;
}

export interface DriveEntry {
  letter: string;
  label: string;
}

export interface FileContent {
  type: 'markdown' | 'text' | 'svg' | 'mermaid' | 'image' | 'binary';
  content?: string;
  html?: string;
  headings?: { level: number; text: string; slug: string }[];
  language?: string | null;
  contentType?: string;
  fileName: string;
  breadcrumbs: BreadcrumbItem[];
  isInsider: boolean;
}

export interface ShareResponse {
  path: string;
  url: string;
  exp: string | null;
  depth: number;
  dirs: boolean;
}

export interface ShareSettings {
  expiry: string;
  depth: number;
  dirs: boolean;
}

export interface AuthStatus {
  authenticated: boolean;
  email?: string;
  picture?: string;
  isInsider: boolean;
  keyCreatedAt?: string | null;
}

/** Rotate insider key — invalidates all existing shares */
export async function rotateKey(): Promise<{ ok: boolean; keyCreatedAt?: string }> {
  return fetchJson('/api/rotate-key', { method: 'POST' });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(withKey(url), {
    ...init,
    credentials: 'same-origin',
  });

  if (res.status === 401) {
    window.location.href = `/auth/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${String(res.status)}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export async function getDrives(): Promise<DriveEntry[]> {
  return fetchJson<DriveEntry[]>(`${API_BASE}/drives`);
}

export async function getDirectory(path: string): Promise<DirectoryListing> {
  return fetchJson<DirectoryListing>(`${API_BASE}/path/${path}`);
}

export async function getFile(path: string): Promise<FileContent> {
  return fetchJson<FileContent>(`${API_BASE}/file/${path}`);
}

export async function getFileRaw(path: string): Promise<FileContent> {
  return fetchJson<FileContent>(`${API_BASE}/file/${path}?raw=1`);
}

export async function getAuthStatus(browsePath?: string): Promise<AuthStatus> {
  let url = `${API_BASE}/auth/status`;
  if (browsePath) {
    url += `?path=${encodeURIComponent(browsePath)}`;
  }
  const res = await fetch(withKey(url), { credentials: 'same-origin' });
  if (!res.ok) {
    return { authenticated: false, isInsider: false };
  }
  return res.json() as Promise<AuthStatus>;
}

/** Generate an outsider share link — computed server-side, no keys on client */
export async function getShareLink(
  targetPath: string,
  expiry?: string,
  depth?: number,
  dirs?: boolean,
): Promise<ShareResponse> {
  return fetchJson<ShareResponse>(`${API_BASE}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: targetPath, expiry, depth, dirs }),
  });
}

export function getRawFileUrl(path: string): string {
  return `/api/raw/${path}`;
}

export interface Capabilities {
  localMode: boolean;
  mermaid: boolean;
  plantuml: boolean;
}

let _capabilitiesCache: Capabilities | null = null;

export async function getCapabilities(): Promise<Capabilities> {
  if (_capabilitiesCache) return _capabilitiesCache;
  try {
    const res = await fetch('/api/capabilities');
    if (res.ok) {
      _capabilitiesCache = await res.json() as Capabilities;
      return _capabilitiesCache;
    }
  } catch { /* ignore */ }
  return { localMode: false, mermaid: false, plantuml: false };
}

export async function openLocally(path: string): Promise<void> {
  const result = await fetchJson<{ ok: boolean; fileUrl: string }>(`${API_BASE}/open/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (result.fileUrl) {
    window.open(result.fileUrl, '_blank');
  }
}

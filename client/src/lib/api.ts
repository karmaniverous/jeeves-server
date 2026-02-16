/**
 * API client for Jeeves Server backend
 *
 * All auth is via session cookies — no keys or credentials on the client side.
 */

const API_BASE = '/api';

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
  const res = await fetch(url, {
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

export async function getAuthStatus(): Promise<AuthStatus> {
  const res = await fetch(`${API_BASE}/auth/status`, { credentials: 'same-origin' });
  if (!res.ok) {
    return { authenticated: false, isInsider: false };
  }
  return res.json() as Promise<AuthStatus>;
}

/** Generate an outsider share link — computed server-side, no keys on client */
export async function getShareLink(
  targetPath: string,
  expiry?: string,
): Promise<ShareResponse> {
  return fetchJson<ShareResponse>(`${API_BASE}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: targetPath, expiry }),
  });
}

export function getRawFileUrl(path: string): string {
  return `/path/${path}?raw=1`;
}

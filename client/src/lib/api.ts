/**
 * API client for Jeeves Server backend
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
  type: 'markdown' | 'text' | 'svg' | 'image' | 'binary';
  content?: string;
  html?: string;
  headings?: { level: number; text: string; slug: string }[];
  contentType?: string;
  fileName: string;
  breadcrumbs: BreadcrumbItem[];
  isInsider: boolean;
}

export interface ShareResponse {
  path: string;
  key: string;
  exp: string | null;
  url: string;
}

export interface AuthStatus {
  authenticated: boolean;
  email?: string;
  isInsider: boolean;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: 'same-origin',
  });

  if (res.status === 401) {
    // Redirect to login
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

export async function getAuthStatus(): Promise<AuthStatus> {
  return fetchJson<AuthStatus>(`${API_BASE}/auth/status`);
}

export async function getShareLink(
  insiderKey: string,
  path: string,
  expiry?: string,
): Promise<ShareResponse> {
  const params = new URLSearchParams({ path, key: insiderKey });
  if (expiry) params.set('exp', expiry);
  return fetchJson<ShareResponse>(`/share?${params.toString()}`);
}

export async function rotateKey(): Promise<{ ok: boolean; insiderKey?: string }> {
  return fetchJson(`/rotate-key`, { method: 'POST' });
}

export function getRawFileUrl(path: string, key?: string): string {
  const params = key ? `?key=${key}&raw=1` : '?raw=1';
  return `/path/${path}${params}`;
}

/**
 * Data fetching and state management for the file browser.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import type { BreadcrumbItem, DirectoryListing, DriveEntry, FileContent, ShareSettings } from '@/lib/api';
import { getDrives, getDirectory, getFile, getFileRaw, saveFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';

function formatRelativeTime(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${String(mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `${String(days)}d ago`;
}

function loadShareSettings(): ShareSettings {
  const saved = localStorage.getItem('jeeves-share-settings');
  if (saved) try { return JSON.parse(saved) as ShareSettings; } catch { /* ignore */ }
  return { expiry: localStorage.getItem('jeeves-share-expiry') ?? '', depth: 0, dirs: false };
}

export function useFileBrowser() {
  const params = useParams<{ '*': string }>();
  const reqPath = params['*'] ?? '';
  const [theme, toggleTheme] = useTheme();

  // Browser tab title
  useEffect(() => {
    const siteTitle = 'Jeeves Server';
    const segments = reqPath.split('/').filter(Boolean);
    const last = segments.length ? segments[segments.length - 1] : '';
    const decoded = last ? decodeURIComponent(last) : '';
    document.title = decoded ? `${decoded} - ${siteTitle}` : siteTitle;
  }, [reqPath]);

  const [shareSettings, setShareSettings] = useState<ShareSettings>(loadShareSettings);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [proseWidth, setProseWidth] = useState<'narrow' | 'medium' | 'wide'>(
    () => (localStorage.getItem('jeeves-prose-width') as 'narrow' | 'medium' | 'wide') ?? 'medium',
  );
  const toggleProseWidth = (w: 'narrow' | 'medium' | 'wide') => {
    setProseWidth(w);
    localStorage.setItem('jeeves-prose-width', w);
  };

  const [drives, setDrives] = useState<DriveEntry[] | null>(null);
  const [directory, setDirectory] = useState<DirectoryListing | null>(null);
  const [fileRaw, setFileRaw] = useState<FileContent | null>(null);
  const [fileRendered, setFileRendered] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'raw' ? 'raw' : 'rendered';
  const [viewTab, setViewTabState] = useState<'rendered' | 'raw'>(initialTab);
  const setViewTab = (tab: 'rendered' | 'raw') => {
    setViewTabState(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'rendered') next.delete('tab');
      else next.set('tab', tab);
      return next;
    }, { replace: true });
  };

  const file = fileRendered ?? fileRaw;

  // Data fetching
  useEffect(() => {
    setLoading(true);
    setError(null);
    setDrives(null);
    setDirectory(null);
    setFileRaw(null);
    setFileRendered(null);
    setEditing(false);
    setViewTabState(searchParams.get('tab') === 'raw' ? 'raw' : 'rendered');

    if (!reqPath) {
      getDrives()
        .then(setDrives)
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      getDirectory(reqPath)
        .then((data) => {
          if ('entries' in data) {
            setDirectory(data);
            setLoading(false);
          } else {
            getFileRaw(reqPath).then((raw) => { setFileRaw(raw); setLoading(false); }).catch(() => {});
            getFile(reqPath).then(setFileRendered).catch(() => {});
          }
        })
        .catch(() => {
          getFileRaw(reqPath).then((raw) => { setFileRaw(raw); setLoading(false); }).catch((e: Error) => { setError(e.message); setLoading(false); });
          getFile(reqPath).then(setFileRendered).catch(() => {});
        });
    }
  }, [reqPath]);

  useEffect(() => {
    localStorage.setItem('jeeves-share-settings', JSON.stringify(shareSettings));
  }, [shareSettings]);

  const { isInsider: authInsider, keyCreatedAt, rotateKey } = useAuth();
  const breadcrumbs: BreadcrumbItem[] = directory?.breadcrumbs ?? file?.breadcrumbs ?? [];
  const isInsider = directory?.isInsider ?? file?.isInsider ?? authInsider;
  const keyAge = keyCreatedAt ? formatRelativeTime(keyCreatedAt) : null;

  const [rotateKeyDialogOpen, setRotateKeyDialogOpen] = useState(false);
  const handleRotateKey = () => setRotateKeyDialogOpen(true);
  const confirmRotateKey = async () => {
    setRotateKeyDialogOpen(false);
    await rotateKey();
  };

  // Top bar height measurement
  const topBarRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const [topBarHeight, setTopBarHeight] = useState(96);
  const measureTopBar = useCallback(() => {
    if (topBarRef.current) setTopBarHeight(topBarRef.current.offsetHeight);
  }, []);
  useEffect(() => {
    measureTopBar();
    window.addEventListener('resize', measureTopBar);
    return () => window.removeEventListener('resize', measureTopBar);
  }, [measureTopBar]);
  useEffect(() => { measureTopBar(); }, [file, directory, drives, measureTopBar]);

  // Save handler for editor
  const handleSave = async (content: string) => {
    await saveFile(reqPath, content);
    const refreshed = await getFileRaw(reqPath);
    setFileRaw(refreshed);
    try { const r = await getFile(reqPath); setFileRendered(r); } catch { /* ignore */ }
  };

  return {
    reqPath, theme, toggleTheme,
    shareSettings, setShareSettings,
    mobileTocOpen, setMobileTocOpen,
    proseWidth, toggleProseWidth,
    drives, directory, fileRaw, fileRendered, file,
    loading, error, editing, setEditing,
    viewTab, setViewTab,
    breadcrumbs, isInsider, keyAge,
    rotateKeyDialogOpen, setRotateKeyDialogOpen,
    handleRotateKey, confirmRotateKey,
    topBarRef, mainRef, topBarHeight,
    handleSave,
  };
}

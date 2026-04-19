/**
 * Composition root for the file browser — combines focused hooks.
 */
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import type { BreadcrumbItem } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/theme';
import { useFileData } from './useFileData';
import { useShareSettings } from './useShareSettings';
import { useTopBar } from './useTopBar';

function formatRelativeTime(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${String(mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `${String(days)}d ago`;
}

export function useFileBrowser() {
  const params = useParams<{ '*': string }>();
  const reqPath = params['*'] ?? '';
  const [searchParams, setSearchParams] = useSearchParams();
  const [theme, toggleTheme] = useTheme();

  // Browser tab title
  useEffect(() => {
    const siteTitle = 'Jeeves Server';
    const segments = reqPath.split('/').filter(Boolean);
    const last = segments.length ? segments[segments.length - 1] : '';
    const decoded = last ? decodeURIComponent(last) : '';
    document.title = decoded ? `${decoded} - ${siteTitle}` : siteTitle;
  }, [reqPath]);

  // Data
  const {
    drives, directory, fileRaw, fileRendered, file,
    loading, error, editing, setEditing,
    viewTab, setViewTab: setViewTabInternal,
    handleSave, refetch,
  } = useFileData(reqPath, searchParams);

  // Sync tab to URL
  const setViewTab = (tab: 'rendered' | 'raw') => {
    setViewTabInternal(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'rendered') next.delete('tab');
      else next.set('tab', tab);
      return next;
    }, { replace: true });
  };

  // Sharing
  const { shareSettings, setShareSettings } = useShareSettings();

  // UI state
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [proseWidth, setProseWidth] = useState<'narrow' | 'medium' | 'wide'>(
    () => (localStorage.getItem('jeeves-prose-width') as 'narrow' | 'medium' | 'wide') ?? 'medium',
  );
  const toggleProseWidth = (w: 'narrow' | 'medium' | 'wide') => {
    setProseWidth(w);
    localStorage.setItem('jeeves-prose-width', w);
  };

  // Auth
  const { isInsider: authInsider, searchEnabled, keyCreatedAt, rotateKey } = useAuth();
  const breadcrumbs: BreadcrumbItem[] = directory?.breadcrumbs ?? file?.breadcrumbs ?? [];
  const isInsider = directory?.isInsider ?? file?.isInsider ?? authInsider;
  const keyAge = keyCreatedAt ? formatRelativeTime(keyCreatedAt) : null;

  // Key rotation dialog
  const [rotateKeyDialogOpen, setRotateKeyDialogOpen] = useState(false);
  const handleRotateKey = () => setRotateKeyDialogOpen(true);
  const confirmRotateKey = async () => {
    setRotateKeyDialogOpen(false);
    await rotateKey();
  };

  // Layout
  const { topBarRef, mainRef, topBarHeight } = useTopBar(JSON.stringify([file, directory, drives]));

  return {
    reqPath, theme, toggleTheme,
    shareSettings, setShareSettings,
    mobileTocOpen, setMobileTocOpen,
    proseWidth, toggleProseWidth,
    drives, directory, fileRaw, fileRendered, file,
    loading, error, editing, setEditing,
    viewTab, setViewTab,
    breadcrumbs, isInsider, searchEnabled, keyAge,
    rotateKeyDialogOpen, setRotateKeyDialogOpen,
    handleRotateKey, confirmRotateKey,
    topBarRef, mainRef, topBarHeight,
    handleSave, refetch,
  };
}

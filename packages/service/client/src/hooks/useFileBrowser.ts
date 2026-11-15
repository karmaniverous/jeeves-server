/**
 * Composition root for the file browser — combines focused hooks.
 */
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import type { BreadcrumbItem } from '@/lib/apiTypes';
import { useAuthStatus } from '@/lib/AuthStatusContext';
import { useDocumentTitle } from '@/lib/documentTitle';
import { applyRenderState, computeRenderState } from '@/lib/renderState';
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

/** The decoded last segment of a browse path (`''` for none). */
function lastSegment(reqPath: string): string {
  const last = reqPath.split('/').filter(Boolean).pop() ?? '';
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

export function useFileBrowser() {
  const params = useParams<{ '*': string }>();
  const reqPath = params['*'] ?? '';
  const [searchParams, setSearchParams] = useSearchParams();
  const [theme, toggleTheme] = useTheme();

  // Data
  const {
    drives,
    directory,
    fileRaw,
    fileRendered,
    file,
    loading,
    error,
    renderError,
    editing,
    setEditing,
    viewTab,
    setViewTab: setViewTabInternal,
    handleSave,
    refetch,
  } = useFileData(reqPath, searchParams);

  // Export render-state signal (#295): set after React commits the view.
  const renderState = computeRenderState({
    reqPath,
    loading,
    error,
    hasDrives: drives !== null,
    hasDirectory: directory !== null,
    hasFileRaw: fileRaw !== null,
    hasFileRendered: fileRendered !== null,
    fileType: file?.type,
    renderError,
    viewTab,
  });
  useEffect(() => {
    applyRenderState(renderState);
  }, [renderState]);

  // Browser tab title (#262): the open file's title, else the directory's.
  useDocumentTitle(
    file
      ? (file.title ?? file.fileName)
      : directory
        ? lastSegment(reqPath)
        : null,
  );

  // Sync tab to URL
  const setViewTab = (tab: 'rendered' | 'raw') => {
    setViewTabInternal(tab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === 'rendered') next.delete('tab');
        else next.set('tab', tab);
        return next;
      },
      { replace: true },
    );
  };

  // Sharing
  const { shareSettings, setShareSettings } = useShareSettings();

  // UI state
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [proseWidth, setProseWidth] = useState<'narrow' | 'medium' | 'wide'>(
    () =>
      (localStorage.getItem('jeeves-prose-width') as
        'narrow' | 'medium' | 'wide') ?? 'medium',
  );
  const toggleProseWidth = (w: 'narrow' | 'medium' | 'wide') => {
    setProseWidth(w);
    localStorage.setItem('jeeves-prose-width', w);
  };

  // Auth
  const {
    isInsider: authInsider,
    searchEnabled,
    keyCreatedAt,
    rotateKey,
  } = useAuthStatus();
  const breadcrumbs: BreadcrumbItem[] =
    directory?.breadcrumbs ?? file?.breadcrumbs ?? [];
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
  const { topBarRef, mainRef, topBarHeight } = useTopBar(
    JSON.stringify([file, directory, drives]),
  );

  return {
    reqPath,
    theme,
    toggleTheme,
    shareSettings,
    setShareSettings,
    mobileTocOpen,
    setMobileTocOpen,
    proseWidth,
    toggleProseWidth,
    drives,
    directory,
    fileRaw,
    fileRendered,
    file,
    loading,
    error,
    editing,
    setEditing,
    viewTab,
    setViewTab,
    breadcrumbs,
    isInsider,
    searchEnabled,
    keyAge,
    rotateKeyDialogOpen,
    setRotateKeyDialogOpen,
    handleRotateKey,
    confirmRotateKey,
    topBarRef,
    mainRef,
    topBarHeight,
    handleSave,
    refetch,
  };
}

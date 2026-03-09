/**
 * Data fetching for file browser — drives, directories, and file content.
 */
import { useCallback, useEffect, useState } from 'react';

import type { DirectoryListing, DriveEntry, FileContent } from '@/lib/api';
import { getDrives, getDirectory, getFile, getFileRaw, saveFile } from '@/lib/api';

export function useFileData(reqPath: string, searchParams: URLSearchParams) {
  const [drives, setDrives] = useState<DriveEntry[] | null>(null);
  const [directory, setDirectory] = useState<DirectoryListing | null>(null);
  const [fileRaw, setFileRaw] = useState<FileContent | null>(null);
  const [fileRendered, setFileRendered] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const initialTab = searchParams.get('tab') === 'raw' ? 'raw' : 'rendered';
  const [viewTab, setViewTabInternal] = useState<'rendered' | 'raw'>(initialTab);

  const file = fileRendered ?? fileRaw;

  const loadData = useCallback(async (path: string, params: URLSearchParams) => {
    setLoading(true);
    setError(null);
    setDrives(null);
    setDirectory(null);
    setFileRaw(null);
    setFileRendered(null);
    setEditing(false);
    setViewTabInternal(params.get('tab') === 'raw' ? 'raw' : 'rendered');

    if (!path) {
      try {
        const data = await getDrives();
        setDrives(data);
      } catch (e: unknown) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    } else {
      try {
        const data = await getDirectory(path);
        if ('entries' in data) {
          setDirectory(data);
          setLoading(false);
        } else {
          getFileRaw(path).then((raw) => { setFileRaw(raw); setLoading(false); }).catch(() => {});
          getFile(path).then(setFileRendered).catch(() => {});
        }
      } catch {
        getFileRaw(path).then((raw) => { setFileRaw(raw); setLoading(false); }).catch((e: Error) => { setError(e.message); setLoading(false); });
        getFile(path).then(setFileRendered).catch(() => {});
      }
    }
  }, []);

  // Only reload data when the path changes, not when tab params change
  useEffect(() => {
    void loadData(reqPath, searchParams);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadData, reqPath]);

  const handleSave = async (content: string) => {
    await saveFile(reqPath, content);
    const refreshed = await getFileRaw(reqPath);
    setFileRaw(refreshed);
    try { const r = await getFile(reqPath); setFileRendered(r); } catch { /* ignore */ }
    setEditing(false);
  };

  return {
    drives, directory, fileRaw, fileRendered, file,
    loading, error,
    editing, setEditing,
    viewTab, setViewTab: setViewTabInternal,
    handleSave,
  };
}

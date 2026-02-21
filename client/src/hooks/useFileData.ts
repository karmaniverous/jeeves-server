/**
 * Data fetching for file browser — drives, directories, and file content.
 */
import { useEffect, useState } from 'react';

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

  useEffect(() => {
    setLoading(true);
    setError(null);
    setDrives(null);
    setDirectory(null);
    setFileRaw(null);
    setFileRendered(null);
    setEditing(false);
    setViewTabInternal(searchParams.get('tab') === 'raw' ? 'raw' : 'rendered');

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

  const handleSave = async (content: string) => {
    await saveFile(reqPath, content);
    const refreshed = await getFileRaw(reqPath);
    setFileRaw(refreshed);
    try { const r = await getFile(reqPath); setFileRendered(r); } catch { /* ignore */ }
  };

  return {
    drives, directory, fileRaw, fileRendered, file,
    loading, error,
    editing, setEditing,
    viewTab, setViewTab: setViewTabInternal,
    handleSave,
  };
}

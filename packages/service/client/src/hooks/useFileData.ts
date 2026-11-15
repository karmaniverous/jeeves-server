/**
 * Data fetching for file browser — drives, directories, and file content.
 */
import { useCallback, useEffect, useState } from 'react';

import type { DirectoryListing, DriveEntry, FileContent } from '@/lib/apiTypes';
import { server } from '@/lib/server';
import { errorMessage } from '@/lib/serverErrors';

import { useLatestRef } from './useLatestRef';

/** A file's rendered view; forwards `render_diagrams` from the page URL (PDF/DOCX export via Puppeteer). */
function getFile(path: string): Promise<FileContent> {
  const renderDiagrams = new URLSearchParams(window.location.search).get(
    'render_diagrams',
  );
  return server.fileContent({
    '*': path,
    ...(renderDiagrams ? { render_diagrams: renderDiagrams } : {}),
  });
}

/** A file's source, unrendered. */
function getFileRaw(path: string): Promise<FileContent> {
  return server.fileContent({ '*': path, raw: '1' });
}

export function useFileData(reqPath: string, searchParams: URLSearchParams) {
  const [drives, setDrives] = useState<DriveEntry[] | null>(null);
  const [directory, setDirectory] = useState<DirectoryListing | null>(null);
  const [fileRaw, setFileRaw] = useState<FileContent | null>(null);
  const [fileRendered, setFileRendered] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Failure of the rendered-view request (drives the export render state). */
  const [renderError, setRenderError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const initialTab = searchParams.get('tab') === 'raw' ? 'raw' : 'rendered';
  const [viewTab, setViewTabInternal] = useState<'rendered' | 'raw'>(
    initialTab,
  );

  const file = fileRendered ?? fileRaw;

  const loadData = useCallback(
    async (path: string, params: URLSearchParams) => {
      setLoading(true);
      setError(null);
      setRenderError(null);
      setDrives(null);
      setDirectory(null);
      setFileRaw(null);
      setFileRendered(null);
      setEditing(false);
      setViewTabInternal(params.get('tab') === 'raw' ? 'raw' : 'rendered');

      if (!path) {
        try {
          const data = await server.drives();
          setDrives(data);
        } catch (e: unknown) {
          setError(errorMessage(e));
        } finally {
          setLoading(false);
        }
      } else {
        try {
          const data = await server.browse({ '*': path });
          if ('entries' in data) {
            setDirectory(data);
            setLoading(false);
          } else {
            getFileRaw(path)
              .then((raw) => {
                setFileRaw(raw);
                setLoading(false);
              })
              .catch(() => {});
            getFile(path)
              .then(setFileRendered)
              .catch((e: unknown) => {
                setRenderError(errorMessage(e));
              });
          }
        } catch {
          getFileRaw(path)
            .then((raw) => {
              setFileRaw(raw);
              setLoading(false);
            })
            .catch((e: unknown) => {
              setError(errorMessage(e));
              setLoading(false);
            });
          getFile(path)
            .then(setFileRendered)
            .catch((e: unknown) => {
              setRenderError(errorMessage(e));
            });
        }
      }
    },
    [],
  );

  // Only reload data when the path changes, not when tab params change:
  // the load reads the params current at that moment through a ref.
  const searchParamsRef = useLatestRef(searchParams);
  useEffect(() => {
    const params = searchParamsRef.current;
    queueMicrotask(() => {
      void loadData(reqPath, params);
    });
  }, [loadData, reqPath, searchParamsRef]);

  /** Imperatively re-fetch file data without resetting editing/view state. */
  const refetch = useCallback(async () => {
    if (!reqPath) return;
    try {
      const raw = await getFileRaw(reqPath);
      setFileRaw(raw);
    } catch {
      /* ignore */
    }
    try {
      const rendered = await getFile(reqPath);
      setFileRendered(rendered);
    } catch {
      /* ignore */
    }
  }, [reqPath]);

  const handleSave = async (content: string) => {
    await server.fileWrite({ '*': reqPath, content });
    const refreshed = await getFileRaw(reqPath);
    setFileRaw(refreshed);
    try {
      const r = await getFile(reqPath);
      setFileRendered(r);
    } catch {
      /* ignore */
    }
    setEditing(false);
  };

  return {
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
  };
}

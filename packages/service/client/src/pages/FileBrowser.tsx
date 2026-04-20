/**
 * FileBrowser — thin composition root that wires hooks and components together.
 */
import { useCallback, useState } from 'react';
import { Loader2, Undo2, Redo2 } from 'lucide-react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DirectoryTable } from '@/components/DirectoryTable';
import { DownloadDropdown } from '@/components/DownloadDropdown';
import { DriveList } from '@/components/DriveList';
import { FileContentView } from '@/components/FileContentView';
import { Header } from '@/components/layout/Header';
import { LinkDropdown } from '@/components/LinkDropdown';
import { TabBar } from '@/components/TabBar';
import { useFileBrowser } from '@/hooks/useFileBrowser';
import { saveFile } from '@/lib/api';
import { useUndo } from '@/lib/useUndo';

export function FileBrowser() {
  const {
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
  } = useFileBrowser();

  // Undo/redo controls for header
  const { peekUndo, peekRedo, confirmUndo, confirmRedo, canUndo, canRedo } = useUndo();
  const [undoSaving, setUndoSaving] = useState(false);
  const currentContent = (fileRaw ?? fileRendered)?.content ?? '';

  const handleUndo = useCallback(async () => {
    const restored = peekUndo(reqPath);
    if (!restored) return;
    setUndoSaving(true);
    try {
      await saveFile(reqPath, restored);
      confirmUndo(reqPath, currentContent);
      await refetch();
    } finally {
      setUndoSaving(false);
    }
  }, [reqPath, currentContent, peekUndo, confirmUndo, refetch]);

  const handleRedo = useCallback(async () => {
    const restored = peekRedo(reqPath);
    if (!restored) return;
    setUndoSaving(true);
    try {
      await saveFile(reqPath, restored);
      confirmRedo(reqPath, currentContent);
      await refetch();
    } finally {
      setUndoSaving(false);
    }
  }, [reqPath, currentContent, peekRedo, confirmRedo, refetch]);

  const showFileView = file || (loading && !!reqPath);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Fixed top bar */}
      <div ref={topBarRef} className="fixed top-0 left-0 right-0 z-50">
        <Header
          breadcrumbs={breadcrumbs}
          isInsider={isInsider}
          searchEnabled={searchEnabled}
          theme={theme}
          onToggleTheme={toggleTheme}

          keyAge={editing ? undefined : keyAge}
          onRotateKey={editing ? undefined : handleRotateKey}
          downloadDropdown={editing ? undefined :
            file ? (
              <DownloadDropdown reqPath={reqPath} file={file} variant="header" />
            ) : directory ? (
              <DownloadDropdown reqPath={reqPath} file={null} isDirectory variant="header" />
            ) : undefined
          }
          downloadMenuItem={editing ? undefined :
            file ? (
              (onDismiss) => <DownloadDropdown reqPath={reqPath} file={file} variant="menuItem" onStateChange={(s) => { if (s === 'done') setTimeout(onDismiss, 800); }} />
            ) : directory ? (
              (onDismiss) => <DownloadDropdown reqPath={reqPath} file={null} isDirectory variant="menuItem" onStateChange={(s) => { if (s === 'done') setTimeout(onDismiss, 800); }} />
            ) : undefined
          }
          linkControls={editing ? undefined : isInsider ? (
            <LinkDropdown path={`/${reqPath}`} shareSettings={shareSettings} onShareSettingsChange={setShareSettings} showEvent showRaw={!!file} variant="header" isDirectory={!file} />
          ) : undefined}
          linkMenuItem={editing ? undefined : isInsider ? (
            (onDismiss) => <LinkDropdown path={`/${reqPath}`} shareSettings={shareSettings} onShareSettingsChange={setShareSettings} showEvent showRaw={!!file} variant="menuItem" isDirectory={!file} onStateChange={(s) => { if (s === 'done') setTimeout(onDismiss, 800); }} />
          ) : undefined}
        />

        {/* Tabs for file views */}
        {showFileView && (
          <TabBar
            reqPath={reqPath}
            file={file}
            fileRendered={fileRendered}
            viewTab={viewTab}
            setViewTab={setViewTab}
            proseWidth={proseWidth}
            toggleProseWidth={toggleProseWidth}
            isInsider={isInsider}
            editing={editing}
            setEditing={setEditing}
            mobileTocOpen={mobileTocOpen}
            setMobileTocOpen={setMobileTocOpen}
            loading={loading}
            undoRedoControls={!editing && isInsider && (canUndo(reqPath) || canRedo(reqPath)) ? (
              <div className="flex items-center gap-0.5 ml-2">
                {canUndo(reqPath) && (
                  <button
                    onClick={handleUndo}
                    disabled={undoSaving}
                    title="Undo (Ctrl+Z)"
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {undoSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                  </button>
                )}
                {canRedo(reqPath) && (
                  <button
                    onClick={handleRedo}
                    disabled={undoSaving}
                    title="Redo (Ctrl+Shift+Z)"
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {undoSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Redo2 className="h-4 w-4" />}
                  </button>
                )}
              </div>
            ) : undefined}
          />
        )}
      </div>

      <main
        ref={mainRef}
        className={showFileView ? 'px-0 pb-32 overflow-y-auto' : 'p-4 pb-32 md:px-6 md:pt-6 overflow-y-auto'}
        style={{ marginTop: `${topBarHeight}px`, height: `calc(100vh - ${topBarHeight}px)` }}
      >
        {loading && !reqPath && <div className="text-muted-foreground text-sm">Loading...</div>}
        {error && <div className="text-destructive text-sm">Error: {error}</div>}

        {/* Drive listing */}
        {!loading && !error && drives && (
          <DriveList drives={drives} isInsider={isInsider} shareSettings={shareSettings} onShareSettingsChange={setShareSettings} />
        )}

        {/* Directory listing */}
        {!loading && !error && directory && (
          <DirectoryTable entries={directory.entries} basePath={reqPath} isInsider={isInsider} shareSettings={shareSettings} onShareSettingsChange={setShareSettings} />
        )}

        {/* File viewer */}
        {!error && showFileView && (
          <FileContentView
            reqPath={reqPath}
            file={file}
            fileRaw={fileRaw}
            fileRendered={fileRendered}
            viewTab={viewTab}
            editing={editing}
            setEditing={setEditing}
            proseWidth={proseWidth}
            topBarHeight={topBarHeight}
            mainRef={mainRef}
            mobileTocOpen={mobileTocOpen}
            setMobileTocOpen={setMobileTocOpen}
            onSave={handleSave}
            refetch={refetch}
            loading={loading}
          />
        )}
      </main>

      <ConfirmDialog
        open={rotateKeyDialogOpen}
        onOpenChange={setRotateKeyDialogOpen}
        title="Rotate insider key?"
        description="This will invalidate ALL existing share links generated with your current key. This action cannot be undone."
        confirmLabel="Rotate Key"
        onConfirm={() => void confirmRotateKey()}
      />
    </div>
  );
}

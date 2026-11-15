/**
 * FileBrowser — thin composition root that wires hooks and components together.
 */
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DirectoryTable } from '@/components/DirectoryTable';
import { DownloadDropdown } from '@/components/DownloadDropdown';
import { DriveList } from '@/components/DriveList';
import { FileContentView } from '@/components/FileContentView';
import { Header } from '@/components/layout/Header';
import { LinkDropdown } from '@/components/LinkDropdown';
import { TabBar } from '@/components/TabBar';
import { UndoRedoControls } from '@/components/UndoRedoControls';
import { useFileBrowser } from '@/hooks/useFileBrowser';
import { useUndoRedo } from '@/hooks/useUndoRedo';

/** A menu item's `onStateChange`: dismiss the menu shortly after `done`. */
const dismissWhenDone = (onDismiss: () => void) => (s: string) => {
  if (s === 'done') setTimeout(onDismiss, 800);
};

export function FileBrowser() {
  const {
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
  } = useFileBrowser();

  // Undo/redo controls for header
  const currentContent = (fileRaw ?? fileRendered)?.content ?? '';
  const { handleUndo, handleRedo, saving, canUndo, canRedo } = useUndoRedo(
    reqPath,
    currentContent,
    refetch,
  );

  const showFileView = file || (loading && !!reqPath);

  // What the download control exports (none while editing).
  const download = editing
    ? undefined
    : file
      ? { file }
      : directory
        ? { file: null, isDirectory: true }
        : undefined;
  // The link control's props (insiders only, none while editing).
  const link =
    !editing && isInsider
      ? {
          path: `/${reqPath}`,
          shareSettings,
          onShareSettingsChange: setShareSettings,
          showEvent: true,
          showRaw: !!file,
          isDirectory: !file,
        }
      : undefined;

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
          downloadDropdown={
            download && (
              <DownloadDropdown
                reqPath={reqPath}
                {...download}
                variant="header"
              />
            )
          }
          downloadMenuItem={
            download &&
            ((onDismiss) => (
              <DownloadDropdown
                reqPath={reqPath}
                {...download}
                variant="menuItem"
                onStateChange={dismissWhenDone(onDismiss)}
              />
            ))
          }
          linkControls={link && <LinkDropdown {...link} variant="header" />}
          linkMenuItem={
            link &&
            ((onDismiss) => (
              <LinkDropdown
                {...link}
                variant="menuItem"
                onStateChange={dismissWhenDone(onDismiss)}
              />
            ))
          }
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
            undoRedoControls={
              !editing && isInsider && (canUndo || canRedo) ? (
                <UndoRedoControls
                  canUndo={canUndo}
                  canRedo={canRedo}
                  saving={saving}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                />
              ) : undefined
            }
          />
        )}
      </div>

      <main
        ref={mainRef}
        className={
          showFileView
            ? 'px-0 pb-32 overflow-y-auto'
            : 'p-4 pb-32 md:px-6 md:pt-6 overflow-y-auto'
        }
        style={{
          marginTop: `${topBarHeight}px`,
          height: `calc(100vh - ${topBarHeight}px)`,
        }}
      >
        {loading && !reqPath && (
          <div className="text-muted-foreground text-sm">Loading...</div>
        )}
        {error && (
          <div className="text-destructive text-sm">Error: {error}</div>
        )}

        {/* Drive listing */}
        {!loading && !error && drives && (
          <DriveList
            drives={drives}
            isInsider={isInsider}
            shareSettings={shareSettings}
            onShareSettingsChange={setShareSettings}
          />
        )}

        {/* Directory listing */}
        {!loading && !error && directory && (
          <DirectoryTable
            entries={directory.entries}
            basePath={reqPath}
            isInsider={isInsider}
            shareSettings={shareSettings}
            onShareSettingsChange={setShareSettings}
          />
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

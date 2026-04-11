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
import { useFileBrowser } from '@/hooks/useFileBrowser';

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
    handleSave, refetchFile,
  } = useFileBrowser();

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
              <DownloadDropdown reqPath={reqPath} file={file} isInsider={isInsider} variant="header" />
            ) : directory ? (
              <DownloadDropdown reqPath={reqPath} file={null} isDirectory isInsider={isInsider} variant="header" />
            ) : undefined
          }
          downloadMenuItem={editing ? undefined :
            file ? (
              (onDismiss) => <DownloadDropdown reqPath={reqPath} file={file} isInsider={isInsider} variant="menuItem" onStateChange={(s) => { if (s === 'done') setTimeout(onDismiss, 800); }} />
            ) : directory ? (
              (onDismiss) => <DownloadDropdown reqPath={reqPath} file={null} isDirectory isInsider={isInsider} variant="menuItem" onStateChange={(s) => { if (s === 'done') setTimeout(onDismiss, 800); }} />
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
            onRefetch={refetchFile}
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

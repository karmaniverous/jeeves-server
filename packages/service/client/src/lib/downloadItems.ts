/**
 * Download menu contents for files and directories (pure): each entry names
 * the SDK binary entry that fetches it and the file name it is saved as
 * (`<base name>.<format>`, or `<directory name>.zip`/`.tar`).
 */

/** The SDK binary entry (and format) a download fetches. */
export type DownloadRequest =
  | { entry: 'raw' }
  | { entry: 'export'; format: 'pdf' | 'docx' | 'zip' | 'tar' }
  | { entry: 'exportMermaid' | 'exportPlantUml'; format: string };

/** One entry of the Download menu. */
export interface DownloadItem {
  label: string;
  request: DownloadRequest;
  filename: string;
}

/** Diagram download formats, by source kind. */
const DIAGRAM_DOWNLOADS = {
  exportMermaid: ['svg', 'png', 'pdf'],
  exportPlantUml: ['svg', 'png', 'pdf', 'eps'],
} as const;

/** Menu entries for a diagram source's export formats. */
function diagramItems(
  entry: keyof typeof DIAGRAM_DOWNLOADS,
  baseName: string,
): DownloadItem[] {
  return DIAGRAM_DOWNLOADS[entry].map((format) => ({
    label: format.toUpperCase(),
    request: { entry, format },
    filename: `${baseName}.${format}`,
  }));
}

/**
 * Download menu entries. Directory archives (ZIP/Tar) are insider-only;
 * outsiders get only the formats for the file they were shared.
 */
export function getDownloadItems(
  reqPath: string,
  file: { fileName: string; type: string } | null,
  isDirectory: boolean | undefined,
  isInsider: boolean,
): DownloadItem[] {
  if (isDirectory || !file) {
    if (!isInsider) return [];
    const baseDirName = reqPath.split('/').pop() ?? 'archive';
    return [
      {
        label: 'ZIP',
        request: { entry: 'export', format: 'zip' },
        filename: `${baseDirName}.zip`,
      },
      {
        label: 'Tar',
        request: { entry: 'export', format: 'tar' },
        filename: `${baseDirName}.tar`,
      },
    ];
  }

  const baseName = file.fileName.replace(/\.[^.]+$/, '');
  const items: DownloadItem[] = [
    { label: 'Raw', request: { entry: 'raw' }, filename: file.fileName },
  ];

  if (file.type === 'markdown' || file.type === '.md') {
    items.push(
      {
        label: 'PDF',
        request: { entry: 'export', format: 'pdf' },
        filename: `${baseName}.pdf`,
      },
      {
        label: 'DOCX',
        request: { entry: 'export', format: 'docx' },
        filename: `${baseName}.docx`,
      },
    );
  }

  if (file.type === 'mermaid' || file.type === '.mmd')
    items.push(...diagramItems('exportMermaid', baseName));

  if (
    file.type === 'plantuml' ||
    ['.puml', '.plantuml', '.pu'].includes(file.type)
  )
    items.push(...diagramItems('exportPlantUml', baseName));

  return items;
}

/** Clear Cache is offered to insiders, for files only. */
export function showClearCache(
  isDirectory: boolean | undefined,
  isInsider: boolean,
): boolean {
  return isInsider && !isDirectory;
}

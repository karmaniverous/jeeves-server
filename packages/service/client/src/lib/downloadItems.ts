/**
 * Download menu contents for files and directories (pure).
 */

/** One entry of the Download menu. */
export interface DownloadItem {
  label: string;
  href: string;
  filename: string;
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
  const items: DownloadItem[] = [];

  if (isDirectory || !file) {
    if (!isInsider) return items;
    const baseDirName = reqPath.split('/').pop() ?? 'archive';
    items.push({
      label: 'ZIP',
      href: `/api/export/${reqPath}?format=zip`,
      filename: `${baseDirName}.zip`,
    });
    items.push({
      label: 'Tar',
      href: `/api/export/${reqPath}?format=tar`,
      filename: `${baseDirName}.tar`,
    });
    return items;
  }

  const baseName = file.fileName.replace(/\.[^.]+$/, '');
  items.push({
    label: 'Raw',
    href: `/api/raw/${reqPath}`,
    filename: file.fileName,
  });

  if (file.type === 'markdown' || file.type === '.md') {
    items.push({
      label: 'PDF',
      href: `/api/export/${reqPath}?format=pdf`,
      filename: `${baseName}.pdf`,
    });
    items.push({
      label: 'DOCX',
      href: `/api/export/${reqPath}?format=docx`,
      filename: `${baseName}.docx`,
    });
  }

  if (file.type === 'mermaid' || file.type === '.mmd') {
    items.push({
      label: 'SVG',
      href: `/api/mermaid-export/${reqPath}?format=svg`,
      filename: `${baseName}.svg`,
    });
    items.push({
      label: 'PNG',
      href: `/api/mermaid-export/${reqPath}?format=png`,
      filename: `${baseName}.png`,
    });
    items.push({
      label: 'PDF',
      href: `/api/mermaid-export/${reqPath}?format=pdf`,
      filename: `${baseName}.pdf`,
    });
  }

  if (
    file.type === 'plantuml' ||
    ['.puml', '.plantuml', '.pu'].includes(file.type)
  ) {
    items.push({
      label: 'SVG',
      href: `/api/plantuml-export/${reqPath}?format=svg`,
      filename: `${baseName}.svg`,
    });
    items.push({
      label: 'PNG',
      href: `/api/plantuml-export/${reqPath}?format=png`,
      filename: `${baseName}.png`,
    });
    items.push({
      label: 'PDF',
      href: `/api/plantuml-export/${reqPath}?format=pdf`,
      filename: `${baseName}.pdf`,
    });
    items.push({
      label: 'EPS',
      href: `/api/plantuml-export/${reqPath}?format=eps`,
      filename: `${baseName}.eps`,
    });
  }

  return items;
}

/** Clear Cache is offered to insiders, for files only. */
export function showClearCache(
  isDirectory: boolean | undefined,
  isInsider: boolean,
): boolean {
  return isInsider && !isDirectory;
}

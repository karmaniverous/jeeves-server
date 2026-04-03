/**
 * CSV to HTML table conversion.
 *
 * Parses RFC 4180 CSV and renders an HTML table with headers.
 *
 * @packageDocumentation
 */

/**
 * Parse a CSV string into rows of fields per RFC 4180.
 *
 * Handles: quoted fields with embedded commas/newlines,
 * escaped quotes (""), empty fields, trailing newlines.
 */
export function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < csv.length) {
    const ch = csv[i];

    if (inQuotes) {
      if (ch === '"') {
        // Peek next character
        if (i + 1 < csv.length && csv[i + 1] === '"') {
          // Escaped quote
          field += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        row.push(field);
        field = '';
        i++;
      } else if (ch === '\r') {
        // Handle \r\n or bare \r
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        i++;
        if (i < csv.length && csv[i] === '\n') i++;
      } else if (ch === '\n') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Push final field/row if there's content
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Remove trailing empty row (from trailing newline)
  const lastRow = rows.length > 0 ? rows[rows.length - 1] : undefined;
  if (lastRow && lastRow.length === 1 && lastRow[0] === '') {
    rows.pop();
  }

  return rows;
}

/** Escape HTML special characters. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convert a CSV string to an HTML table.
 *
 * First row is treated as column headers (thead).
 * Returns empty paragraph for empty input.
 */
export function csvToHtmlTable(csv: string): string {
  const rows = parseCsvRows(csv);
  if (rows.length === 0) return '<p>Empty CSV</p>';

  const [headers, ...data] = rows as [string[], ...string[][]];
  const colCount = headers.length;
  const thead = `<thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${data
    .map((row) => {
      const cells = Array.from({ length: colCount }, (_, i) => row[i] ?? '');
      return `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`;
    })
    .join('')}</tbody>`;

  return `<table class="csv-table">${thead}${tbody}</table>`;
}

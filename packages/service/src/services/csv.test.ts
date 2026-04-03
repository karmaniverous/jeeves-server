import { describe, expect, it } from 'vitest';

import { csvToHtmlTable, parseCsvRows } from './csv.js';

describe('parseCsvRows', () => {
  it('parses simple CSV', () => {
    const rows = parseCsvRows('a,b,c\n1,2,3\n');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields with embedded commas', () => {
    const rows = parseCsvRows('name,desc\n"Smith, John","has, commas"\n');
    expect(rows).toEqual([
      ['name', 'desc'],
      ['Smith, John', 'has, commas'],
    ]);
  });

  it('handles escaped quotes ("")', () => {
    const rows = parseCsvRows('a\n"he said ""hello"""\n');
    expect(rows).toEqual([['a'], ['he said "hello"']]);
  });

  it('handles empty fields', () => {
    const rows = parseCsvRows('a,,c\n,,\n');
    expect(rows).toEqual([
      ['a', '', 'c'],
      ['', '', ''],
    ]);
  });

  it('handles trailing newlines', () => {
    const rows = parseCsvRows('a,b\n1,2\n\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('handles single row (headers only)', () => {
    const rows = parseCsvRows('name,age,city\n');
    expect(rows).toEqual([['name', 'age', 'city']]);
  });

  it('returns empty array for empty input', () => {
    const rows = parseCsvRows('');
    expect(rows).toEqual([]);
  });

  it('handles CRLF line endings', () => {
    const rows = parseCsvRows('a,b\r\n1,2\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('handles quoted fields with embedded newlines', () => {
    const rows = parseCsvRows('a,b\n"line1\nline2",val\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['line1\nline2', 'val'],
    ]);
  });
});

describe('csvToHtmlTable', () => {
  it('renders a table with headers and data', () => {
    const html = csvToHtmlTable('Name,Age\nAlice,30\nBob,25\n');
    expect(html).toContain('<thead>');
    expect(html).toContain('<th>Name</th>');
    expect(html).toContain('<th>Age</th>');
    expect(html).toContain('<td>Alice</td>');
    expect(html).toContain('<td>30</td>');
    expect(html).toContain('<td>Bob</td>');
  });

  it('returns empty paragraph for empty input', () => {
    const html = csvToHtmlTable('');
    expect(html).toBe('<p>Empty CSV</p>');
  });

  it('escapes HTML in field values', () => {
    const html = csvToHtmlTable('a\n<script>alert("xss")</script>\n');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('produces a table with csv-table class for client styling', () => {
    const html = csvToHtmlTable('Name,Age\nAlice,30\n');
    expect(html).toMatch(/<table class="csv-table">/);
  });

  it('normalizes rows with fewer or more columns than header', () => {
    // Row with fewer columns gets padded, row with more gets truncated
    const csv = 'a,b,c\n1\n4,5,6,7\n';
    const html = csvToHtmlTable(csv);
    // First data row: 1 field → padded to 3 columns
    expect(html).toContain('<tr><td>1</td><td></td><td></td></tr>');
    // Second data row: 4 fields → truncated to 3 columns (no "7")
    expect(html).toContain('<tr><td>4</td><td>5</td><td>6</td></tr>');
    expect(html).not.toContain('<td>7</td>');
  });

  it('handles a large CSV (>100 rows) without issues', () => {
    const header = 'id,name,value\n';
    const rows = Array.from(
      { length: 150 },
      (_, i) => `${String(i)},item${String(i)},${String(i * 10)}\n`,
    ).join('');
    const csv = header + rows;

    const html = csvToHtmlTable(csv);
    expect(html).toContain('csv-table');
    expect(html).toContain('<thead>');
    // Verify first and last data rows are present
    expect(html).toContain('<td>0</td>');
    expect(html).toContain('<td>149</td>');
    // Count tbody rows
    const trMatches = html.match(/<tr>/g);
    // 1 header row + 150 data rows = 151
    expect(trMatches).toHaveLength(151);
  });
});

# Exporting & Downloads

Jeeves Server can export files as PDF, DOCX, or ZIP — turning Markdown into business-ready documents with one click.

## Export Types

| Format | Available For | How It Works |
|--------|--------------|--------------|
| **PDF** | Markdown files | Puppeteer renders the page in headless Chrome and prints to PDF |
| **DOCX** | Markdown files | HTML converted via `@turbodocx/html-to-docx` |
| **ZIP** | Directories | Entire directory tree compressed via `archiver` |
| **Raw** | Any file | Direct file download |

## Using Exports

### From the UI

The **Download dropdown** (⬇️ icon) in the header shows available export options based on the current file type. Click an option and the file downloads directly — a spinner shows during generation, replaced by a checkmark on completion.

### Via URL Parameters

Append to any file URL:

```
# PDF export
/browse/d/docs/design.md?export=pdf

# DOCX export
/browse/d/docs/design.md?export=docx

# Raw file download
/browse/d/docs/design.md?raw=1
```

These work with both insider keys (`?key=<insider-key>&export=pdf`) and outsider share links.

### Programmatic Access

```bash
# Download PDF via curl
curl -o design.pdf "https://jeeves.example.com/path/d/docs/design.md?key=<key>&export=pdf"

# Download DOCX
curl -o design.docx "https://jeeves.example.com/path/d/docs/design.md?key=<key>&export=docx"

# Download raw file
curl -o design.md "https://jeeves.example.com/path/d/docs/design.md?key=<key>&raw=1"
```

## PDF Export

PDF generation uses **Puppeteer** with your installed Chrome/Chromium. The server:

1. Launches headless Chrome
2. Loads the rendered markdown page (authenticating with the `_internal` key)
3. Prints to PDF with print-quality settings
4. Returns the PDF as a download

### Requirements

- **Chrome/Chromium** must be installed on the server
- **`chromePath`** must point to the executable in `jeeves.config.ts`
- **`_internal` key** must be configured (Puppeteer uses it to authenticate)

```typescript
chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
keys: {
  _internal: 'random-seed-string',  // Required for PDF/DOCX export
},
```

### What you see is what you get

PDFs render from the same HTML as the browser view, but:
- **Prose width setting is ignored** — exports always use full width
- **Dark mode is ignored** — exports always render in light mode
- **TOC sidebar is excluded** — the document stands alone
- **Code blocks retain syntax highlighting** — colors print correctly

### Troubleshooting

**"Export failed" error:**
- Verify `chromePath` points to a valid Chrome/Chromium executable
- Ensure the `_internal` key is configured in `keys`
- Check server logs for Puppeteer errors

**Blank or login page in PDF:**
- The `_internal` key's derived insider key must be valid
- Verify with: `curl -s "http://localhost:<port>/insider-key" -H "X-API-Key: <_internal-seed>"`

**Timeout on large documents:**
- Large markdown files with many code blocks or diagrams take longer to render
- The server has a default timeout; very large documents may need optimization

## DOCX Export

DOCX generation converts the rendered HTML to a Word document using `@turbodocx/html-to-docx`. This happens server-side without Chrome.

DOCX exports:
- Preserve headings, tables, lists, and basic formatting
- Include code blocks (without syntax highlighting colors)
- Embed images as inline content
- Work independently of the `_internal` key (no Puppeteer needed)

## ZIP Export

Directories can be downloaded as ZIP archives. The header shows a ZIP download option when viewing a directory.

### Size limit

The `maxZipSizeMb` config setting (default: 100 MB) prevents accidentally zipping enormous directories:

```typescript
maxZipSizeMb: 100,  // Refuse ZIP for directories larger than this
```

When the total directory size exceeds this limit, the ZIP option is disabled with a message explaining why.

### What's included

The ZIP contains the entire directory tree — all files and subdirectories. No files are excluded.

## Export for Outsiders

Outsiders (people using share links) can also export files:
- **PDF and DOCX** exports work on shared markdown files
- **Raw download** works on any shared file
- **ZIP** works on shared directories (within the size limit)

The share link's authentication covers the export — no additional credentials needed.

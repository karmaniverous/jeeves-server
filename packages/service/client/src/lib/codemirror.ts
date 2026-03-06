/**
 * Shared CodeMirror 6 utilities: core loader and language detection.
 * Used by both CodeViewer (read-only) and CodeEditor (editable).
 */

/** Lazy-load core CodeMirror modules */
export async function loadCodeMirror() {
  const [
    { EditorView, basicSetup },
    { EditorState },
    { keymap },
    { oneDark },
  ] = await Promise.all([
    import('codemirror'),
    import('@codemirror/state'),
    import('@codemirror/view'),
    import('@codemirror/theme-one-dark'),
  ]);
  return { EditorView, EditorState, basicSetup, keymap, oneDark };
}

/** Map file extensions to CodeMirror language support (lazy-loaded) */
export async function getLanguageExtension(ext: string) {
  switch (ext.toLowerCase()) {
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return (await import('@codemirror/lang-javascript')).javascript({ jsx: ext.includes('x') });
    case 'ts':
    case 'tsx':
    case 'mts':
    case 'cts':
      return (await import('@codemirror/lang-javascript')).javascript({ jsx: ext.includes('x'), typescript: true });
    case 'html':
    case 'htm':
      return (await import('@codemirror/lang-html')).html();
    case 'css':
    case 'scss':
      return (await import('@codemirror/lang-css')).css();
    case 'json':
    case 'jsonl':
      return (await import('@codemirror/lang-json')).json();
    case 'md':
    case 'mdx':
    case 'markdown':
      return (await import('@codemirror/lang-markdown')).markdown();
    case 'py':
    case 'pyw':
      return (await import('@codemirror/lang-python')).python();
    case 'xml':
    case 'svg':
    case 'xsl':
    case 'xhtml':
      return (await import('@codemirror/lang-xml')).xml();
    case 'yaml':
    case 'yml':
      return (await import('@codemirror/lang-yaml')).yaml();
    case 'c':
    case 'h':
    case 'cpp':
    case 'hpp':
    case 'cc':
    case 'cxx':
      return (await import('@codemirror/lang-cpp')).cpp();
    case 'java':
      return (await import('@codemirror/lang-java')).java();
    case 'rs':
      return (await import('@codemirror/lang-rust')).rust();
    case 'sql':
      return (await import('@codemirror/lang-sql')).sql();
    case 'php':
      return (await import('@codemirror/lang-php')).php();
    default:
      return null;
  }
}

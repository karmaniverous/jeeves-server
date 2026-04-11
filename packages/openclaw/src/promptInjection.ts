/**
 * Generates the Server menu string for TOOLS.md injection.
 */

import { fetchJson } from '@karmaniverous/jeeves';

interface HealthPayload {
  port?: number;
  chrome?: { configured?: boolean; path?: string | null };
  exports?: {
    documents?: string[];
    directories?: string[];
    diagrams?: string[];
    chromeAvailable?: boolean;
  };
  auth?: { insiderCount?: number; keyCount?: number };
  events?: Array<{ name: string; cmd?: string; pattern?: string }>;
  diagrams?: {
    mermaid?: boolean;
    plantuml?: { localJar?: boolean; servers?: string[] };
  };
}

interface StatusResponse {
  name?: string;
  version?: string;
  uptime?: number;
  status?: string;
  health?: HealthPayload;
}

/**
 * Fetch server status and generate a Markdown menu string.
 */
export async function generateServerMenu(apiUrl: string): Promise<string> {
  let status: StatusResponse;

  try {
    status = (await fetchJson(apiUrl + '/status', {
      signal: AbortSignal.timeout(5000),
    })) as StatusResponse;
  } catch {
    return '> jeeves-server status unavailable.';
  }

  const health = status.health ?? {};

  const lines: string[] = [
    `jeeves-server v${status.version ?? 'unknown'} running on port ${String(health.port ?? 'unknown')}.`,
    '',
  ];

  // Export capabilities
  if (health.exports) {
    lines.push('### Export');
    if (health.exports.documents) {
      lines.push(
        '* **Documents** (Markdown/HTML): ' +
          health.exports.documents.join(', '),
      );
      if (!health.exports.chromeAvailable) {
        lines.push('  > Chrome not detected — PDF export unavailable.');
      }
    }
    if (health.exports.directories) {
      lines.push('* **Directories**: ' + health.exports.directories.join(', '));
    }
    if (health.exports.diagrams) {
      lines.push('* **Diagrams**: ' + health.exports.diagrams.join(', '));
    }
    lines.push('* **All files**: raw download');
    lines.push(
      'Use `server_link_info` to check available formats for a specific path.',
    );
    lines.push('');
  }

  // Diagram support
  if (health.diagrams) {
    const langs: string[] = [];
    if (health.diagrams.mermaid) langs.push('Mermaid');
    if (health.diagrams.plantuml) {
      const pl = health.diagrams.plantuml;
      langs.push(
        'PlantUML' + (pl.localJar ? ' (local jar)' : ' (server-only)'),
      );
    }
    if (langs.length > 0) {
      lines.push('### Diagrams');
      lines.push('Supported: ' + langs.join(', '));
      lines.push('');
    }
  }

  // Event gateway
  if (health.events && health.events.length > 0) {
    lines.push('### Event Gateway');
    lines.push('Active schemas:');
    for (const evt of health.events) {
      lines.push(
        '* **' +
          evt.name +
          '**' +
          (evt.pattern ? ' — pattern: `' + evt.pattern + '`' : ''),
      );
    }
    lines.push('');
  }

  // Access info
  if (health.auth?.insiderCount !== undefined) {
    lines.push('### Access');
    lines.push(String(health.auth.insiderCount) + ' insider(s) configured.');
    lines.push('');
  }

  // Checkbox toggling
  lines.push('### Editing');
  lines.push(
    'Insiders can toggle GFM task-list checkboxes in rendered Markdown pages. The server exposes `POST /api/file/*/toggle-checkbox` with stale-write protection (mtime). This is used by the web UI — no agent tool is needed.',
  );
  lines.push('');

  // Sharing guidance
  lines.push('### Sharing');
  lines.push(
    'Use `server_share` to generate links. Insiders authenticate via Google; outsiders use HMAC share links.',
  );
  lines.push(
    'Use `server_link_info` to check available export formats for a path before exporting.',
  );
  lines.push(
    'URLs returned by server tools are automatically rewritten to use the public domain when `publicUrl` is configured. No manual URL rewriting is needed.',
  );

  return lines.join('\n');
}

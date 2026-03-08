/**
 * Generates the Server menu string for TOOLS.md injection.
 */

import { fetchJson } from './helpers.js';

interface StatusResponse {
  version?: string;
  uptime?: number;
  port?: number;
  chrome?: boolean;
  exports?: {
    documents?: string[];
    directories?: string[];
    diagrams?: string[];
    chromeAvailable?: boolean;
  };
  services?: Record<string, { url: string; reachable: boolean }>;
  auth?: { insiderCount?: number; keyCount?: number };
  events?: Array<{ name: string; cmd?: string; pattern?: string }>;
  diagrams?: {
    mermaid?: boolean;
    plantuml?: { localJar?: boolean; servers?: string[] };
  };
}

/**
 * Fetch server status and generate a Markdown menu string.
 */
export async function generateServerMenu(apiUrl: string): Promise<string> {
  let status: StatusResponse;

  try {
    status = (await fetchJson(apiUrl + '/api/status', {
      signal: AbortSignal.timeout(5000),
    })) as StatusResponse;
  } catch {
    return `> **ACTION REQUIRED: jeeves-server is unreachable.**
> The server API at ${apiUrl} is down or not configured.
>
> **Troubleshooting:**
> - Check if the JeevesServer service is running
> - Verify the apiUrl in plugins.entries.jeeves-server-openclaw.config
> - Try: \`jeeves-server service start\``;
  }

  const lines: string[] = [
    `jeeves-server v${status.version ?? 'unknown'} running on port ${String(status.port ?? 'unknown')}.`,
    '',
  ];

  // Export capabilities
  if (status.exports) {
    lines.push('### Export');
    if (status.exports.documents) {
      lines.push(
        '* **Documents** (Markdown/HTML): ' +
          status.exports.documents.join(', '),
      );
      if (!status.exports.chromeAvailable) {
        lines.push('  > Chrome not detected \u2014 PDF export unavailable.');
      }
    }
    if (status.exports.directories) {
      lines.push('* **Directories**: ' + status.exports.directories.join(', '));
    }
    if (status.exports.diagrams) {
      lines.push('* **Diagrams**: ' + status.exports.diagrams.join(', '));
    }
    lines.push('* **All files**: raw download');
    lines.push(
      'Use `server_link_info` to check available formats for a specific path.',
    );
    lines.push('');
  }

  // Diagram support
  if (status.diagrams) {
    const langs: string[] = [];
    if (status.diagrams.mermaid) langs.push('Mermaid');
    if (status.diagrams.plantuml) {
      const pl = status.diagrams.plantuml;
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

  // Connected services
  if (status.services) {
    lines.push('### Connected Services');
    for (const [name, svc] of Object.entries(status.services)) {
      const icon = svc.reachable ? '\u2705' : '\u274c';
      lines.push(`* ${icon} **${name}**: ${svc.url}`);
    }
    lines.push('');
  }

  // Event gateway
  if (status.events && status.events.length > 0) {
    lines.push('### Event Gateway');
    lines.push('Active schemas:');
    for (const evt of status.events) {
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
  if (status.auth?.insiderCount !== undefined) {
    lines.push('### Access');
    lines.push(String(status.auth.insiderCount) + ' insider(s) configured.');
    lines.push('');
  }

  // Sharing guidance
  lines.push('### Sharing');
  lines.push(
    'Use `server_share` to generate links. Insiders authenticate via Google; outsiders use HMAC share links.',
  );
  lines.push(
    'Use `server_link_info` to check available export formats for a path before exporting.',
  );

  return lines.join('\n');
}

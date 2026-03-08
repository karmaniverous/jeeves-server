/**
 * Generates the Server menu string for TOOLS.md injection.
 */

import { fetchJson } from './helpers.js';

interface StatusResponse {
  version?: string;
  uptime?: number;
  port?: number;
  chrome?: boolean;
  exportFormats?: string[];
  services?: Record<string, { url: string; reachable: boolean }>;
  insiderCount?: number;
  events?: Array<{ name: string; pattern?: string }>;
  diagrams?: string[];
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

  // Export formats
  if (status.exportFormats && status.exportFormats.length > 0) {
    lines.push('### Export Formats');
    lines.push('Available: ' + status.exportFormats.join(', '));
    if (!status.chrome) {
      lines.push('> **Note:** Chrome not detected — PDF export unavailable.');
    }
    lines.push('');
  }

  // Diagram support
  if (status.diagrams && status.diagrams.length > 0) {
    lines.push('### Diagram Support');
    lines.push('Supported languages: ' + status.diagrams.join(', '));
    lines.push('');
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

  // Insider count
  if (status.insiderCount !== undefined) {
    lines.push('### Access');
    lines.push(String(status.insiderCount) + ' insider(s) configured.');
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

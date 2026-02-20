/**
 * PlantUML rendering via the PlantUML community server.
 *
 * Encodes diagram source into a URL and fetches the rendered SVG.
 * No local Java dependency required.
 */

import plantumlEncoder from 'plantuml-encoder';

const PLANTUML_SERVER = 'https://www.plantuml.com/plantuml';

/**
 * Encode PlantUML source into a server URL for the given format.
 */
export function plantumlUrl(source: string, format: 'svg' | 'png' = 'svg'): string {
  const encoded = plantumlEncoder.encode(source);
  return `${PLANTUML_SERVER}/${format}/${encoded}`;
}

/**
 * Render PlantUML source to SVG via the community server.
 * Returns the SVG string, or null on failure.
 */
export async function renderPlantUml(source: string): Promise<string | null> {
  try {
    const url = plantumlUrl(source, 'svg');
    const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

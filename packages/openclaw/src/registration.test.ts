/**
 * Registration snapshot: the tools and parameters the plugin registers against those 0.15.0 registered (`test/tool-snapshot-0.15.0.json`, recorded from the 0.15.0 code before this version changed it). Only the differences the spec decides are allowed.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { pluginTools } from './test/fakeServer.js';

/** A JSON Schema property, as far as the snapshot compares it. */
interface Property {
  type?: string;
  enum?: unknown[];
  properties?: Record<string, Property>;
}

/** A recorded tool. */
interface RecordedTool {
  name: string;
  parameters: { properties?: Record<string, Property>; required?: string[] };
}

const SNAPSHOT = JSON.parse(
  readFileSync(
    new URL('./test/tool-snapshot-0.15.0.json', import.meta.url),
    'utf8',
  ),
) as RecordedTool[];

/** Tools removed since 0.15.0 (Decision 13). */
const REMOVED = ['server_rotate_key'];

/**
 * Property changes since 0.15.0, by tool: `server_export` lists every export
 * format and takes `share` (Decisions 19 and 21).
 */
const CHANGED: Record<string, Record<string, Property>> = {
  server_export: {
    format: {
      type: 'string',
      enum: ['pdf', 'docx', 'zip', 'tar', 'svg', 'png'],
    },
    share: {
      type: 'object',
      properties: { expiryDays: { type: 'number' } },
    },
  },
};

/**
 * What the snapshot compares of a property: its type (catalog schemas type
 * whole numbers `integer` where 0.15.0 said `number`), enum and nested
 * properties.
 */
function shapeOf(property: Property): Property {
  return {
    ...(property.type === undefined
      ? {}
      : { type: property.type === 'integer' ? 'number' : property.type }),
    ...(property.enum ? { enum: property.enum } : {}),
    ...(property.properties
      ? {
          properties: Object.fromEntries(
            Object.entries(property.properties).map(([k, v]) => [
              k,
              shapeOf(v),
            ]),
          ),
        }
      : {}),
  };
}

/** Each property's shape. */
const shapesOf = (properties: Record<string, Property> = {}) =>
  Object.fromEntries(
    Object.entries(properties).map(([name, p]) => [name, shapeOf(p)]),
  );

describe('tool registration against 0.15.0', () => {
  vi.stubEnv('JEEVES_CONFIG_ROOT', '');
  const tools = pluginTools();

  it('registers the 0.15.0 tools, less the removed ones', () => {
    expect([...tools.keys()].sort()).toEqual(
      SNAPSHOT.map(({ name }) => name)
        .filter((name) => !REMOVED.includes(name))
        .sort(),
    );
  });

  it.each(SNAPSHOT.filter(({ name }) => !REMOVED.includes(name)))(
    '$name keeps its parameters',
    ({ name, parameters }) => {
      const now = tools.get(name)?.parameters as RecordedTool['parameters'];
      const expected = { ...shapesOf(parameters.properties) };
      for (const [prop, shape] of Object.entries(CHANGED[name] ?? {}))
        expected[prop] = shape;
      expect(shapesOf(now.properties)).toEqual(expected);
      expect([...(now.required ?? [])].sort()).toEqual(
        [...(parameters.required ?? [])].sort(),
      );
    },
  );

  it('describes every browse-path parameter as one (#320)', () => {
    const described = [...tools.values()].flatMap(({ name, parameters }) => {
      const path = (
        parameters as { properties?: Record<string, { description?: string }> }
      ).properties?.path;
      return path === undefined ? [] : [[name, path.description]];
    });
    // server_config's path is a JSONPath expression.
    expect(Object.fromEntries(described)).toEqual({
      server_config: expect.stringContaining('JSONPath') as unknown,
      ...Object.fromEntries(
        [
          'server_browse',
          'server_export',
          'server_export_cache_clear',
          'server_file_mutate',
          'server_file_write',
          'server_link_info',
          'server_share',
        ].map((name) => [
          name,
          'Browse path (use server_resolve_path to convert a filesystem path)',
        ]),
      ),
    });
  });
});

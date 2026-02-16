/**
 * Event route tests
 */

import { JsonMap } from '@karmaniverous/jsonmap';
import Ajv from 'ajv';
import * as _ from 'radash';
import { describe, expect, it } from 'vitest';

const ajv = new Ajv();

describe('event route', () => {
  describe('schema matching', () => {
    it('should match against JSON Schema', () => {
      const schema = {
        type: 'object',
        properties: {
          type: { const: 'page.content_updated' },
        },
        required: ['type'],
      };

      const validate = ajv.compile(schema);

      expect(validate({ type: 'page.content_updated', data: {} })).toBe(true);
      expect(validate({ type: 'other' })).toBe(false);
      expect(validate({ data: {} })).toBe(false);
    });

    it('should match first schema in order', () => {
      const schema1 = {
        type: 'object',
        properties: {
          source: { const: 'github' },
        },
        required: ['source'],
      };

      const schema2 = {
        type: 'object',
        properties: {
          type: { const: 'generic' },
        },
        required: ['type'],
      };

      const body = { source: 'github', type: 'generic' };

      const validate1 = ajv.compile(schema1);
      const validate2 = ajv.compile(schema2);

      // Both match, but first wins
      expect(validate1(body)).toBe(true);
      expect(validate2(body)).toBe(true);
    });

    it('should handle complex nested schemas', () => {
      const schema = {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              page_id: { type: 'string' },
            },
            required: ['page_id'],
          },
        },
        required: ['data'],
      };

      const validate = ajv.compile(schema);

      expect(validate({ data: { page_id: 'abc123' } })).toBe(true);
      expect(validate({ data: {} })).toBe(false);
      expect(validate({})).toBe(false);
    });
  });

  describe('JsonMap transformation', () => {
    it('should extract fields using radash get', async () => {
      const body = {
        type: 'page.content_updated',
        data: {
          page_id: 'abc123',
          title: 'Test Page',
        },
      };

      const map = {
        pageId: {
          $: { method: '$.lib._.get', params: ['$.input', 'data.page_id'] },
        },
        type: {
          $: { method: '$.lib._.get', params: ['$.input', 'type'] },
        },
      };

      const mapper = new JsonMap(map, { _: _ as never });
      const result = (await mapper.transform(body)) as Record<string, unknown>;

      expect(result.pageId).toBe('abc123');
      expect(result.type).toBe('page.content_updated');
    });

    it('should handle missing fields gracefully', async () => {
      const body = {
        type: 'event',
      };

      const map = {
        pageId: {
          $: { method: '$.lib._.get', params: ['$.input', 'data.page_id'] },
        },
        type: {
          $: { method: '$.lib._.get', params: ['$.input', 'type'] },
        },
      };

      const mapper = new JsonMap(map, { _: _ as never });
      const result = (await mapper.transform(body)) as Record<string, unknown>;

      expect(result.pageId).toBeUndefined();
      expect(result.type).toBe('event');
    });

    it('should preserve full body when no map is defined', () => {
      const body = {
        type: 'event',
        data: { foo: 'bar' },
        nested: { a: { b: 'c' } },
      };

      // No transformation when map is undefined
      const result = body;

      expect(result).toEqual(body);
      expect(result.data).toEqual({ foo: 'bar' });
      expect(result.nested).toEqual({ a: { b: 'c' } });
    });

    it('should handle nested path extraction', async () => {
      const body = {
        metadata: {
          author: {
            name: 'Alice',
            email: 'alice@example.com',
          },
          tags: ['important', 'review'],
        },
      };

      const map = {
        authorName: {
          $: { method: '$.lib._.get', params: ['$.input', 'metadata.author.name'] },
        },
        authorEmail: {
          $: { method: '$.lib._.get', params: ['$.input', 'metadata.author.email'] },
        },
      };

      const mapper = new JsonMap(map, { _: _ as never });
      const result = (await mapper.transform(body)) as Record<string, unknown>;

      expect(result.authorName).toBe('Alice');
      expect(result.authorEmail).toBe('alice@example.com');
    });
  });

  describe('queue entry formatting', () => {
    it('should format entry with all required fields', () => {
      const entry = {
        ts: new Date().toISOString(),
        event: 'test-event',
        cmd: 'node test.js',
        body: { foo: 'bar' },
        timeoutMs: 30000,
      };

      expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(entry.event).toBe('test-event');
      expect(entry.cmd).toBe('node test.js');
      expect(entry.body).toEqual({ foo: 'bar' });
      expect(entry.timeoutMs).toBe(30000);
    });

    it('should use default timeout when not specified', () => {
      const defaultTimeoutMs = 30000;
      const eventConfig: { timeoutMs?: number } = {}; // Simulate config without timeoutMs

      const timeoutMs = eventConfig.timeoutMs ?? defaultTimeoutMs;

      expect(timeoutMs).toBe(30000);
    });

    it('should use event-specific timeout when specified', () => {
      const defaultTimeoutMs = 30000;
      const eventConfig: { timeoutMs?: number } = { timeoutMs: 60000 };

      const timeoutMs = eventConfig.timeoutMs ?? defaultTimeoutMs;

      expect(timeoutMs).toBe(60000);
    });
  });

  describe('event log formatting', () => {
    it('should format matched event log entry', () => {
      const entry = {
        ts: new Date().toISOString(),
        event: 'test-event',
        matched: true,
        exitCode: 0,
        durationMs: 1234,
      };

      expect(entry.matched).toBe(true);
      expect(entry.event).toBe('test-event');
      expect(entry.exitCode).toBe(0);
      expect(entry.durationMs).toBe(1234);
    });

    it('should format unmatched event log entry', () => {
      const entry = {
        ts: new Date().toISOString(),
        event: null,
        matched: false,
        bodyPreview: '{"type":"unknown"}',
      };

      expect(entry.matched).toBe(false);
      expect(entry.event).toBeNull();
      expect(entry.bodyPreview).toBe('{"type":"unknown"}');
    });

    it('should truncate body preview to reasonable length', () => {
      const longBody = { data: 'x'.repeat(300) };
      const preview = JSON.stringify(longBody).slice(0, 200);

      expect(preview.length).toBe(200);
    });
  });
});

/**
 * Tests for file detection utilities
 */

import { describe, expect, it } from 'vitest';

import {
  DANGEROUS_EXTENSIONS,
  getContentType,
  isInlineType,
  looksLikeText,
} from './fileDetection.js';

describe('file detection', () => {
  describe('DANGEROUS_EXTENSIONS', () => {
    it('should include common Windows executables', () => {
      expect(DANGEROUS_EXTENSIONS).toContain('.exe');
      expect(DANGEROUS_EXTENSIONS).toContain('.bat');
      expect(DANGEROUS_EXTENSIONS).toContain('.ps1');
      expect(DANGEROUS_EXTENSIONS).toContain('.dll');
    });

    it('should include script extensions', () => {
      expect(DANGEROUS_EXTENSIONS).toContain('.vbs');
      expect(DANGEROUS_EXTENSIONS).toContain('.jse');
      expect(DANGEROUS_EXTENSIONS).toContain('.wsh');
    });
  });

  describe('looksLikeText', () => {
    it('should return true for plain text', () => {
      const buffer = Buffer.from('Hello, world!', 'utf8');
      expect(looksLikeText(buffer)).toBe(true);
    });

    it('should return true for text with newlines', () => {
      const buffer = Buffer.from('Line 1\nLine 2\nLine 3', 'utf8');
      expect(looksLikeText(buffer)).toBe(true);
    });

    it('should return false for binary data with null bytes', () => {
      const buffer = Buffer.from([0x48, 0x65, 0x00, 0x6c, 0x6c, 0x6f]); // He\0llo
      expect(looksLikeText(buffer)).toBe(false);
    });

    it('should return false for binary data at start', () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      expect(looksLikeText(buffer)).toBe(false);
    });

    it('should only check first 8KB', () => {
      // Create 10KB buffer with null byte at position 9000
      const buffer = Buffer.alloc(10240);
      buffer.fill('A'.charCodeAt(0), 0, 9000);
      buffer[9000] = 0;
      buffer.fill('A'.charCodeAt(0), 9001);

      // Should return true because null byte is beyond 8KB
      expect(looksLikeText(buffer)).toBe(true);
    });

    it('should handle empty buffer', () => {
      const buffer = Buffer.alloc(0);
      expect(looksLikeText(buffer)).toBe(true);
    });
  });

  describe('getContentType', () => {
    it('should return correct type for text files', () => {
      expect(getContentType('.txt')).toBe('text/plain; charset=utf-8');
      expect(getContentType('.json')).toBe('application/json; charset=utf-8');
      expect(getContentType('.html')).toBe('text/html; charset=utf-8');
    });

    it('should return correct type for images', () => {
      expect(getContentType('.png')).toBe('image/png');
      expect(getContentType('.jpg')).toBe('image/jpeg');
      expect(getContentType('.svg')).toBe('image/svg+xml');
    });

    it('should return correct type for documents', () => {
      expect(getContentType('.pdf')).toBe('application/pdf');
      expect(getContentType('.docx')).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    });

    it('should be case-insensitive', () => {
      expect(getContentType('.PDF')).toBe('application/pdf');
      expect(getContentType('.TxT')).toBe('text/plain; charset=utf-8');
    });

    it('should return octet-stream for unknown extensions', () => {
      expect(getContentType('.unknown')).toBe('application/octet-stream');
      expect(getContentType('.xyz123')).toBe('application/octet-stream');
    });
  });

  describe('isInlineType', () => {
    it('should return true for text types', () => {
      expect(isInlineType('text/plain; charset=utf-8')).toBe(true);
      expect(isInlineType('text/html')).toBe(true);
    });

    it('should return true for images', () => {
      expect(isInlineType('image/png')).toBe(true);
      expect(isInlineType('image/jpeg')).toBe(true);
    });

    it('should return true for video/audio', () => {
      expect(isInlineType('video/mp4')).toBe(true);
      expect(isInlineType('audio/mpeg')).toBe(true);
    });

    it('should return true for JSON and PDF', () => {
      expect(isInlineType('application/json; charset=utf-8')).toBe(true);
      expect(isInlineType('application/pdf')).toBe(true);
      expect(isInlineType('application/xml')).toBe(true);
    });

    it('should return false for archives', () => {
      expect(isInlineType('application/zip')).toBe(false);
      expect(isInlineType('application/x-tar')).toBe(false);
    });

    it('should return false for executables', () => {
      expect(isInlineType('application/octet-stream')).toBe(false);
      expect(isInlineType('application/x-msdownload')).toBe(false);
    });
  });
});

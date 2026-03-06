/**
 * Tests for formatting utilities
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { formatRelativeTime, formatSize, nowIso } from './formatters.js';

describe('formatters', () => {
  describe('formatSize', () => {
    it('should format 0 bytes', () => {
      expect(formatSize(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatSize(500)).toBe('500 B');
      expect(formatSize(1023)).toBe('1023 B');
    });

    it('should format kilobytes', () => {
      expect(formatSize(1024)).toBe('1.0 KB');
      expect(formatSize(1536)).toBe('1.5 KB');
      expect(formatSize(10240)).toBe('10.0 KB');
    });

    it('should format megabytes', () => {
      expect(formatSize(1048576)).toBe('1.0 MB');
      expect(formatSize(1572864)).toBe('1.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatSize(1073741824)).toBe('1.0 GB');
      expect(formatSize(2147483648)).toBe('2.0 GB');
    });

    it('should format terabytes', () => {
      expect(formatSize(1099511627776)).toBe('1.0 TB');
    });
  });

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-15T12:00:00Z'));
    });

    it('should return null for null input', () => {
      expect(formatRelativeTime(null)).toBeNull();
    });

    it('should return null for future timestamps', () => {
      const future = new Date('2026-02-15T13:00:00Z').toISOString();
      expect(formatRelativeTime(future)).toBeNull();
    });

    it('should return "just now" for very recent timestamps', () => {
      const recent = new Date('2026-02-15T11:59:30Z').toISOString();
      expect(formatRelativeTime(recent)).toBe('just now');
    });

    it('should return minutes ago', () => {
      const mins5 = new Date('2026-02-15T11:55:00Z').toISOString();
      expect(formatRelativeTime(mins5)).toBe('5m ago');

      const mins45 = new Date('2026-02-15T11:15:00Z').toISOString();
      expect(formatRelativeTime(mins45)).toBe('45m ago');
    });

    it('should return hours ago', () => {
      const hours2 = new Date('2026-02-15T10:00:00Z').toISOString();
      expect(formatRelativeTime(hours2)).toBe('2h ago');

      const hours12 = new Date('2026-02-15T00:00:00Z').toISOString();
      expect(formatRelativeTime(hours12)).toBe('12h ago');
    });

    it('should return days ago', () => {
      const days1 = new Date('2026-02-14T12:00:00Z').toISOString();
      expect(formatRelativeTime(days1)).toBe('1d ago');

      const days7 = new Date('2026-02-08T12:00:00Z').toISOString();
      expect(formatRelativeTime(days7)).toBe('7d ago');
    });

    it('should prioritize days over hours', () => {
      const days1Hours5 = new Date('2026-02-14T07:00:00Z').toISOString();
      expect(formatRelativeTime(days1Hours5)).toBe('1d ago');
    });
  });

  describe('nowIso', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-15T12:34:56.789Z'));
    });

    it('should return current time in ISO format', () => {
      expect(nowIso()).toBe('2026-02-15T12:34:56.789Z');
    });

    it('should match ISO 8601 format', () => {
      expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});

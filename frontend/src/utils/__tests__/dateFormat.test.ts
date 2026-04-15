import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatRelativeTime, formatAbsoluteTime, formatDate, formatTime } from '../dateFormat';

describe('dateFormat', () => {
  describe('formatRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns "just now" for times less than 60 seconds ago', () => {
      const date = new Date('2025-06-15T11:59:30Z');
      expect(formatRelativeTime(date)).toBe('just now');
    });

    it('returns minutes ago for times less than 60 minutes', () => {
      const date = new Date('2025-06-15T11:55:00Z');
      expect(formatRelativeTime(date)).toBe('5 minutes ago');
    });

    it('returns "1 minute ago" for singular', () => {
      const date = new Date('2025-06-15T11:59:00Z');
      expect(formatRelativeTime(date)).toBe('1 minute ago');
    });

    it('returns hours ago for times less than 24 hours', () => {
      const date = new Date('2025-06-15T09:00:00Z');
      expect(formatRelativeTime(date)).toBe('3 hours ago');
    });

    it('returns "1 hour ago" for singular', () => {
      const date = new Date('2025-06-15T11:00:00Z');
      expect(formatRelativeTime(date)).toBe('1 hour ago');
    });

    it('returns "yesterday" for 1 day ago', () => {
      const date = new Date('2025-06-14T12:00:00Z');
      expect(formatRelativeTime(date)).toBe('yesterday');
    });

    it('returns days ago for times less than 7 days', () => {
      const date = new Date('2025-06-12T12:00:00Z');
      expect(formatRelativeTime(date)).toBe('3 days ago');
    });

    it('returns weeks ago for times less than 4 weeks', () => {
      const date = new Date('2025-06-01T12:00:00Z');
      expect(formatRelativeTime(date)).toBe('2 weeks ago');
    });

    it('returns "1 week ago" for singular', () => {
      const date = new Date('2025-06-08T12:00:00Z');
      expect(formatRelativeTime(date)).toBe('1 week ago');
    });

    it('returns months ago for times less than 12 months', () => {
      const date = new Date('2025-03-15T12:00:00Z');
      expect(formatRelativeTime(date)).toBe('3 months ago');
    });

    it('returns years ago for very old dates', () => {
      const date = new Date('2023-06-15T12:00:00Z');
      expect(formatRelativeTime(date)).toBe('2 years ago');
    });

    it('accepts string dates', () => {
      expect(formatRelativeTime('2025-06-15T11:59:30Z')).toBe('just now');
    });
  });

  describe('formatAbsoluteTime', () => {
    it('formats a date as localized string', () => {
      const date = new Date('2025-01-15T14:30:00Z');
      const result = formatAbsoluteTime(date);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('accepts string dates', () => {
      const result = formatAbsoluteTime('2025-01-15T14:30:00Z');
      expect(result).toBeTruthy();
    });
  });

  describe('formatDate', () => {
    it('formats a date without time', () => {
      const date = new Date('2025-01-15T14:30:00Z');
      const result = formatDate(date);
      expect(result).toBeTruthy();
      // Should contain year
      expect(result).toContain('2025');
    });

    it('accepts string dates', () => {
      const result = formatDate('2025-06-01');
      expect(result).toBeTruthy();
    });
  });

  describe('formatTime', () => {
    it('formats time only', () => {
      const date = new Date('2025-01-15T14:30:00Z');
      const result = formatTime(date);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('accepts string dates', () => {
      const result = formatTime('2025-01-15T14:30:00Z');
      expect(result).toBeTruthy();
    });
  });
});

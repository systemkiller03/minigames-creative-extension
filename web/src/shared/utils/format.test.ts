import { describe, expect, it } from 'vitest';
import { formatCount, formatRelativeTime } from './format';

describe('formatCount', () => {
  it('keeps small numbers as is', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
  });
  it('abbreviates thousands and millions', () => {
    expect(formatCount(1000)).toBe('1K');
    expect(formatCount(28_700)).toBe('28.7K');
    expect(formatCount(1_500_000)).toBe('1.5M');
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-01-10T12:00:00Z');
  it('returns empty string for missing or invalid input', () => {
    expect(formatRelativeTime(undefined, now)).toBe('');
    expect(formatRelativeTime('nope', now)).toBe('');
  });
  it('returns just now for very recent dates', () => {
    expect(formatRelativeTime('2026-01-10T11:59:50Z', now)).toBe('just now');
  });
  it('formats each unit', () => {
    expect(formatRelativeTime('2026-01-10T11:58:00Z', now)).toBe('2 minutes ago');
    expect(formatRelativeTime('2026-01-10T09:00:00Z', now)).toBe('3 hours ago');
    expect(formatRelativeTime('2026-01-08T12:00:00Z', now)).toBe('2 days ago');
    expect(formatRelativeTime('2025-12-20T12:00:00Z', now)).toBe('3 weeks ago');
    expect(formatRelativeTime('2025-10-10T12:00:00Z', now)).toBe('3 months ago');
    expect(formatRelativeTime('2023-12-01T12:00:00Z', now)).toBe('2 years ago');
  });
});

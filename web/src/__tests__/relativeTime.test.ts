import { describe, expect, it } from 'vitest';
import { relativeTime } from '../lib/relativeTime';

const NOW = 1_700_000_000_000;

describe('relativeTime', () => {
  it('shows just now under a minute (en)', () => {
    expect(relativeTime(NOW - 30_000, NOW, 'en')).toBe('just now');
  });

  it('shows minutes (en)', () => {
    expect(relativeTime(NOW - 5 * 60_000, NOW, 'en')).toBe('5 min ago');
  });

  it('shows hours (en)', () => {
    expect(relativeTime(NOW - 3 * 3_600_000, NOW, 'en')).toBe('3 h ago');
  });

  it('shows days within a week (en)', () => {
    expect(relativeTime(NOW - 2 * 86_400_000, NOW, 'en')).toBe('2 d ago');
  });

  it('localises to zh', () => {
    expect(relativeTime(NOW - 5 * 60_000, NOW, 'zh')).toBe('5 分钟前');
  });

  it('localises to fr', () => {
    expect(relativeTime(NOW - 3 * 3_600_000, NOW, 'fr')).toBe('il y a 3 h');
  });

  it('falls back to locale date after 7 days', () => {
    const stamp = NOW - 8 * 86_400_000;
    expect(relativeTime(stamp, NOW, 'en')).toBe(new Date(stamp).toLocaleDateString());
  });

  it('never goes negative', () => {
    expect(relativeTime(NOW + 5_000, NOW, 'en')).toBe('just now');
  });
});
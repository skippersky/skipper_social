import { describe, expect, it } from 'vitest';
import { relativeTime } from '../lib/relativeTime';

const NOW = 1_700_000_000_000;

describe('relativeTime', () => {
  it('shows just now under a minute', () => {
    expect(relativeTime(NOW - 30_000, NOW)).toBe('刚刚');
  });

  it('shows minutes', () => {
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe('5 分钟前');
  });

  it('shows hours', () => {
    expect(relativeTime(NOW - 3 * 3_600_000, NOW)).toBe('3 小时前');
  });

  it('shows days within a week', () => {
    expect(relativeTime(NOW - 2 * 86_400_000, NOW)).toBe('2 天前');
  });

  it('falls back to locale date after 7 days', () => {
    const stamp = NOW - 8 * 86_400_000;
    expect(relativeTime(stamp, NOW)).toBe(new Date(stamp).toLocaleDateString());
  });

  it('never goes negative', () => {
    expect(relativeTime(NOW + 5_000, NOW)).toBe('刚刚');
  });
});
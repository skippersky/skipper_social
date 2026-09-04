import { describe, expect, it } from 'vitest';
import { dayLabel, groupMessages, TIMESTAMP_GAP_MS } from '../composables/messageGrouping';
import type { Message } from '../types';

function message(overrides: Partial<Message>): Message {
  return {
    id: overrides.id ?? 'm-1',
    conversationId: 'c-1',
    content: 'hello',
    type: 'text',
    sender: 'contact',
    timestamp: Date.now(),
    status: 'read',
    ...overrides
  };
}

const DAY = 24 * 60 * 60 * 1000;

describe('dayLabel', () => {
  it('labels today and yesterday per locale', () => {
    const now = Date.now();
    expect(dayLabel(now, 'en')).toBe('Today');
    expect(dayLabel(now - DAY, 'en')).toBe('Yesterday');
    expect(dayLabel(now, 'zh')).toBe('\u4eca\u5929');
    expect(dayLabel(now - DAY, 'zh')).toBe('\u6628\u5929');
    expect(dayLabel(now, 'fr')).toBe('Aujourd\u2019hui');
    expect(dayLabel(now - DAY, 'fr')).toBe('Hier');
  });

  it('formats older dates with the locale calendar', () => {
    const old = new Date(2026, 0, 15).getTime();
    expect(dayLabel(old, 'en')).toContain('Jan');
    expect(dayLabel(old, 'zh')).toContain('2026');
    expect(dayLabel(old, 'fr')).toContain('janv');
  });
});

describe('groupMessages', () => {
  it('returns an empty list for no messages', () => {
    expect(groupMessages([])).toEqual([]);
  });

  it('adds a day separator and first timestamp', () => {
    const items = groupMessages([message({ id: 'a' })]);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ kind: 'day', label: 'Today' });
    expect(items[1]).toMatchObject({ kind: 'message', showTimestamp: true });
  });

  it('suppresses timestamps inside the five minute window', () => {
    const base = Date.now();
    const items = groupMessages([
      message({ id: 'a', timestamp: base }),
      message({ id: 'b', timestamp: base + TIMESTAMP_GAP_MS - 1000 })
    ]);
    const messages = items.filter((i) => i.kind === 'message');

    expect(items.filter((i) => i.kind === 'day')).toHaveLength(1);
    expect(messages[1].showTimestamp).toBe(false);
  });

  it('shows a timestamp after a gap larger than five minutes', () => {
    const base = Date.now();
    const items = groupMessages([
      message({ id: 'a', timestamp: base }),
      message({ id: 'b', timestamp: base + TIMESTAMP_GAP_MS + 1000 })
    ]);

    expect(items.filter((i) => i.kind === 'message')[1].showTimestamp).toBe(true);
  });

  it('inserts a new day separator when the date changes', () => {
    const base = Date.now();
    const items = groupMessages([
      message({ id: 'a', timestamp: base }),
      message({ id: 'b', timestamp: base - 2 * DAY })
    ]);

    expect(items.filter((i) => i.kind === 'day')).toHaveLength(2);
  });
});
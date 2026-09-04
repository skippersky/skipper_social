import type { Message } from '../types';

export const TIMESTAMP_GAP_MS = 5 * 60_000;

export interface MessageListItem {
  kind: 'day' | 'message';
  key: string;
  /** Localised day label for `day` items. */
  label?: string;
  message?: Message;
  /** Show the inline timestamp when the gap to the previous message > 5 min. */
  showTimestamp?: boolean;
}

export function dayLabel(timestamp: number, locale: string): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  if (date.toDateString() === today.toDateString()) {
    return locale === 'zh' ? '今天' : locale === 'fr' ? 'Aujourd’hui' : 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return locale === 'zh' ? '昨天' : locale === 'fr' ? 'Hier' : 'Yesterday';
  }
  const lang = locale === 'zh' ? 'zh-CN' : locale === 'fr' ? 'fr-FR' : 'en-US';
  return date.toLocaleDateString(lang, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Groups a chronological message list into day separators + bubbles. */
export function groupMessages(messages: Message[], locale = 'en'): MessageListItem[] {
  const items: MessageListItem[] = [];
  let previous: Message | null = null;
  for (const message of messages) {
    const newDay =
      !previous || new Date(previous.timestamp).toDateString() !== new Date(message.timestamp).toDateString();
    if (newDay) {
      items.push({ kind: 'day', key: `day-${message.id}`, label: dayLabel(message.timestamp, locale) });
    }
    items.push({
      kind: 'message',
      key: message.id,
      message,
      showTimestamp: !previous || message.timestamp - previous.timestamp > TIMESTAMP_GAP_MS
    });
    previous = message;
  }
  return items;
}
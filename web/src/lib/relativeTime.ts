import { messages, type UiLocale } from '../i18n/messages';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Formats a timestamp as a short relative time for conversation lists,
 * localised via the i18n dictionaries (en / zh / fr).
 */
export function relativeTime(timestamp: number, now: number = Date.now(), locale: UiLocale = 'en'): string {
  const table = messages[locale];
  const diff = Math.max(0, now - timestamp);
  if (diff < MINUTE) {
    return table['time.now'];
  }
  if (diff < HOUR) {
    return table['time.min'].replace('{n}', String(Math.floor(diff / MINUTE)));
  }
  if (diff < DAY) {
    return table['time.hour'].replace('{n}', String(Math.floor(diff / HOUR)));
  }
  if (diff < 7 * DAY) {
    return table['time.day'].replace('{n}', String(Math.floor(diff / DAY)));
  }
  return new Date(timestamp).toLocaleDateString();
}
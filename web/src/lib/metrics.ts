import type { UiLocale } from '../i18n/messages';

const LOCALE_TAG: Record<UiLocale, string> = { en: 'en-US', zh: 'zh-CN', fr: 'fr-FR' };

/** Thousands-separated integers using the active UI locale. */
export function formatNumber(value: number, locale: UiLocale): string {
  return value.toLocaleString(LOCALE_TAG[locale] ?? 'en-US');
}

/** Compact human duration: 45s, 12m, 3.5h, 2d. Null renders as an em dash placeholder. */
export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '\u2014';
  const seconds = ms / 1000;
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

/** Signed percentage with one decimal, or a dash when there is no baseline. */
export function formatChange(percent: number | null): string {
  if (percent === null) return '\u2014';
  const rounded = Math.round(percent * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

export function trendDirection(percent: number | null): 'up' | 'down' | 'flat' {
  if (percent === null || percent === 0) return 'flat';
  return percent > 0 ? 'up' : 'down';
}

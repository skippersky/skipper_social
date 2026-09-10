import { computed, ref } from 'vue';
import { presetRange } from '../stores/analytics';
import type { DateRange, DateRangePreset } from '../types';

const DAY_MS = 86_400_000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Guard against absurd custom windows; charts stay readable below this. */
export const MAX_RANGE_DAYS = 366;
export const DATE_RANGE_PRESETS: DateRangePreset[] = ['today', '7d', '30d', 'custom'];

export function toInputValue(ts: number): string {
  const date = new Date(ts);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parses a YYYY-MM-DD input into local midnight; null when malformed. */
export function fromInputValue(value: string): number | null {
  const match = DATE_RE.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
    return null;
  }
  return date.getTime();
}

/** Date window selection: presets plus a validated custom range. */
export function useDateRange(initial?: DateRange) {
  const range = ref<DateRange>(initial ? { ...initial } : presetRange('30d'));
  const customFrom = ref(toInputValue(range.value.from));
  const customTo = ref(toInputValue(range.value.to));
  const customError = ref<string | null>(null);
  const preset = computed<DateRangePreset>(() => range.value.preset);

  function syncInputs(): void {
    customFrom.value = toInputValue(range.value.from);
    customTo.value = toInputValue(range.value.to);
  }

  function setPreset(next: DateRangePreset): void {
    customError.value = null;
    if (next === 'custom') {
      range.value = { ...range.value, preset: 'custom' };
      return;
    }
    range.value = presetRange(next);
    syncInputs();
  }

  function setDateRange(next: DateRange): void {
    range.value = { ...next };
    customError.value = null;
    syncInputs();
  }

  function applyCustom(from = customFrom.value, to = customTo.value): boolean {
    const fromMs = fromInputValue(from);
    const toMs = fromInputValue(to);
    if (fromMs === null || toMs === null) {
      customError.value = 'analytics.rangeInvalid';
      return false;
    }
    if (fromMs > toMs) {
      customError.value = 'analytics.rangeReversed';
      return false;
    }
    if (toMs - fromMs > MAX_RANGE_DAYS * DAY_MS) {
      customError.value = 'analytics.rangeTooLong';
      return false;
    }
    customError.value = null;
    customFrom.value = from;
    customTo.value = to;
    // The end date is inclusive, so the window closes at the last millisecond of that day.
    range.value = { from: fromMs, to: toMs + DAY_MS - 1, preset: 'custom' };
    return true;
  }

  return { range, preset, presets: DATE_RANGE_PRESETS, customFrom, customTo, customError, setPreset, setDateRange, applyCustom };
}

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { messages, UI_LOCALES, type UiLocale } from './messages';

const STORAGE_KEY = 'ks-ui-locale';

export type { UiLocale };

export function detectLocale(): UiLocale {
  if (typeof navigator === 'undefined' || !navigator.language) {
    return 'en';
  }
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('fr')) return 'fr';
  return 'en';
}

function readStored(): UiLocale | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as UiLocale | null;
    return stored && UI_LOCALES.includes(stored) ? stored : null;
  } catch {
    return null;
  }
}

export const useI18nStore = defineStore('i18n', () => {
  const locale = ref<UiLocale>(readStored() ?? detectLocale());

  function setLocale(next: UiLocale): void {
    locale.value = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
  }

  function t(key: string, params?: Record<string, string | number>): string {
    const table = messages[locale.value];
    let text = table[key] ?? messages.en[key] ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replace(`{${name}}`, String(value));
      }
    }
    return text;
  }

  return { locale, setLocale, t };
});
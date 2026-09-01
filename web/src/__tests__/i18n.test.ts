import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { detectLocale, useI18nStore } from '../i18n';

describe('i18n store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('defaults to en in an en browser', () => {
    expect(useI18nStore().locale).toBe('en');
  });

  it('translates and interpolates', () => {
    const i18n = useI18nStore();
    expect(i18n.t('chat.send')).toBe('Send');
    i18n.setLocale('fr');
    expect(i18n.t('time.min', { n: 4 })).toBe('il y a 4 min');
  });

  it('falls back to en then to the key', () => {
    const i18n = useI18nStore();
    i18n.setLocale('zh');
    expect(i18n.t('chat.send')).toBe('发送');
    expect(i18n.t('missing.key')).toBe('missing.key');
  });

  it('persists the locale', () => {
    const i18n = useI18nStore();
    i18n.setLocale('zh');
    expect(localStorage.getItem('ks-ui-locale')).toBe('zh');

    setActivePinia(createPinia());
    expect(useI18nStore().locale).toBe('zh');
  });

  it('detects navigator language', () => {
    const original = Object.getOwnPropertyDescriptor(Navigator.prototype, 'language');
    Object.defineProperty(Navigator.prototype, 'language', { value: 'fr-FR', configurable: true });
    expect(detectLocale()).toBe('fr');
    Object.defineProperty(Navigator.prototype, 'language', { value: 'zh-CN', configurable: true });
    expect(detectLocale()).toBe('zh');
    if (original) {
      Object.defineProperty(Navigator.prototype, 'language', original);
    }
  });
});
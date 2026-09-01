import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { describe, expect, it } from 'vitest';
import LanguageSwitcher from '../components/LanguageSwitcher.vue';
import { useI18nStore } from '../i18n';

describe('LanguageSwitcher', () => {
  it('switches and persists the locale', async () => {
    const pinia = createPinia();
    const wrapper = mount(LanguageSwitcher, { global: { plugins: [pinia] } });
    const i18n = useI18nStore(pinia);

    expect(i18n.locale).toBe('en');
    await wrapper.findAll('button')[1].trigger('click');
    expect(i18n.locale).toBe('zh');
    expect(wrapper.findAll('button')[1].classes()).toContain('lang-switch__option--active');

    await wrapper.findAll('button')[2].trigger('click');
    expect(i18n.locale).toBe('fr');
  });
});
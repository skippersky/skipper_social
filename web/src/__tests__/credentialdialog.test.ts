import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Vant from 'vant';
import CredentialFormDialog from '../components/channel/CredentialFormDialog.vue';

function mountDialog(platform: 'whatsapp' | 'facebook' | 'instagram' | 'tiktok') {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  return mount(CredentialFormDialog, {
    props: { show: true, platform },
    global: { plugins: [createPinia(), Vant] }
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe('CredentialFormDialog', () => {
  it('renders the whatsapp credential fields dynamically', () => {
    const wrapper = mountDialog('whatsapp');

    expect(wrapper.text()).toContain('Connect WhatsApp');
    const inputs = wrapper.findAll('.cred-field input');
    expect(inputs).toHaveLength(3);
    expect(wrapper.text()).toContain('Phone Number ID');
    expect(wrapper.text()).toContain('Access Token');
    expect(wrapper.text()).toContain('Verify Token');
    expect(inputs.filter((i) => i.attributes('type') === 'password')).toHaveLength(2);
    vi.unstubAllGlobals();
  });

  it('renders a different field set per platform', () => {
    const wrapper = mountDialog('tiktok');

    expect(wrapper.text()).toContain('Connect TikTok');
    expect(wrapper.text()).toContain('Client Key');
    expect(wrapper.text()).toContain('Client Secret');
    expect(wrapper.findAll('.cred-field input')).toHaveLength(2);
    vi.unstubAllGlobals();
  });

  it('blocks the submit while required fields are empty', async () => {
    const wrapper = mountDialog('facebook');

    await wrapper.find('.cred-dialog__form').trigger('submit');
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.findAll('.cred-field__error')).toHaveLength(2);
    expect(wrapper.text()).toContain('This field is required');
    vi.unstubAllGlobals();
  });

  it('emits trimmed credentials on submit', async () => {
    const wrapper = mountDialog('facebook');
    const inputs = wrapper.findAll('.cred-field input');
    await inputs[0].setValue('  page-123  ');
    await inputs[1].setValue(' token-abc ');

    await wrapper.find('.cred-dialog__form').trigger('submit');
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('submit')).toEqual([
      [{ page_id: 'page-123', page_access_token: 'token-abc' }]
    ]);
    vi.unstubAllGlobals();
  });

  it('emits the oauth event for the alternative flow', async () => {
    const wrapper = mountDialog('instagram');

    await wrapper.find('.cred-dialog__oauth').trigger('click');

    expect(wrapper.emitted('oauth')).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it('renders nothing while hidden', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const wrapper = mount(CredentialFormDialog, {
      props: { show: false, platform: 'whatsapp' },
      global: { plugins: [createPinia(), Vant] }
    });

    expect(wrapper.find('.cred-dialog').exists()).toBe(false);
    vi.unstubAllGlobals();
  });
});
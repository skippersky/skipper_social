import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import Vant from 'vant';
import { createMemoryHistory, createRouter } from 'vue-router';
import CustomerDetail from '../views/dashboard/customers/detail.vue';

async function mountDetail(id: string) {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/dashboard/customers', component: { template: '<div class="list-stub" />' } },
      { path: '/dashboard/customers/:id', component: CustomerDetail },
      { path: '/dashboard/conversations', component: { template: '<div class="inbox-stub" />' } }
    ]
  });
  await router.push(`/dashboard/customers/${id}`);
  await router.isReady();
  const wrapper = mount(CustomerDetail, { global: { plugins: [createPinia(), router, Vant] } });
  await flushPromises();
  return { wrapper, router };
}

function cardTags(wrapper: Awaited<ReturnType<typeof mountDetail>>['wrapper']) {
  return wrapper
    .findAll('.cust-card__tag')
    .map((node) => node.text().replace(/\u00D7/g, '').replace(/\s+/g, ' ').trim());
}

function statValues(wrapper: Awaited<ReturnType<typeof mountDetail>>['wrapper']) {
  return wrapper.findAll('.cust-stats__value').map((node) => node.text());
}

function dialogButton(wrapper: Awaited<ReturnType<typeof mountDetail>>['wrapper'], label: string) {
  const found = wrapper.findAll('.van-dialog__footer button').find((node) => node.text() === label);
  if (!found) throw new Error('dialog button not found: ' + label);
  return found;
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('CustomerDetail profile', () => {
  it('renders the card, the stats and the linked history', async () => {
    const { wrapper } = await mountDetail('u-1');

    expect(wrapper.find('.cust-card__name').text()).toBe('Amani Juma');
    expect(wrapper.find('.cust-detail__heading').text()).toBe('Customers');
    expect(wrapper.findAll('.cust-card__meta-row dt').map((n) => n.text())).toEqual(['Phone', 'Email', 'Address', 'Notes']);
    expect(cardTags(wrapper)).toEqual(['VIP', 'Wholesale']);

    const values = statValues(wrapper);
    expect(values[0]).toBe('1');
    expect(Number(values[1])).toBeGreaterThan(20);
    expect(wrapper.findAll('.cust-stats__channel').map((n) => n.text())).toEqual(['WhatsApp']);

    expect(wrapper.find('.cust-detail__history-title').text()).toBe('Conversation history');
    expect(wrapper.findAll('.conv-item')).toHaveLength(1);
    expect(wrapper.find('.conv-item__name').text()).toBe('Amani Juma');
  });

  it('shows the quiet state for a customer without conversations', async () => {
    const { wrapper } = await mountDetail('u-8');

    expect(wrapper.find('.cust-card__name').text()).toBe('Daniel Kimaro');
    expect(wrapper.find('.cust-detail__history-empty').text()).toBe('No conversations with this customer yet.');
    expect(statValues(wrapper)[0]).toBe('0');
    expect(wrapper.find('.cust-stats__none').text()).toBe('No contact yet');
    expect(cardTags(wrapper)).toEqual([]);
  });

  it('reports a missing customer and offers the way back', async () => {
    const { wrapper, router } = await mountDetail('ghost');

    expect(wrapper.find('.cust-detail__missing').exists()).toBe(true);
    expect(wrapper.text()).toContain('Customer not found');
    expect(wrapper.find('.cust-card').exists()).toBe(false);

    await wrapper.find('.cust-detail__cta').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/dashboard/customers');
  });

  it('returns to the directory from the header', async () => {
    const { wrapper, router } = await mountDetail('u-1');

    await wrapper.find('.cust-detail__back').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/dashboard/customers');
  });

  it('opens the linked conversation in the inbox', async () => {
    const { wrapper, router } = await mountDetail('u-1');

    await wrapper.find('.conv-item').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/dashboard/conversations');
    expect(router.currentRoute.value.query.open).toBe('i-1');
  });
});

describe('CustomerDetail editing', () => {
  it('saves profile changes from the popup form', async () => {
    const { wrapper } = await mountDetail('u-1');

    await wrapper.findAll('.cust-card__btn')[0].trigger('click');
    await flushPromises();
    expect(wrapper.find('.cust-form__title').text()).toBe('Edit customer');

    const inputs = wrapper.findAll('.cust-form__input');
    expect((inputs[0].element as HTMLInputElement).value).toBe('Amani Juma');
    await inputs[0].setValue('Amani Juma VIP');
    await inputs[3].setValue('Dodoma, TZ');
    await wrapper.find('.cust-form').trigger('submit');
    await flushPromises();

    expect(wrapper.find('.cust-card__name').text()).toBe('Amani Juma VIP');
    expect(wrapper.text()).toContain('Dodoma, TZ');
  });

  it('keeps the form open when validation fails', async () => {
    const { wrapper } = await mountDetail('u-1');

    await wrapper.findAll('.cust-card__btn')[0].trigger('click');
    await flushPromises();
    await wrapper.findAll('.cust-form__input')[0].setValue('   ');
    await wrapper.find('.cust-form').trigger('submit');
    await flushPromises();

    expect(wrapper.find('.cust-form__error').text()).toBe('This field is required');
    expect(wrapper.find('.cust-card__name').text()).toBe('Amani Juma');
  });

  it('cancels the edit popup', async () => {
    const { wrapper } = await mountDetail('u-1');

    await wrapper.findAll('.cust-card__btn')[0].trigger('click');
    await flushPromises();
    await wrapper.find('.cust-form__cancel').trigger('click');
    await flushPromises();

    expect(wrapper.find('.cust-form').isVisible()).toBe(false);
  });
});

describe('CustomerDetail tags', () => {
  it('assigns an unassigned tag and removes it again', async () => {
    const { wrapper } = await mountDetail('u-1');
    expect(cardTags(wrapper)).toEqual(['VIP', 'Wholesale']);

    await wrapper.find('.cust-card__tag-add').trigger('click');
    await flushPromises();
    expect(wrapper.find('.cust-detail__tag-title').text()).toBe('Add tag');
    expect(wrapper.findAll('.cust-detail__tag-option').map((n) => n.text())).toEqual(['New lead', 'Follow-up']);

    await wrapper.findAll('.cust-detail__tag-option')[0].trigger('click');
    await flushPromises();
    expect(cardTags(wrapper)).toEqual(['VIP', 'Wholesale', 'New lead']);

    await wrapper.findAll('.cust-card__tag-x')[2].trigger('click');
    await flushPromises();
    expect(cardTags(wrapper)).toEqual(['VIP', 'Wholesale']);
  });

  it('reports an empty picker when every tag is assigned', async () => {
    const { wrapper } = await mountDetail('u-1');

    await wrapper.find('.cust-card__tag-add').trigger('click');
    await flushPromises();
    await wrapper.findAll('.cust-detail__tag-option')[0].trigger('click');
    await flushPromises();
    await wrapper.findAll('.cust-detail__tag-option')[0].trigger('click');
    await flushPromises();
    await wrapper.find('.cust-card__tag-add').trigger('click');
    await flushPromises();

    expect(cardTags(wrapper)).toEqual(['VIP', 'Wholesale', 'New lead', 'Follow-up']);
    expect(wrapper.find('.cust-detail__tag-empty').text()).toBe('No tags yet');
    expect(wrapper.findAll('.cust-detail__tag-option')).toHaveLength(0);
  });
});

describe('CustomerDetail delete', () => {
  it('deletes the customer and returns to the directory', async () => {
    const { wrapper, router } = await mountDetail('u-1');

    await wrapper.findAll('.cust-card__btn')[1].trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('Delete customer');
    expect(wrapper.find('.cust-detail__confirm-text').text()).toContain('This removes the profile');

    await dialogButton(wrapper, 'Delete').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/dashboard/customers');
    const stored = JSON.parse(localStorage.getItem('ks-demo-customers') ?? '[]') as { id: string }[];
    expect(stored.some((c) => c.id === 'u-1')).toBe(false);
  });

  it('keeps the customer when the dialog is cancelled', async () => {
    const { wrapper, router } = await mountDetail('u-1');

    await wrapper.findAll('.cust-card__btn')[1].trigger('click');
    await flushPromises();
    await dialogButton(wrapper, 'Cancel').trigger('click');
    await flushPromises();

    expect(wrapper.find('.cust-card__name').text()).toBe('Amani Juma');
    expect(router.currentRoute.value.path).toBe('/dashboard/customers/u-1');
  });
});
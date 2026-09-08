import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import Vant from 'vant';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import CustomersView from '../views/dashboard/customers/index.vue';

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, code: 'OK', message: '', data })
  } as Response;
}

/** Backend mode: the customer endpoint answers, the tag endpoint returns an empty catalogue. */
function backendFetch() {
  return vi.fn().mockImplementation((url: unknown) => {
    const data = String(url).includes('/tags')
      ? []
      : {
          customers: [
            { id: 'srv-1', name: 'Real Buyer', tags: [], channels: [], conversationCount: 0, lastContactAt: null, createdAt: 1 }
          ],
          hasMore: false,
          total: 1
        };
    return Promise.resolve(jsonResponse(data));
  });
}

async function mountCustomers(seed: Record<string, string> = {}, fetchMock?: ReturnType<typeof vi.fn>) {
  localStorage.clear();
  for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value);
  vi.stubGlobal('fetch', fetchMock ?? vi.fn().mockRejectedValue(new Error('offline')));
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/home', component: { template: '<div />' } },
      { path: '/dashboard/conversations', component: { template: '<div />' } },
      { path: '/dashboard/customers', component: CustomersView },
      { path: '/dashboard/customers/:id', component: { template: '<div class="detail-stub" />' } }
    ]
  });
  await router.push('/dashboard/customers');
  await router.isReady();
  const wrapper = mount(CustomersView, { global: { plugins: [createPinia(), router, Vant] } });
  await flushPromises();
  return { wrapper, router };
}

function names(wrapper: VueWrapper) {
  return wrapper.findAll('.cust-item__name').map((node) => node.text());
}

function chip(wrapper: VueWrapper, label: string) {
  const found = wrapper.findAll('.customers__chip').find((node) => node.text() === label);
  if (!found) throw new Error('chip not found: ' + label);
  return found;
}

function dialogButton(wrapper: VueWrapper, label: string) {
  const found = wrapper.findAll('.van-dialog__footer button').find((node) => node.text() === label);
  if (!found) throw new Error('dialog button not found: ' + label);
  return found;
}

async function submitForm(wrapper: VueWrapper) {
  await wrapper.find('.cust-form').trigger('submit');
  await flushPromises();
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('CustomersView directory', () => {
  it('lists the demo customers with the total badge and page meta', async () => {
    const { wrapper } = await mountCustomers();

    expect(names(wrapper)).toEqual([
      'Amani Juma',
      'Neema Wanjiru',
      'Grace Adeyemi',
      'Zuri Abebe',
      'Kofi Mensah',
      'Baraka Okonkwo',
      'Daniel Kimaro',
      'Salma Hassan'
    ]);
    expect(wrapper.find('.customers__count').text()).toBe('8');
    expect(wrapper.find('.customers__title').text()).toBe('Customers');
    expect(wrapper.find('.customers__more').exists()).toBe(false);
    expect(wrapper.find('.cust-form').exists()).toBe(false);
    expect(document.title).toBe('Customers - KiliSocial');
  });

  it('navigates home from the back button', async () => {
    const { wrapper, router } = await mountCustomers();

    await wrapper.find('.customers__home').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/home');
  });

  it('searches on submit and filters while typing', async () => {
    const { wrapper } = await mountCustomers();
    const search = wrapper.find('.customers__search-input');

    await search.setValue('amani');
    await search.trigger('input');
    await flushPromises();
    expect(names(wrapper)).toEqual(['Amani Juma']);

    await wrapper.find('.customers__search').trigger('submit');
    await flushPromises();
    expect(names(wrapper)).toEqual(['Amani Juma']);

    await search.setValue('');
    await wrapper.find('.customers__search').trigger('submit');
    await flushPromises();
    expect(names(wrapper)).toHaveLength(8);

    await search.setValue('nobody-here');
    await wrapper.find('.customers__search').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.customers__empty').exists()).toBe(true);
  });

  it('filters by tag and by channel', async () => {
    const { wrapper } = await mountCustomers();

    await chip(wrapper, 'VIP').trigger('click');
    await flushPromises();
    expect(names(wrapper)).toEqual(['Amani Juma']);
    expect(chip(wrapper, 'VIP').classes()).toContain('is-active');

    await chip(wrapper, 'Wholesale').trigger('click');
    await flushPromises();
    expect(names(wrapper)).toEqual(['Amani Juma', 'Salma Hassan']);

    await chip(wrapper, 'All tags').trigger('click');
    await chip(wrapper, 'WhatsApp').trigger('click');
    await flushPromises();
    expect(names(wrapper)).toEqual(['Amani Juma', 'Neema Wanjiru', 'Baraka Okonkwo']);

    await chip(wrapper, 'TikTok').trigger('click');
    await flushPromises();
    expect(names(wrapper)).toEqual(['Kofi Mensah']);

    await chip(wrapper, 'All channels').trigger('click');
    await flushPromises();
    expect(names(wrapper)).toHaveLength(8);
  });

  it('shows the empty state with a create shortcut', async () => {
    const { wrapper } = await mountCustomers({ 'ks-demo-customers': '[]' });

    expect(names(wrapper)).toEqual([]);
    expect(wrapper.find('.customers__empty').text()).toContain('No customers yet');
    expect(wrapper.find('.customers__empty-hint').text()).toContain('Add your first customer');

    await wrapper.find('.customers__empty-cta').trigger('click');
    await flushPromises();
    expect(wrapper.find('.cust-form').exists()).toBe(true);
  });
});

describe('CustomersView sample data disclosure', () => {
  it('flags the demo rows and collapses them once dismissed', async () => {
    const { wrapper } = await mountCustomers();

    expect(wrapper.find('.customers__demo').text()).toContain('Sample data shown below');
    expect(wrapper.find('.customers__demo button').attributes('aria-label')).toBe('Hide sample data');
    expect(names(wrapper)).toHaveLength(8);

    await wrapper.find('.customers__demo button').trigger('click');
    await flushPromises();

    expect(wrapper.find('.customers__demo').exists()).toBe(false);
    expect(names(wrapper)).toHaveLength(0);
    expect(wrapper.find('.customers__empty').exists()).toBe(true);
    expect(localStorage.getItem('ks-customers-demo-hidden')).toBe('1');
  });

  it('stays collapsed on the next visit and still offers the create shortcut', async () => {
    const { wrapper } = await mountCustomers({ 'ks-customers-demo-hidden': '1' });

    expect(wrapper.find('.customers__demo').exists()).toBe(false);
    expect(names(wrapper)).toHaveLength(0);
    expect(wrapper.find('.customers__empty-hint').exists()).toBe(true);

    await wrapper.find('.customers__empty-cta').trigger('click');
    await flushPromises();
    expect(wrapper.find('.cust-form').isVisible()).toBe(true);
  });

  it('drops the disclosure when a search returns no rows', async () => {
    const { wrapper } = await mountCustomers();
    const search = wrapper.find('.customers__search-input');

    await search.setValue('nobody-here');
    await wrapper.find('.customers__search').trigger('submit');
    await flushPromises();

    expect(names(wrapper)).toHaveLength(0);
    expect(wrapper.find('.customers__demo').exists()).toBe(false);
    expect(wrapper.find('.customers__empty').exists()).toBe(true);

    await search.setValue('');
    await wrapper.find('.customers__search').trigger('submit');
    await flushPromises();

    expect(names(wrapper)).toHaveLength(8);
    expect(wrapper.find('.customers__demo').exists()).toBe(true);
  });

  it('shows no disclosure when the backend answers', async () => {
    const { wrapper } = await mountCustomers({}, backendFetch());

    expect(names(wrapper)).toEqual(['Real Buyer']);
    expect(wrapper.find('.customers__demo').exists()).toBe(false);
    expect(wrapper.find('.customers__count').text()).toBe('1');
  });
});

describe('CustomersView create and edit', () => {
  it('creates a customer from the popup form', async () => {
    const { wrapper } = await mountCustomers();

    await wrapper.findAll('.customers__btn')[1].trigger('click');
    await flushPromises();
    expect(wrapper.find('.cust-form__title').text()).toBe('New customer');

    const inputs = wrapper.findAll('.cust-form__input');
    await inputs[0].setValue('Test Buyer');
    await inputs[1].setValue('+255 700 111 222');
    await wrapper.findAll('.tag-select__chip')[0].trigger('click');
    await submitForm(wrapper);

    expect(names(wrapper)[0]).toBe('Test Buyer');
    expect(wrapper.find('.customers__count').text()).toBe('9');
    expect(wrapper.find('.cust-item__tags').text()).toContain('VIP');
    expect(wrapper.find('.cust-form').isVisible()).toBe(false);
  });

  it('blocks an invalid create and keeps the popup open', async () => {
    const { wrapper } = await mountCustomers();

    await wrapper.findAll('.customers__btn')[1].trigger('click');
    await flushPromises();
    await submitForm(wrapper);

    expect(wrapper.find('.cust-form__error').text()).toBe('This field is required');
    expect(wrapper.find('.cust-form').exists()).toBe(true);
    expect(wrapper.find('.customers__count').text()).toBe('8');
  });

  it('cancels the create popup', async () => {
    const { wrapper } = await mountCustomers();

    await wrapper.findAll('.customers__btn')[1].trigger('click');
    await flushPromises();
    await wrapper.find('.cust-form__cancel').trigger('click');
    await flushPromises();

    expect(wrapper.find('.cust-form').isVisible()).toBe(false);
    expect(names(wrapper)).toHaveLength(8);
  });

  it('edits a customer from the swipe action', async () => {
    const { wrapper } = await mountCustomers();

    await wrapper.findAll('.cust-item__swipe')[0].trigger('click');
    await flushPromises();
    expect(wrapper.find('.cust-form__title').text()).toBe('Edit customer');
    const inputs = wrapper.findAll('.cust-form__input');
    expect((inputs[0].element as HTMLInputElement).value).toBe('Amani Juma');

    await inputs[0].setValue('Amani Juma Jr');
    await inputs[4 - 1].setValue('VIP buyer, Dar es Salaam');
    await submitForm(wrapper);

    expect(names(wrapper)[0]).toBe('Amani Juma Jr');
    expect(wrapper.find('.customers__count').text()).toBe('8');
  });

  it('opens the edit popup from the list edit action', async () => {
    const { wrapper } = await mountCustomers();

    await wrapper.findAll('.cust-item__swipe')[2].trigger('click');
    await flushPromises();

    const inputs = wrapper.findAll('.cust-form__input');
    expect((inputs[0].element as HTMLInputElement).value).toBe('Neema Wanjiru');
  });
});

describe('CustomersView delete', () => {
  it('deletes after confirming the dialog', async () => {
    const { wrapper } = await mountCustomers();

    await wrapper.findAll('.cust-item__swipe')[1].trigger('click');
    await flushPromises();
    expect(wrapper.find('.van-dialog').exists()).toBe(true);
    expect(wrapper.text()).toContain('Delete customer');
    expect(wrapper.find('.customers__confirm-text').text()).toContain('This removes the profile');

    await dialogButton(wrapper, 'Delete').trigger('click');
    await flushPromises();

    expect(names(wrapper)).toHaveLength(7);
    expect(names(wrapper)).not.toContain('Amani Juma');
    expect(wrapper.find('.customers__count').text()).toBe('7');
  });

  it('keeps the customer when the dialog is cancelled', async () => {
    const { wrapper } = await mountCustomers();

    await wrapper.findAll('.cust-item__swipe')[1].trigger('click');
    await flushPromises();
    await dialogButton(wrapper, 'Cancel').trigger('click');
    await flushPromises();

    expect(names(wrapper)).toHaveLength(8);
  });

  it('keeps the dialog hidden until a row is picked', async () => {
    const { wrapper } = await mountCustomers();

    expect(wrapper.find('.van-dialog').exists()).toBe(false);

    await wrapper.findAll('.cust-item__swipe')[1].trigger('click');
    await flushPromises();
    expect(wrapper.find('.van-dialog').isVisible()).toBe(true);

    await dialogButton(wrapper, 'Cancel').trigger('click');
    await flushPromises();
    expect(names(wrapper)).toHaveLength(8);

    // The pending target is rebound, so the next confirm deletes the new row only.
    await wrapper.findAll('.cust-item__swipe')[3].trigger('click');
    await flushPromises();
    await dialogButton(wrapper, 'Delete').trigger('click');
    await flushPromises();

    expect(names(wrapper)).toHaveLength(7);
    expect(names(wrapper)).not.toContain('Neema Wanjiru');
    expect(names(wrapper)).toContain('Amani Juma');
  });
});

describe('CustomersView tags', () => {
  it('creates a tag from the manager and offers it as a filter', async () => {
    const { wrapper } = await mountCustomers();

    await wrapper.findAll('.customers__btn')[0].trigger('click');
    await flushPromises();
    expect(wrapper.find('.tag-manager').exists()).toBe(true);
    expect(wrapper.findAll('.tag-manager__row')).toHaveLength(4);

    await wrapper.find('.tag-manager__create .tag-manager__input').setValue('Retail');
    await wrapper.find('.tag-manager__create').trigger('submit');
    await flushPromises();

    expect(wrapper.findAll('.tag-manager__row')).toHaveLength(5);
    expect(chip(wrapper, 'Retail').exists()).toBe(true);
  });

  it('renames and deletes a tag from the manager', async () => {
    const { wrapper } = await mountCustomers();

    await wrapper.findAll('.customers__btn')[0].trigger('click');
    await flushPromises();

    await wrapper.findAll('.tag-manager__row')[0].findAll('.tag-manager__action')[0].trigger('click');
    await wrapper.findAll('.tag-manager__row')[0].find('.tag-manager__input').setValue('Top buyer');
    await wrapper.findAll('.tag-manager__row')[0].find('.tag-manager__save').trigger('click');
    await flushPromises();
    expect(chip(wrapper, 'Top buyer').exists()).toBe(true);

    await wrapper.findAll('.tag-manager__row')[0].findAll('.tag-manager__action')[1].trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.tag-manager__row')).toHaveLength(3);
    expect(wrapper.findAll('.customers__chip').some((node) => node.text() === 'Top buyer')).toBe(false);
  });

  it('blocks an empty tag name', async () => {
    const { wrapper } = await mountCustomers();

    await wrapper.findAll('.customers__btn')[0].trigger('click');
    await flushPromises();
    await wrapper.find('.tag-manager__create').trigger('submit');
    await flushPromises();

    expect(wrapper.find('.tag-manager__error').text()).toBe('This field is required');
    expect(wrapper.findAll('.tag-manager__row')).toHaveLength(4);
  });
});

describe('CustomersView navigation', () => {
  it('opens the detail route when a row is selected', async () => {
    const { wrapper, router } = await mountCustomers();

    await wrapper.findAll('.cust-item')[2].trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).toBe('/dashboard/customers/u-3');
    expect(router.currentRoute.value.params.id).toBe('u-3');
  });
});
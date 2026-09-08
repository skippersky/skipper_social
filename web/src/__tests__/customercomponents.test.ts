import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import Vant from 'vant';
import CustomerCard from '../components/customer/CustomerCard.vue';
import CustomerForm from '../components/customer/CustomerForm.vue';
import CustomerItem from '../components/customer/CustomerItem.vue';
import CustomerList from '../components/customer/CustomerList.vue';
import CustomerStats from '../components/customer/CustomerStats.vue';
import TagManager from '../components/customer/TagManager.vue';
import TagSelector from '../components/customer/TagSelector.vue';
import { TAG_COLORS, type Customer, type CustomerStats as Stats, type Tag } from '../types';

const plugins = [createPinia(), Vant];

const VIP: Tag = { id: 'tag-vip', name: 'VIP', color: '#B45309' };
const LEAD: Tag = { id: 'tag-lead', name: 'New lead', color: '#5B5BD6' };

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'u-1',
    name: 'Amani Juma',
    phone: '+255 712 345 678',
    email: 'amani@example.com',
    address: 'Dar es Salaam, TZ',
    notes: 'Prefers Swahili',
    tags: [VIP],
    channels: ['whatsapp'],
    conversationCount: 2,
    lastContactAt: Date.now() - 60_000,
    createdAt: Date.now() - 86_400_000,
    ...overrides
  };
}

describe('CustomerItem', () => {
  it('renders contact line, thread count and tags', () => {
    const wrapper = mount(CustomerItem, { props: { customer: customer() }, global: { plugins } });

    expect(wrapper.find('.cust-item__name').text()).toBe('Amani Juma');
    expect(wrapper.find('.cust-item__contact').text()).toBe('+255 712 345 678');
    expect(wrapper.find('.cust-item__threads').text()).toBe('2 conversations');
    expect(wrapper.findAll('.cust-item__tag').map((t) => t.text())).toEqual(['VIP']);
  });

  it('falls back to the email and a never contacted label', () => {
    const wrapper = mount(CustomerItem, {
      props: { customer: customer({ phone: '', lastContactAt: null, conversationCount: 0, tags: [] }) },
      global: { plugins }
    });

    expect(wrapper.find('.cust-item__contact').text()).toBe('amani@example.com');
    expect(wrapper.find('.cust-item__time').text()).toBe('No contact yet');
    expect(wrapper.find('.cust-item__threads').text()).toBe('0 conversations');
    expect(wrapper.find('.cust-item__tags').exists()).toBe(false);
  });

  it('emits select, edit and delete', async () => {
    const wrapper = mount(CustomerItem, { props: { customer: customer() }, global: { plugins } });

    await wrapper.find('.cust-item').trigger('click');
    const swipe = wrapper.findAll('.cust-item__swipe');
    expect(swipe).toHaveLength(2);
    await swipe[0].trigger('click');
    await swipe[1].trigger('click');

    expect(wrapper.emitted('select')).toHaveLength(1);
    expect(wrapper.emitted('edit')).toHaveLength(1);
    expect(wrapper.emitted('delete')).toHaveLength(1);
  });
});

describe('CustomerList', () => {
  it('re-emits row actions with the customer id', async () => {
    const wrapper = mount(CustomerList, {
      props: { customers: [customer({ id: 'u-1' }), customer({ id: 'u-2', name: 'Neema Wanjiru' })] },
      global: { plugins }
    });

    expect(wrapper.findAll('.cust-item')).toHaveLength(2);

    await wrapper.findAll('.cust-item')[1].trigger('click');
    await wrapper.findAll('.cust-item__swipe')[2].trigger('click');
    await wrapper.findAll('.cust-item__swipe')[3].trigger('click');

    expect(wrapper.emitted('select')?.[0]).toEqual(['u-2']);
    expect(wrapper.emitted('edit')?.[0]).toEqual(['u-2']);
    expect(wrapper.emitted('delete')?.[0]).toEqual(['u-2']);
  });
});

describe('CustomerCard', () => {
  it('shows only the filled meta rows', () => {
    const wrapper = mount(CustomerCard, {
      props: { customer: customer({ email: '', address: '', notes: '' }) },
      global: { plugins }
    });

    const labels = wrapper.findAll('.cust-card__meta-row dt').map((n) => n.text());
    expect(labels).toEqual(['Phone']);
    expect(wrapper.find('.cust-card__name').text()).toBe('Amani Juma');
    expect(wrapper.findAll('.cust-card__tag')).toHaveLength(1);
  });

  it('shows every meta row for a complete profile', () => {
    const wrapper = mount(CustomerCard, { props: { customer: customer() }, global: { plugins } });

    expect(wrapper.findAll('.cust-card__meta-row dt').map((n) => n.text())).toEqual(['Phone', 'Email', 'Address', 'Notes']);
    expect(wrapper.find('.cust-card__notes').text()).toBe('Prefers Swahili');
  });

  it('emits edit, delete, add tag and remove tag', async () => {
    const wrapper = mount(CustomerCard, { props: { customer: customer() }, global: { plugins } });

    await wrapper.findAll('.cust-card__btn')[0].trigger('click');
    await wrapper.findAll('.cust-card__btn')[1].trigger('click');
    await wrapper.find('.cust-card__tag-add').trigger('click');
    await wrapper.find('.cust-card__tag-x').trigger('click');

    expect(wrapper.emitted('edit')).toHaveLength(1);
    expect(wrapper.emitted('delete')).toHaveLength(1);
    expect(wrapper.emitted('addTag')).toHaveLength(1);
    expect(wrapper.emitted('removeTag')?.[0]).toEqual(['tag-vip']);
    expect(wrapper.find('.cust-card__tag-x').attributes('aria-label')).toBe('Remove tag VIP');
  });
});

describe('CustomerStats', () => {
  const stats: Stats = {
    conversationCount: 3,
    messageCount: 27,
    firstContactAt: Date.now() - 10 * 86_400_000,
    lastContactAt: Date.now() - 3_600_000,
    activeChannels: ['whatsapp', 'facebook']
  };

  it('renders the four tiles and the channel badges', () => {
    const wrapper = mount(CustomerStats, { props: { stats }, global: { plugins } });

    const values = wrapper.findAll('.cust-stats__value').map((n) => n.text());
    expect(values[0]).toBe('3');
    expect(values[1]).toBe('27');
    expect(wrapper.findAll('.cust-stats__label').map((n) => n.text())).toEqual([
      'Conversations',
      'Messages',
      'First contact',
      'Last contact'
    ]);
    expect(wrapper.findAll('.cust-stats__channel').map((n) => n.text())).toEqual(['WhatsApp', 'Facebook']);
    expect(wrapper.find('.cust-stats__none').exists()).toBe(false);
  });

  it('handles missing stats and channels', () => {
    const empty = mount(CustomerStats, {
      props: { stats: { conversationCount: 0, messageCount: 0, firstContactAt: null, lastContactAt: null, activeChannels: [] } },
      global: { plugins }
    });
    expect(empty.findAll('.cust-stats__value--text').map((n) => n.text())).toEqual(['No contact yet', 'No contact yet']);
    expect(empty.find('.cust-stats__none').text()).toBe('No contact yet');

    const loading = mount(CustomerStats, { props: { stats: null, loading: true }, global: { plugins } });
    expect(loading.find('.cust-stats__loading').exists()).toBe(true);
    expect(loading.attributes()).toMatchObject({});
    expect(loading.find('.cust-stats').attributes('aria-busy')).toBe('true');
  });
});

describe('CustomerForm', () => {
  it('requires a name before submitting', async () => {
    const wrapper = mount(CustomerForm, { props: { tags: [VIP] }, global: { plugins } });

    await wrapper.find('form').trigger('submit');

    expect(wrapper.find('.cust-form__error').text()).toBe('This field is required');
    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.find('.cust-form__title').text()).toBe('New customer');
  });

  it('rejects malformed phone and email values', async () => {
    const wrapper = mount(CustomerForm, { props: { tags: [VIP] }, global: { plugins } });
    const inputs = wrapper.findAll('.cust-form__input');

    await inputs[0].setValue('Amani');
    await inputs[1].setValue('12');
    await inputs[2].setValue('not-an-email');
    await wrapper.find('form').trigger('submit');

    const errors = wrapper.findAll('.cust-form__error').map((n) => n.text());
    expect(errors).toEqual(['Enter a valid phone number', 'Enter a valid email address']);
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('emits a trimmed payload with the selected tags', async () => {
    const wrapper = mount(CustomerForm, { props: { tags: [VIP, LEAD] }, global: { plugins } });
    const inputs = wrapper.findAll('.cust-form__input');

    await inputs[0].setValue('  Amani Juma  ');
    await inputs[1].setValue(' +255 712 345 678 ');
    await inputs[2].setValue(' amani@example.com ');
    await inputs[3].setValue(' Dar es Salaam ');
    await wrapper.find('.cust-form__input--area').setValue(' Wholesale buyer ');
    await wrapper.findAll('.tag-select__chip')[1].trigger('click');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('submit')?.[0]).toEqual([
      {
        name: 'Amani Juma',
        phone: '+255 712 345 678',
        email: 'amani@example.com',
        address: 'Dar es Salaam',
        notes: 'Wholesale buyer',
        tagIds: ['tag-lead']
      }
    ]);
    expect(wrapper.find('.cust-form__submit').text()).toBe('Create customer');
  });

  it('prefills an existing customer and cancels', async () => {
    const wrapper = mount(CustomerForm, { props: { tags: [VIP], customer: customer() }, global: { plugins } });
    const inputs = wrapper.findAll('.cust-form__input');

    expect(wrapper.find('.cust-form__title').text()).toBe('Edit customer');
    expect(wrapper.find('.cust-form__submit').text()).toBe('Save changes');
    expect((inputs[0].element as HTMLInputElement).value).toBe('Amani Juma');
    expect((inputs[3].element as HTMLInputElement).value).toBe('Dar es Salaam, TZ');
    expect((wrapper.find('.cust-form__input--area').element as HTMLTextAreaElement).value).toBe('Prefers Swahili');
    expect(wrapper.findAll('.tag-select__chip.is-active')).toHaveLength(1);

    await wrapper.find('.cust-form__cancel').trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('re-reads the profile when the edited customer changes', async () => {
    const wrapper = mount(CustomerForm, { props: { tags: [VIP], customer: null }, global: { plugins } });
    expect((wrapper.findAll('.cust-form__input')[0].element as HTMLInputElement).value).toBe('');

    await wrapper.setProps({ customer: customer({ id: 'u-2', name: 'Neema Wanjiru', tags: [] }) });

    expect((wrapper.findAll('.cust-form__input')[0].element as HTMLInputElement).value).toBe('Neema Wanjiru');
    expect(wrapper.findAll('.tag-select__chip.is-active')).toHaveLength(0);
  });
});

describe('TagSelector', () => {
  it('toggles tag ids both ways', async () => {
    const wrapper = mount(TagSelector, { props: { tags: [VIP, LEAD], modelValue: ['tag-vip'] }, global: { plugins } });
    const chips = wrapper.findAll('.tag-select__chip');

    expect(chips[0].classes()).toContain('is-active');
    expect(chips[0].attributes('aria-pressed')).toBe('true');

    await chips[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([['tag-vip', 'tag-lead']]);

    await chips[0].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([[]]);
  });
});

describe('TagManager', () => {
  it('shows the empty state without tags', () => {
    const wrapper = mount(TagManager, { props: { tags: [] }, global: { plugins } });

    expect(wrapper.find('.tag-manager__empty').text()).toBe('No tags yet');
    expect(wrapper.find('.tag-manager__title').text()).toBe('Tags');
  });

  it('requires a name before creating a tag', async () => {
    const wrapper = mount(TagManager, { props: { tags: [] }, global: { plugins } });

    await wrapper.find('.tag-manager__create').trigger('submit');

    expect(wrapper.find('.tag-manager__error').text()).toBe('This field is required');
    expect(wrapper.emitted('create')).toBeUndefined();
  });

  it('creates a tag with the picked colour and clears the field', async () => {
    const wrapper = mount(TagManager, { props: { tags: [] }, global: { plugins } });
    const colours = wrapper.findAll('.tag-manager__create .tag-manager__color');
    expect(colours).toHaveLength(TAG_COLORS.length);

    await colours[3].trigger('click');
    await wrapper.find('.tag-manager__create .tag-manager__input').setValue('  Retail  ');
    await wrapper.find('.tag-manager__create').trigger('submit');

    expect(wrapper.emitted('create')?.[0]).toEqual(['Retail', TAG_COLORS[3]]);
    expect((wrapper.find('.tag-manager__create .tag-manager__input').element as HTMLInputElement).value).toBe('');
    expect(wrapper.find('.tag-manager__error').exists()).toBe(false);
  });

  it('edits a tag inline, saves and cancels', async () => {
    const wrapper = mount(TagManager, { props: { tags: [VIP, LEAD] }, global: { plugins } });
    const rowOf = () => wrapper.findAll('.tag-manager__row')[0];
    expect(wrapper.findAll('.tag-manager__row')).toHaveLength(2);
    expect(rowOf().find('.tag-manager__chip').text()).toBe('VIP');

    await rowOf().findAll('.tag-manager__action')[0].trigger('click');
    expect((rowOf().find('.tag-manager__input').element as HTMLInputElement).value).toBe('VIP');

    await rowOf().find('.tag-manager__cancel').trigger('click');
    expect(rowOf().find('.tag-manager__chip').exists()).toBe(true);
    expect(wrapper.emitted('update')).toBeUndefined();

    await rowOf().findAll('.tag-manager__action')[0].trigger('click');
    await rowOf().find('.tag-manager__input').setValue('   ');
    await rowOf().find('.tag-manager__save').trigger('click');
    expect(wrapper.emitted('update')).toBeUndefined();
    expect(rowOf().find('.tag-manager__input').exists()).toBe(true);

    await rowOf().find('.tag-manager__input').setValue('Top buyer');
    await rowOf().findAll('.tag-manager__color')[1].trigger('click');
    await rowOf().find('.tag-manager__save').trigger('click');

    expect(wrapper.emitted('update')?.[0]).toEqual(['tag-vip', { name: 'Top buyer', color: TAG_COLORS[1] }]);
    expect(rowOf().find('.tag-manager__chip').exists()).toBe(true);
  });

  it('ignores a save without an editing row', async () => {
    const wrapper = mount(TagManager, { props: { tags: [VIP] }, global: { plugins } });
    const vm = wrapper.vm as unknown as { submitEdit: () => void; submitCreate: () => void };

    vm.submitEdit();

    expect(wrapper.emitted('update')).toBeUndefined();
  });

  it('emits delete for a tag', async () => {
    const wrapper = mount(TagManager, { props: { tags: [VIP, LEAD] }, global: { plugins } });

    await wrapper.findAll('.tag-manager__row')[1].findAll('.tag-manager__action')[1].trigger('click');

    expect(wrapper.emitted('delete')?.[0]).toEqual(['tag-lead']);
  });
});
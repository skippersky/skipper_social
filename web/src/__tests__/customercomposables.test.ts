import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import * as customerApi from '../api/customer';
import { ApiError } from '../api/http';
import * as tagApi from '../api/tag';
import { useCustomer } from '../composables/useCustomer';
import { useCustomerList } from '../composables/useCustomerList';
import { useCustomerTags } from '../composables/useCustomerTags';
import type { Conversation, Customer, CustomerStats, Tag } from '../types';

vi.mock('../api/customer', () => ({
  getCustomers: vi.fn(),
  getCustomerById: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  deleteCustomer: vi.fn(),
  getCustomerConversations: vi.fn(),
  getCustomerStats: vi.fn()
}));

vi.mock('../api/tag', () => ({
  getTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
  assignTag: vi.fn(),
  removeTag: vi.fn()
}));

const customers = vi.mocked(customerApi);
const tags = vi.mocked(tagApi);

const VIP: Tag = { id: 'tag-vip', name: 'VIP', color: '#B45309' };

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'u-1',
    name: 'Amani Juma',
    tags: [],
    channels: ['whatsapp'],
    conversationCount: 1,
    lastContactAt: 100,
    createdAt: 1,
    ...overrides
  };
}

function conversation(id: string): Conversation {
  return { id, contactName: 'Amani Juma', contactPhone: '+255 712 345 678', lastMessage: 'hi', lastMessageTime: 5, unreadCount: 0 };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  customers.getCustomers.mockResolvedValue({ customers: [customer()], total: 1, hasMore: false });
  customers.getCustomerById.mockResolvedValue(customer());
  customers.getCustomerConversations.mockResolvedValue([conversation('i-1')]);
  customers.deleteCustomer.mockResolvedValue(undefined);
  tags.getTags.mockResolvedValue([VIP]);
  tags.deleteTag.mockResolvedValue(undefined);
  tags.assignTag.mockResolvedValue(undefined);
  tags.removeTag.mockResolvedValue(undefined);
});

describe('useCustomerList', () => {
  it('exposes the filtered directory and paging state', async () => {
    const list = useCustomerList();

    await list.refresh();

    expect(list.customers.value.map((c) => c.id)).toEqual(['u-1']);
    expect(list.total.value).toBe(1);
    expect(list.hasMore.value).toBe(false);
    expect(list.loading.value).toBe(false);
    expect(list.filters.value).toEqual({ query: '', tagId: 'all', channel: 'all' });
    expect(list.findCustomer('u-1')?.name).toBe('Amani Juma');
    expect(list.findCustomer('ghost')).toBeNull();
  });

  it('searches and filters through the api', async () => {
    const list = useCustomerList();

    await list.search('amani');
    expect(list.filters.value.query).toBe('amani');
    expect(customers.getCustomers).toHaveBeenLastCalledWith({ limit: 20, offset: 0, query: 'amani' });

    await list.filterByTag('tag-vip');
    expect(list.filters.value.tagId).toBe('tag-vip');
    expect(customers.getCustomers).toHaveBeenLastCalledWith({ limit: 20, offset: 0, query: 'amani', tagId: 'tag-vip' });

    await list.filterByChannel('whatsapp');
    expect(list.filters.value.channel).toBe('whatsapp');

    await list.filterByTag('all');
    await list.filterByChannel('all');
    expect(customers.getCustomers).toHaveBeenLastCalledWith({ limit: 20, offset: 0, query: 'amani' });
  });

  it('loads more pages on demand', async () => {
    customers.getCustomers.mockResolvedValue({ customers: [customer({ id: 'u-1' })], total: 2, hasMore: true });
    const list = useCustomerList();
    await list.refresh();

    customers.getCustomers.mockResolvedValue({ customers: [customer({ id: 'u-2' })], total: 2, hasMore: false });
    await list.loadMore();

    expect(list.customers.value.map((c) => c.id)).toEqual(['u-1', 'u-2']);
    expect(list.hasMore.value).toBe(false);
  });
});

describe('useCustomer', () => {
  it('loads profile, stats and history together', async () => {
    const stats: CustomerStats = { conversationCount: 1, messageCount: 12, firstContactAt: 1, lastContactAt: 2, activeChannels: ['whatsapp'] };
    customers.getCustomerStats.mockResolvedValue(stats);
    const id = ref<string | null>('u-1');
    const detail = useCustomer(id);

    await detail.loadAll();

    expect(detail.customer.value?.id).toBe('u-1');
    expect(detail.stats.value).toEqual(stats);
    expect(detail.conversations.value.map((c) => c.id)).toEqual(['i-1']);
    expect(detail.loading.value).toBe(false);
    expect(detail.error.value).toBeNull();
  });

  it('does nothing without an id', async () => {
    const detail = useCustomer(ref<string | null>(null));

    await expect(detail.loadCustomer()).resolves.toBeNull();
    await detail.loadAll();

    expect(detail.customer.value).toBeNull();
    expect(detail.conversations.value).toEqual([]);
    expect(customers.getCustomerById).not.toHaveBeenCalled();
    await expect(detail.updateCustomer({ name: 'x' })).resolves.toBe(false);
    await expect(detail.deleteCustomer()).resolves.toBe(false);
  });

  it('keeps stats null when the stats call fails', async () => {
    customers.getCustomerStats.mockRejectedValue(new ApiError('HTTP_500', 'boom'));
    const detail = useCustomer(ref('u-1'));

    await detail.loadCustomerStats();

    expect(detail.stats.value).toBeNull();
  });

  it('updates and deletes the loaded customer', async () => {
    customers.updateCustomer.mockResolvedValue(customer({ name: 'Renamed' }));
    const detail = useCustomer(ref('u-1'));
    await detail.loadCustomer();

    await expect(detail.updateCustomer({ name: 'Renamed' })).resolves.toBe(true);
    expect(detail.customer.value?.name).toBe('Renamed');

    await expect(detail.deleteCustomer()).resolves.toBe(true);
    expect(detail.customer.value).toBeNull();
  });
});

describe('useCustomerTags', () => {
  it('wraps the tag store', async () => {
    const manager = useCustomerTags();

    await manager.loadTags();
    expect(manager.tags.value.map((t) => t.id)).toEqual(['tag-vip']);
    expect(manager.loading.value).toBe(false);
    expect(manager.error.value).toBeNull();

    tags.createTag.mockResolvedValue({ id: 'tag-new', name: 'Retail', color: '#FFB238' });
    await expect(manager.createTag('Retail', '#FFB238')).resolves.toMatchObject({ id: 'tag-new' });
    expect(manager.tags.value).toHaveLength(2);

    tags.updateTag.mockResolvedValue({ id: 'tag-vip', name: 'Top', color: '#B45309' });
    await expect(manager.updateTag('tag-vip', { name: 'Top' })).resolves.toBe(true);

    await expect(manager.assignTag('u-1', 'tag-vip')).resolves.toBe(true);
    await expect(manager.removeTag('u-1', 'tag-vip')).resolves.toBe(true);

    await expect(manager.deleteTag('tag-vip')).resolves.toBe(true);
    expect(manager.tags.value.some((t) => t.id === 'tag-vip')).toBe(false);
  });

  it('surfaces tag errors', async () => {
    tags.getTags.mockRejectedValue(new ApiError('HTTP_403', 'nope'));
    const manager = useCustomerTags();

    await manager.loadTags();

    expect(manager.error.value).toBe('api.403');

    tags.createTag.mockRejectedValue(new ApiError('HTTP_403', 'nope'));
    await expect(manager.createTag('x', '#B45309')).resolves.toBeNull();
    expect(manager.error.value).toBe('api.403');
  });
});
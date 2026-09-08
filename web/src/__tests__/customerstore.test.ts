import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import * as customerApi from '../api/customer';
import { ApiError } from '../api/http';
import { useCustomerStore } from '../stores/customer';
import type { Conversation, Customer, CustomerStats } from '../types';

vi.mock('../api/customer', () => ({
  getCustomers: vi.fn(),
  getCustomerById: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  deleteCustomer: vi.fn(),
  getCustomerConversations: vi.fn(),
  getCustomerStats: vi.fn()
}));

const mocked = vi.mocked(customerApi);

const VIP = { id: 'tag-vip', name: 'VIP', color: '#B45309' };
const LEAD = { id: 'tag-lead', name: 'New lead', color: '#5B5BD6' };

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'u-1',
    name: 'Amani Juma',
    phone: '+255 712 345 678',
    email: 'amani@example.com',
    address: 'Dar es Salaam',
    notes: '',
    tags: [],
    channels: ['whatsapp'],
    conversationCount: 1,
    lastContactAt: 1000,
    createdAt: 500,
    ...overrides
  };
}

function page(customers: Customer[], total = customers.length, hasMore = false) {
  return { customers, total, hasMore };
}

function conversation(id: string): Conversation {
  return { id, contactName: 'Amani Juma', contactPhone: '+255 712 345 678', lastMessage: 'hi', lastMessageTime: 10, unreadCount: 0 };
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  mocked.deleteCustomer.mockResolvedValue(undefined);
  mocked.getCustomerConversations.mockResolvedValue([]);
});

describe('customer store loading', () => {
  it('stores the first page and its paging state', async () => {
    mocked.getCustomers.mockResolvedValue(page([customer({ id: 'u-1' }), customer({ id: 'u-2' })], 42, true));
    const store = useCustomerStore();

    await store.fetchCustomers();

    expect(store.customers.map((c) => c.id)).toEqual(['u-1', 'u-2']);
    expect(store.total).toBe(42);
    expect(store.hasMore).toBe(true);
    expect(store.customerCount).toBe(42);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(mocked.getCustomers).toHaveBeenCalledWith({ limit: 20, offset: 0 });
  });

  it('maps failures to an i18n error key', async () => {
    mocked.getCustomers.mockRejectedValue(new ApiError('HTTP_500', 'boom'));
    const store = useCustomerStore();

    await store.fetchCustomers();

    expect(store.error).toBe('api.500');
    expect(store.customers).toEqual([]);
    expect(store.loading).toBe(false);
  });

  it('falls back to the loaded length when the api omits a total', async () => {
    mocked.getCustomers.mockResolvedValue(page([customer({ id: 'u-1' })], 0, false));
    const store = useCustomerStore();

    await store.fetchCustomers();
    expect(store.customerCount).toBe(1);
  });

  it('appends the next page without duplicates and stops at the end', async () => {
    mocked.getCustomers.mockResolvedValue(page([customer({ id: 'u-1' }), customer({ id: 'u-2' })], 3, true));
    const store = useCustomerStore();
    await store.fetchCustomers();

    mocked.getCustomers.mockResolvedValue(page([customer({ id: 'u-2' }), customer({ id: 'u-3' })], 3, false));
    await store.loadMoreCustomers();

    expect(store.customers.map((c) => c.id)).toEqual(['u-1', 'u-2', 'u-3']);
    expect(store.hasMore).toBe(false);
    expect(mocked.getCustomers).toHaveBeenLastCalledWith({ limit: 20, offset: 2 });

    await store.loadMoreCustomers();
    expect(mocked.getCustomers).toHaveBeenCalledTimes(2);
  });

  it('reports load more failures', async () => {
    mocked.getCustomers.mockResolvedValue(page([customer({ id: 'u-1' })], 5, true));
    const store = useCustomerStore();
    await store.fetchCustomers();

    mocked.getCustomers.mockRejectedValue(new ApiError('TIMEOUT', 'slow'));
    await store.loadMoreCustomers();

    expect(store.error).toBe('api.timeout');
    expect(store.customers).toHaveLength(1);
  });

  it('sends active filters to the api', async () => {
    mocked.getCustomers.mockResolvedValue(page([]));
    const store = useCustomerStore();
    store.setFilters({ query: 'amani', tagId: 'tag-vip', channel: 'whatsapp' });

    await store.fetchCustomers();

    expect(mocked.getCustomers).toHaveBeenCalledWith({ limit: 20, offset: 0, query: 'amani', tagId: 'tag-vip', channel: 'whatsapp' });

    store.resetFilters();
    expect(store.filters).toEqual({ query: '', tagId: 'all', channel: 'all' });
  });
});

describe('customer store filtering', () => {
  const list = [
    customer({ id: 'u-1', name: 'Amani Juma', phone: '+255 712 345 678', email: 'amani@example.com', tags: [VIP], channels: ['whatsapp'] }),
    customer({ id: 'u-3', name: 'Grace Adeyemi', phone: '+234 803 555 0107', email: 'grace@example.com', tags: [LEAD], channels: ['facebook'] }),
    customer({ id: 'u-5', name: 'Kofi Mensah', phone: '+233 24 555 0199', email: 'kofi@example.com', tags: [], channels: ['tiktok'] })
  ];

  function seeded() {
    const store = useCustomerStore();
    store.customers = list.map((c) => ({ ...c }));
    return store;
  }

  it('filters by query across name, phone and email', () => {
    const store = seeded();

    store.setFilters({ query: 'amani' });
    expect(store.filteredCustomers.map((c) => c.id)).toEqual(['u-1']);

    store.setFilters({ query: 'grace@example.com' });
    expect(store.filteredCustomers.map((c) => c.id)).toEqual(['u-3']);

    store.setFilters({ query: '233' });
    expect(store.filteredCustomers.map((c) => c.id)).toEqual(['u-5']);

    store.setFilters({ query: 'nobody' });
    expect(store.filteredCustomers).toEqual([]);
  });

  it('filters by tag and channel together', () => {
    const store = seeded();

    store.setFilters({ tagId: 'tag-vip' });
    expect(store.filteredCustomers.map((c) => c.id)).toEqual(['u-1']);

    store.setFilters({ tagId: 'all', channel: 'facebook' });
    expect(store.filteredCustomers.map((c) => c.id)).toEqual(['u-3']);

    store.setFilters({ channel: 'whatsapp', query: 'kofi' });
    expect(store.filteredCustomers).toEqual([]);
  });
});

describe('customer store mutations', () => {
  it('loads a single customer and its history', async () => {
    mocked.getCustomerById.mockResolvedValue(customer({ id: 'u-1' }));
    mocked.getCustomerConversations.mockResolvedValue([conversation('i-1')]);
    const store = useCustomerStore();

    await expect(store.fetchCustomer('u-1')).resolves.toMatchObject({ id: 'u-1' });
    expect(store.currentCustomer?.id).toBe('u-1');

    await store.loadCustomerConversations('u-1');
    expect(store.conversationsByCustomer['u-1'].map((c) => c.id)).toEqual(['i-1']);
    expect(store.currentCustomerConversations).toHaveLength(1);
  });

  it('clears the current customer when loading fails', async () => {
    mocked.getCustomerById.mockRejectedValue(new ApiError('NOT_FOUND', 'gone'));
    const store = useCustomerStore();

    await expect(store.fetchCustomer('ghost')).resolves.toBeNull();
    expect(store.currentCustomer).toBeNull();
    expect(store.error).toBe('api.404');
  });

  it('returns an empty history and an error key when history fails', async () => {
    mocked.getCustomerConversations.mockRejectedValue(new ApiError('HTTP_503', 'down'));
    const store = useCustomerStore();

    await expect(store.loadCustomerConversations('u-1')).resolves.toEqual([]);
    expect(store.error).toBe('api.500');
    expect(store.currentCustomerConversations).toEqual([]);
  });

  it('creates, updates and deletes customers', async () => {
    mocked.getCustomers.mockResolvedValue(page([customer({ id: 'u-1' })], 1));
    const store = useCustomerStore();
    await store.fetchCustomers();

    mocked.getCustomerById.mockResolvedValue(customer({ id: 'u-1' }));
    mocked.createCustomer.mockResolvedValue(customer({ id: 'u-9', name: 'New Buyer' }));
    await expect(store.createCustomer({ name: 'New Buyer' })).resolves.toBe(true);
    expect(store.customers.map((c) => c.id)).toEqual(['u-9', 'u-1']);
    expect(store.total).toBe(2);

    mocked.updateCustomer.mockResolvedValue(customer({ id: 'u-1', name: 'Renamed' }));
    await store.fetchCustomer('u-1');
    await expect(store.updateCustomer('u-1', { name: 'Renamed' })).resolves.toBe(true);
    expect(store.customers.find((c) => c.id === 'u-1')?.name).toBe('Renamed');
    expect(store.currentCustomer?.name).toBe('Renamed');

    await expect(store.deleteCustomer('u-1')).resolves.toBe(true);
    expect(store.customers.map((c) => c.id)).toEqual(['u-9']);
    expect(store.currentCustomer).toBeNull();
    expect(store.total).toBe(1);
  });

  it('keeps the total at zero when deleting the last record', async () => {
    const store = useCustomerStore();
    await expect(store.deleteCustomer('ghost')).resolves.toBe(true);
    expect(store.total).toBe(0);
  });

  it('reports mutation failures without touching the list', async () => {
    mocked.getCustomers.mockResolvedValue(page([customer({ id: 'u-1' })], 1));
    const store = useCustomerStore();
    await store.fetchCustomers();

    mocked.createCustomer.mockRejectedValue(new ApiError('HTTP_403', 'nope'));
    await expect(store.createCustomer({ name: 'x' })).resolves.toBe(false);
    expect(store.error).toBe('api.403');

    mocked.updateCustomer.mockRejectedValue(new ApiError('HTTP_500', 'boom'));
    await expect(store.updateCustomer('u-1', { name: 'x' })).resolves.toBe(false);

    mocked.deleteCustomer.mockRejectedValue(new ApiError('HTTP_500', 'boom'));
    await expect(store.deleteCustomer('u-1')).resolves.toBe(false);
    expect(store.customers).toHaveLength(1);
  });

  it('patches embedded tags for the list and the open customer', async () => {
    mocked.getCustomers.mockResolvedValue(page([customer({ id: 'u-1' }), customer({ id: 'u-2' })], 2));
    const store = useCustomerStore();
    await store.fetchCustomers();
    mocked.getCustomerById.mockResolvedValue(customer({ id: 'u-1' }));
    await store.fetchCustomer('u-1');

    store.patchCustomerTags('u-1', [VIP, LEAD]);

    expect(store.customers.find((c) => c.id === 'u-1')?.tags.map((t) => t.id)).toEqual(['tag-vip', 'tag-lead']);
    expect(store.customers.find((c) => c.id === 'u-2')?.tags).toEqual([]);
    expect(store.currentCustomer?.tags.map((t) => t.id)).toEqual(['tag-vip', 'tag-lead']);
  });

  it('exposes stats through the api module', async () => {
    const stats: CustomerStats = { conversationCount: 2, messageCount: 9, firstContactAt: 1, lastContactAt: 2, activeChannels: ['whatsapp'] };
    mocked.getCustomerStats.mockResolvedValue(stats);

    await expect(customerApi.getCustomerStats('u-1')).resolves.toEqual(stats);
  });
});
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ApiError } from '../api/http';
import * as tagApi from '../api/tag';
import { useCustomerStore } from '../stores/customer';
import { useTagStore } from '../stores/tag';
import type { Customer, Tag } from '../types';

vi.mock('../api/tag', () => ({
  getTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
  assignTag: vi.fn(),
  removeTag: vi.fn()
}));

const mocked = vi.mocked(tagApi);

const VIP: Tag = { id: 'tag-vip', name: 'VIP', color: '#B45309' };
const LEAD: Tag = { id: 'tag-lead', name: 'New lead', color: '#5B5BD6' };
const WHOLESALE: Tag = { id: 'tag-wholesale', name: 'Wholesale', color: '#B45309' };

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'u-1',
    name: 'Amani Juma',
    tags: [],
    channels: ['whatsapp'],
    conversationCount: 0,
    lastContactAt: null,
    createdAt: 1,
    ...overrides
  };
}

function seedCustomers(list: Customer[], current: Customer | null = null) {
  const store = useCustomerStore();
  store.customers = list.map((c) => ({ ...c }));
  store.currentCustomer = current ? { ...current } : null;
  return store;
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  mocked.deleteTag.mockResolvedValue(undefined);
  mocked.assignTag.mockResolvedValue(undefined);
  mocked.removeTag.mockResolvedValue(undefined);
});

describe('tag store catalogue', () => {
  it('loads tags and groups them by colour', async () => {
    mocked.getTags.mockResolvedValue([VIP, LEAD, WHOLESALE]);
    const store = useTagStore();

    await store.fetchTags();

    expect(store.tags).toHaveLength(3);
    expect(store.tagCount).toBe(3);
    expect(store.tagsByColor['#B45309'].map((t) => t.id)).toEqual(['tag-vip', 'tag-wholesale']);
    expect(store.tagsByColor['#5B5BD6'].map((t) => t.id)).toEqual(['tag-lead']);
    expect(store.loading).toBe(false);
  });

  it('maps load failures to an i18n key', async () => {
    mocked.getTags.mockRejectedValue(new ApiError('HTTP_500', 'boom'));
    const store = useTagStore();

    await store.fetchTags();

    expect(store.error).toBe('api.500');
    expect(store.tags).toEqual([]);
    expect(store.loading).toBe(false);
  });

  it('creates a tag and appends it', async () => {
    mocked.getTags.mockResolvedValue([VIP]);
    mocked.createTag.mockResolvedValue(LEAD);
    const store = useTagStore();
    await store.fetchTags();

    await expect(store.createTag('New lead', '#5B5BD6')).resolves.toEqual(LEAD);
    expect(store.tags.map((t) => t.id)).toEqual(['tag-vip', 'tag-lead']);
    expect(mocked.createTag).toHaveBeenCalledWith({ name: 'New lead', color: '#5B5BD6' });
  });

  it('returns null and an error key when creation fails', async () => {
    mocked.createTag.mockRejectedValue(new ApiError('HTTP_403', 'nope'));
    const store = useTagStore();

    await expect(store.createTag('x', '#B45309')).resolves.toBeNull();
    expect(store.error).toBe('api.403');
    expect(store.tags).toEqual([]);
  });

  it('updates a tag in place', async () => {
    mocked.getTags.mockResolvedValue([VIP, LEAD]);
    mocked.updateTag.mockResolvedValue({ ...VIP, name: 'Top' });
    const store = useTagStore();
    await store.fetchTags();

    await expect(store.updateTag('tag-vip', { name: 'Top' })).resolves.toBe(true);
    expect(store.tags.map((t) => t.name)).toEqual(['Top', 'New lead']);

    mocked.updateTag.mockRejectedValue(new ApiError('TIMEOUT', 'slow'));
    await expect(store.updateTag('tag-vip', { name: 'Slow' })).resolves.toBe(false);
    expect(store.error).toBe('api.timeout');
  });

  it('deletes a tag and strips it from every customer', async () => {
    mocked.getTags.mockResolvedValue([VIP, LEAD]);
    const store = useTagStore();
    await store.fetchTags();

    const customers = seedCustomers(
      [customer({ id: 'u-1', tags: [VIP, LEAD] }), customer({ id: 'u-2', tags: [LEAD] })],
      customer({ id: 'u-1', tags: [VIP, LEAD] })
    );

    await expect(store.deleteTag('tag-vip')).resolves.toBe(true);

    expect(store.tags.map((t) => t.id)).toEqual(['tag-lead']);
    expect(customers.customers.find((c) => c.id === 'u-1')?.tags.map((t) => t.id)).toEqual(['tag-lead']);
    expect(customers.currentCustomer?.tags.map((t) => t.id)).toEqual(['tag-lead']);
    expect(customers.customers.find((c) => c.id === 'u-2')?.tags.map((t) => t.id)).toEqual(['tag-lead']);
  });

  it('reports delete failures and keeps the tag', async () => {
    mocked.getTags.mockResolvedValue([VIP]);
    const store = useTagStore();
    await store.fetchTags();
    seedCustomers([customer({ id: 'u-1', tags: [VIP] })]);

    mocked.deleteTag.mockRejectedValue(new ApiError('HTTP_500', 'boom'));
    await expect(store.deleteTag('tag-vip')).resolves.toBe(false);

    expect(store.tags).toHaveLength(1);
    expect(store.error).toBe('api.500');
  });
});

describe('tag store assignment', () => {
  it('assigns a known tag to a listed customer', async () => {
    mocked.getTags.mockResolvedValue([VIP, LEAD]);
    const store = useTagStore();
    await store.fetchTags();
    const customers = seedCustomers([customer({ id: 'u-1', tags: [VIP] })]);

    await expect(store.assignTag('u-1', 'tag-lead')).resolves.toBe(true);
    expect(customers.customers[0].tags.map((t) => t.id)).toEqual(['tag-vip', 'tag-lead']);
  });

  it('does not duplicate an already assigned tag', async () => {
    mocked.getTags.mockResolvedValue([VIP]);
    const store = useTagStore();
    await store.fetchTags();
    const customers = seedCustomers([customer({ id: 'u-1', tags: [VIP] })]);

    await expect(store.assignTag('u-1', 'tag-vip')).resolves.toBe(true);
    expect(customers.customers[0].tags).toHaveLength(1);
  });

  it('assigns to the open customer when it is not in the list', async () => {
    mocked.getTags.mockResolvedValue([LEAD]);
    const store = useTagStore();
    await store.fetchTags();
    const customers = seedCustomers([], customer({ id: 'u-9', tags: [] }));

    await expect(store.assignTag('u-9', 'tag-lead')).resolves.toBe(true);
    expect(customers.currentCustomer?.tags.map((t) => t.id)).toEqual(['tag-lead']);
  });

  it('stays quiet when the customer or tag is unknown locally', async () => {
    mocked.getTags.mockResolvedValue([VIP]);
    const store = useTagStore();
    await store.fetchTags();
    seedCustomers([customer({ id: 'u-1', tags: [] })]);

    await expect(store.assignTag('ghost', 'tag-vip')).resolves.toBe(true);
    await expect(store.assignTag('u-1', 'ghost-tag')).resolves.toBe(true);
    expect(useCustomerStore().customers[0].tags).toEqual([]);
  });

  it('removes a tag from a customer', async () => {
    mocked.getTags.mockResolvedValue([VIP, LEAD]);
    const store = useTagStore();
    await store.fetchTags();
    const customers = seedCustomers([customer({ id: 'u-1', tags: [VIP, LEAD] })], customer({ id: 'u-1', tags: [VIP, LEAD] }));

    await expect(store.removeTag('u-1', 'tag-vip')).resolves.toBe(true);
    expect(customers.customers[0].tags.map((t) => t.id)).toEqual(['tag-lead']);
    expect(customers.currentCustomer?.tags.map((t) => t.id)).toEqual(['tag-lead']);

    await expect(store.removeTag('ghost', 'tag-lead')).resolves.toBe(true);
  });

  it('reports assignment failures', async () => {
    mocked.getTags.mockResolvedValue([VIP]);
    const store = useTagStore();
    await store.fetchTags();
    seedCustomers([customer({ id: 'u-1', tags: [] })]);

    mocked.assignTag.mockRejectedValue(new ApiError('HTTP_500', 'boom'));
    await expect(store.assignTag('u-1', 'tag-vip')).resolves.toBe(false);
    expect(store.error).toBe('api.500');

    mocked.removeTag.mockRejectedValue(new ApiError('TIMEOUT', 'slow'));
    await expect(store.removeTag('u-1', 'tag-vip')).resolves.toBe(false);
    expect(store.error).toBe('api.timeout');
    expect(useCustomerStore().customers[0].tags).toEqual([]);
  });
});
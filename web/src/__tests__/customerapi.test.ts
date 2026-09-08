import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as customerApi from '../api/customer';
import { ApiError } from '../api/http';
import * as tagApi from '../api/tag';

function jsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve({ success: ok, code: ok ? 'OK' : `HTTP_${status}`, message: '', data })
  } as Response;
}

function offline() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('customer api demo fallback', () => {
  it('lists the seeded directory ordered by last contact', async () => {
    offline();
    const page = await customerApi.getCustomers();

    expect(page.total).toBe(8);
    expect(page.hasMore).toBe(false);
    expect(page.customers.map((c) => c.id)).toEqual(['u-1', 'u-2', 'u-3', 'u-4', 'u-5', 'u-6', 'u-8', 'u-7']);
    expect(page.customers[0]).toMatchObject({ name: 'Amani Juma', conversationCount: 1 });
    expect(page.customers[0].tags.map((t) => t.id)).toEqual(['tag-vip', 'tag-wholesale']);
  });

  it('pages the demo directory', async () => {
    offline();
    const first = await customerApi.getCustomers({ limit: 3, offset: 0 });
    const second = await customerApi.getCustomers({ limit: 3, offset: 3 });

    expect(first.customers.map((c) => c.id)).toEqual(['u-1', 'u-2', 'u-3']);
    expect(first.hasMore).toBe(true);
    expect(second.customers.map((c) => c.id)).toEqual(['u-4', 'u-5', 'u-6']);
  });

  it('filters the demo directory by query, tag and channel', async () => {
    offline();

    const byName = await customerApi.getCustomers({ query: 'amani' });
    expect(byName.customers.map((c) => c.id)).toEqual(['u-1']);

    const byPhone = await customerApi.getCustomers({ query: '803 555' });
    expect(byPhone.customers.map((c) => c.id)).toEqual(['u-3']);

    const byTag = await customerApi.getCustomers({ tagId: 'tag-vip' });
    expect(byTag.customers.map((c) => c.id)).toEqual(['u-1']);

    const byChannel = await customerApi.getCustomers({ channel: 'whatsapp' });
    expect(byChannel.customers.map((c) => c.id)).toEqual(['u-1', 'u-2', 'u-6']);

    const none = await customerApi.getCustomers({ query: 'nobody-here' });
    expect(none).toEqual({ customers: [], hasMore: false, total: 0 });
  });

  it('returns backend pages untouched when the api answers', async () => {
    const payload = { customers: [{ id: 'srv-1', name: 'Real', tags: [], channels: [], conversationCount: 0, lastContactAt: null, createdAt: 1 }], hasMore: true, total: 41 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(payload)));

    await expect(customerApi.getCustomers()).resolves.toEqual(payload);
  });

  it('serialises filters and skips the all placeholders', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ customers: [], hasMore: false, total: 0 }));
    vi.stubGlobal('fetch', fetchMock);

    await customerApi.getCustomers({ query: 'amani', tagId: 'tag-vip', channel: 'whatsapp', limit: 20, offset: 40 });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('query=amani');
    expect(url).toContain('tag=tag-vip');
    expect(url).toContain('channel=whatsapp');
    expect(url).toContain('limit=20');
    expect(url).toContain('offset=40');

    await customerApi.getCustomers({ tagId: 'all', channel: 'all' });
    expect(String(fetchMock.mock.calls[1][0])).toBe('/api/v1/customers');
  });

  it('surfaces server errors instead of falling back to demo data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, 500)));

    await expect(customerApi.getCustomers()).rejects.toBeInstanceOf(ApiError);
  });

  it('reads, creates, updates and deletes demo customers', async () => {
    offline();

    const amani = await customerApi.getCustomerById('u-1');
    expect(amani).toMatchObject({ id: 'u-1', name: 'Amani Juma', phone: '+255 712 345 678' });
    await expect(customerApi.getCustomerById('ghost')).rejects.toThrow('customer not found');

    const created = await customerApi.createCustomer({ name: '  Test Buyer  ', phone: '+255 700 000 000', tagIds: ['tag-lead'] });
    expect(created.name).toBe('Test Buyer');
    expect(created.tags.map((t) => t.id)).toEqual(['tag-lead']);

    const list = await customerApi.getCustomers();
    expect(list.total).toBe(9);
    expect(list.customers.some((c) => c.id === created.id)).toBe(true);

    const saved = await customerApi.updateCustomer(created.id, { name: 'Renamed', phone: '+255 700 000 001', tagIds: [] });
    expect(saved.name).toBe('Renamed');
    expect(saved.tags).toEqual([]);
    await expect(customerApi.updateCustomer('ghost', { name: 'x' })).rejects.toBeInstanceOf(ApiError);

    await customerApi.deleteCustomer(created.id);
    const after = await customerApi.getCustomers();
    expect(after.total).toBe(8);
    expect(after.customers.some((c) => c.id === created.id)).toBe(false);
  });

  it('links demo customers to inbox conversations by phone number', async () => {
    offline();

    const linked = await customerApi.getCustomerConversations('u-1');
    expect(linked.map((c) => c.id)).toEqual(['i-1']);

    const unlinked = await customerApi.getCustomerConversations('u-7');
    expect(unlinked).toEqual([]);

    const noPhone = await customerApi.getCustomerConversations('u-8');
    expect(noPhone).toEqual([]);
  });

  it('computes demo stats from the linked conversation history', async () => {
    offline();

    const stats = await customerApi.getCustomerStats('u-1');
    expect(stats.conversationCount).toBe(1);
    expect(stats.messageCount).toBeGreaterThan(20);
    expect(stats.activeChannels).toEqual(['whatsapp']);
    expect(stats.firstContactAt).not.toBeNull();
    expect(stats.lastContactAt).not.toBeNull();
    expect(stats.firstContactAt! <= stats.lastContactAt!).toBe(true);

    const quiet = await customerApi.getCustomerStats('u-7');
    expect(quiet).toMatchObject({ conversationCount: 0, messageCount: 0, firstContactAt: null, activeChannels: [] });

    await expect(customerApi.getCustomerStats('ghost')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('tag api demo fallback', () => {
  it('seeds four tags and passes backend data through', async () => {
    offline();
    const tags = await tagApi.getTags();
    expect(tags.map((t) => t.id)).toEqual(['tag-vip', 'tag-lead', 'tag-wholesale', 'tag-followup']);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([{ id: 'srv-tag', name: 'Server', color: '#15803D' }])));
    await expect(tagApi.getTags()).resolves.toEqual([{ id: 'srv-tag', name: 'Server', color: '#15803D' }]);
  });

  it('creates, renames and deletes demo tags', async () => {
    offline();

    const created = await tagApi.createTag({ name: '  Retail  ', color: '#FFB238' });
    expect(created.name).toBe('Retail');
    expect(await tagApi.getTags()).toHaveLength(5);

    const renamed = await tagApi.updateTag(created.id, { name: 'Retailers', color: '#DC2626' });
    expect(renamed).toMatchObject({ id: created.id, name: 'Retailers', color: '#DC2626' });
    await expect(tagApi.updateTag('ghost', { name: 'x' })).rejects.toBeInstanceOf(ApiError);

    await tagApi.deleteTag(created.id);
    expect(await tagApi.getTags()).toHaveLength(4);
  });

  it('deleting a tag strips it from customers', async () => {
    offline();
    expect((await customerApi.getCustomerById('u-1')).tags.map((t) => t.id)).toEqual(['tag-vip', 'tag-wholesale']);

    await tagApi.deleteTag('tag-vip');

    expect((await customerApi.getCustomerById('u-1')).tags.map((t) => t.id)).toEqual(['tag-wholesale']);
    expect((await tagApi.getTags()).some((t) => t.id === 'tag-vip')).toBe(false);
  });

  it('assigns and removes tags on a demo customer', async () => {
    offline();

    await tagApi.assignTag('u-4', 'tag-lead');
    expect((await customerApi.getCustomerById('u-4')).tags.map((t) => t.id)).toEqual(['tag-lead']);

    await tagApi.assignTag('u-4', 'tag-lead');
    expect((await customerApi.getCustomerById('u-4')).tags).toHaveLength(1);

    await tagApi.removeTag('u-4', 'tag-lead');
    expect((await customerApi.getCustomerById('u-4')).tags).toEqual([]);

    await expect(tagApi.assignTag('ghost', 'tag-lead')).rejects.toBeInstanceOf(ApiError);
    await expect(tagApi.assignTag('u-4', 'ghost-tag')).rejects.toBeInstanceOf(ApiError);
    await expect(tagApi.removeTag('ghost', 'tag-lead')).rejects.toBeInstanceOf(ApiError);
  });

  it('posts tag assignments to the customer sub resource', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(null));
    vi.stubGlobal('fetch', fetchMock);

    await tagApi.assignTag('u-1', 'tag-vip');
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/v1/customers/u-1/tags/tag-vip');
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST');

    await tagApi.removeTag('u-1', 'tag-vip');
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe('DELETE');
  });
});
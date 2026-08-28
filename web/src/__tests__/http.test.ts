import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiGet, ApiError, apiPost } from '../api/http';

function stubFetch(payload: unknown, ok = true, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: 'status',
    json: async () => payload
  }));
}

describe('apiPost', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns data on success envelope', async () => {
    stubFetch({ success: true, code: 'OK', message: 'success', data: 'hello' });

    await expect(apiPost('/x', { a: 1 })).resolves.toBe('hello');
  });

  it('throws ApiError when envelope fails', async () => {
    stubFetch({ success: false, code: 'TEMPLATE_NOT_FOUND', message: 'nope', data: null });

    await expect(apiPost('/x', {})).rejects.toMatchObject({ code: 'TEMPLATE_NOT_FOUND' });
  });

  it('throws ApiError on http error', async () => {
    stubFetch({ success: false, code: 'INTERNAL_ERROR', message: 'boom', data: null }, false, 500);

    await expect(apiPost('/x', {})).rejects.toBeInstanceOf(ApiError);
  });
});

describe('apiGet', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns data on success envelope', async () => {
    stubFetch({ success: true, code: 'OK', message: 'success', data: [1, 2] });

    await expect(apiGet<number[]>('/y')).resolves.toEqual([1, 2]);
  });

  it('throws ApiError when envelope fails', async () => {
    stubFetch({ success: false, code: 'NOT_FOUND', message: 'gone', data: null }, false, 404);

    await expect(apiGet('/y')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
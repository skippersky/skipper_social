import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiPost } from '../api/http';

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

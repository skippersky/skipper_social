import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiErrorI18nKey, apiGet, ApiError, apiPost, REQUEST_TIMEOUT_MS } from '../api/http';

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
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns data on success envelope', async () => {
    stubFetch({ success: true, code: 'OK', message: 'success', data: [1, 2] });

    await expect(apiGet<number[]>('/y')).resolves.toEqual([1, 2]);
  });

  it('retries once on transient network failure', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, code: 'OK', message: 'ok', data: 'recovered' })
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiGet('/y')).resolves.toBe('recovered');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 404 envelopes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ success: false, code: 'NOT_FOUND', message: 'gone', data: null })
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiGet('/y')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('times out after 10s and retries once', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      })
    ));

    const pending = apiGet('/slow');
    const assertion = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 10);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 10);
    await assertion;
  });
});

describe('apiErrorI18nKey', () => {
  it('maps codes to i18n keys', () => {
    expect(apiErrorI18nKey(new ApiError('TIMEOUT', 'x'))).toBe('api.timeout');
    expect(apiErrorI18nKey(new ApiError('HTTP_401', 'x'))).toBe('api.401');
    expect(apiErrorI18nKey(new ApiError('HTTP_403', 'x'))).toBe('api.403');
    expect(apiErrorI18nKey(new ApiError('HTTP_404', 'x'))).toBe('api.404');
    expect(apiErrorI18nKey(new ApiError('HTTP_500', 'x'))).toBe('api.500');
    expect(apiErrorI18nKey(new ApiError('HTTP_503', 'x'))).toBe('api.500');
    expect(apiErrorI18nKey(new Error('boom'))).toBe('api.network');
  });
});
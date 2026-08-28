import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateCopywriting } from '../api/copywriting';

describe('generateCopywriting', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts to the copywriting endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, code: 'OK', message: 'ok', data: 'copy' })
    });
    vi.stubGlobal('fetch', fetchMock);

    await generateCopywriting({ locale: 'sw', contentType: 'social_post', variables: { content: 'tea' } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toContain('/api/v1/ai/copywriting');
    expect(JSON.parse(options.body)).toMatchObject({ locale: 'sw', contentType: 'social_post' });
  });
});

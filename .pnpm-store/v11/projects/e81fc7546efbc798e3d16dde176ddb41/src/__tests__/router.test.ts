import { describe, expect, it } from 'vitest';
import { router } from '../router';

describe('router', () => {
  it('defines editor and drafts routes', () => {
    const paths = router.getRoutes().map((r) => r.path);

    expect(paths).toContain('/');
    expect(paths).toContain('/editor');
    expect(paths).toContain('/drafts');
  });
});

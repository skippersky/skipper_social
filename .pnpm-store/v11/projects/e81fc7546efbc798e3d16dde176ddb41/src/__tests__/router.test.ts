import { describe, expect, it } from 'vitest';
import { router } from '../router';

describe('router', () => {
  it('defines home, editor, drafts and chat routes', () => {
    const paths = router.getRoutes().map((r) => r.path);

    expect(paths).toContain('/');
    expect(paths).toContain('/editor');
    expect(paths).toContain('/drafts');
    expect(paths).toContain('/chat');
  });
});
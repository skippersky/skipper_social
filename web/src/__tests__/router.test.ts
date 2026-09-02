import { describe, expect, it } from 'vitest';
import { router } from '../router';

describe('router', () => {
  it('defines landing, workspace and auth routes', () => {
    const paths = router.getRoutes().map((r) => r.path);

    const expected = [
      '/',
      '/pricing',
      '/privacy',
      '/terms',
      '/home',
      '/editor',
      '/drafts',
      '/chat',
      '/login',
      '/register',
      '/forgot-password',
      '/settings/profile',
      '/settings/security'
    ];
    for (const path of expected) {
      expect(paths).toContain(path);
    }
  });
});
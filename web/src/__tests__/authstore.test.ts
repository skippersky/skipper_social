import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { DEMO_CREDENTIALS } from '../api/auth';
import { useAuthStore } from '../stores/auth';

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

afterEach(() => vi.unstubAllGlobals());

describe('auth store', () => {
  it('bootstrap leaves the visitor signed out without a session', async () => {
    const auth = useAuthStore();
    await auth.bootstrap();

    expect(auth.isAuthenticated).toBe(false);
    expect(auth.isLoading).toBe(false);
  });

  it('login sets the user and demo flag', async () => {
    const auth = useAuthStore();
    await auth.login(DEMO_CREDENTIALS);

    expect(auth.isAuthenticated).toBe(true);
    expect(auth.demo).toBe(true);
    expect(auth.user?.email).toBe(DEMO_CREDENTIALS.email);
  });

  it('restores the session on a fresh bootstrap', async () => {
    const first = useAuthStore();
    await first.login(DEMO_CREDENTIALS);

    setActivePinia(createPinia());
    const second = useAuthStore();
    await second.bootstrap();

    expect(second.user?.email).toBe(DEMO_CREDENTIALS.email);
  });

  it('logout clears the user', async () => {
    const auth = useAuthStore();
    await auth.login(DEMO_CREDENTIALS);
    await auth.logout();

    expect(auth.isAuthenticated).toBe(false);
  });

  it('updateProfile persists into the session user', async () => {
    const auth = useAuthStore();
    await auth.login(DEMO_CREDENTIALS);
    await auth.updateProfile({ nickname: 'Zuri' });

    expect(auth.user?.nickname).toBe('Zuri');
  });
});
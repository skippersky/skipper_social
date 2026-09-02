import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changePassword,
  DEMO_CREDENTIALS,
  demoMode,
  getMe,
  login,
  logout,
  oauthGoogle,
  register,
  resetPassword,
  updateMe
} from '../api/auth';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

afterEach(() => vi.unstubAllGlobals());

describe('auth demo directory', () => {
  it('logs in with the seeded demo account', async () => {
    const response = await login(DEMO_CREDENTIALS);

    expect(response.demo).toBe(true);
    expect(response.user.email).toBe(DEMO_CREDENTIALS.email);
    expect('password' in response.user).toBe(false);
    expect(demoMode()).toBe(true);
  });

  it('rejects unknown demo credentials', async () => {
    await expect(
      login({ email: DEMO_CREDENTIALS.email, password: 'wrong' })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('registers, auto-signs-in and resolves getMe', async () => {
    const response = await register({ email: 'neema@x.io', password: 'Passw0rd', nickname: 'Neema' });

    expect(response.user.nickname).toBe('Neema');
    await expect(getMe()).resolves.toMatchObject({ email: 'neema@x.io' });
  });

  it('rejects duplicate demo registration', async () => {
    await register({ email: 'dup@x.io', password: 'Passw0rd', nickname: 'A' });

    await expect(
      register({ email: 'dup@x.io', password: 'Passw0rd', nickname: 'B' })
    ).rejects.toMatchObject({ code: 'EMAIL_EXISTS' });
  });

  it('updates the profile of the signed-in demo user', async () => {
    await login(DEMO_CREDENTIALS);

    await updateMe({ nickname: 'Updated', company: 'ACME' });

    await expect(getMe()).resolves.toMatchObject({ nickname: 'Updated', company: 'ACME' });
  });
});
describe('auth demo session lifecycle', () => {
  it('getMe without a session rejects', async () => {
    await expect(getMe()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('logout clears the demo session', async () => {
    await login(DEMO_CREDENTIALS);
    await logout();

    await expect(getMe()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('changes the password and validates the current one', async () => {
    await login(DEMO_CREDENTIALS);
    await expect(changePassword('nope', 'NewPass123')).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });

    await changePassword(DEMO_CREDENTIALS.password, 'NewPass123');
    await logout();

    await expect(login({ email: DEMO_CREDENTIALS.email, password: 'NewPass123' })).resolves.toBeTruthy();
  });

  it('resetPassword resolves in demo mode', async () => {
    await expect(resetPassword('nobody@x.io')).resolves.toBeUndefined();
  });

  it('google oauth reports unavailable in demo mode', async () => {
    await expect(oauthGoogle({ provider: 'google', token: 't' })).rejects.toMatchObject({ code: 'OAUTH_UNAVAILABLE' });
  });
});

describe('auth against a real backend', () => {
  it('returns the backend payload when the endpoint exists', async () => {
    const remote = {
      user: { id: '9', email: 'a@b.c', nickname: 'A', timezone: 'UTC', language: 'en', subscriptionTier: 'free', createdAt: 1 }
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, code: 'OK', message: 'ok', data: remote })
    }));

    const response = await login({ email: 'a@b.c', password: 'x' });

    expect(response.user.id).toBe('9');
    expect(response.demo).toBeUndefined();
  });

  it('surfaces backend 401 without demo fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ success: false, code: 'UNAUTHORIZED', message: 'bad', data: null })
    }));

    await expect(login({ email: 'a@b.c', password: 'x' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(demoMode()).toBe(false);
  });
});
import { apiGet, apiPost, apiPut, ApiError } from './http';
import type {
  AuthResponse,
  LoginRequest,
  OAuthRequest,
  RegisterRequest,
  UpdateMeRequest,
  User
} from '../types';

const AUTH = '/api/v1/auth';
const USERS_KEY = 'ks-demo-users';
const SESSION_KEY = 'ks-demo-session';
const MODE_KEY = 'ks-demo-mode';

/** Ready-made account usable while the backend auth endpoints are absent. */
export const DEMO_CREDENTIALS: LoginRequest = {
  email: 'demo@kilisocial.app',
  password: 'Demo1234'
};

interface DemoUser extends User {
  password: string;
}

/** True once any auth call fell back to the on-device demo directory. */
export function demoMode(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) === '1';
  } catch {
    return false;
  }
}

function enterDemoMode(): void {
  try {
    localStorage.setItem(MODE_KEY, '1');
  } catch {
    /* private mode */
  }
}

/** Backend auth is considered absent on network errors, timeouts and 404s. */
function isMissingBackend(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.code === 'TIMEOUT' || error.code === 'HTTP_404' || error.code === 'NOT_FOUND';
  }
  return true;
}

function readUsers(): DemoUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]') as DemoUser[];
  } catch {
    return [];
  }
}

function writeUsers(users: DemoUser[]): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    /* private mode */
  }
}

function seedUsers(): DemoUser[] {
  const users = readUsers();
  if (!users.some((u) => u.email === DEMO_CREDENTIALS.email)) {
    users.push({
      id: 'demo-1',
      email: DEMO_CREDENTIALS.email,
      password: DEMO_CREDENTIALS.password,
      nickname: 'Demo Merchant',
      company: 'KiliSocial Demo',
      timezone: 'Africa/Dar_es_Salaam',
      language: 'en',
      subscriptionTier: 'free',
      createdAt: 1735689600000
    });
    writeUsers(users);
  }
  return users;
}

function toPublic(user: DemoUser): User {
  const { password, ...publicUser } = user;
  void password;
  return publicUser;
}

function sessionEmail(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function findUser(email: string): DemoUser | undefined {
  return seedUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
}

function requireSessionUser(): DemoUser {
  const email = sessionEmail();
  const user = email ? findUser(email) : undefined;
  if (!user) throw new ApiError('UNAUTHORIZED', 'not signed in');
  return user;
}
export async function login(data: LoginRequest): Promise<AuthResponse> {
  try {
    return await apiPost<AuthResponse>(`${AUTH}/login`, data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    enterDemoMode();
    const user = findUser(data.email);
    if (!user || user.password !== data.password) {
      throw new ApiError('UNAUTHORIZED', 'invalid email or password');
    }
    localStorage.setItem(SESSION_KEY, user.email);
    return { user: toPublic(user), demo: true };
  }
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  try {
    return await apiPost<AuthResponse>(`${AUTH}/register`, data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    enterDemoMode();
    if (findUser(data.email)) {
      throw new ApiError('EMAIL_EXISTS', 'email already registered');
    }
    const user: DemoUser = {
      id: `demo-${Date.now()}`,
      email: data.email,
      password: data.password,
      nickname: data.nickname,
      phone: data.phone,
      timezone: 'Africa/Dar_es_Salaam',
      language: 'en',
      subscriptionTier: 'free',
      createdAt: Date.now()
    };
    writeUsers([...seedUsers(), user]);
    localStorage.setItem(SESSION_KEY, user.email);
    return { user: toPublic(user), demo: true };
  }
}

export async function oauthGoogle(data: OAuthRequest): Promise<AuthResponse> {
  try {
    return await apiPost<AuthResponse>(`${AUTH}/oauth/google`, data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    enterDemoMode();
    throw new ApiError('OAUTH_UNAVAILABLE', 'google sign-in is not available yet');
  }
}

export async function getMe(): Promise<User> {
  try {
    return await apiGet<User>(`${AUTH}/me`);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    enterDemoMode();
    return toPublic(requireSessionUser());
  }
}

export async function updateMe(data: UpdateMeRequest): Promise<User> {
  try {
    return await apiPut<User>(`${AUTH}/me`, data);
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    enterDemoMode();
    const user = requireSessionUser();
    const updated: DemoUser = { ...user, ...data };
    writeUsers(seedUsers().map((u) => (u.id === user.id ? updated : u)));
    return toPublic(updated);
  }
}

export async function resetPassword(email: string): Promise<void> {
  try {
    await apiPost<void>(`${AUTH}/forgot-password`, { email });
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    enterDemoMode();
    // Demo mode: nothing to send; resolve so the UI can confirm the flow.
  }
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  try {
    await apiPost<void>(`${AUTH}/change-password`, { oldPassword, newPassword });
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    enterDemoMode();
    const user = requireSessionUser();
    if (user.password !== oldPassword) {
      throw new ApiError('WRONG_PASSWORD', 'current password is incorrect');
    }
    writeUsers(seedUsers().map((u) => (u.id === user.id ? { ...u, password: newPassword } : u)));
  }
}

export async function logout(): Promise<void> {
  try {
    await apiPost<void>(`${AUTH}/logout`, {});
  } catch (error) {
    if (!isMissingBackend(error)) throw error;
    enterDemoMode();
  } finally {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
}
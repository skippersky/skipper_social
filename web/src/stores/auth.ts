import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import * as authApi from '../api/auth';
import type { LoginRequest, RegisterRequest, UpdateMeRequest, User } from '../types';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const isLoading = ref(true);
  const demo = ref(authApi.demoMode());
  let bootstrapped: Promise<void> | null = null;

  const isAuthenticated = computed(() => user.value !== null);

  /** Restores the session once (httpOnly cookie via getMe, or demo session). */
  function bootstrap(): Promise<void> {
    bootstrapped ??= (async () => {
      try {
        user.value = await authApi.getMe();
        demo.value = authApi.demoMode();
      } catch {
        user.value = null;
      } finally {
        isLoading.value = false;
      }
    })();
    return bootstrapped;
  }

  async function login(request: LoginRequest): Promise<void> {
    const response = await authApi.login(request);
    user.value = response.user;
    demo.value = authApi.demoMode();
  }

  async function register(request: RegisterRequest): Promise<void> {
    const response = await authApi.register(request);
    user.value = response.user;
    demo.value = authApi.demoMode();
  }

  async function refreshUser(): Promise<void> {
    user.value = await authApi.getMe();
  }

  async function updateProfile(data: UpdateMeRequest): Promise<void> {
    user.value = await authApi.updateMe(data);
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      /* best effort: the local session is cleared either way */
    }
    clearSession();
  }

  function clearSession(): void {
    user.value = null;
  }

  return {
    user,
    isLoading,
    demo,
    isAuthenticated,
    bootstrap,
    login,
    register,
    refreshUser,
    updateProfile,
    logout,
    clearSession
  };
});
import { computed, shallowRef } from 'vue';
import { useRouter } from 'vue-router';

import type { UserInfo } from '../types/user';
import {
  getUserByPhone,
  getUserByUserId,
  type UserByUserIdResult,
  type UserLoginStatus,
} from '../api/dingtalk-client';
import { setAuthRequestGate } from '../api/request';
import { clearGzdataToken, setAuthToken } from '../api/timesheet-client';
import { clearSessionCache, getLocalStorage, removeLocalStorage, setLocalStorage } from '../utils/cache';

type HydrateStatus = UserLoginStatus | 'not_found' | 'error';

interface HydrateResult {
  ok: boolean;
  status: HydrateStatus;
  userId: string | null;
}

const userId = shallowRef<string | null>(getLocalStorage('userId'));
const userInfo = shallowRef<UserInfo | null>(null);
const isLoading = shallowRef(false);
const isRestoring = shallowRef(false);
let restorePromise: Promise<boolean> | null = null;

export function useAuthSession() {
  const router = useRouter();

  const isAuthenticated = computed(() => Boolean(userId.value && userInfo.value));

  function applyUserSession(data: UserByUserIdResult): boolean {
    if (data.status !== 'logged_in' || !data.token) {
      return false;
    }

    setAuthToken(data.token);
    userId.value = data.userId;
    setLocalStorage('userId', data.userId);
    userInfo.value = {
      userId: data.userId,
      nickname: data.nickname || 'Unknown',
      phone: data.phone || '',
      department: data.department || 'Unassigned',
    };
    return true;
  }

  function clearRuntimeSession(): void {
    userInfo.value = null;
    clearSessionCache();
    clearGzdataToken();
  }

  function finalizeHydration(response: UserByUserIdResult | null): HydrateResult {
    if (!response) {
      return {
        ok: false,
        status: 'not_found',
        userId: null,
      };
    }

    const ok = applyUserSession(response);
    if (ok) {
      return {
        ok: true,
        status: response.status,
        userId: response.userId,
      };
    }

    clearRuntimeSession();
    if (response.userId) {
      userId.value = response.userId;
      setLocalStorage('userId', response.userId);
    }

    return {
      ok: false,
      status: response.status,
      userId: response.userId,
    };
  }

  async function runAuthTask<T>(task: () => Promise<T>): Promise<T> {
    isLoading.value = true;
    const promise = task();
    setAuthRequestGate(promise);

    try {
      return await promise;
    } finally {
      isLoading.value = false;
      setAuthRequestGate(null);
    }
  }

  async function hydrateUser(targetUserId = userId.value): Promise<HydrateResult> {
    if (!targetUserId) {
      return { ok: false, status: 'not_found', userId: null };
    }

    return runAuthTask(async () => {
      try {
        const response = await getUserByUserId(targetUserId);
        return finalizeHydration(response.data);
      } catch {
        return { ok: false, status: 'error', userId: targetUserId };
      }
    });
  }

  async function hydrateUserByPhone(phone: string): Promise<HydrateResult> {
    const normalizedPhone = phone.replace(/[^\d]/g, '');
    if (!normalizedPhone) {
      return { ok: false, status: 'not_found', userId: null };
    }

    return runAuthTask(async () => {
      try {
        const response = await getUserByPhone(normalizedPhone);
        return finalizeHydration(response.data);
      } catch {
        return { ok: false, status: 'error', userId: null };
      }
    });
  }

  async function restoreAuth(): Promise<boolean> {
    if (restorePromise) {
      return restorePromise;
    }

    isRestoring.value = true;
    restorePromise = (async () => {
      if (!userId.value) {
        redirectToLogin('required');
        return false;
      }

      const result = await hydrateUser(userId.value);
      if (result.ok) {
        return true;
      }

      if (result.status === 'expired' || result.status === 'refreshing') {
        clearRuntimeSession();
        redirectToLogin('expired');
        return false;
      }

      clearSession();
      redirectToLogin('required');
      return false;
    })();

    try {
      return await restorePromise;
    } finally {
      restorePromise = null;
      isRestoring.value = false;
    }
  }

  function storeUserId(nextUserId: string): void {
    userId.value = nextUserId;
    setLocalStorage('userId', nextUserId);
  }

  function clearSession(): void {
    clearRuntimeSession();
    userId.value = null;
    removeLocalStorage('userId');
  }

  function redirectToLogin(reason: 'required' | 'expired' = 'required'): void {
    void router.push({
      name: 'dingtalk-login',
      query: {
        redirect: router.currentRoute.value.fullPath,
        reason,
      },
    });
  }

  function handleTokenExpired(): void {
    clearRuntimeSession();
    redirectToLogin('expired');
  }

  function logout(): void {
    clearSession();
    void router.push({ name: 'dingtalk-login' });
  }

  return {
    userId,
    userInfo,
    isLoading,
    isRestoring,
    isAuthenticated,
    hydrateUser,
    hydrateUserByPhone,
    restoreAuth,
    storeUserId,
    handleTokenExpired,
    logout,
  };
}
